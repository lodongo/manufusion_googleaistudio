import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { MaintenanceInterval } from '../../../../types/am_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { defaultAmIntervals } from '../../../../constants/am_intervals';

const IntervalsSubTab: React.FC = () => {
    const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState<MaintenanceInterval | null>(null);

    const collectionRef = collection(db, 'modules/AM/intervals');

    useEffect(() => {
        const q = query(collectionRef, orderBy('code'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setIntervals(snapshot.docs.map(doc => ({ ...doc.data() } as MaintenanceInterval)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSeed = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            defaultAmIntervals.forEach(item => {
                batch.set(doc(collectionRef, item.code), item);
            });
            await batch.commit();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleToggle = async (item: MaintenanceInterval) => {
        try {
            await setDoc(doc(collectionRef, item.code), { ...item, enabled: !item.enabled });
            setConfirmToggle(null);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 italic">Loading intervals...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Time-Based Frequencies</h3>
                {needsSeeding && (
                    <Button onClick={handleSeed} isLoading={isSeeding} className="!w-auto !py-1.5 text-xs">
                        Seed Default Intervals
                    </Button>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">Visual</th>
                            <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">Code</th>
                            <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase">Description</th>
                            <th className="px-4 py-2 text-center text-[10px] font-black text-slate-400 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {intervals.map(item => (
                            <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="w-4 h-4 rounded shadow-sm border border-slate-200" style={{ backgroundColor: item.color || '#CBD5E1' }}></div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">{item.code}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.name}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{item.description}</td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => setConfirmToggle(item)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                                            item.enabled ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
                                        }`}
                                    >
                                        {item.enabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmationModal
                isOpen={!!confirmToggle}
                onClose={() => setConfirmToggle(null)}
                onConfirm={() => confirmToggle && handleToggle(confirmToggle)}
                title={confirmToggle?.enabled ? "Disable Interval?" : "Enable Interval?"}
                message={`Are you sure you want to change the status of "${confirmToggle?.name}"?`}
            />
        </div>
    );
};

export default IntervalsSubTab;