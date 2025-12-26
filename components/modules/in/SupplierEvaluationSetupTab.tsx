
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { collection, onSnapshot, doc, deleteDoc, writeBatch, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import type { SupplierEvaluationCategory, SupplierEvaluationCriterion } from '../../../types/in_types';
import Button from '../../Button';
import Input from '../../Input';
import Modal from '../../common/Modal';
import ConfirmationModal from '../../common/ConfirmationModal';
import { defaultSupplierEvaluationTemplate } from '../../../constants/in_supplier_evaluation';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

// --- Modals ---

const CategoryModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (data: Partial<SupplierEvaluationCategory>) => void, category?: SupplierEvaluationCategory }> = ({ isOpen, onClose, onSave, category }) => {
    const [formData, setFormData] = useState<Partial<SupplierEvaluationCategory>>({ name: '', description: '', weight: 0, enabled: true });
    
    useEffect(() => {
        if (isOpen) {
            setFormData(category ? { ...category } : { name: '', description: '', weight: 0, enabled: true });
        }
    }, [isOpen, category]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={category ? "Edit Category" : "Add Category"}>
            <div className="space-y-4">
                <Input label="Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required id="catName" />
                <Input label="Weight (%)" type="number" value={formData.weight || 0} onChange={e => setFormData({...formData, weight: Number(e.target.value)})} id="catWeight" />
                <Input label="Description" as="textarea" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} id="catDesc" />
                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                    <span className="text-sm">Enabled</span>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={() => { onSave(formData); onClose(); }}>Save</Button></div>
            </div>
        </Modal>
    );
};

const CriterionModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (data: Partial<SupplierEvaluationCriterion>) => void, criterion?: SupplierEvaluationCriterion }> = ({ isOpen, onClose, onSave, criterion }) => {
    const [formData, setFormData] = useState<Partial<SupplierEvaluationCriterion>>({ name: '', description: '', scoringGuidelines: '', enabled: true });
    
    useEffect(() => {
        if (isOpen) {
            setFormData(criterion ? { ...criterion } : { name: '', description: '', scoringGuidelines: '', enabled: true });
        }
    }, [isOpen, criterion]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={criterion ? "Edit Question/Criterion" : "Add Question/Criterion"}>
            <div className="space-y-4">
                <Input label="Question / Criterion" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required id="critName" />
                <Input label="Description" as="textarea" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} id="critDesc" />
                <Input label="Scoring Guidelines (e.g. 1=Poor, 5=Excellent)" as="textarea" value={formData.scoringGuidelines || ''} onChange={e => setFormData({...formData, scoringGuidelines: e.target.value})} rows={3} id="critScore" />
                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                    <span className="text-sm">Enabled</span>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={() => { onSave(formData); onClose(); }}>Save</Button></div>
            </div>
        </Modal>
    );
};

