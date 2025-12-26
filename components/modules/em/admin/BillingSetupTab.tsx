
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, addDoc, limit } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { EnergyBillingComponent, EnergyUtilitySettings, EnergyCategory, TariffUpdateLog } from '../../../../types/em_types';
import Button from '../../../Button';
import Input from '../../../Input';
import BillingComponentModal from './BillingComponentModal';
import ConfirmationModal from '../../../common/ConfirmationModal';
import Modal from '../../../common/Modal';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const BillingSetupTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'], currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [settings, setSettings] = useState<EnergyUtilitySettings>({ meterNumber: '', meterFactor: 1, providerName: '', accountNumber: '', currency: organisation.currency.code, isTouEnabled: false, billingDay: 1 });
    const [components, setComponents] = useState<EnergyBillingComponent[]>([]);
    const [categories, setCategories] = useState<EnergyCategory[]>([]);
    const [latestRates, setLatestRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    
    const [modal, setModal] = useState<{ open: boolean, data?: EnergyBillingComponent | null }>({ open: false, data: null });
    const [catModal, setCatModal] = useState<{ open: boolean, data?: EnergyCategory | null }>({ open: false, data: null });
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'comp' | 'cat', data: any } | null>(null);

    const modulePath = `organisations/${organisation.domain}/modules/EM`;
    const settingsDocPath = `${modulePath}/settings/billing`;
    const componentsColl = `${modulePath}/billingComponents`;
    const categoriesColl = `${modulePath}/billingCategories`;

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, settingsDocPath), snap => {
            if (snap.exists) setSettings(snap.data() as EnergyUtilitySettings);
        });

        const unsubCats = onSnapshot(query(collection(db, categoriesColl), orderBy('order')), snap => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyCategory)));
        });

        const unsubComps = onSnapshot(query(collection(db, componentsColl), orderBy('order')), snap => {
            setComponents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyBillingComponent)));
            setLoading(false);
        });

        // Fetch latest rates from history
        const monthStr = new Date().toISOString().slice(0, 7);
        const unsubRates = onSnapshot(query(collection(db, `${modulePath}/monthlyAdjustments/${monthStr}/history`), orderBy('timestamp', 'desc'), limit(1)), snap => {
            if (!snap.empty) {
                setLatestRates((snap.docs[0].data() as TariffUpdateLog).values);
            }
        });

        return () => { unsubSettings(); unsubComps(); unsubCats(); unsubRates(); };
    }, [settingsDocPath, componentsColl, categoriesColl, modulePath]);

    const handleSaveCategory = async (data: Partial<EnergyCategory>) => {
        const ref = data.id ? doc(db, `${categoriesColl}/${data.id}`) : doc(collection(db, categoriesColl));
        const payload = { 
            ...data, 
            id: ref.id,
            order: data.order ?? (categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1)
        };
        await setDoc(ref, payload, { merge: true });
    };

    const handleSaveComponent = async (data: Partial<EnergyBillingComponent>) => {
        const ref = data.id ? doc(db, `${componentsColl}/${data.id}`) : doc(collection(db, componentsColl));
        const payload = { 
            ...data, 
            id: ref.id,
            order: data.order ?? (components.length > 0 ? Math.max(...components.map(c => c.order)) + 1 : 1)
        };
        await setDoc(ref, payload, { merge: true });
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const coll = confirmDelete.type === 'cat' ? categoriesColl : componentsColl;
        await deleteDoc(doc(db, `${coll}/${confirmDelete.data.id}`));
        setConfirmDelete(null);
    };

    if (loading) return <div className="p-12 text-center text-slate-400 italic">Initializing tariff configuration...</div>;

    return (
        <div className="space-y-8 mt-6">
            {/* Categories Management */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tariff Categories</h3>
                    <button onClick={() => setCatModal({ open: true })} className="text-xs font-bold text-indigo-600 hover:underline">+ New Category</button>
                </div>
                <div className="flex flex-wrap gap-3">
                    {categories.map(cat => (
                        <div key={cat.id} className="group flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition-all hover:border-indigo-300">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black">Order: {cat.order}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button onClick={() => setCatModal({ open: true, data: cat })} className="text-slate-400 hover:text-indigo-600"><EditIcon/></button>
                                <button onClick={() => setConfirmDelete({ type: 'cat', data: cat })} className="text-slate-400 hover:text-red-600"><DeleteIcon/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Components Management */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Master Tariff Components</h3>
                    <Button onClick={() => setModal({ open: true, data: null })} className="!w-auto">+ Add Component</Button>
                </div>
                
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase text-[10px]">Classification</th>
                                <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase text-[10px]">Category</th>
                                <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase text-[10px]">Component</th>
                                <th className="px-6 py-4 text-right font-bold text-slate-400 uppercase text-[10px]">Active Rate</th>
                                <th className="px-6 py-4 text-right font-bold text-slate-400 uppercase text-[10px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {components.map((comp) => {
                                const hasMultiValues = comp.method === 'Tiered' || comp.method === 'TimeOfUse';
                                
                                return (
                                    <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                comp.type === 'Consumption' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                comp.type === 'Tax' ? 'bg-red-50 border-red-200 text-red-700' :
                                                'bg-slate-50 border-slate-200 text-slate-700'
                                            }`}>{comp.type}</span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-tight">
                                            {categories.find(c => c.id === comp.categoryId)?.name || 'Uncategorized'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800">{comp.name}</p>
                                            <span className="text-[10px] text-slate-400 font-mono">Method: {comp.method} {comp.unitBasis ? `(${comp.unitBasis})` : ''}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {hasMultiValues ? (
                                                 <div className="flex flex-col gap-1 items-end">
                                                    {(comp.method === 'Tiered' ? comp.tiers : comp.touSlots)?.map((sub, sIdx) => (
                                                        <div key={sIdx} className="flex gap-2 items-center">
                                                            <span className="text-[9px] text-slate-400 uppercase font-black">{(sub as any).name || `Tier ${sIdx+1}`}:</span>
                                                            <span className="font-mono font-bold text-indigo-600">
                                                                {latestRates?.[`${comp.id}_${sIdx}`] !== undefined ? Number(latestRates[`${comp.id}_${sIdx}`]).toFixed(7) : '---'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                 </div>
                                            ) : (
                                                <span className="font-mono font-bold text-indigo-600">
                                                    {latestRates?.[comp.id] !== undefined ? Number(latestRates[comp.id]).toFixed(7) : '---'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => setModal({ open: true, data: comp })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><EditIcon/></button>
                                            <button onClick={() => setConfirmDelete({ type: 'comp', data: comp })} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><DeleteIcon/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <BillingComponentModal 
                isOpen={modal.open} 
                onClose={() => setModal({open: false, data: null})} 
                onSave={handleSaveComponent} 
                componentToEdit={modal.data} 
                allComponents={components}
                categories={categories}
                currency={settings.currency}
                theme={theme}
            />

            <CategoryEntryModal 
                isOpen={catModal.open}
                onClose={() => setCatModal({ open: false, data: null })}
                onSave={handleSaveCategory}
                categoryToEdit={catModal.data}
            />

            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDelete} 
                title={`Remove ${confirmDelete?.type === 'cat' ? 'Category' : 'Component'}`} 
                message={`Are you sure you want to remove "${confirmDelete?.data.name}"?`} 
            />
        </div>
    );
};

// Internal Category Modal
const CategoryEntryModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (d: Partial<EnergyCategory>) => void, categoryToEdit?: EnergyCategory | null }> = ({ isOpen, onClose, onSave, categoryToEdit }) => {
    const [name, setName] = useState('');
    const [order, setOrder] = useState(0);
    useEffect(() => {
        if(isOpen) { setName(categoryToEdit?.name || ''); setOrder(categoryToEdit?.order || 0); }
    }, [isOpen, categoryToEdit]);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={categoryToEdit ? "Edit Category" : "New Category"}>
            <div className="space-y-4">
                <Input id="cn" label="Category Name" value={name} onChange={e => setName(e.target.value.toUpperCase())} />
                <Input id="co" label="Sort Order" type="number" value={order} onChange={e => setOrder(Number(e.target.value))} />
                <div className="flex justify-end pt-4 border-t"><Button onClick={() => onSave({ name, order, id: categoryToEdit?.id })} className="!w-auto px-10">Save Category</Button></div>
            </div>
        </Modal>
    );
};

export default BillingSetupTab;
