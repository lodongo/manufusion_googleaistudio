
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeConfig } from '../../../types/in_types';
import Button from '../../Button';
import Input from '../../Input';
import Modal from '../../common/Modal';
import ConfirmationModal from '../../common/ConfirmationModal';

interface StockTakeSetupProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const StockTakeSetup: React.FC<StockTakeSetupProps> = ({ organisation, theme, currentUser }) => {
    const [configs, setConfigs] = useState<StockTakeConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<StockTakeConfig | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<StockTakeConfig | null>(null);
    
    // Form State
    const [formData, setFormData] = useState<Partial<StockTakeConfig>>({
        type: 'FULL',
        frequency: 'ANNUALLY',
        blindCount: true,
        freezeInventory: true,
        durationDays: 1
    });

    useEffect(() => {
        const configsRef = collection(db, `organisations/${organisation.domain}/modules/IN/stockTakeConfigs`);
        const q = query(configsRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setConfigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockTakeConfig)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [organisation.domain]);

    const handleOpenModal = (config?: StockTakeConfig) => {
        if (config) {
            setEditingConfig(config);
            setFormData(config);
        } else {
            setEditingConfig(null);
            setFormData({
                name: '',
                type: 'FULL',
                frequency: 'ANNUALLY',
                blindCount: true,
                freezeInventory: true,
                durationDays: 1
            });
        }
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) return;
        
        const payload: any = {
            ...formData,
            updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
        };
        
        if (!editingConfig) {
            payload.createdAt = Timestamp.now();
            payload.createdBy = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
        }

        try {
            if (editingConfig) {
                await setDoc(doc(db, `organisations/${organisation.domain}/modules/IN/stockTakeConfigs`, editingConfig.id), payload, { merge: true });
            } else {
                await addDoc(collection(db, `organisations/${organisation.domain}/modules/IN/stockTakeConfigs`), payload);
            }
            setModalOpen(false);
        } catch (error) {
            console.error("Error saving config:", error);
            alert("Failed to save configuration.");
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/IN/stockTakeConfigs`, confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error("Error deleting config:", error);
            alert("Failed to delete configuration.");
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'FULL': return 'bg-purple-100 text-purple-800';
            case 'CYCLE': return 'bg-blue-100 text-blue-800';
            case 'ADHOC': return 'bg-amber-100 text-amber-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div className="p-8 text-center">Loading configurations...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Stock Take Configurations</h3>
                    <p className="text-sm text-slate-500">Define the types of stock counts available for execution.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="!w-auto">Create Configuration</Button>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Name</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500 uppercase">Type</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Frequency</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Controls</th>
                            <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {configs.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No configurations defined.</td></tr>
                        ) : (
                            configs.map(config => (
                                <tr key={config.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{config.name}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getTypeColor(config.type)}`}>
                                            {config.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {config.frequency}
                                        {config.type === 'CYCLE' && config.durationDays && <span className="text-xs text-slate-400 block">Duration: {config.durationDays} days</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <span className={config.blindCount ? 'text-green-600' : 'text-red-600'}>{config.blindCount ? '✓' : '✕'}</span> Blind Count
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={config.freezeInventory ? 'text-green-600' : 'text-red-600'}>{config.freezeInventory ? '✓' : '✕'}</span> Freeze Stock
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <button onClick={() => handleOpenModal(config)} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><EditIcon /></button>
                                        <button onClick={() => setConfirmDelete(config)} className="p-1 text-red-600 hover:bg-red-100 rounded"><DeleteIcon /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingConfig ? "Edit Configuration" : "New Configuration"}>
                <div className="space-y-4">
                    <Input id="configName" label="Configuration Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Annual Wall-to-Wall Count" required />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Input as="select" id="countType" label="Count Type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} required>
                            <option value="FULL">Full Count</option>
                            <option value="CYCLE">Cycle Count</option>
                            <option value="ADHOC">Adhoc Count</option>
                        </Input>
                        <Input as="select" id="frequency" label="Frequency" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})} required>
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                            <option value="ANNUALLY">Annually</option>
                            <option value="ADHOC">Ad-hoc</option>
                        </Input>
                    </div>

                    {formData.type === 'CYCLE' && (
                        <Input id="durationDays" label="Duration (Days)" type="number" value={formData.durationDays || 1} onChange={e => setFormData({...formData, durationDays: Number(e.target.value)})} min={1} />
                    )}

                    <div className="space-y-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-slate-50">
                            <input type="checkbox" checked={formData.blindCount} onChange={e => setFormData({...formData, blindCount: e.target.checked})} className="h-4 w-4 text-indigo-600 rounded" />
                            <span className="text-sm font-medium text-slate-700">Blind Count (Hide System Quantity)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-slate-50">
                            <input type="checkbox" checked={formData.freezeInventory} onChange={e => setFormData({...formData, freezeInventory: e.target.checked})} className="h-4 w-4 text-indigo-600 rounded" />
                            <span className="text-sm font-medium text-slate-700">Freeze Inventory Movements</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Configuration</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDelete} 
                title="Delete Configuration" 
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This will not affect past sessions.`} 
            />
        </div>
    );
};

export default StockTakeSetup;