const SupplierEvaluationSetupTab: React.FC<{ organisationId: string }> = ({ organisationId }) => {
    const [categories, setCategories] = useState<SupplierEvaluationCategory[]>([]);
    const [criteriaMap, setCriteriaMap] = useState<Record<string, SupplierEvaluationCriterion[]>>({});
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    
    const [catModal, setCatModal] = useState<{ open: boolean, data?: SupplierEvaluationCategory }>({ open: false });
    const [critModal, setCritModal] = useState<{ open: boolean, catId?: string, data?: SupplierEvaluationCriterion }>({ open: false });
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'cat' | 'crit', id: string, parentId?: string } | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);

    const catsRef = collection(db, `organisations/${organisationId}/modules/PR/evaluationTemplates`);

    useEffect(() => {
        const q = query(catsRef, orderBy('name'));
        const unsub = onSnapshot(q, snap => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierEvaluationCategory)));
        });
        return unsub;
    }, [organisationId]);

    const toggleCategory = (catId: string) => {
        setOpenCategories(p => ({ ...p, [catId]: !p[catId] }));
        if (!criteriaMap[catId]) {
            const critRef = collection(catsRef, catId, 'criteria');
            onSnapshot(query(critRef, orderBy('name')), snap => {
                setCriteriaMap(p => ({ ...p, [catId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierEvaluationCriterion)) }));
            });
        }
    };

    const handleSaveCategory = async (data: Partial<SupplierEvaluationCategory>) => {
        if (catModal.data) {
            await updateDoc(doc(catsRef, catModal.data.id), data);
        } else {
            await addDoc(catsRef, data);
        }
    };

    const handleSaveCriterion = async (data: Partial<SupplierEvaluationCriterion>) => {
        if (!critModal.catId) return;
        const ref = collection(catsRef, critModal.catId, 'criteria');
        if (critModal.data) {
            await updateDoc(doc(ref, critModal.data.id), data);
        } else {
            await addDoc(ref, data);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        if (confirmDelete.type === 'cat') {
            await deleteDoc(doc(catsRef, confirmDelete.id));
        } else if (confirmDelete.type === 'crit' && confirmDelete.parentId) {
            await deleteDoc(doc(catsRef, confirmDelete.parentId, 'criteria', confirmDelete.id));
        }
        setConfirmDelete(null);
    };

    const handleSeed = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const catData of defaultSupplierEvaluationTemplate) {
                const catRef = doc(catsRef); // Auto-ID
                const { criteria, ...catFields } = catData;
                batch.set(catRef, catFields);
                
                for (const crit of criteria) {
                    const critRef = doc(collection(catRef, 'criteria'));
                    batch.set(critRef, crit);
                }
            }
            await batch.commit();
        } catch (e) {
            console.error(e);
            alert("Seeding failed.");
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Supplier Relationship Evaluation Template</h3>
                    <p className="text-sm text-slate-500">Define the scorecard structure for evaluating supplier performance.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleSeed} isLoading={isSeeding} disabled={categories.length > 0}>Seed Default Template</Button>
                    <Button onClick={() => setCatModal({ open: true })}>+ Add Category</Button>
                </div>
            </div>

            <div className="space-y-3">
                {categories.length === 0 && <p className="text-center text-slate-400 py-8 border rounded-lg border-dashed">No categories defined.</p>}
                {categories.map(cat => (
                    <div key={cat.id} className="border rounded-lg bg-white overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleCategory(cat.id)}>
                            <div className="flex items-center gap-3">
                                <ChevronDownIcon />
                                <div>
                                    <h4 className="font-bold text-slate-700">{cat.name} <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">{cat.weight}%</span></h4>
                                    <p className="text-xs text-slate-500">{cat.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, data: cat }); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><EditIcon/></button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'cat', id: cat.id }); }} className="p-1 text-red-600 hover:bg-red-100 rounded"><DeleteIcon/></button>
                            </div>
                        </div>
                        
                        {openCategories[cat.id] && (
                            <div className="p-4 border-t border-slate-200">
                                <div className="flex justify-end mb-3">
                                    <Button variant="secondary" className="!py-1 !px-2 !text-xs !w-auto" onClick={() => setCritModal({ open: true, catId: cat.id })}>+ Add Question</Button>
                                </div>
                                <div className="space-y-2">
                                    {(criteriaMap[cat.id] || []).map(crit => (
                                        <div key={crit.id} className="flex justify-between items-start p-3 bg-slate-50/50 border rounded-md hover:bg-white hover:shadow-sm transition-all">
                                            <div>
                                                <p className="font-medium text-sm text-slate-800">{crit.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{crit.description}</p>
                                                {crit.scoringGuidelines && <p className="text-xs text-indigo-600 mt-1 italic">Guide: {crit.scoringGuidelines}</p>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <button onClick={() => setCritModal({ open: true, catId: cat.id, data: crit })} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><EditIcon/></button>
                                                 <button onClick={() => setConfirmDelete({ type: 'crit', id: crit.id, parentId: cat.id })} className="p-1 text-red-600 hover:bg-red-100 rounded"><DeleteIcon/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {(criteriaMap[cat.id] || []).length === 0 && <p className="text-xs text-slate-400 italic text-center">No questions added.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <CategoryModal isOpen={catModal.open} onClose={() => setCatModal({ open: false })} onSave={handleSaveCategory} category={catModal.data} />
            <CriterionModal isOpen={critModal.open} onClose={() => setCritModal({ open: false })} onSave={handleSaveCriterion} criterion={critModal.data} />
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title="Confirm Delete" message="Are you sure?" />
        </div>
    );
};

export default SupplierEvaluationSetupTab;
