// components/modules/hr_memssetup.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Module } from '../../types';
import type { CareerCategory, CareerLevel, CareerProfession, QualificationLevel, Qualification } from '../../types/hr_types';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';
import Modal from '../common/Modal';
import Input from '../Input';
import { defaultCareers } from '../../constants/careers';
import { defaultQualifications } from '../../constants/qualifications';
import SkillsTab from './hr/SkillsTab';
import ModuleRightsManager from '../admin/ModuleRightsManager';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

// --- Modals for Careers (3-Level Hierarchy) ---

interface CareerCategoryModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<CareerCategory, 'id'|'enabled'>, code: string) => Promise<void>; category?: CareerCategory | null;
}
const CareerCategoryModal: React.FC<CareerCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!category;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: category?.name || '', description: category?.description || '' });
            setCode(category?.id || '');
        }
    }, [isOpen, category]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Career Category' : 'Add Career Category'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., MGMT_FIN)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Category'}</Button>
            </div>
        </Modal>
    );
};

interface CareerLevelModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<CareerLevel, 'id'|'enabled'>, code: string) => Promise<void>; level?: CareerLevel | null;
}
const CareerLevelModal: React.FC<CareerLevelModalProps> = ({ isOpen, onClose, onSave, level }) => {
    const [formData, setFormData] = useState({ name: '', description: '', order: 0 });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!level;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: level?.name || '', description: level?.description || '', order: level?.order || 0 });
            setCode(level?.id || '');
        }
    }, [isOpen, level]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Career Level' : 'Add Career Level'}>
             <div className="space-y-4">
                <Input id="code" label="Code (e.g., EXEC)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <Input id="order" label="Sort Order" type="number" value={formData.order} onChange={e => setFormData(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Level'}</Button>
            </div>
        </Modal>
    );
};


interface CareerProfessionModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<CareerProfession, 'id'|'enabled'>, code: string) => Promise<void>; profession?: CareerProfession | null;
}
const CareerProfessionModal: React.FC<CareerProfessionModalProps> = ({ isOpen, onClose, onSave, profession }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!profession;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: profession?.name || '', description: profession?.description || '' });
            setCode(profession?.id || '');
        }
    }, [isOpen, profession]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Profession' : 'Add Profession'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., 11-1011)" value={code} onChange={e => setCode(e.target.value)} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Profession'}</Button>
            </div>
        </Modal>
    );
};


// --- Modals for Qualifications ---

interface QualificationLevelModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<QualificationLevel, 'id' | 'enabled'>, code: string) => Promise<void>; level?: QualificationLevel | null;
}
const QualificationLevelModal: React.FC<QualificationLevelModalProps> = ({ isOpen, onClose, onSave, level }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!level;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: level?.name || '', description: level?.description || '' });
            setCode(level?.id || '');
        }
    }, [isOpen, level]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Qualification Level' : 'Add Qualification Level'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., LEVEL-6)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Level Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Level'}</Button>
            </div>
        </Modal>
    );
};


interface QualificationModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<Qualification, 'id' | 'enabled'>, code: string) => Promise<void>; qualification?: Qualification | null;
}
const QualificationModal: React.FC<QualificationModalProps> = ({ isOpen, onClose, onSave, qualification }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!qualification;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: qualification?.name || '', description: qualification?.description || '' });
            setCode(qualification?.id || '');
        }
    }, [isOpen, qualification]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Qualification' : 'Add Qualification'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., BSC)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Qualification'}</Button>
            </div>
        </Modal>
    );
};


// --- CAREERS TAB (3-Level Hierarchy) ---
type CareerItemToDelete = { type: 'category'; data: CareerCategory } | { type: 'level'; data: CareerLevel; categoryId: string } | { type: 'profession'; data: CareerProfession; categoryId: string; levelId: string };

