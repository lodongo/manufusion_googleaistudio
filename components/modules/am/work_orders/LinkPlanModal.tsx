
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { MaintenancePlan, WorkOrderTask } from '../../../../types/am_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import 'firebase/compat/firestore';

interface LinkPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisationDomain: string;
    workOrderId: string;
    workOrderLocation: { l3Id: string; l4Id: string; l5Id: string; };
    onLinkComplete: () => void;
}

// Helper to get ISO week number
const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const LinkPlanModal: React.FC<LinkPlanModalProps> = ({ isOpen, onClose, organisationDomain, workOrderId, workOrderLocation, onLinkComplete }) => {
    const [plans, setPlans] = useState<MaintenancePlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                setLoading(true);
                setValidationError(null);
                
                const currentYear = new Date().getFullYear();
                const currentWeek = getISOWeek(new Date());

                try {
                    // 1. Fetch Plans (Base filter: OPEN status)
                    const plansRef = db.collection(`organisations/${organisationDomain}/modules/AM/maintenancePlans`);
                    const q = plansRef.where('status', '==', 'OPEN').orderBy('createdAt', 'desc');
                    const plansSnapshot = await q.get();
                    
                    const allOpenPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenancePlan));

                    // 2. Client-side Filter: Location Match + Not Current Week
                    const filteredPlans = allOpenPlans.filter(p => {
                        const isSameLocation = 
                            (p.allocationLevel3Id === workOrderLocation.l3Id) &&
                            (p.allocationLevel4Id === workOrderLocation.l4Id) &&
                            (p.allocationLevel5Id === workOrderLocation.l5Id);
                        
                        // Exclude if it is in the current week of current year
                        const isCurrentWeek = p.year === currentYear && p.week === currentWeek;

                        return isSameLocation && !isCurrentWeek;
                    });

                    setPlans(filteredPlans);

                    // 3. Validate Work Order Tasks
                    const tasksRef = db.collection(`organisations/${organisationDomain}/modules/AM/workOrders/${workOrderId}/tasks`);
                    const tasksSnapshot = await tasksRef.get();
                    const tasks = tasksSnapshot.docs.map(doc => doc.data() as WorkOrderTask);
                    
                    if (tasks.length === 0) {
                        setValidationError("This Work Order has no tasks. Add at least one task to link.");
                    } else {
                        const hasSafeTask = tasks.some(t => {
                            if (!t.riskAssessments || t.riskAssessments.length === 0) return false; 
                            return t.riskAssessments.every(ra => ra.isResidualTolerable);
                        });

                        if (!hasSafeTask) {
                            setValidationError("Cannot link: At least one task must have a completed safety analysis with tolerable residual risk.");
                        }
                    }

                } catch (e) {
                    console.error("Error fetching data:", e);
                    setValidationError("Failed to validate work order status.");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [isOpen, organisationDomain, workOrderId, workOrderLocation]);

    const handleLink = async () => {
        if (!selectedPlanId) return;
        setSaving(true);
        try {
            const plan = plans.find(p => p.id === selectedPlanId);
            if (!plan) return;

            // Using compat syntax doc()
            await db.doc(`organisations/${organisationDomain}/modules/AM/workOrders/${workOrderId}`).update({
                pmNumber: plan.planId,
                scheduledStartDate: plan.scheduledStartDate,
                scheduledEndDate: plan.scheduledEndDate,
                status: 'SCHEDULED'
            });
            onLinkComplete();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to link plan.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link to Maintenance Plan">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">Select an open maintenance plan to assign this work order to.</p>
                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border">
                    <strong>Filters applied:</strong>
                    <ul className="list-disc list-inside mt-1">
                        <li>Matches Site, Department, and Section</li>
                        <li>Status is OPEN</li>
                        <li>Not scheduled for the current week</li>
                    </ul>
                </div>
                
                {loading ? (
                    <div className="p-4 text-center text-slate-500">Validating...</div>
                ) : validationError ? (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                        <p className="font-bold mb-1">Link Unavailable</p>
                        <p>{validationError}</p>
                    </div>
                ) : (
                    <>
                        {plans.length === 0 ? (
                            <p className="text-center text-slate-500 italic p-4">No matching maintenance plans available.</p>
                        ) : (
                            <select 
                                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                                value={selectedPlanId}
                                onChange={e => setSelectedPlanId(e.target.value)}
                            >
                                <option value="">Select a Plan...</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.planId} - {p.planName} (Wk {p.week}, {p.year})
                                    </option>
                                ))}
                            </select>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={onClose} disabled={saving} className="!w-auto">Cancel</Button>
                            <Button onClick={handleLink} isLoading={saving} disabled={!selectedPlanId || saving} className="!w-auto">Link</Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default LinkPlanModal;
