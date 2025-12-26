
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { Organisation } from '../../../../types';
import type { EnergyConsumerCategory, EnergyConsumerSubcategory, EnergyConsumerSubSubcategory } from '../../../../types/em_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import ConsumerCategoryModal from './ConsumerCategoryModal';
import ConsumerSubcategoryModal from './ConsumerSubcategoryModal';
import ConsumerSubSubcategoryModal from './ConsumerSubSubcategoryModal';
import { defaultEnergyConsumerCategories } from '../../../../constants/em_consumer_defaults';

const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const ConsumerTypesTab: React.FC<{ theme: Organisation['theme'] }> = ({ theme }) => {
    const [categories, setCategories] = useState<EnergyConsumerCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, EnergyConsumerSubcategory[]>>({});
    const [subSubcategories, setSubSubcategories] = useState<Record<string, EnergyConsumerSubSubcategory[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; subcategoryOpen: boolean; subSubcategoryOpen: boolean; confirmOpen: boolean;
        selectedCategory: EnergyConsumerCategory | null; selectedSubcategory: EnergyConsumerSubcategory | null; selectedSubSubcategory: EnergyConsumerSubSubcategory | null;
        itemToDelete: { type: 'category' | 'subcategory' | 'subSubcategory', data: any, parentIds: string[] } | null;
    }>({ 
        categoryOpen: false, subcategoryOpen: false, subSubcategoryOpen: false, confirmOpen: false, 
        selectedCategory: null, selectedSubcategory: null, selectedSubSubcategory: null,
        itemToDelete: null 
    });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({});
    
    const collectionRef = collection(db, 'modules/EM/ConsumerTypes');

    useEffect(() => {
        const q = query(collectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) setNeedsSeeding(true);
            else {
                setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnergyConsumerCategory)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleCategory = useCallback((categoryId: string) => {
        const isOpen = !openCategories[categoryId];
        setOpenCategories(prev => ({ ...prev, [categoryId]: isOpen }));
        if (isOpen && !subcategories[categoryId]) {
            const subRef = collection(db, `modules/EM/ConsumerTypes/${categoryId}/Subcategories`);
            onSnapshot(query(subRef, orderBy('name')), (snapshot) => {
                setSubcategories(prev => ({...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnergyConsumerSubcategory))}));
            });
        }
    }, [openCategories, subcategories]);

    const toggleSubcategory = useCallback((categoryId: string, subId: string) => {
        const isOpen = !openSubcategories[subId];
        setOpenSubcategories(prev => ({ ...prev, [subId]: isOpen }));
        if (isOpen && !subSubcategories[subId]) {
            const subSubRef = collection(db, `modules/EM/ConsumerTypes/${categoryId}/Subcategories/${subId}/SubSubcategories`);
            onSnapshot(query(subSubRef, orderBy('name')), (snapshot) => {
                setSubSubcategories(prev => ({...prev, [subId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnergyConsumerSubSubcategory))}));
            });
        }
    }, [openSubcategories, subSubcategories]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batchSize = 400; // Firestore limit is 500
            let batch = writeBatch(db);
            let count = 0;

            const commitBatch = async () => {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            };

            for (const cat of defaultEnergyConsumerCategories) {
                const catRef = doc(collectionRef, cat.categoryId);
                batch.set(catRef, { name: cat.categoryName, code: cat.categoryId, enabled: true });
                count++;
                if (count >= batchSize) await commitBatch();

                for (const sub of cat.subCategories) {
                    const subRef = doc(collection(catRef, 'Subcategories'), sub.subCategoryId);
                    batch.set(subRef, { name: sub.subCategoryName, code: sub.subCategoryId, enabled: true });
                    count++;
                    if (count >= batchSize) await commitBatch();

                    for (const subSubName of sub.subSubCategories) {
                        // Generate ID from name
                        const subSubId = subSubName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
                        const subSubRef = doc(collection(subRef, 'SubSubcategories'), subSubId);
                        batch.set(subSubRef, { name: subSubName, enabled: true });
                        count++;
                        if (count >= batchSize) await commitBatch();
                    }
                }
            }
            if (count > 0) await batch.commit();
        } catch (error) { 
            console.error("Error seeding consumer data:", error); 
        } finally { 
            setIsSeeding(false); 
        }
    };
    
    const handleSaveCategory = async (data: Omit<EnergyConsumerCategory, 'id'>, code: string) => {
        await setDoc(doc(collectionRef, code), { ...data, enabled: true });
    };

    const handleSaveSubcategory = async (data: Omit<EnergyConsumerSubcategory, 'id'>, code: string) => {
        if (!modalState.selectedCategory) return;
        const subRef = collection(db, `modules/EM/ConsumerTypes/${modalState.selectedCategory.id}/Subcategories`);
        await setDoc(doc(subRef, code), { ...data, enabled: true });
    };

    const handleSaveSubSubcategory = async (data: Omit<EnergyConsumerSubSubcategory, 'id'>) => {
        if (!modalState.selectedCategory || !modalState.selectedSubcategory) return;
        const subSubId = data.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        const subSubRef = collection(db, `modules/EM/ConsumerTypes/${modalState.selectedCategory.id}/Subcategories/${modalState.selectedSubcategory.id}/SubSubcategories`);
        await setDoc(doc(subSubRef, subSubId), { ...data, enabled: true });
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const { type, data, parentIds } = modalState.itemToDelete;
        try {
            if (type === 'category') {
                await deleteDoc(doc(collectionRef, data.id));
            } else if (type === 'subcategory') {
                await deleteDoc(doc(db, `modules/EM/ConsumerTypes/${parentIds[0]}/Subcategories`, data.id));
            } else if (type === 'subSubcategory') {
                await deleteDoc(doc(db, `modules/EM/ConsumerTypes/${parentIds[0]}/Subcategories/${parentIds[1]}/SubSubcategories`, data.id));
            }
        } catch (error) { 
            console.error("Delete failed:", error); 
        } finally { 
            setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); 
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400 italic">Synchronizing catalog...</div>;

    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No consumer classifications found. Populate the database with defaults to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Consumers</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Consumer Classifications</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))} className="!w-auto">Add Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                            <button onClick={() => toggleCategory(category.id)} className="flex-1 flex items-center text-left focus:outline-none">
                                <ChevronDownIcon />
                                <h4 className="font-bold text-slate-800 ml-2">{category.name} ({subcategories[category.id]?.length || 0})</h4>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: null }))} className="!py-1 !px-3 text-[10px] uppercase font-black !w-auto">Add Sub</Button>
                                <button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: category }))} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"><EditIcon /></button>
                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'category', data: category, parentIds: [] } }))} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"><DeleteIcon /></button>
                            </div>
                        </div>
                        {openCategories[category.id] && (
                            <div className="divide-y divide-slate-100 pl-4 bg-white">
                                {(subcategories[category.id] || []).map(sub => (
                                    <div key={sub.id} className="border-l-2 border-slate-100">
                                        <div className="p-4 flex justify-between items-start hover:bg-slate-50 transition-colors">
                                            <button onClick={() => toggleSubcategory(category.id, sub.id)} className="flex-1 flex items-center text-left focus:outline-none">
                                                <ChevronDownIcon />
                                                <div className="ml-2">
                                                    <p className="font-medium text-slate-900">{sub.name} <span className="font-mono text-[10px] text-slate-400 ml-2">[{sub.code}]</span></p>
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Sub-Items: {subSubcategories[sub.id]?.length || 0}</p>
                                                </div>
                                            </button>
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => setModalState(p => ({ ...p, subSubcategoryOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedSubSubcategory: null }))} className="!py-1 !px-3 text-[10px] uppercase font-black !w-auto">Add Item</Button>
                                                <button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: sub }))} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><EditIcon /></button>
                                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'subcategory', data: sub, parentIds: [category.id] } }))} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                        {openSubcategories[sub.id] && (
                                            <div className="divide-y divide-slate-50 pl-8 bg-slate-50/30">
                                                {(subSubcategories[sub.id] || []).map(subSub => (
                                                    <div key={subSub.id} className="p-3 flex justify-between items-center hover:bg-white transition-colors border-l-2 border-indigo-100">
                                                        <span className="text-sm text-slate-700 font-medium">{subSub.name}</span>
                                                        <div className="flex items-center space-x-2">
                                                            <button onClick={() => setModalState(p => ({ ...p, subSubcategoryOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedSubSubcategory: subSub }))} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"><EditIcon /></button>
                                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'subSubcategory', data: subSub, parentIds: [category.id, sub.id] } }))} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"><DeleteIcon /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {subSubcategories[sub.id]?.length === 0 && <p className="p-4 text-xs text-slate-400 italic">No items defined.</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {subcategories[category.id]?.length === 0 && <p className="p-4 text-xs text-slate-400 italic">No sub-classifications defined.</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ConsumerCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p => ({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <ConsumerSubcategoryModal isOpen={modalState.subcategoryOpen} onClose={() => setModalState(p => ({...p, subcategoryOpen: false}))} onSave={handleSaveSubcategory} subcategory={modalState.selectedSubcategory} />
            <ConsumerSubSubcategoryModal isOpen={modalState.subSubcategoryOpen} onClose={() => setModalState(p => ({...p, subSubcategoryOpen: false}))} onSave={handleSaveSubSubcategory} subSubcategory={modalState.selectedSubSubcategory} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message="This will remove the item from the global catalog. This cannot be undone." />
        </div>
    );
};

export default ConsumerTypesTab;
