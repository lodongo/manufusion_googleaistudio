import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { SkillCategory, SkillSubcategory, Skill } from '../../../types/hr_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import SkillCategoryModal from './SkillCategoryModal';
import SkillSubcategoryModal from './SkillSubcategoryModal';
import SkillModal from './SkillModal';
import { defaultSkills } from '../../../constants/skills';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

type ItemToDelete = { type: 'category'; data: SkillCategory } | { type: 'subcategory'; data: SkillSubcategory; categoryId: string } | { type: 'skill'; data: Skill; categoryId: string; subcategoryId: string };

const SkillsTab: React.FC = () => {
    const [categories, setCategories] = useState<SkillCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, SkillSubcategory[]>>({});
    const [skills, setSkills] = useState<Record<string, Skill[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; subcategoryOpen: boolean; skillOpen: boolean; confirmOpen: boolean;
        selectedCategory: SkillCategory | null; selectedSubcategory: SkillSubcategory | null; selectedSkill: Skill | null;
        itemToDelete: ItemToDelete | null;
    }>({ categoryOpen: false, subcategoryOpen: false, skillOpen: false, confirmOpen: false, selectedCategory: null, selectedSubcategory: null, selectedSkill: null, itemToDelete: null });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({});
    
    const skillsCollectionRef = collection(db, 'modules/HR/Skills');

    useEffect(() => {
        const q = query(skillsCollectionRef, orderBy('__name__'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNeedsSeeding(snapshot.empty);
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SkillCategory)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleCategory = useCallback((categoryId: string) => {
        const isOpen = !openCategories[categoryId];
        setOpenCategories(prev => ({ ...prev, [categoryId]: isOpen }));
        if (isOpen && !subcategories[categoryId]) {
            const subcategoriesRef = collection(skillsCollectionRef, categoryId, 'Subcategories');
            onSnapshot(query(subcategoriesRef, orderBy('__name__')), (snapshot) => {
                setSubcategories(prev => ({...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SkillSubcategory))}));
            });
        }
    }, [openCategories, subcategories]);

    const toggleSubcategory = useCallback((categoryId: string, subcategoryId: string) => {
        const compositeId = `${categoryId}_${subcategoryId}`;
        const isOpen = !openSubcategories[compositeId];
        setOpenSubcategories(prev => ({ ...prev, [compositeId]: isOpen }));
        if (isOpen && !skills[compositeId]) {
            const skillsRef = collection(skillsCollectionRef, categoryId, 'Subcategories', subcategoryId, 'Skills');
            onSnapshot(query(skillsRef, orderBy('__name__')), (snapshot) => {
                setSkills(prev => ({...prev, [compositeId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Skill))}));
            });
        }
    }, [openSubcategories, skills]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const category of defaultSkills) {
                const categoryRef = doc(skillsCollectionRef, category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, enabled: true });
                for (const subcategory of category.subcategories) {
                    const subcategoryRef = doc(collection(categoryRef, 'Subcategories'), subcategory.code);
                    batch.set(subcategoryRef, { name: subcategory.name, description: subcategory.description, enabled: subcategory.enabled });
                    for (const skill of subcategory.skills) {
                        const skillRef = doc(collection(subcategoryRef, 'Skills'), skill.code);
                        batch.set(skillRef, { name: skill.name, description: skill.description, enabled: skill.enabled });
                    }
                }
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding skill data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveCategory = async (data: Omit<SkillCategory, 'id'|'enabled'>, code: string) => await setDoc(doc(skillsCollectionRef, code), { ...data, enabled: true });
    const handleSaveSubcategory = async (data: Omit<SkillSubcategory, 'id'|'enabled'>, code: string) => {
        if (!modalState.selectedCategory) return;
        await setDoc(doc(skillsCollectionRef, modalState.selectedCategory.id, 'Subcategories', code), { ...data, enabled: true });
    };
    const handleSaveSkill = async (data: Omit<Skill, 'id'|'enabled'>, code: string) => {
        if (!modalState.selectedCategory || !modalState.selectedSubcategory) return;
        await setDoc(doc(skillsCollectionRef, modalState.selectedCategory.id, 'Subcategories', modalState.selectedSubcategory.id, 'Skills', code), { ...data, enabled: true });
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const batch = writeBatch(db);
        try {
            if (modalState.itemToDelete.type === 'skill') {
                const { categoryId, subcategoryId, data } = modalState.itemToDelete;
                batch.delete(doc(skillsCollectionRef, categoryId, 'Subcategories', subcategoryId, 'Skills', data.id));
            } else if (modalState.itemToDelete.type === 'subcategory') {
                const { categoryId, data } = modalState.itemToDelete;
                const skillsRef = collection(skillsCollectionRef, categoryId, 'Subcategories', data.id, 'Skills');
                const skillsSnap = await getDocs(query(skillsRef));
                skillsSnap.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(skillsCollectionRef, categoryId, 'Subcategories', data.id));
            } else if (modalState.itemToDelete.type === 'category') {
                const { data } = modalState.itemToDelete;
                const subcategoriesRef = collection(skillsCollectionRef, data.id, 'Subcategories');
                const subcategoriesSnap = await getDocs(query(subcategoriesRef));
                for (const subDoc of subcategoriesSnap.docs) {
                    const skillsRef = collection(subDoc.ref, 'Skills');
                    const skillsSnap = await getDocs(query(skillsRef));
                    skillsSnap.forEach(skillDoc => batch.delete(skillDoc.ref));
                    batch.delete(subDoc.ref);
                }
                batch.delete(doc(skillsCollectionRef, data.id));
            }
            await batch.commit();
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No skills data found. Populate the database with a comprehensive catalog to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Skills Catalog</Button>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Skills Catalog</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))}>Add New Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                aria-expanded={!!openCategories[category.id]}
                                aria-controls={`category-panel-skill-${category.id}`}
                                className="flex-1 flex items-center text-left focus:outline-none"
                            >
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{category.id}</span>
                                    <span>{category.name} ({subcategories[category.id]?.length || 0} subcategories)</span>
                                </h4>
                                <div className={`ml-4 ${openCategories[category.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: null }))} className="!py-1 !px-3 text-xs">Add Subcategory</Button>
                                <button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: category }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'category', data: category } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                            </div>
                        </div>
                        {openCategories[category.id] && (
                            <div id={`category-panel-skill-${category.id}`} className="bg-white divide-y divide-gray-200 pl-4">
                                {(subcategories[category.id] || []).map(sub => (
                                    <div key={sub.id} className="border-l border-gray-200">
                                        <div className="w-full flex justify-between items-center p-3 hover:bg-gray-50">
                                            <button
                                                onClick={() => toggleSubcategory(category.id, sub.id)}
                                                aria-expanded={!!openSubcategories[`${category.id}_${sub.id}`]}
                                                aria-controls={`subcategory-panel-skill-${sub.id}`}
                                                className="flex-1 flex items-center text-left focus:outline-none ml-4"
                                            >
                                                <h5 className="font-medium text-gray-700 flex items-center gap-2">
                                                    <span className="font-mono text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{sub.id}</span>
                                                    <span>{sub.name}</span>
                                                </h5>
                                                <div className={`ml-3 text-gray-400 ${openSubcategories[`${category.id}_${sub.id}`] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                                            </button>
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => setModalState(p => ({ ...p, skillOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedSkill: null }))} className="!py-1 !px-3 text-xs">Add Skill</Button>
                                                <button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: sub }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'subcategory', data: sub, categoryId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                        {openSubcategories[`${category.id}_${sub.id}`] && (
                                             <div id={`subcategory-panel-skill-${sub.id}`} className="bg-gray-50/50 divide-y divide-gray-200 pl-8 border-l border-gray-200 ml-4">
                                                {(skills[`${category.id}_${sub.id}`] || []).map(skill => (
                                                    <div key={skill.id} className="p-2.5 flex justify-between items-start hover:bg-white">
                                                        <div className="flex-1">
                                                            <p className="font-normal text-gray-800">
                                                                <span className="font-mono text-xs text-gray-500 mr-2">{skill.id}</span>
                                                                {skill.name}
                                                            </p>
                                                        </div>
                                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                                            <button onClick={() => setModalState(p => ({ ...p, skillOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedSkill: skill }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'skill', data: skill, categoryId: category.id, subcategoryId: sub.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
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
            <SkillCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p=>({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <SkillSubcategoryModal isOpen={modalState.subcategoryOpen} onClose={() => setModalState(p=>({...p, subcategoryOpen: false}))} onSave={handleSaveSubcategory} subcategory={modalState.selectedSubcategory} />
            <SkillModal isOpen={modalState.skillOpen} onClose={() => setModalState(p=>({...p, skillOpen: false}))} onSave={handleSaveSkill} skill={modalState.selectedSkill} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message="Are you sure? This will delete the item and all items nested under it. This action cannot be undone." />
        </div>
    );
};

export default SkillsTab;
