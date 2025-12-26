
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { WorkOrder } from '../../../../types/am_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import 'firebase/compat/firestore';

interface LinkWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisationDomain: string;
    planId: string; // The PM number e.g. PM001
    planDates: { start: string, end: string };
}

const LinkWorkOrderModal: React.FC<LinkWorkOrderModalProps> = ({ isOpen, onClose, organisationDomain, planId, planDates }) => {
    const [availableWOs, setAvailableWOs] = useState<WorkOrder[]>([]);
    const [selectedWOs, setSelectedWOs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchWOs = async () => {
            setLoading(true);
            try {
                // Using Compat syntax: db.collection(...)
                const snapshot = await db.collection(`organisations/${organisationDomain}/modules/AM/workOrders`)
                    .where('status', '==', 'OPEN')
                    .get();
                
                const wos = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder))
                    // Client-side filter to ensure we don't grab WOs already assigned to a plan
                    .filter(wo => !wo.pmNumber); 

                setAvailableWOs(wos);
            } catch (error) {
                console.error("Error fetching work orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWOs();
        setSelectedWOs(new Set());
    }, [isOpen, organisationDomain]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedWOs);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedWOs(newSet);
    };

    const handleLink = async () => {
        if (selectedWOs.size === 0) return;
        setSaving(true);
        try {
            const batch = db.batch();
            selectedWOs.forEach(woId => {
                const ref = db.doc(`organisations/${organisationDomain}/modules/AM/workOrders/${woId}`);
                batch.update(ref, {
                    pmNumber: planId,
                    scheduledStartDate: planDates.start,
                    scheduledEndDate: planDates.end,
                    status: 'SCHEDULED'
                });
            });
            await batch.commit();
            onClose();
        } catch (error) {
            console.error("Error linking work orders:", error);
            alert("Failed to link work orders.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Work Orders to Plan" size="xl">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">Select open work orders to add to maintenance plan <strong>{planId}</strong>.</p>
                
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading available work orders...</div>
                ) : availableWOs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded border border-dashed">
                        No available open work orders found.
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto border rounded-md">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 w-10">
                                        <input 
                                            type="checkbox" 
                                            onChange={(e) => setSelectedWOs(e.target.checked ? new Set(availableWOs.map(w => w.id)) : new Set())}
                                            checked={selectedWOs.size === availableWOs.length && availableWOs.length > 0}
                                        />
                                    </th>
                                    <th className="px-4 py-2">WO ID</th>
                                    <th className="px-4 py-2">Title</th>
                                    <th className="px-4 py-2">Asset</th>
                                    <th className="px-4 py-2">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {availableWOs.map(wo => (
                                    <tr key={wo.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleSelection(wo.id)}>
                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedWOs.has(wo.id)} 
                                                onChange={() => toggleSelection(wo.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-mono text-blue-600">{wo.woId}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wo.title}</td>
                                        <td className="px-4 py-3 text-slate-600">{wo.allocationLevel6Name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{wo.createdAt?.toDate().toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving} className="!w-auto">Cancel</Button>
                    <Button onClick={handleLink} isLoading={saving} disabled={selectedWOs.size === 0} className="!w-auto">
                        Link {selectedWOs.size} Work Order{selectedWOs.size !== 1 ? 's' : ''}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LinkWorkOrderModal;
