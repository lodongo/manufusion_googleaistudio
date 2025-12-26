
// components/modules/she/HazardsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
// FIX: addDoc was missing from the import
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { HazardCategory, Hazard } from '../../../types/she_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import HazardCategoryModal from './HazardCategoryModal';
import HazardModal from './HazardModal';
import { defaultSheHazards } from '../../../constants/she_hazards';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;


type ItemToDelete = { type: 'category', data: HazardCategory } | { type: 'hazard', data: Hazard, parentId: string };

export const HazardsTab: React.FC = () => {
    const [categories, setCategories] = useState<HazardCategory[]>([]);
    const [hazards, setHazards] = useState<Record<string, Hazard[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; hazardOpen: boolean; confirmOpen: boolean;
        selectedCategory: HazardCategory | null; selectedHazard: Hazard | null;
        itemToDelete: ItemToDelete | null;
    }>({ categoryOpen: false, hazardOpen: false, confirmOpen: false, selectedCategory: null, selectedHazard: null, itemToDelete: null });

    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
    
    const categoriesCollectionRef = collection(db, 'modules/SHE/Hazards');

    useEffect(() => {
        const q = query(categoriesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HazardCategory)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleAccordion = useCallback((categoryId: string) => {
        const isOpen = !openAccordions[categoryId];
        setOpenAccordions(prev => ({ ...prev, [categoryId]: isOpen }));

        if (isOpen && !hazards[categoryId]) {
            const hazardsRef = collection(categoriesCollectionRef, categoryId, 'Hazards');
            onSnapshot(query(hazardsRef, orderBy('name')), (snapshot) => {
                setHazards(prev => ({ ...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hazard)) }));
            });
        }
    }, [openAccordions, hazards]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultSheHazards) {
                const categoryRef = doc(categoriesCollectionRef, category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, code: category.code, enabled: true });
                for (const hazard of category.hazards) {
                    const hazardRef = doc(collection(categoryRef, 'Hazards'));
                    batch.set(hazardRef, hazard);
                }
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding hazard data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveCategory = async (data: Omit<HazardCategory, 'id'>, id?: string) => {
        const docRef = id ? doc(categoriesCollectionRef, id) : doc(categoriesCollectionRef, data.code);
        if(id) await updateDoc(docRef, data as any);
        else await setDoc(docRef, data);
    };

    const handleSaveHazard = async (data: Omit<Hazard, 'id'>, id?: string) => {
        if (!modalState.selectedCategory) return;
        const hazardsRef = collection(categoriesCollectionRef, modalState.selectedCategory.id, 'Hazards');
        if (id) await updateDoc(doc(hazardsRef, id), data);
        else await addDoc(hazardsRef, data);
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const { type, data } = modalState.itemToDelete;
        try {
            if (type === 'category') {
                const hazardsRef = collection(categoriesCollectionRef, data.id, 'Hazards');
                const hazardsSnap = await getDocs(query(hazardsRef));
                const batch = writeBatch(db);
                hazardsSnap.docs.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(categoriesCollectionRef, data.id));
                await batch.commit();
            } else if (type === 'hazard') {
                await deleteDoc(doc(categoriesCollectionRef, modalState.itemToDelete.parentId, 'Hazards', data.id));
            }
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };
    
    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No hazard data found. Populate the database with a default set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Hazards</Button>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Hazard Catalog</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))}>Add New Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleAccordion(category.id)}
                            aria-expanded={!!openAccordions[category.id]}
                            aria-controls={`panel-hazard-${category.id}`}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                        >
                             <h4 className="font-semibold text-gray-800">{category.name} ({hazards[category.id]?.length || 0})</h4>
                             <div className={`${openAccordions[category.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordions[category.id] && (
                            <div id={`panel-hazard-${category.id}`} className="bg-white divide-y divide-gray-200">
                                <div className="p-3"><Button onClick={() => setModalState(p => ({...p, hazardOpen: true, selectedCategory: category, selectedHazard: null}))} className="!w-auto !py-1 !px-3 text-xs">Add Hazard</Button></div>
                                {(hazards[category.id] || []).map(hazard => (
                                    <div key={hazard.id} className="p-4 flex justify-between items-start hover:bg-gray-50 ml-4">
                                        <div>
                                            <p className="font-medium text-gray-900">{hazard.name}</p>
                                            <p className="text-sm text-gray-600">{hazard.description}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => setModalState(p => ({ ...p, hazardOpen: true, selectedCategory: category, selectedHazard: hazard }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'hazard', data: hazard, parentId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <HazardCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p => ({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <HazardModal isOpen={modalState.hazardOpen} onClose={() => setModalState(p => ({...p, hazardOpen: false}))} onSave={handleSaveHazard} hazard={modalState.selectedHazard} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${modalState.itemToDelete?.data.name}"? This action cannot be undone.`} />
        </div>
    );
};
