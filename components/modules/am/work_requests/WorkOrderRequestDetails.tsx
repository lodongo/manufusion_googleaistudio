

import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { WorkOrder, WorkRequest } from '../../../../types/am_types';
// FIX: Add 'firebase/compat/firestore' import to ensure that Firestore types and methods are correctly augmented for the compat library.
import 'firebase/compat/firestore';

interface WorkOrderRequestDetailsProps {
  workOrder: WorkOrder;
}

const DetailItem: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm text-slate-900">{value || 'N/A'}</dd>
    </div>
);

const WorkOrderRequestDetails: React.FC<WorkOrderRequestDetailsProps> = ({ workOrder }) => {
    const [workRequest, setWorkRequest] = useState<WorkRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!workOrder.workRequestRef) {
            setError('Work Request reference is missing.');
            setLoading(false);
            return;
        }

        const fetchWorkRequest = async () => {
            setLoading(true);
            setError('');
            try {
                // FIX: Use db.doc(...) instead of doc(db, ...) to align with Firebase v8 compat syntax. Imported 'doc' is not necessary.
                const wrDocRef = db.doc(workOrder.workRequestRef);
                const wrDocSnap = await wrDocRef.get();

                if (wrDocSnap.exists) {
                    setWorkRequest({ id: wrDocSnap.id, ...wrDocSnap.data() } as WorkRequest);
                } else {
                    setError('Original Work Request not found.');
                }
            } catch (err: any) {
                setError('Failed to fetch Work Request details.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWorkRequest();
    }, [workOrder.workRequestRef]);

    if (loading) {
        return <div className="p-8 text-center">Loading original request details...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    if (!workRequest) {
        return <div className="p-8 text-center text-slate-500">No Work Request found.</div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-700">Original Request Details ({workRequest.wrId})</h3>
                <p className="mt-1 text-sm text-slate-600">{workRequest.description}</p>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                <DetailItem label="Status" value={workRequest.status} />
                <DetailItem label="Request Date" value={workRequest.requestDate} />
                <DetailItem label="Created At" value={workRequest.createdAt.toDate().toLocaleString()} />
                <DetailItem label="Created By" value={workRequest.createdBy.name} />
                <DetailItem label="Raised By" value={workRequest.raisedBy.name} />
                <DetailItem label="Tag Source" value={workRequest.tagSource} />
            </dl>

            <div className="pt-4 border-t">
                <h4 className="text-md font-medium text-slate-800 mb-2">Location & Asset</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    <DetailItem label="Lvl 3 (Site)" value={workRequest.allocationLevel3Name} />
                    <DetailItem label="Lvl 4 (Department)" value={workRequest.allocationLevel4Name} />
                    <DetailItem label="Lvl 5 (Section)" value={workRequest.allocationLevel5Name} />
                    <DetailItem label="Lvl 6 (Asset)" value={workRequest.allocationLevel6Name} />
                    <DetailItem label="Lvl 7 (Assembly)" value={workRequest.allocationLevel7Name} />
                </dl>
            </div>

            <div className="pt-4 border-t">
                <h4 className="text-md font-medium text-slate-800 mb-2">Impact</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    <DetailItem label="Category" value={workRequest.impactCategoryName} />
                    <DetailItem label="Subcategory" value={workRequest.impactSubcategoryName} />
                </dl>
                <p className="text-sm text-slate-600 mt-2 p-3 bg-slate-100 rounded-md">{workRequest.impactSubcategoryDescription}</p>
            </div>
        </div>
    );
};

export default WorkOrderRequestDetails;
