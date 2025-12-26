import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../../types';
import Input from '../../../Input';
import MaterialApprovalModal from '../MaterialApprovalModal';

interface MaterialRequestsListProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

type RequestItem = (MaterialMasterData & { 
    path?: string; 
    type?: 'EXTENSION' | 'REMOVAL' | 'NEW_MATERIAL';
    targetWarehouse?: string;
    allocationLevel4Name?: string;
    allocationLevel5Name?: string;
    materialName?: string;
});

const MaterialRequestsList: React.FC<MaterialRequestsListProps> = ({ currentUser, theme, organisation }) => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);

    useEffect(() => {
        setLoading(true);
        const masterDataRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);
        const extensionsRef = collection(db, `organisations/${organisation.domain}/modules/IN/extensions`);

        const qMaster = query(masterDataRef, where('status', 'in', ['Pending Approval', 'Rejected']), orderBy('createdAt', 'desc'));
        const qExt = query(extensionsRef, where('status', 'in', ['Pending Approval', 'Rejected']), orderBy('createdAt', 'desc'));

        let masterItems: RequestItem[] = [];
        let extItems: RequestItem[] = [];
        
        const updateState = () => {
            const combined = [...masterItems, ...extItems].sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
            setRequests(combined);
            setLoading(false);
        };

        const unsubMaster = onSnapshot(qMaster, (snap) => {
            masterItems = snap.docs.map(doc => ({ 
                id: doc.id, 
                path: doc.ref.path, 
                type: 'NEW_MATERIAL' as const,
                ...doc.data() 
            } as RequestItem));
            updateState();
        });

        const unsubExt = onSnapshot(qExt, (snap) => {
            extItems = snap.docs.map(doc => ({ 
                id: doc.id, 
                path: doc.ref.path, 
                ...doc.data() 
            } as RequestItem));
            updateState();
        });

        return () => { unsubMaster(); unsubExt(); };
    }, [organisation.domain]);

    const filteredRequests = requests.filter(req => {
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return (
            (req.materialCode || '').toLowerCase().includes(lower) ||
            (req.procurementComponentName || '').toLowerCase().includes(lower) ||
            (req.materialTypeName || '').toLowerCase().includes(lower) ||
            (req.type || '').toLowerCase().includes(lower)
        );
    });

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'Pending Approval': return 'bg-yellow-100 text-yellow-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    const getTypeChip = (type: string = 'NEW_MATERIAL') => {
        switch (type) {
            case 'NEW_MATERIAL': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'EXTENSION': return 'bg-green-50 text-green-700 border-green-100';
            case 'REMOVAL': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-50 text-gray-700';
        }
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-b-lg shadow-md">
            <div className="flex justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-slate-800">Material Requests <span className="text-sm font-normal text-slate-500 ml-2">({filteredRequests.length})</span></h2>
                <Input
                    label=""
                    id="search-requests"
                    type="search"
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    containerClassName="w-full md:w-72 mb-0"
                />
            </div>

            {loading ? (
                <div className="text-center py-10">Loading requests...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Name / Code</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Target Location</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Requested By</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Status</th>
                                <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded border ${getTypeChip(req.type)}`}>
                                            {req.type === 'NEW_MATERIAL' ? 'NEW ITEM' : req.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-slate-900">{req.procurementComponentName || req.materialName}</div>
                                        <div className="text-xs text-slate-500 font-mono">{req.materialCode || 'Pending Code'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                        {req.allocationLevel5Name ? `${req.allocationLevel4Name} > ${req.allocationLevel5Name}` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                        <div>{req.createdBy?.name}</div>
                                        <div className="text-xs">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                        <button onClick={() => setSelectedRequest(req)} className="hover:underline" style={{color: theme.colorPrimary}}>
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRequests.length === 0 && <p className="text-center py-8 text-slate-500">No pending or rejected requests found.</p>}
                </div>
            )}
            
            {selectedRequest && (
                <MaterialApprovalModal
                    isOpen={!!selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    material={selectedRequest as any}
                    currentUser={currentUser}
                    organisation={organisation}
                    theme={theme}
                />
            )}
        </div>
    );
};

export default MaterialRequestsList;
