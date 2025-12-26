import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { IndustryCategory, IndustrySubcategory } from '../../types';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';
import IndustryCategoryModal from './IndustryCategoryModal';
import IndustrySubcategoryModal from './IndustrySubcategoryModal';
import { defaultIndustries } from '../../constants/industries';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const IndustryTypesTab: React.FC = () => {
    const [categories, setCategories] = useState<IndustryCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, IndustrySubcategory[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState<IndustryCategory | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<IndustrySubcategory | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{type: 'category' | 'subcategory', data: IndustryCategory | IndustrySubcategory} | null>(null);
    
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    
    const categoriesCollectionRef = collection(db, 'settings', 'memsSetup', 'industry_categories');

    useEffect(() => {
        const q = query(categoriesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
                setLoading(false);
                return;
            }
            
            setNeedsSeeding(false);
            const catsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndustryCategory));
            setCategories(catsData);

            const subcategoryPromises = catsData.map(cat => 
                getDocs(query(collection(categoriesCollectionRef, cat.id, 'Industry_subcategories'), orderBy('name')))
            );

            const subcategorySnapshots = await Promise.all(subcategoryPromises);
            const subsData: Record<string, IndustrySubcategory[]> = {};
            subcategorySnapshots.forEach((subSnapshot, index) => {
                const categoryId = catsData[index].id;
                subsData[categoryId] = subSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndustrySubcategory));
            });
            setSubcategories(subsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching industry types:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultIndustries) {
                const categoryRef = doc(categoriesCollectionRef);
                batch.set(categoryRef, { name: category.name, description: category.description, enabled: true });
                for (const subcategory of category.subcategories) {
                    const subcategoryRef = doc(collection(categoryRef, 'Industry_subcategories'));
                    batch.set(subcategoryRef, subcategory);
                }
            }
            await batch.commit();
        } catch (error) {
            console.error("Error seeding industry data:", error);
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleSaveCategory = async (data: Omit<IndustryCategory, 'id'>, id?: string) => {
        if (id) {
            await updateDoc(doc(categoriesCollectionRef, id), data);
        } else {
            await addDoc(categoriesCollectionRef, data);
        }
    };

    const handleSaveSubcategory = async (data: Omit<IndustrySubcategory, 'id'>, id?: string) => {
        if (!selectedCategory) return;
        const subcategoriesRef = collection(categoriesCollectionRef, selectedCategory.id, 'Industry_subcategories');
        if (id) {
            await updateDoc(doc(subcategoriesRef, id), data);
        } else {
            await addDoc(subcategoriesRef, data);
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;

        if (itemToDelete.type === 'category') {
            await deleteDoc(doc(categoriesCollectionRef, itemToDelete.data.id));
        } else if (itemToDelete.type === 'subcategory') {
            const parentCategory = categories.find(c => subcategories[c.id]?.some(s => s.id === itemToDelete.data.id));
            if (parentCategory) {
                 await deleteDoc(doc(categoriesCollectionRef, parentCategory.id, 'Industry_subcategories', itemToDelete.data.id));
            }
        }
        setIsConfirmModalOpen(false);
        setItemToDelete(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
    }
    
    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
                <p className="text-gray-500 mb-4">No industry types found. Populate the database with a default set of standard industries to begin.</p>
                <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Industries</Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Industry Classification</h3>
                    <p className="mt-1 text-sm text-gray-600">Manage industry categories and their specific sub-sectors.</p>
                </div>
                <Button onClick={() => { setSelectedCategory(null); setIsCategoryModalOpen(true); }}>Add New Category</Button>
            </div>

            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                            <button onClick={() => setOpenAccordion(openAccordion === category.id ? null : category.id)} className="flex-1 flex items-center text-left focus:outline-none">
                                <h4 className="font-semibold text-gray-800">{category.name} ({subcategories[category.id]?.length || 0})</h4>
                                <div className={`ml-4 ${openAccordion === category.id ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => { setSelectedCategory(category); setIsSubcategoryModalOpen(true); }} className="!py-1 !px-3 text-xs">Add Subcategory</Button>
                                <button onClick={() => { setSelectedCategory(category); setIsCategoryModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                <button onClick={() => { setItemToDelete({type: 'category', data: category }); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                            </div>
                        </div>
                        {openAccordion === category.id && (
                            <div className="bg-white divide-y divide-gray-200">
                                {subcategories[category.id] && subcategories[category.id].length > 0 ? subcategories[category.id].map(sub => (
                                    <div key={sub.id} className="p-4 flex justify-between items-start hover:bg-gray-50">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{sub.name}</p>
                                            <p className="text-sm text-gray-600">{sub.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sub.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {sub.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <button onClick={() => { setSelectedCategory(category); setSelectedSubcategory(sub); setIsSubcategoryModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                            <button onClick={() => { setItemToDelete({type: 'subcategory', data: sub}); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                )) : <p className="p-4 text-sm text-gray-500">No subcategories defined.</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <IndustryCategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} category={selectedCategory} />
            <IndustrySubcategoryModal isOpen={isSubcategoryModalOpen} onClose={() => setIsSubcategoryModalOpen(false)} onSave={handleSaveSubcategory} subcategory={selectedSubcategory} categoryId={selectedCategory?.id} />
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${itemToDelete?.data.name}"? This action cannot be undone.`} confirmButtonText="Delete" />
        </div>
    );
};

export default IndustryTypesTab;