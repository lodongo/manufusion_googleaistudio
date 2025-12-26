
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { RiskCategory, RiskSubcategory } from '../../../types/am_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import RiskCategoryModal from './RiskCategoryModal';
import RiskSubcategoryModal from './RiskSubcategoryModal';
import { defaultRisks } from '../../../constants/am_risks';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

type ItemToDelete = { type: 'category', data: RiskCategory } | { type: 'subcategory', data: RiskSubcategory, parentId: string };

const RisksTab: React.FC = () => {
    const [categories, setCategories] = useState<RiskCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, RiskSubcategory[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState<RiskCategory | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<RiskSubcategory | null>(null);
    const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
    
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
    
    const categoriesCollectionRef = collection(db, 'modules/AM/Risks');

    useEffect(() => {
        const q = query(categoriesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
                setLoading(false);
            } else {
                setCategories(snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as RiskCategory)));
                setNeedsSeeding(false);
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching risk categories:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleAccordion = useCallback((code: string) => {
        const isOpen = !openAccordions[code];
        setOpenAccordions(prev => ({ ...prev, [code]: isOpen }));

        if (isOpen && !subcategories[code]) {
            const subcategoriesRef = collection(categoriesCollectionRef, code, 'Subcategories');
            onSnapshot(query(subcategoriesRef, orderBy('name')), (snapshot) => {
                setSubcategories(prev => ({ ...prev, [code]: snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as RiskSubcategory)) }));
            });
        }
    }, [openAccordions, subcategories]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultRisks) {
                const categoryRef = doc(categoriesCollectionRef, category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, enabled: true });
                for (const subcategory of category.subcategories) {
                    const subcategoryRef = doc(collection(categoryRef, 'Subcategories'), subcategory.code);
                    batch.set(subcategoryRef, subcategory);
                }
            }
            await batch.commit();
        } catch (error) {
            console.error("Error seeding risk data:", error);
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleSaveCategory = async (data: Omit<RiskCategory, 'code'>, code: string) => {
        await setDoc(doc(categoriesCollectionRef, code), data);
    };

    const handleSaveSubcategory = async (data: Omit<RiskSubcategory, 'code'>, code: string) => {
        if (!selectedCategory) return;
        await setDoc(doc(categoriesCollectionRef, selectedCategory.code, 'Subcategories', code), data);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        const { type, data } = itemToDelete;

        try {
            if (type === 'category') {
                const subcategoriesRef = collection(categoriesCollectionRef, data.code, 'Subcategories');
                const subcategoriesSnap = await getDocs(query(subcategoriesRef));
                const batch = writeBatch(db);
                subcategoriesSnap.docs.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(categoriesCollectionRef, data.code));
                await batch.commit();
            } else if (type === 'subcategory') {
                await deleteDoc(doc(categoriesCollectionRef, itemToDelete.parentId, 'Subcategories', data.code));
            }
        } catch (error) {
            console.error("Delete failed:", error);
        } finally {
            setIsConfirmModalOpen(false);
            setItemToDelete(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
    }
    
    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
                <p className="text-gray-500 mb-4">No maintenance risks found. Populate the database with a default set to begin.</p>
                <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Risks</Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Risk Classification</h3>
                    <p className="mt-1 text-sm text-gray-600">Manage risk categories associated with maintenance failures.</p>
                </div>
                <Button onClick={() => { setSelectedCategory(null); setIsCategoryModalOpen(true); }}>Add New Category</Button>
            </div>

            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.code} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleAccordion(category.code)}
                            aria-expanded={!!openAccordions[category.code]}
                            aria-controls={`panel-risk-${category.code}`}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                        >
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                {category.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }}></span>}
                                {category.name} ({subcategories[category.code]?.length || 0})
                            </h4>
                            <div className={`${openAccordions[category.code] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordions[category.code] && (
                            <div id={`panel-risk-${category.code}`} className="bg-white divide-y divide-gray-200">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <p className="text-sm text-slate-500 italic">{category.description}</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setSelectedCategory(category); setIsCategoryModalOpen(true); }} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit Category</button>
                                        <button onClick={() => { setItemToDelete({type: 'category', data: category}); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                                    </div>
                                </div>
                                
                                {subcategories[category.code] === undefined ? <p className="p-4 text-sm text-gray-500">Loading...</p> 
                                : subcategories[category.code].length > 0 ? subcategories[category.code].map(sub => (
                                    <div key={sub.code} className="p-4 flex justify-between items-start hover:bg-gray-50 ml-4">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{sub.name} <span className="text-gray-400 font-mono text-xs">({sub.code})</span></p>
                                            <p className="text-sm text-gray-600">{sub.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <button onClick={() => { setSelectedCategory(category); setSelectedSubcategory(sub); setIsSubcategoryModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors"><EditIcon /></button>
                                            <button onClick={() => { setItemToDelete({type: 'subcategory', data: sub, parentId: category.code}); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                )) : <div className="p-4 flex justify-between items-center">
                                        <p className="text-sm text-gray-500">No subcategories defined.</p>
                                        <Button onClick={() => { setSelectedCategory(category); setSelectedSubcategory(null); setIsSubcategoryModalOpen(true); }} className="!py-1 !px-3 text-xs !w-auto">Add Subcategory</Button>
                                     </div>
                                }
                                {subcategories[category.code] && subcategories[category.code].length > 0 && (
                                     <div className="p-3 bg-slate-50 border-t border-slate-100">
                                         <Button onClick={() => { setSelectedCategory(category); setSelectedSubcategory(null); setIsSubcategoryModalOpen(true); }} className="!py-1 !px-3 text-xs !w-auto">Add Subcategory</Button>
                                     </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <RiskCategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} category={selectedCategory} />
            <RiskSubcategoryModal isOpen={isSubcategoryModalOpen} onClose={() => setIsSubcategoryModalOpen(false)} onSave={handleSaveSubcategory} subcategory={selectedSubcategory} parentCategoryCode={selectedCategory?.code}/>
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${itemToDelete?.data.name}"? If this is a category, all its subcategories will also be deleted. This action cannot be undone.`} />
        </div>
    );
};

export default RisksTab;
