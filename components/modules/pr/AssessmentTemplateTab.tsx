
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../services/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { AssessmentCategory, AssessmentQuestion } from '../../../types/pr_types';
import Button from '../../Button';
import Input from '../../Input';
import ConfirmationModal from '../../common/ConfirmationModal';
import AssessmentCategoryModal from './AssessmentCategoryModal';
import AssessmentQuestionModal from './AssessmentQuestionModal';
import { defaultAssessmentTemplate } from '../../../constants/pr_assessment_template';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = ({ className = '' }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const AssessmentTemplateTab: React.FC<{ organisation: Organisation }> = ({ organisation }) => {
    const [categories, setCategories] = useState<AssessmentCategory[]>([]);
    const [questionsMap, setQuestionsMap] = useState<Record<string, AssessmentQuestion[]>>({});
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    
    const [catModal, setCatModal] = useState<{ open: boolean, data?: AssessmentCategory }>({ open: false });
    const [qModal, setQModal] = useState<{ open: boolean, catId?: string, data?: AssessmentQuestion }>({ open: false });
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'cat' | 'q', id: string, parentId?: string } | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);

    // Using 'master' document to hold settings and parent the categories collection
    // Global Path: modules/PR/assessmentTemplates/master
    const templateDocPath = `modules/PR/assessmentTemplates/master`;
    
    useEffect(() => {
        // Fetch Categories from subcollection
        const catsRef = collection(db, templateDocPath, 'categories');
        const qCats = query(catsRef, orderBy('order', 'asc'));
        const unsubCats = onSnapshot(qCats, (snap) => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentCategory)));
        });

        return () => { unsubCats(); };
    }, [templateDocPath]);

    const toggleCategory = (catId: string) => {
        setOpenCategories(p => ({ ...p, [catId]: !p[catId] }));
        if (!questionsMap[catId]) {
            const qRef = collection(db, templateDocPath, 'categories', catId, 'questions');
            onSnapshot(query(qRef, orderBy('order', 'asc')), snap => {
                setQuestionsMap(p => ({ ...p, [catId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentQuestion)) }));
            });
        }
    };

    const handleSeed = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            // 1. Settings (Master Doc) - still populated for backend consistency
            const templateDocRef = doc(db, templateDocPath);
            batch.set(templateDocRef, {
                scale_min: defaultAssessmentTemplate.scale_min,
                scale_max: defaultAssessmentTemplate.scale_max,
                scale_definition: defaultAssessmentTemplate.scale_definition
            }, { merge: true });

            // 2. Categories & Questions
            defaultAssessmentTemplate.categories.forEach((catData, index) => {
                const catRef = doc(collection(db, templateDocPath, 'categories'));
                const { questions, ...catFields } = catData;
                batch.set(catRef, { ...catFields, order: index + 1 });

                questions.forEach((qData, qIndex) => {
                    const qRef = doc(collection(catRef, 'questions'));
                    batch.set(qRef, { ...qData, order: qIndex + 1 });
                });
            });
            
            await batch.commit();
        } catch (e) {
            console.error(e);
            alert("Seeding failed.");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSaveCategory = async (data: Omit<AssessmentCategory, 'id'>) => {
        const ref = collection(db, templateDocPath, 'categories');
        if (catModal.data) {
            await updateDoc(doc(ref, catModal.data.id), data);
        } else {
            // For new category, find max order or just append
            const newOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) + 1 : 1;
            await addDoc(ref, { ...data, order: newOrder });
        }
    };

    const handleSaveQuestion = async (data: Omit<AssessmentQuestion, 'id'>) => {
        if (!qModal.catId) return;
        const ref = collection(db, templateDocPath, 'categories', qModal.catId, 'questions');
        if (qModal.data) {
            await updateDoc(doc(ref, qModal.data.id), data);
        } else {
             const currentQuestions = questionsMap[qModal.catId] || [];
             const newOrder = currentQuestions.length > 0 ? Math.max(...currentQuestions.map(q => q.order || 0)) + 1 : 1;
            await addDoc(ref, { ...data, order: newOrder });
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        if (confirmDelete.type === 'cat') {
            // Delete subcollection docs first
            const qRef = collection(db, templateDocPath, 'categories', confirmDelete.id, 'questions');
            const qSnap = await getDocs(qRef);
            const batch = writeBatch(db);
            qSnap.forEach(d => batch.delete(d.ref));
            batch.delete(doc(db, templateDocPath, 'categories', confirmDelete.id));
            await batch.commit();
        } else if (confirmDelete.type === 'q' && confirmDelete.parentId) {
            await deleteDoc(doc(db, templateDocPath, 'categories', confirmDelete.parentId, 'questions', confirmDelete.id));
        }
        setConfirmDelete(null);
    };

    return (
        <div className="space-y-8">
            {/* Categories */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Assessment Categories</h3>
                    <div className="flex gap-2">
                        {categories.length === 0 && (
                            <Button onClick={handleSeed} isLoading={isSeeding} variant="secondary" className="!w-auto">Seed Global Template</Button>
                        )}
                        <Button onClick={() => setCatModal({ open: true })} className="!w-auto">+ Add Category</Button>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="border rounded-lg bg-white overflow-hidden">
                            <div className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleCategory(cat.id)}>
                                <div className="flex items-center gap-3">
                                    <ChevronDownIcon className={openCategories[cat.id] ? 'rotate-180' : ''} />
                                    <div>
                                        <h4 className="font-bold text-slate-700">
                                            <span className="text-gray-400 font-mono mr-2 text-xs">{cat.order}.</span>
                                            {cat.name} 
                                            <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">{cat.weight_percent}%</span>
                                        </h4>
                                        <p className="text-xs text-slate-500">{cat.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, data: cat }); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><EditIcon/></button>
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'cat', id: cat.id }); }} className="p-1 text-red-600 hover:bg-red-100 rounded"><DeleteIcon/></button>
                                </div>
                            </div>

                            {openCategories[cat.id] && (
                                <div className="p-4 border-t border-slate-200 bg-white">
                                    <div className="flex justify-end mb-3">
                                        <Button variant="secondary" className="!py-1 !px-2 !text-xs !w-auto" onClick={() => setQModal({ open: true, catId: cat.id })}>+ Add Question</Button>
                                    </div>
                                    <div className="space-y-3">
                                        {(questionsMap[cat.id] || []).map(q => (
                                            <div key={q.id} className="p-3 border rounded-md hover:bg-slate-50">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-slate-800">
                                                            <span className="text-gray-400 font-mono mr-2 text-xs">{q.order}.</span>
                                                            {q.question_text}
                                                        </p>
                                                        <div className="flex gap-2">
                                                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 capitalize">{q.question_type}</span>
                                                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 capitalize">Score: {q.scores}</span>
                                                        </div>
                                                        <div className="mt-2 text-xs text-slate-500 grid grid-cols-1 sm:grid-cols-5 gap-1">
                                                            <span>1: {q.rating_scale?.["1"] || 'N/A'}</span>
                                                            <span>2: {q.rating_scale?.["2"] || 'N/A'}</span>
                                                            <span>3: {q.rating_scale?.["3"] || 'N/A'}</span>
                                                            <span>4: {q.rating_scale?.["4"] || 'N/A'}</span>
                                                            <span>5: {q.rating_scale?.["5"] || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 ml-4">
                                                        <button onClick={() => setQModal({ open: true, catId: cat.id, data: q })} className="text-blue-600 hover:text-blue-800"><EditIcon/></button>
                                                        <button onClick={() => setConfirmDelete({ type: 'q', id: q.id, parentId: cat.id })} className="text-red-600 hover:text-red-800"><DeleteIcon/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(questionsMap[cat.id] || []).length === 0 && <p className="text-center text-slate-400 text-sm italic">No questions defined.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <AssessmentCategoryModal isOpen={catModal.open} onClose={() => setCatModal({ open: false })} onSave={handleSaveCategory} category={catModal.data} />
            <AssessmentQuestionModal isOpen={qModal.open} onClose={() => setQModal({ open: false })} onSave={handleSaveQuestion} question={qModal.data} />
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title="Confirm Delete" message="Are you sure? This cannot be undone." />
        </div>
    );
};

export default AssessmentTemplateTab;
