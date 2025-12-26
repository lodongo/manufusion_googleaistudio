
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { PurchaseRequisition, PRLineItem } from '../../../../types/pr_types';
import type { Organisation, AppUser } from '../../../../types';

interface PrDetailsTabProps {
    pr: PurchaseRequisition;
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

// Interfaces for MRP Data Structure
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

interface ExtendedPRLine extends PRLineItem {
    policy?: MrpPolicy;
    mrp?: MrpExecutionData;
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

const PrDetailsTab: React.FC<PrDetailsTabProps> = ({ pr, organisation, theme, currentUser }) => {
    const [warehouseName, setWarehouseName] = useState(pr.warehouseName || '');
    const [loadingName, setLoadingName] = useState(false);

    // Helper to resolve warehouse path to name if missing
    useEffect(() => {
        const resolveWarehouseName = async () => {
            const rawPr = pr as any;
            if (!warehouseName && rawPr.warehousePath) {
                setLoadingName(true);
                try {
                    const docRef = doc(db, rawPr.warehousePath);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setWarehouseName(snap.data()?.name || 'Unknown Warehouse');
                    }
                } catch (e) {
                    console.error("Error resolving warehouse name", e);
                    setWarehouseName('Unknown Location');
                } finally {
                    setLoadingName(false);
                }
            } else if (!warehouseName && pr.warehouseId) {
                 // Try to use ID if path is missing (fallback)
                 setWarehouseName(pr.warehouseId);
            }
        };
        resolveWarehouseName();
    }, [pr, warehouseName]);

    const formatDate = (val: any) => {
        if (!val) return '-';
        if (val.toDate) return val.toDate().toLocaleString();
        return String(val);
    };

    const extendedLines = pr.lines as ExtendedPRLine[];
    const isAuto = (pr as any).isAuto || (pr as any).auto?.isAuto;
    const type = (pr as any).type || pr.source?.kind || 'Manual';

    return (
        <div className="space-y-6 bg-slate-50/50 p-2 rounded-lg">
            {/* 1. Master Header Section */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Requisition ID</p>
                    <p className="text-lg font-mono font-bold text-slate-800">{pr.prNumber}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Warehouse / Location</p>
                    <p className="text-sm font-medium text-slate-800">
                        {loadingName ? 'Resolving...' : warehouseName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pr.warehouseId}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Generation Details</p>
                    <div className="flex gap-2 mt-1">
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{type}</span>
                        {isAuto && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">AUTO</span>}
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
                         <span><strong>Updated:</strong> {extendedLines[0]?.mrp?.updatedAt ? formatDate(extendedLines[0].mrp.updatedAt) : '-'}</span>
                         <span><strong>Requester:</strong> {pr.requestedBy?.name || 'System'}</span>
                         <span><strong>Notes:</strong> {pr.notes || 'None'}</span>
                     </div>
                </div>
            </div>

            {/* 2. Detailed Breakdown (Showing MRP Logic if available) */}
            <div className="space-y-4">
                {extendedLines.map((line, idx) => {
                     const policy = line.policy;
                     const mrp = line.mrp;
                     
                    return (
                        <div key={idx} className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                            {/* Line Header */}
                            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-sm font-bold text-slate-700">
                                        {line.materialCode}
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-800 text-sm block text-left">
                                            {line.description}
                                        </span>
                                        <span className="text-[10px] text-slate-500">Material ID: {line.materialId}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Quantity</span>
                                    <span className="text-xl font-bold text-green-600">{line.quantity} <span className="text-sm text-slate-500 font-normal">{line.uom}</span></span>
                                </div>
                            </div>

                            {/* Detailed Grid - Only render detail blocks if policy/mrp data exists */}
                            {(policy || mrp) ? (
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    
                                    {/* A. Inventory Position */}
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

                                    {/* B. Demand & Supply */}
                                    <DetailBlock title="B. Demand & Pipeline">
                                        <KeyVal label="Gross Demand" value={policy?.grossNeeded} />
                                        <KeyVal label="Pipeline (Incoming)" value={policy?.pipelineAllPR} />
                                        <KeyVal label="Other PRs" value={policy?.pipelineOtherPR} />
                                        <KeyVal label="Total Received" value={policy?.receivedQuantity} />
                                        <KeyVal label="Total Requested" value={policy?.requestedQuantity} />
                                        <KeyVal label="Annual Usage" value={policy?.annualUsageQuantity} />
                                        <KeyVal label="Daily Usage" value={policy?.dailyUsage?.toFixed(4)} />
                                    </DetailBlock>

                                    {/* C. Safety & Limits (Policy) */}
                                    <DetailBlock title="C. Policy Parameters">
                                        <KeyVal label="Min / Safety Stock" value={policy?.safetyStockQty} />
                                        <KeyVal label="Reorder Point (ROP)" value={policy?.reorderPointQty} />
                                        <KeyVal label="ROP Effective" value={policy?.reorderPointEffective} />
                                        <KeyVal label="Max Stock Level" value={policy?.maxStockLevel} />
                                        <KeyVal label="Desired Max (Eff)" value={policy?.desiredMaxEffective} />
                                        <KeyVal label="Target Days Supply" value={policy?.targetDaysSupply} />
                                        <KeyVal label="Target Qty" value={policy?.targetDaysQty} />
                                    </DetailBlock>

                                    {/* D. Calculation Logic */}
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
                            ) : (
                                <div className="p-4 text-center text-slate-500 italic">
                                    Standard manual request. No detailed planning data available.
                                </div>
                            )}
                            
                            {/* E. Advanced / Arrays */}
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
        </div>
    );
};

export default PrDetailsTab;
