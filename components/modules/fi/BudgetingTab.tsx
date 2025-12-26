import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { AppUser, Organisation } from '../../../types';
import type { BudgetTemplateMetadata } from '../../../types/fi_types';
import Button from '../../Button';
import Input from '../../Input';
import Modal from '../../common/Modal';
import ConfirmationModal from '../../common/ConfirmationModal';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { levelInfo } from '../../org/HierarchyNodeModal';

const { Timestamp } = firebase.firestore;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

// --- MODAL FOR CREATING TEMPLATE ---
interface CreateTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<BudgetTemplateMetadata, 'id'>) => Promise<void>;
    organisation: Organisation;
    currentUser: AppUser;
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ isOpen, onClose, onSave, organisation, currentUser }) => {
    const [financialYear, setFinancialYear] = useState<number>(new Date().getFullYear());
    const [level2Id, setLevel2Id] = useState('');
    const [level2Options, setLevel2Options] = useState<{id:string, name:string}[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        const fetchLevel2 = async () => {
            const ref = db.collection(`organisations/${organisation.domain}/level_1`);
            const snap = await ref.get();
            const options: {id:string, name:string}[] = [];
            
            // We need to get level_2 from EACH level_1. Simplification: iterate.
            for(const doc of snap.docs) {
                const l2Ref = doc.ref.collection('level_2');
                const l2Snap = await l2Ref.get();
                l2Snap.forEach(l2 => options.push({id: l2.id, name: l2.data().name}));
            }
            setLevel2Options(options.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
        };
        fetchLevel2();
    }, [organisation.domain]);

    const handleSave = async () => {
        if (!level2Id) return;
        setIsLoading(true);
        const selectedL2 = level2Options.find(o => o.id === level2Id);
        
        const newTemplate: Omit<BudgetTemplateMetadata, 'id'> = {
            financialYear,
            level2Id,
            level2Name: selectedL2?.name || '',
            latestVersion: 1,
            status: 'Enabled',
            createdAt: Timestamp.now(),
            createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
            versions: [{
                version: 1,
                createdAt: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                status: 'Open',
                type: 'Budget'
            }]
        };
        
        await onSave(newTemplate);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Budget Template">
            <div className="space-y-4">
                <Input id="financialYear" label="Financial Year" type="number" value={financialYear} onChange={e => setFinancialYear(Number(e.target.value))} />
                <div>
                    <label className="block text-sm font-medium text-gray-700">{levelInfo[2].name}</label>
                    <select value={level2Id} onChange={e => setLevel2Id(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="">Select Entity...</option>
                        {level2Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} isLoading={isLoading} disabled={!level2Id}>Create Template</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- ADMIN BUDGETING TAB ---
const BudgetingTab: React.FC<{ organisation: Organisation; theme: Organisation['theme']; currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [templates, setTemplates] = useState<BudgetTemplateMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<BudgetTemplateMetadata | null>(null);

    const templatesCollectionRef = db.collection(`organisations/${organisation.domain}/modules/FI/budgetTemplates`);

    useEffect(() => {
        const q = templatesCollectionRef.orderBy('financialYear', 'desc');
        const unsubscribe = q.onSnapshot(snapshot => {
            setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetTemplateMetadata)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [organisation.domain]);

    const handleCreateTemplate = async (data: Omit<BudgetTemplateMetadata, 'id'>) => {
        const docId = `FY${data.financialYear}-${data.level2Id}`;
        await templatesCollectionRef.doc(docId).set(data);
    };
    
    const handleToggleStatus = async (template: BudgetTemplateMetadata) => {
        const newStatus = template.status === 'Enabled' ? 'Disabled' : 'Enabled';
        await templatesCollectionRef.doc(template.id).update({ status: newStatus });
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        // Note: This only deletes the metadata doc. Deleting subcollections (budget data) requires a recursive delete function (e.g. via cloud function or detailed client-side script).
        // For now, we just delete the metadata to hide it.
        await templatesCollectionRef.doc(confirmDelete.id).delete();
        setConfirmDelete(null);
    };

    if (loading) return <div className="p-12 text-center">Loading templates...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Budget Templates Management</h3>
                <Button onClick={() => setIsModalOpen(true)}>Create New Template</Button>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Financial Year</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entity ({levelInfo[2].name})</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Version</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {templates.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-5 py-4 bg-white text-sm font-bold">{t.financialYear}</td>
                                <td className="px-5 py-4 bg-white text-sm">{t.level2Name}</td>
                                <td className="px-5 py-4 bg-white text-sm">V{t.latestVersion} ({t.versions.find(v => v.version === t.latestVersion)?.type})</td>
                                <td className="px-5 py-4 bg-white text-sm text-center">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.status === 'Enabled' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-5 py-4 bg-white text-sm text-center space-x-2">
                                    <button onClick={() => handleToggleStatus(t)} className="text-blue-600 hover:underline text-xs">{t.status === 'Enabled' ? 'Disable' : 'Enable'}</button>
                                    <button onClick={() => setConfirmDelete(t)} className="text-red-600 hover:text-red-800 p-2 rounded-full"><DeleteIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {templates.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-500">No templates found.</td></tr>}
                    </tbody>
                </table>
            </div>
            
            <CreateTemplateModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleCreateTemplate} 
                organisation={organisation} 
                currentUser={currentUser}
            />
            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDelete} 
                title="Delete Template?" 
                message={`Are you sure you want to delete the budget template for ${confirmDelete?.level2Name} FY${confirmDelete?.financialYear}?`} 
            />
        </div>
    );
};

export default BudgetingTab;