

// components/modules/she/HazardsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
// FIX: addDoc was missing from the import
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { HazardCategory, Hazard } from '../../../types/she_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import HazardCategoryModal from '../she/HazardCategoryModal'; // Re-using modals from SHE
import HazardModal from '../she/HazardModal'; // Re-using modals from SHE
import { defaultSheHazards } from '../../../constants/she_hazards';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
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