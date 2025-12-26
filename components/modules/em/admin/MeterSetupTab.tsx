
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { Meter } from '../../../../types/em_types';
import Button from '../../../Button';
import MeterModal from './MeterModal';
import MeterDetailsModal from './MeterDetailsModal';
import ConfirmationModal from '../../../common/ConfirmationModal';
import firebase from 'firebase/compat/app';

const { Timestamp } = firebase.firestore;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ActivityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;

const MeterSetupTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'], currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [meters, setMeters] = useState<Meter[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean, data?: Meter | null }>({ open: false, data: null });
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, meterId: string | null }>({ open: false, meterId: null });
    const [confirmDelete, setConfirmDelete] = useState<Meter | null>(null);

    const metersPath = `organisations/${organisation.domain}/modules/EM/meters`;

    useEffect(() => {
        const q = query(collection(db, metersPath), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMeters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meter)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [metersPath]);

    const handleSaveMeter = async (data: Partial<Meter>) => {
        const ref = data.id ? doc(db, `${metersPath}/${data.id}`) : doc(collection(db, metersPath));
        const payload = {
            ...data,
            id: ref.id,
            createdAt: data.createdAt || Timestamp.now()
        };
        await setDoc(ref, payload, { merge: true });
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        await deleteDoc(doc(db, `${metersPath}/${confirmDelete.id}`));
        setConfirmDelete(null);
    };

    if (loading) return <div className="p-12 text-center text-slate-400 italic">Synchronizing meters...</div>;

    return (
        <div className="space-y-6 mt-6">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Meter Configuration</h3>
                    <p className="text-sm text-slate-500 mt-1">Register and manage physical energy meters for real-time monitoring.</p>
                </div>
                <Button onClick={() => setModal({ open: true, data: null })} className="!w-auto">+ Add Meter</Button>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase text-[10px]">Meter Name</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase text-[10px]">Serial Number</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase text-[10px]">Network IP</th>
                            <th className="px-6 py-4 text-center font-bold text-slate-500 uppercase text-[10px]">Status</th>
                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-[10px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {meters.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">No meters registered yet.</td>
                            </tr>
                        ) : (
                            meters.map((meter) => (
                                <tr key={meter.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800">
                                        <button 
                                            onClick={() => setDetailsModal({ open: true, meterId: meter.ipAddress })}
                                            className="hover:underline text-left"
                                        >
                                            {meter.name}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-600 uppercase tracking-tight">{meter.serialNumber}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{meter.ipAddress}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                            meter.enabled ? 'bg-green-100 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                                        }`}>
                                            {meter.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button 
                                            onClick={() => setDetailsModal({ open: true, meterId: meter.ipAddress })} 
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                            title="View Live Telemetry"
                                        >
                                            <ActivityIcon />
                                        </button>
                                        <button onClick={() => setModal({ open: true, data: meter })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><EditIcon/></button>
                                        <button onClick={() => setConfirmDelete(meter)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><DeleteIcon/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <MeterModal 
                isOpen={modal.open} 
                onClose={() => setModal({ open: false, data: null })} 
                onSave={handleSaveMeter} 
                meterToEdit={modal.data} 
                theme={theme}
            />

            {detailsModal.open && detailsModal.meterId && (
                <MeterDetailsModal
                    isOpen={detailsModal.open}
                    onClose={() => setDetailsModal({ open: false, meterId: null })}
                    meterId={detailsModal.meterId}
                />
            )}

            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDelete} 
                title="Remove Meter" 
                message={`Are you sure you want to remove meter "${confirmDelete?.name}"?`} 
            />
        </div>
    );
};

export default MeterSetupTab;
