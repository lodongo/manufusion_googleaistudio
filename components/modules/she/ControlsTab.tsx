
// components/modules/she/ControlsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { ControlCategory, Control } from '../../../types/she_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import ControlCategoryModal from './ControlCategoryModal';
import ControlModal from './ControlModal';
import { defaultSheControls } from '../../../constants/she_controls';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

type ItemToDelete = { type: 'category', data: ControlCategory } | { type: 'control', data: Control, parentId: string };

const ControlsTab: React.FC = () => {
    const [categories, setCategories] = useState<ControlCategory[]>([]);
    const [controls, setControls] = useState<Record<string, Control[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; controlOpen: boolean; confirmOpen: boolean;
        selectedCategory: ControlCategory | null; selectedControl: Control | null;
        itemToDelete: ItemToDelete | null;
    }>({ categoryOpen: false, controlOpen: false, confirmOpen: false, selectedCategory: null, selectedControl: null, itemToDelete: null });

    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
    
    const categoriesCollectionRef = collection(db, 'modules/SHE/Controls');

    useEffect(() => {
        const q = query(categoriesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) setNeedsSeeding(true);
            else {
                setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ControlCategory)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleAccordion = useCallback((categoryId: string) => {
        const isOpen = !openAccordions[categoryId];
        setOpenAccordions(prev => ({ ...prev, [categoryId]: isOpen }));
        if (isOpen && !controls[categoryId]) {
            const controlsRef = collection(categoriesCollectionRef, categoryId, 'Controls');
            onSnapshot(query(controlsRef, orderBy('name')), (snapshot) => {
                setControls(prev => ({...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control))}));
            });
        }
    }, [openAccordions, controls]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultSheControls) {
                const categoryRef = doc(categoriesCollectionRef, category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, code: category.code, enabled: true });
                for (const control of category.controls) {
                    const controlRef = doc(collection(categoryRef, 'Controls'));
                    batch.set(controlRef, control);
                }
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding control data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveCategory = async (data: Omit<ControlCategory, 'id'>, id?: string) => {
        const docRef = id ? doc(categoriesCollectionRef, id) : doc(categoriesCollectionRef, data.code);
        if(id) await updateDoc(docRef, data as any);
        else await setDoc(docRef, data);
    };

    const handleSaveControl = async (data: Omit<Control, 'id'>, id?: string) => {
        if (!modalState.selectedCategory) return;
        const controlsRef = collection(categoriesCollectionRef, modalState.selectedCategory.id, 'Controls');
        if (id) await updateDoc(doc(controlsRef, id), data);
        else await addDoc(controlsRef, data);
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const { type, data } = modalState.itemToDelete;
        try {
            if (type === 'category') {
                const subCollectionRef = collection(categoriesCollectionRef, data.id, 'Controls');
                const subDocs = await getDocs(subCollectionRef);
                const batch = writeBatch(db);
                subDocs.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(categoriesCollectionRef, data.id));
                await batch.commit();
            } else if (type === 'control') {
                await deleteDoc(doc(categoriesCollectionRef, modalState.itemToDelete.parentId, 'Controls', data.id));
            }
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };
    
    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No control data found. Populate the database with a default set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Controls</Button>
        </div>
    );
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Controls Catalog (Hierarchy of Controls)</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))}>Add New Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleAccordion(category.id)}
                            aria-expanded={!!openAccordions[category.id]}
                            aria-controls={`panel-control-${category.id}`}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                        >
                             <h4 className="font-semibold text-gray-800">{category.name} ({controls[category.id]?.length || 0})</h4>
                             <div className={`${openAccordions[category.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordions[category.id] && (
                            <div id={`panel-control-${category.id}`} className="bg-white divide-y divide-gray-200">
                                {(controls[category.id] || []).map(control => (
                                    <div key={control.id} className="p-4 flex justify-between items-start hover:bg-gray-50 ml-4">
                                        <div>
                                            <p className="font-medium text-gray-900">{control.name}</p>
                                            <p className="text-sm text-gray-600">{control.description}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => setModalState(p => ({ ...p, controlOpen: true, selectedCategory: category, selectedControl: control }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'control', data: control, parentId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ControlCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p => ({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <ControlModal isOpen={modalState.controlOpen} onClose={() => setModalState(p => ({...p, controlOpen: false}))} onSave={handleSaveControl} control={modalState.selectedControl} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${modalState.itemToDelete?.data.name}"? This action cannot be undone.`} />
        </div>
    );
};

export default ControlsTab;
