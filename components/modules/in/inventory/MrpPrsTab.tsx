import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, collectionGroup, getDocs } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { PurchaseRequisition, PRLineItem } from '../../../../types/pr_types';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';

interface MrpPrsTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
    onViewMaterial: (id: string, path?: string, tab?: string) => void;
}

// Extended interface based on provided data structure
interface MrpPolicy {
    annualUsageQuantity: number;
    availableNetQuantity: number;
    dailyUsage: number;
    desiredMaxEffective: number;
    dueNowReservations: string[];
    expiredQuantity: number;
    freeToIssueNow: number;
    grossNeeded: number;
    grossPolicyShort: number;
    maxStockLevel: number;
    onHandUsableNow: number;
    onHandUsableNowRaw: number;
    pipelineAllPR: number;
    pipelineOtherPR: number;
    policyTriggered: boolean;
    qtyToOrder: number;
    quarantinedQuantity: number;
    reorderPointEffective: number;
    reorderPointQty: number;
    reservationOrderNowQty: number;
    reservedAllocatedNow: number;
    safetyStockQty: number;
    targetDaysQty: number;
    targetDaysSupply: number;
    receivedQuantity: number;
    requestedQuantity: number;
    uom: string;
    updatedAt: any;
    warehouseId: string;
    warehousePath: string;
}

interface MrpExecutionData {
    execId: string;
    policyComponentQty: number;
    reason: string;
    reservationComponentQty: number;
    reservationNumbersDueNow: string[];
    triggerSource: string;
    updatedAt: any;
}

interface ExtendedPRLine extends Omit<PRLineItem, 'mrp' | 'policy'> {
    policy?: MrpPolicy;
    mrp?: MrpExecutionData;
}

interface ExtendedPR extends Omit<PurchaseRequisition, 'lines'> {
    lines: ExtendedPRLine[];
    warehousePath?: string; 
    isAuto?: boolean;
    type?: string;
    auto?: { isAuto: boolean };
}

const DetailBlock: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white border border-slate-200 rounded-md overflow-hidden ${className}`}>
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</h5>
        </div>
        <div className="p-3">
            {children}
        </div>
    </div>
);

const KeyVal: React.FC<{ label: string; value: any; highlight?: boolean; colorClass?: string }> = ({ label, value, highlight, colorClass }) => (
    <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-mono font-medium ${highlight ? 'text-blue-700 font-bold' : 'text-slate-700'} ${colorClass || ''}`}>
            {value === true ? 'Yes' : value === false ? 'No' : (value !== undefined && value !== null ? value : '-')}
        </span>
    </div>
);

const MrpReviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pr: ExtendedPR;
    onAction: (status: 'APPROVED' | 'REJECTED') => void;
    isProcessing: boolean;
    theme: Organisation['theme'];
    onViewMaterial: (id: string, path?: string, tab?: string) => void;
}> = ({ isOpen, onClose, pr, onAction, isProcessing, theme, onViewMaterial }) => {
    if (!isOpen) return null;

    const formatDate = (val: any) => {
        if (!val) return '-';
        if (val.toDate) return val.toDate().toLocaleString();
        return String(val);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`MRP Auto-Replenishment: ${pr.prNumber}`} size="7xl">
            <div className="space-y-6 bg-slate-50/50 p-2">
                
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Requisition ID</p>
                        <p className="text-lg font-mono font-bold text-slate-800">{pr.prNumber}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Warehouse / Location</p>
                        <p className="text-sm font-medium text-slate-800">{pr.warehouseName || 'Unknown Warehouse'}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pr.warehouseId}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Generation Details</p>
                        <div className="flex gap-2 mt-1">
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{pr.type || 'AUTO-REPLENISH'}</span>
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{pr.source?.kind || 'MRP_V1'}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                        <span className={`inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            pr.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            pr.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {pr.status}
                        </span>
                    </div>
                    <div className="col-span-2 md:col-span-4 border-t pt-2 mt-2">
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500">
                             <span><strong>Created:</strong> {formatDate(pr.createdAt)}</span>
                             <span><strong>Updated:</strong> {formatDate(pr.lines[0]?.mrp?.updatedAt || pr.createdAt)}</span>
                             <span><strong>Auto Generated:</strong> {pr.isAuto ? 'Yes' : 'No'}</span>
                             <span><strong>Notes:</strong> {pr.notes}</span>
                         </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {pr.lines.map((line, idx) => {
                         const policy = line.policy;
                         const mrp = line.mrp;
                         const matPath = pr.warehousePath 
                            ? `${pr.warehousePath}/materials/${line.materialId}`
                            : (policy?.warehousePath ? `${policy.warehousePath}/materials/${line.materialId}` : undefined);

                        return (
                            <div key={idx} className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-sm font-bold text-slate-700">
                                            {line.materialCode}
                                        </div>
                                        <div>
                                            <button 
                                                onClick={() => onViewMaterial(line.materialId, matPath)}
                                                className="font-bold text-blue-700 hover:underline text-sm block text-left"
                                            >
                                                {line.description}
                                            </button>
                                            <span className="text-[10px] text-slate-500">Material ID: {line.materialId}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {matPath && (
                                            <button 
                                                onClick={() => {
                                                    onViewMaterial(line.materialId, matPath, 'analytics');
                                                    onClose();
                                                }}
                                                className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded text-xs font-bold shadow-sm hover:bg-indigo-50 transition-colors"
                                            >
                                                Review Analysis & Forecasting
                                            </button>
                                        )}
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Quantity</span>
                                            <span className="text-xl font-bold text-green-600">{line.quantity} <span className="text-sm text-slate-500 font-normal">{line.uom}</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <DetailBlock title="A. Inventory Position">
                                        <KeyVal label="Physical On Hand" value={policy?.onHandUsableNowRaw} />
                                        <KeyVal label="Usable On Hand" value={policy?.onHandUsableNow} />
                                        <KeyVal label="Allocated/Reserved" value={policy?.reservedAllocatedNow} />
                                        <KeyVal label="Free to Issue" value={policy?.freeToIssueNow} />
                                        <KeyVal label="Quarantined" value={policy?.quarantinedQuantity} colorClass={policy?.quarantinedQuantity ? 'text-red-600' : ''}/>
                                        <KeyVal label="Expired" value={policy?.expiredQuantity} colorClass={policy?.expiredQuantity ? 'text-red-600' : ''}/>
                                        <div className="mt-2 pt-2 border-t border-slate-200">
                                            <KeyVal label="Net Available" value={policy?.availableNetQuantity} highlight />
                                        </div>
                                    </DetailBlock>

                                    <DetailBlock title="B. Demand & Pipeline">
                                        <KeyVal label="Gross Demand" value={policy?.grossNeeded} />
                                        <KeyVal label="Pipeline (Incoming)" value={policy?.pipelineAllPR} />
                                        <KeyVal label="Other PRs" value={policy?.pipelineOtherPR} />
                                        <KeyVal label="Total Received" value={policy?.receivedQuantity} />
                                        <KeyVal label="Total Requested" value={policy?.requestedQuantity} />
                                        <KeyVal label="Annual Usage" value={policy?.annualUsageQuantity} />
                                        <KeyVal label="Daily Usage" value={policy?.dailyUsage?.toFixed(4)} />
                                    </DetailBlock>

                                    <DetailBlock title="C. Policy Parameters">
                                        <KeyVal label="Min / Safety Stock" value={policy?.safetyStockQty} />
                                        <KeyVal label="Reorder Point (ROP)" value={policy?.reorderPointQty} />
                                        <KeyVal label="ROP Effective" value={policy?.reorderPointEffective} />
                                        <KeyVal label="Max Stock Level" value={policy?.maxStockLevel} />
                                        <KeyVal label="Desired Max (Eff)" value={policy?.desiredMaxEffective} />
                                        <KeyVal label="Target Days Supply" value={policy?.targetDaysSupply} />
                                        <KeyVal label="Target Qty" value={policy?.targetDaysQty} />
                                    </DetailBlock>

                                    <DetailBlock title="D. MRP Logic Trace">
                                        <KeyVal label="Execution ID" value={mrp?.execId} />
                                        <KeyVal label="Trigger Source" value={mrp?.triggerSource} highlight />
                                        <KeyVal label="Logic Reason" value={mrp?.reason} />
                                        <div className="my-1 border-t border-slate-100"></div>
                                        <KeyVal label="Shortage (Policy)" value={policy?.grossPolicyShort} colorClass="text-amber-600"/>
                                        <KeyVal label="Reservation Req." value={policy?.reservationOrderNowQty} />
                                        <KeyVal label="Policy Triggered?" value={policy?.policyTriggered} colorClass={policy?.policyTriggered ? 'text-red-600' : 'text-slate-400'} />
                                        <div className="mt-2 pt-2 border-t border-slate-200">
                                            <KeyVal label="Final Order Qty" value={policy?.qtyToOrder} highlight />
                                        </div>
                                    </DetailBlock>
                                </div>
                                
                                {(mrp?.reservationNumbersDueNow?.length || 0) > 0 && (
                                    <div className="px-4 pb-4">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                                            <span className="font-bold text-yellow-800">Triggering Reservations: </span>
                                            <span className="text-yellow-700">{mrp?.reservationNumbersDueNow.join(', ')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t mt-4 sticky bottom-0 bg-white pb-2 z-10 p-4 rounded-lg shadow-lg">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Close</Button>
                    
                    {['CREATED', 'DRAFT', 'APPROVED'].includes(pr.status) && (
                        <Button 
                            onClick={() => onAction('REJECTED')} 
                            disabled={isProcessing} 
                            className="!bg-red-50 !text-red-700 hover:!bg-red-100 !border-red-200 !w-auto"
                        >
                            {pr.status === 'APPROVED' ? 'Reverse & Reject' : 'Reject Request'}
                        </Button>
                    )}
                    
                    {['CREATED', 'DRAFT'].includes(pr.status) && (
                        <Button 
                            onClick={() => onAction('APPROVED')} 
                            isLoading={isProcessing} 
                            style={{ backgroundColor: theme.colorPrimary }}
                            className="!w-auto"
                        >
                            Approve Request
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const MrpPrsTab: React.FC<MrpPrsTabProps> = ({ organisation, theme, currentUser, onViewMaterial }) => {
    const [activeTab, setActiveTab] = useState<'open' | 'processed'>('open');
    const [prs, setPrs] = useState<ExtendedPR[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Hierarchy mapping for warehouse name resolution
    const [hierarchyMap, setHierarchyMap] = useState<Map<string, string>>(new Map());

    const [reviewPr, setReviewPr] = useState<ExtendedPR | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchHierarchy = async () => {
             try {
                const groupQ = query(collectionGroup(db, 'level_5'), where('sectionType', '>=', 'Capital Inventory'), where('sectionType', '<', 'Capital Inventory\uf8ff'));
                const snap = await getDocs(groupQ);
                const mapping = new Map<string, string>();
                snap.docs.forEach(d => {
                    if (d.ref.path.includes(organisation.domain)) {
                        mapping.set(d.id, d.data().name);
                    }
                });
                setHierarchyMap(mapping);
             } catch (e) {
                 console.error("Error fetching hierarchy map", e);
             }
        };
        fetchHierarchy();
    }, [organisation.domain]);

    useEffect(() => {
        const prRef = collection(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions`);
        const q = query(
            prRef, 
            where('notes', '==', 'System-generated PR (MRP V1).'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPrs = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    warehouseName: hierarchyMap.get(data.warehouseId) || data.warehouseName || data.warehouseId
                } as ExtendedPR;
            });
            setPrs(fetchedPrs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching MRP PRs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain, hierarchyMap]);

    const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
        if (!reviewPr) return;
        
        setProcessing(true);
        try {
            const prDocRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${reviewPr.id}`);
            const updateData: any = { status: status };
            if (status === 'APPROVED') {
                updateData.approvedAt = Timestamp.now();
            }
            await updateDoc(prDocRef, updateData);
            setReviewPr(null);
        } catch (err) {
            console.error(err);
            alert(`Failed to ${status.toLowerCase()} PR.`);
        } finally {
            setProcessing(false);
        }
    };

    const filteredPrs = useMemo(() => {
        return prs.filter(pr => {
            if (activeTab === 'open') return pr.status === 'DRAFT';
            if (activeTab === 'processed') return pr.status === 'APPROVED';
            return false;
        });
    }, [prs, activeTab]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">APPROVED</span>;
            case 'REJECTED': return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">REJECTED</span>;
            case 'PROCESSED': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">PROCESSED</span>;
            case 'CREATED': 
            case 'DRAFT': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">DRAFT</span>;
            case 'LINKED': return <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-bold">LINKED</span>;
            default: return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-bold">{status}</span>;
        }
    };

    if (loading) return <div className="p-8 text-center">Loading MRP requisitions...</div>;

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-slate-800">MRP Generated Requisitions</h3>
                <span className="text-sm text-slate-500">{filteredPrs.length} Items Found</span>
            </div>

            <div className="border-b border-slate-200 flex-shrink-0 bg-white">
                <nav className="-mb-px flex space-x-6">
                    <button
                        onClick={() => setActiveTab('open')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'open' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Open
                    </button>
                    <button
                        onClick={() => setActiveTab('processed')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'processed' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Processed
                    </button>
                </nav>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full max-h-[calc(100vh-320px)] overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">PR Number</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Warehouse</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Items</th>
                                    <th className="px-6 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredPrs.map(pr => (
                                    <tr key={pr.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-blue-600 font-bold">
                                            {pr.prNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {pr.createdAt?.toDate ? pr.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-800">
                                            {pr.warehouseName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {pr.lines.map((line, idx) => {
                                                    const matPath = pr.warehousePath 
                                                        ? `${pr.warehousePath}/materials/${line.materialId}`
                                                        : (line.policy?.warehousePath ? `${line.policy.warehousePath}/materials/${line.materialId}` : undefined);

                                                    return (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => onViewMaterial(line.materialId, matPath)}
                                                                className="text-indigo-600 hover:underline font-medium text-left truncate max-w-xs"
                                                            >
                                                                {line.description}
                                                            </button>
                                                            <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                                                x{line.quantity}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusBadge(pr.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <Button 
                                                onClick={() => setReviewPr(pr)} 
                                                className="!w-auto !py-1 !px-3 !text-xs"
                                                variant="secondary"
                                            >
                                                {activeTab === 'open' ? 'Review' : 'Details'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPrs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-400 italic">No requisitions found in this category.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {reviewPr && (
                <MrpReviewModal 
                    isOpen={!!reviewPr}
                    onClose={() => setReviewPr(null)}
                    pr={reviewPr}
                    onAction={handleAction}
                    isProcessing={processing}
                    theme={theme}
                    onViewMaterial={onViewMaterial}
                />
            )}
        </div>
    );
};

export default MrpPrsTab;