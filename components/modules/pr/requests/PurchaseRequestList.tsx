import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, collectionGroup, where } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { PurchaseRequisition } from '../../../../types/pr_types';
import Button from '../../../Button';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';

interface PurchaseRequestListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
    onViewPR?: (pr: PurchaseRequisition) => void;
    onEditRequest?: (pr: PurchaseRequisition) => void;
    onViewWorkOrder?: (wo: any) => void;
    viewMode: 'new' | 'converted';
    onCreate?: () => void;
}

const StatCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4" style={{ borderColor: color }}>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
);

export const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({ organisation, theme, currentUser, onViewPR, viewMode, onCreate, onEditRequest }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'open' | 'in_progress' | 'others' | 'closed'>('open');
    const [requests, setRequests] = useState<PurchaseRequisition[]>([]);
    const [loading, setLoading] = useState(true);

    // Hierarchy for filtering
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]); // Level 5 nodes (warehouses)
    const [hierarchyMap, setHierarchyMap] = useState<Map<string, HierarchyNode>>(new Map()); // id -> node
    
    // Filters
    const [filterLevel2, setFilterLevel2] = useState('');
    const [filterLevel5, setFilterLevel5] = useState('');

    useEffect(() => {
        const fetchHierarchy = async () => {
             const groupQ = db.collectionGroup('level_5').where('sectionType', '>=', 'Capital Inventory').where('sectionType', '<', 'Capital Inventory\uf8ff');
             const snap = await groupQ.get();
             const nodes = snap.docs
                .filter(d => d.ref.path.includes(organisation.domain))
                .map(d => {
                    const data = d.data();
                    const pathParts = d.ref.path.split('/');
                    return { 
                        id: d.id, 
                        path: d.ref.path, 
                        ...data,
                        level2Id: pathParts[5],
                        level3Id: pathParts[7],
                        level4Id: pathParts[9]
                    } as HierarchyNode & { level2Id: string, level3Id: string, level4Id: string };
                });
             
             setHierarchy(nodes);
             setHierarchyMap(new Map(nodes.map(n => [n.id, n])));
        };
        fetchHierarchy();
    }, [organisation.domain]);

    useEffect(() => {
        setLoading(true);
        const prRef = collection(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions`);
        const q = query(prRef, orderBy('createdAt', 'desc'));
        
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => {
                const d = doc.data();
                const whNode = hierarchyMap.get(d.warehouseId);
                return {
                    id: doc.id,
                    ...d,
                    warehouseName: whNode?.name || d.warehouseId,
                    warehousePath: whNode?.path || ''
                } as PurchaseRequisition & { warehousePath?: string };
            });
            setRequests(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching PRs:", err);
            setLoading(false);
        });
        
        return () => unsub();
    }, [organisation.domain, hierarchyMap]); 

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            // Exclude DRAFT globally
            if (req.status === 'DRAFT') return false;

            if (activeTab === 'open') {
                return req.status === 'APPROVED';
            } else if (activeTab === 'in_progress') {
                return ['IN_PROCESS', 'PROCESSED'].includes(req.status);
            } else if (activeTab === 'others') {
                // Return items that are not in the main processing pipeline and not closed/draft
                return ['CREATED', 'LINKED', 'AUTO_SUPERSEDED'].includes(req.status);
            } else if (activeTab === 'closed') {
                return ['CLOSED', 'FULFILLED', 'REJECTED', 'NOT_REQUIRED'].includes(req.status);
            }

            // Dashboard items (all except draft)
            return true;
        }).filter(req => {
            if (filterLevel5 && req.warehouseId !== filterLevel5) return false;
            const node = hierarchyMap.get(req.warehouseId) as (HierarchyNode & { level2Id: string }) | undefined;
            if (node && filterLevel2 && node.level2Id !== filterLevel2) return false;
            return true;
        });
    }, [requests, activeTab, filterLevel2, filterLevel5, hierarchyMap]);

    const stats = useMemo(() => {
        const active = requests.filter(r => r.status !== 'DRAFT');
        const newReqs = active.filter(r => r.status === 'APPROVED').length;
        const processing = active.filter(r => ['IN_PROCESS', 'PROCESSED'].includes(r.status)).length;
        const others = active.filter(r => ['CREATED', 'LINKED', 'AUTO_SUPERSEDED'].includes(r.status)).length;
        const closed = active.filter(r => ['CLOSED', 'FULFILLED', 'REJECTED', 'NOT_REQUIRED'].includes(r.status)).length;
        return { total: active.length, newReqs, processing, others, closed };
    }, [requests]);

    const TabButton: React.FC<{ id: string, label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
            {label}
        </button>
    );
    
    const getStatusChip = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-800';
            case 'IN_PROCESS': return 'bg-blue-100 text-blue-800';
            case 'PROCESSED': return 'bg-purple-100 text-purple-800';
            case 'CREATED': return 'bg-indigo-100 text-indigo-800';
            case 'LINKED': return 'bg-teal-100 text-teal-800';
            case 'REJECTED': return 'bg-red-100 text-red-800';
            case 'AUTO_SUPERSEDED': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading && hierarchy.length === 0) return <div className="p-8 text-center">Loading requests...</div>;

    return (
        <div className="space-y-6 flex flex-col h-full max-h-[calc(100vh-160px)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0 px-1">
                <h3 className="text-xl font-bold text-slate-800">Requisitions</h3>
                
                <div className="flex gap-2 flex-wrap">
                    <select className="p-2 border rounded text-sm w-32 bg-white" value={filterLevel2} onChange={e => setFilterLevel2(e.target.value)}>
                        <option value="">Entity (All)</option>
                        {Array.from(new Set(hierarchy.map(h => (h as any).level2Id))).map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                     <select className="p-2 border rounded text-sm w-32 bg-white" value={filterLevel5} onChange={e => setFilterLevel5(e.target.value)}>
                        <option value="">Warehouse (All)</option>
                        {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    {onCreate && <Button onClick={onCreate} className="!w-auto">Create PR</Button>}
                </div>
            </div>

            <div className="border-b border-slate-200 flex-shrink-0 bg-white">
                <nav className="-mb-px flex space-x-4">
                    <TabButton id="dashboard" label="Overview" />
                    <TabButton id="open" label="New" />
                    <TabButton id="in_progress" label="Processing" />
                    <TabButton id="others" label="Others" />
                    <TabButton id="closed" label="Closed" />
                </nav>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                {activeTab === 'dashboard' ? (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-1 overflow-y-auto max-h-full">
                        <StatCard title="Total" value={stats.total} color={theme.colorPrimary} />
                        <StatCard title="Approved" value={stats.newReqs} color="#10b981" />
                        <StatCard title="Processing" value={stats.processing} color="#3b82f6" />
                        <StatCard title="Others" value={stats.others} color="#6366f1" />
                        <StatCard title="Closed" value={stats.closed} color="#64748b" />
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">PR Number</th>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Warehouse</th>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Items</th>
                                        <th className="px-6 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-blue-600 font-bold">{req.prNumber}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-800">{req.warehouseName}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-500">{req.lines?.length || 0} Line(s)</div>
                                                <div className="truncate max-w-xs font-medium">{req.lines?.[0]?.description || 'No Description'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusChip(req.status)}`}>
                                                    {req.status.replace('_', ' ')}
                                                </span>
                                                {req.poNumber && <div className="text-[10px] text-slate-500 mt-1">PO: {req.poNumber}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => onViewPR && onViewPR(req)} 
                                                    className="text-blue-600 hover:underline font-bold"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRequests.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-500 italic">No requisitions found in this category.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