const CareersTab: React.FC = () => {
    const [categories, setCategories] = useState<CareerCategory[]>([]);
    const [levels, setLevels] = useState<Record<string, CareerLevel[]>>({});
    const [professions, setProfessions] = useState<Record<string, CareerProfession[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; levelOpen: boolean; professionOpen: boolean; confirmOpen: boolean;
        selectedCategory: CareerCategory | null; selectedLevel: CareerLevel | null; selectedProfession: CareerProfession | null;
        itemToDelete: CareerItemToDelete | null;
    }>({ categoryOpen: false, levelOpen: false, professionOpen: false, confirmOpen: false, selectedCategory: null, selectedLevel: null, selectedProfession: null, itemToDelete: null });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({});
    
    const careersCollectionRef = collection(db, 'modules/HR/Careers');

    useEffect(() => {
        const q = query(careersCollectionRef, orderBy('__name__'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNeedsSeeding(snapshot.empty);
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareerCategory)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleCategory = useCallback((categoryId: string) => {
        const isOpen = !openCategories[categoryId];
        setOpenCategories(prev => ({ ...prev, [categoryId]: isOpen }));
        if (isOpen && !levels[categoryId]) {
            const levelsRef = collection(careersCollectionRef, categoryId, 'Levels');
            onSnapshot(query(levelsRef, orderBy('__name__')), (snapshot) => {
                setLevels(prev => ({...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareerLevel))}));
            });
        }
    }, [openCategories, levels]);

    const toggleLevel = useCallback((categoryId: string, levelId: string) => {
        const compositeId = `${categoryId}_${levelId}`;
        const isOpen = !openLevels[compositeId];
        setOpenLevels(prev => ({ ...prev, [compositeId]: isOpen }));
        if (isOpen && !professions[compositeId]) {
            const professionsRef = collection(careersCollectionRef, categoryId, 'Levels', levelId, 'Professions');
            onSnapshot(query(professionsRef, orderBy('__name__')), (snapshot) => {
                setProfessions(prev => ({...prev, [compositeId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareerProfession))}));
            });
        }
    }, [openLevels, professions]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultCareers) {
                const categoryRef = doc(careersCollectionRef, category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, enabled: true });
                for (const level of category.levels) {
                    const levelRef = doc(collection(categoryRef, 'Levels'), level.code);
                    batch.set(levelRef, { name: level.name, description: level.description, order: level.order, enabled: true });
                    for (const profession of level.professions) {
                        const professionRef = doc(collection(levelRef, 'Professions'), profession.code);
                        batch.set(professionRef, { name: profession.name, description: profession.description, enabled: profession.enabled });
                    }
                }
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding career data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveCategory = async (data: Omit<CareerCategory, 'id'|'enabled'>, code: string) => await setDoc(doc(careersCollectionRef, code), { ...data, enabled: true });
    const handleSaveLevel = async (data: Omit<CareerLevel, 'id'|'enabled'>, code: string) => {
        if (!modalState.selectedCategory) return;
        await setDoc(doc(careersCollectionRef, modalState.selectedCategory.id, 'Levels', code), { ...data, enabled: true });
    };
    const handleSaveProfession = async (data: Omit<CareerProfession, 'id'|'enabled'>, code: string) => {
        if (!modalState.selectedCategory || !modalState.selectedLevel) return;
        await setDoc(doc(careersCollectionRef, modalState.selectedCategory.id, 'Levels', modalState.selectedLevel.id, 'Professions', code), { ...data, enabled: true });
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const batch = writeBatch(db);
        try {
            if (modalState.itemToDelete.type === 'profession') {
                const { categoryId, levelId, data } = modalState.itemToDelete;
                batch.delete(doc(careersCollectionRef, categoryId, 'Levels', levelId, 'Professions', data.id));
            } else if (modalState.itemToDelete.type === 'level') {
                const { categoryId, data } = modalState.itemToDelete;
                const professionsRef = collection(careersCollectionRef, categoryId, 'Levels', data.id, 'Professions');
                const professionsSnap = await getDocs(query(professionsRef));
                professionsSnap.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(careersCollectionRef, categoryId, 'Levels', data.id));
            } else if (modalState.itemToDelete.type === 'category') {
                const { data } = modalState.itemToDelete;
                const levelsRef = collection(careersCollectionRef, data.id, 'Levels');
                const levelsSnap = await getDocs(query(levelsRef));
                for (const levelDoc of levelsSnap.docs) {
                    const professionsRef = collection(levelDoc.ref, 'Professions');
                    const professionsSnap = await getDocs(query(professionsRef));
                    professionsSnap.forEach(profDoc => batch.delete(profDoc.ref));
                    batch.delete(levelDoc.ref);
                }
                batch.delete(doc(careersCollectionRef, data.id));
            }
            await batch.commit();
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No career data found. Populate the database with the new, structured catalog to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Career Catalog</Button>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Career Catalog</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))}>Add New Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                            <button onClick={() => toggleCategory(category.id)} className="flex-1 flex items-center text-left focus:outline-none">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{category.id}</span>
                                    <span>{category.name} ({levels[category.id]?.length || 0} levels)</span>
                                </h4>
                                <div className={`ml-4 ${openCategories[category.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => setModalState(p => ({ ...p, levelOpen: true, selectedCategory: category, selectedLevel: null }))} className="!py-1 !px-3 text-xs">Add Level</Button>
                                <button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: category }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'category', data: category } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                            </div>
                        </div>
                        {openCategories[category.id] && (
                            <div className="bg-white divide-y divide-gray-200 pl-4">
                                {(levels[category.id] || []).map(level => (
                                    <div key={level.id} className="border-l border-gray-200">
                                        <div className="w-full flex justify-between items-center p-3 hover:bg-gray-50">
                                            <button onClick={() => toggleLevel(category.id, level.id)} className="flex-1 flex items-center text-left focus:outline-none ml-4">
                                                <h5 className="font-medium text-gray-700 flex items-center gap-2">
                                                    <span className="font-mono text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{level.id}</span>
                                                    <span>{level.name}</span>
                                                </h5>
                                                <div className={`ml-3 text-gray-400 ${openLevels[`${category.id}_${level.id}`] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                                            </button>
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => setModalState(p => ({ ...p, professionOpen: true, selectedCategory: category, selectedLevel: level, selectedProfession: null }))} className="!py-1 !px-3 text-xs">Add Profession</Button>
                                                <button onClick={() => setModalState(p => ({ ...p, levelOpen: true, selectedCategory: category, selectedLevel: level }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'level', data: level, categoryId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                        {openLevels[`${category.id}_${level.id}`] && (
                                             <div className="bg-gray-50/50 divide-y divide-gray-200 pl-8 border-l border-gray-200 ml-4">
                                                {(professions[`${category.id}_${level.id}`] || []).map(prof => (
                                                    <div key={prof.id} className="p-2.5 flex justify-between items-start hover:bg-white">
                                                        <div className="flex-1">
                                                            <p className="font-normal text-gray-800">
                                                                <span className="font-mono text-xs text-gray-500 mr-2">{prof.id}</span>
                                                                {prof.name}
                                                            </p>
                                                        </div>
                                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                                            <button onClick={() => setModalState(p => ({ ...p, professionOpen: true, selectedCategory: category, selectedLevel: level, selectedProfession: prof }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'profession', data: prof, categoryId: category.id, levelId: level.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <CareerCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p=>({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <CareerLevelModal isOpen={modalState.levelOpen} onClose={() => setModalState(p=>({...p, levelOpen: false}))} onSave={handleSaveLevel} level={modalState.selectedLevel} />
            <CareerProfessionModal isOpen={modalState.professionOpen} onClose={() => setModalState(p=>({...p, professionOpen: false}))} onSave={handleSaveProfession} profession={modalState.selectedProfession} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message="Are you sure? This will delete the item and all items nested under it. This action cannot be undone." />
        </div>
    );
};


// --- QUALIFICATIONS TAB (Unchanged) ---

const QualificationsTab: React.FC = () => {
    const [levels, setLevels] = useState<QualificationLevel[]>([]);
    const [qualifications, setQualifications] = useState<Record<string, Qualification[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [modalState, setModalState] = useState<{
        levelOpen: boolean; qualificationOpen: boolean; confirmOpen: boolean;
        selectedLevel: QualificationLevel | null; selectedQualification: Qualification | null;
        itemToDelete: { type: 'level' | 'qualification'; data: any; parentId?: string } | null;
    }>({ levelOpen: false, qualificationOpen: false, confirmOpen: false, selectedLevel: null, selectedQualification: null, itemToDelete: null });

    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
    const qualificationsCollectionRef = collection(db, 'modules/HR/Qualifications');

    useEffect(() => {
        const q = query(qualificationsCollectionRef, orderBy('__name__'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNeedsSeeding(snapshot.empty);
            setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QualificationLevel)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleAccordion = useCallback((levelId: string) => {
        const isOpen = !openAccordions[levelId];
        setOpenAccordions(prev => ({ ...prev, [levelId]: isOpen }));
        if (isOpen && !qualifications[levelId]) {
            const qualificationsRef = collection(qualificationsCollectionRef, levelId, 'Qualifications');
            onSnapshot(query(qualificationsRef, orderBy('__name__')), (snapshot) => {
                setQualifications(prev => ({...prev, [levelId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Qualification))}));
            });
        }
    }, [openAccordions, qualifications]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            defaultQualifications.forEach(level => {
                const levelRef = doc(qualificationsCollectionRef, level.code);
                batch.set(levelRef, { name: level.name, description: level.description, enabled: true });
                level.qualifications.forEach(qual => {
                    const qualRef = doc(collection(levelRef, 'Qualifications'), qual.code);
                    batch.set(qualRef, { name: qual.name, description: qual.description, enabled: qual.enabled });
                });
            });
            await batch.commit();
        } catch (error) { console.error("Error seeding qualification data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveLevel = async (data: Omit<QualificationLevel, 'id'|'enabled'>, code: string) => {
        if (modalState.selectedLevel) {
            await updateDoc(doc(qualificationsCollectionRef, modalState.selectedLevel.id), { ...data, enabled: true });
        } else {
            await setDoc(doc(qualificationsCollectionRef, code), { ...data, enabled: true });
        }
    };
    
    const handleSaveQualification = async (data: Omit<Qualification, 'id'|'enabled'>, code: string) => {
        if (!modalState.selectedLevel) return;
        const subcollectionRef = collection(qualificationsCollectionRef, modalState.selectedLevel.id, 'Qualifications');
        if (modalState.selectedQualification) {
            await updateDoc(doc(subcollectionRef, modalState.selectedQualification.id), { ...data, enabled: true });
        } else {
            await setDoc(doc(subcollectionRef, code), { ...data, enabled: true });
        }
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const { type, data, parentId } = modalState.itemToDelete;
        try {
            if (type === 'level') {
                const subcollectionRef = collection(qualificationsCollectionRef, data.id, 'Qualifications');
                const snapshot = await getDocs(subcollectionRef);
                const batch = writeBatch(db);
                snapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(qualificationsCollectionRef, data.id));
                await batch.commit();
            } else if (type === 'qualification' && parentId) {
                await deleteDoc(doc(qualificationsCollectionRef, parentId, 'Qualifications', data.id));
            }
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No education qualifications found. Populate the database with a universal, default set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Qualifications</Button>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Education Qualifications Catalog</h3>
                <Button onClick={() => setModalState(p => ({ ...p, levelOpen: true, selectedLevel: null }))}>Add New Level</Button>
            </div>
            <div className="space-y-2">
                {levels.map(level => (
                    <div key={level.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => toggleAccordion(level.id)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                           <h4 className="font-semibold text-gray-800">{level.name} ({qualifications[level.id]?.length || 0})</h4>
                           <div className={`transition-transform duration-300 ${openAccordions[level.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordions[level.id] && (
                            <div className="bg-white divide-y divide-gray-200">
                                <div className="p-4"><Button onClick={() => setModalState(p => ({ ...p, qualificationOpen: true, selectedLevel: level, selectedQualification: null }))} className="!py-1 !px-3 text-xs">Add Qualification</Button></div>
                                {(qualifications[level.id] || []).map(qual => (
                                    <div key={qual.id} className="p-4 flex justify-between items-start hover:bg-gray-50 ml-4">
                                        <div className="flex-1"><p className="font-medium text-gray-900">{qual.name}</p></div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <button onClick={() => setModalState(p => ({ ...p, qualificationOpen: true, selectedLevel: level, selectedQualification: qual }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'qualification', data: qual, parentId: level.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <QualificationLevelModal isOpen={modalState.levelOpen} onClose={() => setModalState(p => ({...p, levelOpen: false}))} onSave={handleSaveLevel} level={modalState.selectedLevel} />
            <QualificationModal isOpen={modalState.qualificationOpen} onClose={() => setModalState(p => ({...p, qualificationOpen: false}))} onSave={handleSaveQualification} qualification={modalState.selectedQualification} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message="Are you sure? This action cannot be undone." />
        </div>
    );
};


// --- MAIN PAGE ---
interface ModuleSetupPageProps {
  module: Module; onBackToModules: () => void;
}
const HrMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const [activeTab, setActiveTab] = useState('careers');

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
        case 'dashboard':
            return <p>Dashboard for HR setup will be here.</p>;
        case 'careers':
            return <CareersTab />;
        case 'qualifications':
            return <QualificationsTab />;
        case 'skills':
            return <SkillsTab />;
        case 'rights':
            return <ModuleRightsManager module={module} />;
        default:
            return null;
    }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="text-gray-500 font-semibold">Module Setup</p>
        </div>
        <button onClick={onBackToModules} className="text-sm text-blue-600 hover:underline">&larr; Back to Module Management</button>
      </div>
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <TabButton tabName="dashboard" label="Dashboard" />
                <TabButton tabName="careers" label="Careers" />
                <TabButton tabName="qualifications" label="Education Qualifications" />
                <TabButton tabName="skills" label="Skills" />
                <TabButton tabName="rights" label="Rights" />
            </nav>
        </div>
        <div className="mt-6">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default HrMemsSetupPage;