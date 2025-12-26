
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { collection, doc, onSnapshot, updateDoc, query, orderBy, runTransaction } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { TaxRegime, TaxRange } from '../../../types/fi_types';
import Button from '../../Button';
import Input from '../../Input';
import Modal from '../../common/Modal';
import ConfirmationModal from '../../common/ConfirmationModal';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const TaxRegimeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<TaxRegime, 'id'>) => void;
    regime?: TaxRegime | null;
}> = ({ isOpen, onClose, onSave, regime }) => {
    const [formData, setFormData] = useState<Omit<TaxRegime, 'id'>>({
        name: '', code: '', type: 'Constant', calculation: 'Percentage', value: 0, ranges: [], enabled: true
    });
    const isEditing = !!regime;

    useEffect(() => {
        if (isOpen) {
            setFormData(regime ? { ...regime } : {
                name: '', code: '', type: 'Constant', calculation: 'Percentage', value: 0, ranges: [], enabled: true
            });
        }
    }, [isOpen, regime]);

    const handleAddRange = () => {
        setFormData(p => ({ ...p, ranges: [...(p.ranges || []), { min: 0, max: null, value: 0 }] }));
    };

    const handleRangeChange = (index: number, field: keyof TaxRange, value: string) => {
        const newRanges = [...(formData.ranges || [])];
        if (field === 'max' && value === '') {
             newRanges[index][field] = null;
        } else {
             newRanges[index][field] = Number(value);
        }
        setFormData(p => ({ ...p, ranges: newRanges }));
    };
    
    const handleRemoveRange = (index: number) => {
        setFormData(p => ({ ...p, ranges: p.ranges?.filter((_, i) => i !== index) }));
    };

    const handleSubmit = () => {
        if (!formData.name) return;
        onSave(formData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={regime ? 'Edit Tax Regime' : 'Add Tax Regime'} size="lg">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    {isEditing ? (
                        <Input id="code" label="Code" value={formData.code} disabled />
                    ) : (
                        <Input id="code" label="Code" value="Auto-generated" disabled />
                    )}
                    <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                </div>
                
                <Input id="description" label="Description" as="textarea" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Type</label>
                        <select value={formData.type} onChange={e => setFormData(p => ({...p, type: e.target.value as any}))} className="mt-1 block w-full p-2 border rounded-md">
                            <option value="Constant">Constant Rate</option>
                            <option value="Dynamic">Dynamic (Ranges)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Calculation Method</label>
                        <select value={formData.calculation} onChange={e => setFormData(p => ({...p, calculation: e.target.value as any}))} className="mt-1 block w-full p-2 border rounded-md">
                            <option value="Percentage">Percentage (%)</option>
                            <option value="Fixed Amount">Fixed Amount</option>
                        </select>
                    </div>
                </div>

                {formData.type === 'Constant' ? (
                    <Input id="val" label={`Value ${formData.calculation === 'Percentage' ? '(%)' : ''}`} type="number" value={formData.value || 0} onChange={e => setFormData(p => ({...p, value: Number(e.target.value)}))} />
                ) : (
                    <div className="border rounded p-3 bg-slate-50">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold">Tax Ranges</h4>
                            <button onClick={handleAddRange} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">+ Add Range</button>
                        </div>
                        {(!formData.ranges || formData.ranges.length === 0) && <p className="text-xs text-slate-400 italic">No ranges defined.</p>}
                        {formData.ranges?.map((range, idx) => (
                            <div key={idx} className="flex gap-2 items-end mb-2">
                                <Input id={`min-${idx}`} label="Min Amount" type="number" value={range.min} onChange={e => handleRangeChange(idx, 'min', e.target.value)} containerClassName="!mb-0 flex-1" />
                                <Input id={`max-${idx}`} label="Max Amount (Leave empty for ∞)" type="number" value={range.max === null ? '' : range.max} onChange={e => handleRangeChange(idx, 'max', e.target.value)} containerClassName="!mb-0 flex-1" placeholder="Infinity"/>
                                <Input id={`val-${idx}`} label={`Tax ${formData.calculation === 'Percentage' ? '(%)' : ''}`} type="number" value={range.value} onChange={e => handleRangeChange(idx, 'value', e.target.value)} containerClassName="!mb-0 flex-1" />
                                <button onClick={() => handleRemoveRange(idx)} className="mb-2 text-red-500 hover:text-red-700">✕</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center pt-2">
                    <input type="checkbox" id="enabled" checked={formData.enabled} onChange={e => setFormData(p => ({...p, enabled: e.target.checked}))} className="h-4 w-4 rounded border-gray-300" />
                    <label htmlFor="enabled" className="ml-2 text-sm text-slate-700">Enabled</label>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSubmit}>Save Regime</Button>
                </div>
            </div>
        </Modal>
    );
};

const TaxSetupTab: React.FC<{ organisation: Organisation }> = ({ organisation }) => {
    const [regimes, setRegimes] = useState<TaxRegime[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean, data?: TaxRegime | null }>({ open: false, data: null });
    const [confirmDelete, setConfirmDelete] = useState<TaxRegime | null>(null);

    const collectionRef = collection(db, `organisations/${organisation.domain}/modules/FI/taxRegimes`);

    useEffect(() => {
        const q = query(collectionRef, orderBy('name'));
        const unsub = onSnapshot(q, snap => {
            setRegimes(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaxRegime)));
            setLoading(false);
        });
        return () => unsub();
    }, [organisation.domain]);

    const handleSave = async (data: Omit<TaxRegime, 'id'>) => {
        if (modal.data) {
            await updateDoc(doc(collectionRef, modal.data.id), data);
        } else {
             // Generate Code
             const counterRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/counters`);
             const newCode = await runTransaction(db, async (t) => {
                 const docSnap = await t.get(counterRef);
                 const count = (docSnap.data()?.taxRegimeCounter || 0) + 1;
                 t.set(counterRef, { taxRegimeCounter: count }, { merge: true });
                 return `TX${String(count).padStart(4, '0')}`;
             });
             
             // Create with new code, using auto-generated ID from doc()
             const newDocRef = doc(collectionRef);
             await runTransaction(db, async (t) => {
                t.set(newDocRef, { ...data, code: newCode });
             });
        }
    };

    const handleDelete = async () => {
        if (confirmDelete) {
            await runTransaction(db, async (t) => {
                 t.delete(doc(collectionRef, confirmDelete.id));
            });
            setConfirmDelete(null);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading tax regimes...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Tax Regimes</h3>
                <Button onClick={() => setModal({ open: true, data: null })}>Add New Tax Regime</Button>
            </div>
            
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Name (Code)</th>
                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Calculation</th>
                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Value / Structure</th>
                            <th className="px-6 py-3 text-center font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {regimes.map(regime => (
                            <tr key={regime.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {regime.name} <span className="text-xs text-slate-500 font-mono ml-1">({regime.code})</span>
                                    <div className="text-xs text-slate-500 font-normal">{regime.description}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{regime.type}</td>
                                <td className="px-6 py-4 text-slate-600">{regime.calculation}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    {regime.type === 'Constant' ? (
                                        <span className="font-bold">{regime.value}{regime.calculation === 'Percentage' ? '%' : ''}</span>
                                    ) : (
                                        <span className="text-xs italic">{regime.ranges?.length || 0} Ranges defined</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${regime.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {regime.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setModal({ open: true, data: regime })} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><EditIcon/></button>
                                        <button onClick={() => setConfirmDelete(regime)} className="text-red-600 hover:bg-red-50 p-1 rounded"><DeleteIcon/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {regimes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No tax regimes defined.</td></tr>}
                    </tbody>
                </table>
            </div>

            {modal.open && <TaxRegimeModal isOpen={modal.open} onClose={() => setModal({ open: false })} onSave={handleSave} regime={modal.data} />}
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title="Delete Tax Regime" message="Are you sure? This cannot be undone." />
        </div>
    );
};

export default TaxSetupTab;
