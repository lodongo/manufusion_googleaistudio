import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder, WorkRequest } from '../../../../types/am_types';
import WorkRequestDetailModal from '../work_requests/WorkRequestDetailModal';
// FIX: Add 'firebase/compat/firestore' import to ensure that Firestore types and methods are correctly augmented for the compat library.
import 'firebase/compat/firestore';


interface WorkOrderListProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
}

const WorkOrderList: React.FC<WorkOrderListProps> = ({ currentUser, theme, organisation, onSelectWorkOrder }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<WorkRequest | null>(null);

  useEffect(() => {
    const workOrdersRef = db.collection('organisations').doc(organisation.domain).collection('workOrders');
    const q = workOrdersRef.orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      setWorkOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder)));
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [organisation.domain]);

  const handleShowRequest = async (wrId: string) => {
    const wrRef = db.collection('organisations').doc(organisation.domain).collection('workRequests');
    const q = wrRef.where('wrId', '==', wrId);
    const snapshot = await q.get();
    if (!snapshot.empty) {
        const wrDoc = snapshot.docs[0];
        setSelectedRequest({ id: wrDoc.id, ...wrDoc.data() } as WorkRequest);
    } else {
        console.error("Original Work Request not found!");
        alert(`Could not find the original Work Request with ID: ${wrId}`);
    }
  };
  
  const getStatusChip = (status: WorkOrder['status']) => {
    switch (status) {
        case 'OPEN': return 'bg-blue-100 text-blue-800';
        case 'SCHEDULED': return 'bg-cyan-100 text-cyan-800';
        case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
        case 'COMPLETED': return 'bg-purple-100 text-purple-800';
        case 'CLOSED': return 'bg-green-100 text-green-800';
        case 'CANCELLED': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) return <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin" style={{borderColor: theme.colorPrimary}}></div></div>;

  return (
    <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Work Order List</h2>
        
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-200 border rounded-lg">
             {workOrders.map(wo => (
                <div key={wo.id} className="p-4 bg-white" onClick={() => onSelectWorkOrder(wo)}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-mono text-sm font-semibold" style={{color: theme.colorPrimary}}>{wo.woId}</p>
                            <p className="font-bold text-slate-800">{wo.title}</p>
                        </div>
                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(wo.status)}`}>
                            {wo.status}
                        </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <p><strong>Original WR:</strong> <button onClick={(e) => { e.stopPropagation(); handleShowRequest(wo.wrId); }} className="font-mono hover:underline">{wo.wrId}</button></p>
                        <p><strong>Asset:</strong> {wo.allocationLevel6Name || 'N/A'}</p>
                        <p><strong>Created:</strong> {wo.createdBy.name} on {wo.createdAt.toDate().toLocaleDateString()}</p>
                    </div>
                </div>
             ))}
        </div>


        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">WO ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">WR ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Asset</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {workOrders.map(wo => (
                        <tr key={wo.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button onClick={() => onSelectWorkOrder(wo)} className="font-mono hover:underline" style={{color: theme.colorPrimary}}>
                                    {wo.woId}
                                </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button onClick={() => handleShowRequest(wo.wrId)} className="font-mono hover:underline text-slate-600">
                                    {wo.wrId}
                                </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{wo.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{wo.allocationLevel6Name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(wo.status)}`}>
                                    {wo.status}
                                </span>
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                <div>{wo.createdBy.name}</div>
                                <div>{wo.createdAt.toDate().toLocaleDateString()}</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {workOrders.length === 0 && <p className="text-center py-8 text-slate-500">No work orders found.</p>}
        </div>
        {selectedRequest && (
            <WorkRequestDetailModal
                request={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                onEdit={() => {}} // Read-only from this view
                currentUser={currentUser}
                organisation={organisation}
                theme={theme}
            />
        )}
    </div>
  );
};

export default WorkOrderList;