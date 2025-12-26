import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collectionGroup, query, where, onSnapshot, orderBy, limit, collection, getDocs } from 'firebase/firestore';
import { MaterialMasterData, Organisation } from '../../../../types';
import { MaterialMovement } from '../../../../types/in_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';

// Compact Stat Card Component
const CompactStat: React.FC<{ label: string; value: string; subtext?: string; colorClass?: string }> = ({ label, value, subtext, colorClass = "text-slate-800" }) => (
    <div className="flex flex-col px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${colorClass}`}>{value}</span>
            {subtext && <span className="text-[10px] text-slate-500 font-bold uppercase">{subtext}</span>}
        </div>
    </div>
);

const getServiceLevelColor = (target: number) => {
    const p = Math.max(0, Math.min(1, (target - 65) / (99.6 - 65)));
    const r = Math.round(239 + (34 - 239) * p);
    const g = Math.round(68 + (197 - 68) * p);
    const b = Math.round(68 + (94 - 68) * p);
    return `rgb(${r}, ${g}, ${b})`;
};

interface MaterialVendorRecord {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    priority: number;
    hasAgreement: boolean;
    agreementStatus: 'Active' | 'Inactive' | 'Draft';
    agreementRef?: string;
    price?: number;
    currency?: string;
    leadTimeDays?: number;
    minOrderQty?: number;
    validTo?: string;
    validFrom?: string; 
}

interface ConfigAuditRecord {
    id: string;
    date: any;
    userName: string;
    source: 'Manual' | 'Forecasting';
    capitalImpact: number;
    details: string;
}

interface ActivityLogRecord {
    id: string;
    timestamp: any;
    userName: string;
    tab: string;
    action: string;
    details: string;
}

interface MaterialDashboardTabProps {
    material: MaterialMasterData;
    organisation: Organisation;
    warehousePath?: string | null;
    currencyConfig: { local: string; base: string; rate: number };
}

const TransactionPreviewModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    data: any; 
    type: 'ISSUE' | 'RECEIPT' | 'ADJUSTMENT' | 'AGREEMENT';
    currencyConfig: { local: string; base: string; rate: number };
    viewCurrency: 'local' | 'base';
}> = ({ isOpen, onClose, data, type, currencyConfig, viewCurrency }) => {
    if (!isOpen || !data) return null;

    const formatMoney = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        const symbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;
        return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    let title = "Details";
    if (type === 'ISSUE') title = `Issue Slip: ${data.code || 'Pending'}`;
    if (type === 'ADJUSTMENT') title = `PI Document: ${data.piNumber || 'Pending'}`;
    if (type === 'RECEIPT') title = `Receipt: ${data.poNumber || 'Direct'}`;
    if (type === 'AGREEMENT') title = `Sourcing Agreement: ${data.vendorName}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
            <div className="space-y-6">
                {type === 'ISSUE' && (
                    <>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-sm">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</p>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                    {data.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</p>
                                <p className="font-semibold text-slate-700">{data.createdAt?.toDate().toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Work Order</p>
                                <p className="font-mono text-indigo-600 font-bold">{data.workOrderDisplayId || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Requested By</p>
                                <p className="font-medium text-slate-700 truncate">{data.createdBy?.name}</p>
                            </div>
                            <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Asset / Cost Center</p>
                                <p className="text-sm text-slate-800">{data.assetDetails?.name} <span className="text-slate-400">|</span> {data.assetDetails?.location}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                                Issued Items
                            </h4>
                            <div className="border rounded-lg overflow-hidden shadow-sm">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="bg-slate-100 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold text-slate-600">Material</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Quantity</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Unit Cost</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.items?.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800">{item.materialName}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{item.materialCode}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">{item.issuedQuantity} <span className="text-slate-400 font-normal">{item.uom}</span></td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatMoney(item.unitPrice)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatMoney(item.totalCost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right font-bold text-slate-500 uppercase text-xs">Total Value</td>
                                            <td className="px-4 py-2 text-right font-bold text-indigo-700">{formatMoney(data.totalCost || 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </>
                )}
                {type === 'ADJUSTMENT' && (
                     <>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-sm">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batch Name</p>
                                <p className="font-semibold text-slate-800">{data.batchName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scheduled</p>
                                <p className="font-medium text-slate-700">{data.scheduledDate}</p>
                            </div>
                             <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${data.status === 'SETTLED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {data.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Counted By</p>
                                <p className="font-medium text-slate-700">{data.countedBy || 'Pending'}</p>
                            </div>
                        </div>
                        <div>
                             <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                Count Variances
                            </h4>
                            <div className="border rounded-lg overflow-hidden shadow-sm max-h-80 overflow-y-auto">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold text-slate-600">Material</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">System</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Counted</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Var Qty</th>
                                            <th className="px-4 py-2 font-semibold text-slate-600 text-right">Var Val</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.items?.map((item: any, idx: number) => {
                                            const variance = (item.countedQuantity || 0) - (item.systemQuantity || 0);
                                            const varValue = variance * (item.unitCost || 0);
                                            return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2 text-slate-700">{item.materialName}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{item.systemQuantity}</td>
                                                <td className="px-4 py-2 text-right font-medium text-slate-800">{item.countedQuantity}</td>
                                                <td className={`px-4 py-2 text-right font-bold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                                                    {variance > 0 ? '+' : ''}{variance}
                                                </td>
                                                 <td className={`px-4 py-2 text-right font-mono text-xs ${varValue !== 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                                    {formatMoney(varValue)}
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                     </>
                )}
                {type === 'AGREEMENT' && (
                    <>
                         <div className="bg-gradient-to-r from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 flex justify-between items-start shadow-sm">
                             <div>
                                 <div className="flex items-center gap-3 mb-1">
                                     <h3 className="text-xl font-bold text-emerald-900">{data.vendorName}</h3>
                                     <span className="bg-white border border-emerald-200 text-emerald-700 text-xs px-2 py-0.5 rounded font-mono">
                                         {data.vendorCode}
                                     </span>
                                 </div>
                                 <p className="text-sm text-emerald-700">Priority {data.priority} Supplier</p>
                             </div>
                             <div className="text-right">
                                 <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase border ${data.agreementStatus === 'Active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                     {data.hasAgreement ? `${data.agreementStatus} Agreement` : 'Spot Buy (No Agreement)'}
                                 </div>
                                 {data.agreementRef && <p className="text-xs text-slate-500 mt-2 font-mono">Ref: {data.agreementRef}</p>}
                             </div>
                         </div>
                         {data.hasAgreement ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                     <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b pb-2">Commercial Terms</h4>
                                     <div className="grid grid-cols-2 gap-y-4">
                                         <div>
                                             <p className="text-xs text-slate-400">Unit Price</p>
                                             <p className="text-lg font-bold text-slate-800">{formatMoney(data.price || 0)}</p>
                                         </div>
                                         <div>
                                             <p className="text-xs text-slate-400">MOQ</p>
                                             <p className="text-lg font-bold text-slate-800">{data.minOrderQty || 1}</p>
                                         </div>
                                         <div>
                                              <p className="text-xs text-slate-400">Lead Time</p>
                                              <p className="text-base font-semibold text-slate-800">{data.leadTimeDays || '-'} Days</p>
                                         </div>
                                         <div>
                                             <p className="text-xs text-slate-400">Original Currency</p>
                                             <p className="text-base font-semibold text-slate-800">{data.currency || 'N/A'}</p>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                     <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b pb-2">Validity & Performance</h4>
                                      <div className="grid grid-cols-2 gap-y-4">
                                         <div>
                                             <p className="text-xs text-slate-400">Valid From</p>
                                             <p className="text-sm font-medium text-slate-700">{data.validFrom || 'N/A'}</p>
                                         </div>
                                         <div>
                                             <p className="text-xs text-slate-400">Valid To</p>
                                             <p className="text-sm font-medium text-slate-700">{data.validTo || 'N/A'}</p>
                                         </div>
                                         <div className="col-span-2">
                                             <p className="text-xs text-slate-400 mb-1">Contract Status</p>
                                              <div className="w-full bg-slate-100 rounded-full h-2">
                                                  <div className="bg-emerald-500 h-2 rounded-full" style={{width: '65%'}}></div>
                                              </div>
                                         </div>
                                      </div>
                                 </div>
                             </div>
                         ) : (
                             <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                 <p className="text-slate-500 mb-2">No formal agreement configured.</p>
                             </div>
                         )}
                    </>
                )}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button onClick={onClose} variant="secondary">Close Details</Button>
                </div>
            </div>
        </Modal>
    );
};

const MaterialDashboardTab: React.FC<MaterialDashboardTabProps> = ({ material, organisation, warehousePath, currencyConfig }) => {
    const [movements, setMovements] = useState<MaterialMovement[]>([]);
    const [vendors, setVendors] = useState<MaterialVendorRecord[]>([]);
    const [auditLogs, setAuditLogs] = useState<ConfigAuditRecord[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');
    
    const [previewData, setPreviewData] = useState<any>(null);
    const [previewType, setPreviewType] = useState<'ISSUE' | 'RECEIPT' | 'ADJUSTMENT' | 'AGREEMENT'>('ISSUE');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        // Ensure path starts from root for collectionGroup check
        const movementsRef = collectionGroup(db, 'materialMovements');
        const qMovements = query(movementsRef, where('materialId', '==', material.id), orderBy('date', 'desc'), limit(50));
        
        const unsubMovements = onSnapshot(qMovements, (snapshot) => {
            const orgMovements = snapshot.docs
                .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(doc => ({ id: doc.id, ...doc.data() } as MaterialMovement));
            setMovements(orgMovements);
            setLoading(false);
        }, (err) => { console.error("Movement Fetch Error:", err); setLoading(false); });

        // Logic for fetching vendors correctly
        const fetchVendors = async () => {
             // 1. Warehouse level vendors
             const whVendorsPath = warehousePath ? `${warehousePath}/vendors` : null;
             // 2. Master level vendors
             const masterVendorsPath = `organisations/${organisation.domain}/modules/IN/masterData/${material.id}/vendors`;
             
             try {
                 let fetchedVendors: MaterialVendorRecord[] = [];
                 if (whVendorsPath) {
                     const snap = await getDocs(query(collection(db, whVendorsPath), orderBy('priority', 'asc')));
                     fetchedVendors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialVendorRecord));
                 }
                 
                 // If warehouse has none or we are in master mode, try master data level
                 if (fetchedVendors.length === 0) {
                     const snap = await getDocs(query(collection(db, masterVendorsPath), orderBy('priority', 'asc')));
                     fetchedVendors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialVendorRecord));
                 }
                 setVendors(fetchedVendors);
             } catch (e) {
                 console.error("Vendor fetch failed", e);
             }
        };

        // Fetch Config Audit Logs
        const auditRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData/${material.id}/configAudit`);
        const qAudit = query(auditRef, orderBy('date', 'desc'), limit(50));
        const unsubAudit = onSnapshot(qAudit, (snapshot) => {
             setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConfigAuditRecord)));
        });

        // Fetch General Activity Logs
        const activityRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData/${material.id}/activityLogs`);
        const qActivity = query(activityRef, orderBy('timestamp', 'desc'), limit(50));
        const unsubActivity = onSnapshot(qActivity, (snapshot) => {
             setActivityLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLogRecord)));
        });

        fetchVendors();
        return () => { unsubMovements(); unsubAudit(); unsubActivity(); };
    }, [material.id, warehousePath, organisation.domain]);

    const stats = useMemo(() => {
        const issues = movements.filter(m => m.type === 'ISSUE');
        const totalIssued = issues.reduce((acc, m) => acc + m.quantity, 0);
        const now = new Date();
        const oldestDate = issues.length > 0 ? issues[issues.length - 1].date.toDate() : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const daysSpan = Math.max(1, (now.getTime() - oldestDate.getTime()) / (1000 * 3600 * 24));
        const dailyAvg = totalIssued / daysSpan;
        const lastReceipt = movements.find(m => m.type === 'RECEIPT');
        const lastCost = lastReceipt?.unitPrice || material.procurementData?.standardPrice || 0;
        return { dailyAvg, monthlyAvg: dailyAvg * 30, lastCost };
    }, [movements, material.procurementData]);

    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || val === null) return '-';
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const symbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    const inventoryStatus = useMemo(() => {
        const current = material.inventoryData?.issuableQuantity || 0;
        const min = material.inventoryData?.minStockLevel || 0;
        const rop = material.inventoryData?.reorderPointQty || 0;
        const max = material.inventoryData?.maxStockLevel || 0;
        if (current <= min) return { label: 'CRITICALLY LOW', color: 'bg-red-600 text-white animate-pulse', icon: '⚠️' };
        if (current < rop) return { label: 'UNDERSTOCK', color: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: '📉' };
        if (current > max) return { label: 'OVERSTOCK', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: '📈' };
        return { label: 'HEALTHY', color: 'bg-green-50 text-green-800 border-green-200', icon: '✅' };
    }, [material.inventoryData]);

    const valueAnalysis = useMemo(() => {
        const actualQty = material.inventoryData?.issuableQuantity || 0;
        const idealQty = material.inventoryData?.maxStockLevel || 0;
        const unitPrice = stats.lastCost;
        
        const actualValue = actualQty * unitPrice;
        const idealValue = idealQty * unitPrice;
        const varianceAbs = actualValue - idealValue;
        const variancePct = idealValue > 0 ? (varianceAbs / idealValue) * 100 : 0;

        return { actualValue, idealValue, varianceAbs, variancePct };
    }, [material.inventoryData, stats.lastCost]);

    const getMovementColor = (type: string, quantity: number) => {
        switch(type) {
            case 'ISSUE': return 'border-l-4 border-rose-500 bg-rose-50/30';
            case 'RECEIPT': return 'border-l-4 border-blue-500 bg-blue-50/30';
            case 'ADJUSTMENT':
                return quantity >= 0 ? 'border-l-4 border-sky-500 bg-sky-50/30' : 'border-l-4 border-amber-500 bg-amber-50/30';
            default: return 'border-l-4 border-slate-300';
        }
    };

    const handleReferenceClick = async (mov: MaterialMovement) => {
        setPreviewData(null);
        if (mov.type === 'ISSUE' && mov.salesOrderCode) {
             setPreviewType('ISSUE'); setIsPreviewOpen(true);
             const q = query(collection(db, `organisations/${organisation.domain}/modules/IN/salesOrders`), where('code', '==', mov.salesOrderCode));
             const snap = await getDocs(q);
             if (!snap.empty) setPreviewData(snap.docs[0].data());
        } else if (mov.type === 'ADJUSTMENT' && mov.reason) {
             setPreviewType('ADJUSTMENT'); setIsPreviewOpen(true);
             const piMatch = mov.reason.match(/(PI-\d{4}-\d+)/);
             if (piMatch) {
                 const q = query(collectionGroup(db, 'countSheets'), where('piNumber', '==', piMatch[1]));
                 const snap = await getDocs(q);
                 if (!snap.empty) setPreviewData(snap.docs[0].data());
             }
        }
    };

    const handleViewAgreement = (v: MaterialVendorRecord) => {
        setPreviewType('AGREEMENT');
        setPreviewData(v);
        setIsPreviewOpen(true);
    };

    return (
        <div className="p-6 bg-slate-50 min-h-full space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Dashboard {warehousePath && <span className="text-slate-400 font-normal text-sm ml-2">| {material.allocationLevel5Name}</span>}</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
                    <button onClick={() => setViewCurrency('local')} className={`px-4 py-1 text-xs font-black rounded-md transition-all ${viewCurrency === 'local' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{currencyConfig.local}</button>
                    <button onClick={() => setViewCurrency('base')} className={`px-4 py-1 text-xs font-black rounded-md transition-all ${viewCurrency === 'base' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{currencyConfig.base}</button>
                </div>
            </div>

            {/* Key Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <CompactStat label="Stock On Hand" value={String(material.inventoryData?.issuableQuantity || 0)} subtext={material.inventoryData?.inventoryUom} colorClass="text-indigo-600" />
                <CompactStat label="Monthly Usage" value={stats.monthlyAvg.toFixed(0)} subtext="Avg. Units" />
                <CompactStat label="Unit Value" value={`${symbol} ${formatCurrency(stats.lastCost)}`} colorClass="text-emerald-600" />
                <CompactStat label="Actual Stock Value" value={`${symbol} ${formatCurrency(valueAnalysis.actualValue)}`} colorClass="text-slate-700" />
            </div>

            {/* Stock Value Analysis Block */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                <div className="relative z-10">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Stock Value Analysis
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ideal Stock Value (At Max)</p>
                             <div className="flex items-baseline gap-2">
                                 <span className="text-3xl font-black text-slate-800">{symbol} {formatCurrency(valueAnalysis.idealValue)}</span>
                                 <span className="text-xs text-slate-400 font-bold uppercase">{material.inventoryData?.maxStockLevel || 0} Units</span>
                             </div>
                             <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Target maximum operational capital</p>
                        </div>
                        <div className="md:border-x border-slate-100 md:px-8">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Absolute Variance</p>
                             <span className={`text-3xl font-black ${valueAnalysis.varianceAbs > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                 {valueAnalysis.varianceAbs > 0 ? '+' : ''}{symbol} {formatCurrency(valueAnalysis.varianceAbs)}
                             </span>
                             <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Deviation from target maximum</p>
                        </div>
                        <div className="text-center md:text-left">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Percentage Variance</p>
                             <div className="flex items-center gap-3">
                                 <span className={`text-4xl font-black ${valueAnalysis.variancePct > 50 ? 'text-rose-600' : valueAnalysis.variancePct > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                     {valueAnalysis.variancePct > 0 ? '+' : ''}{valueAnalysis.variancePct.toFixed(1)}%
                                 </span>
                                 <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${valueAnalysis.variancePct > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                     {valueAnalysis.variancePct > 0 ? 'EXCESS' : 'OPTIMIZED'}
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stocking Parameters & Strategic Results */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl overflow-hidden relative h-full">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Strategic Classification
                    </h4>
                    <div className="grid grid-cols-3 gap-6">
                        <div className="text-center md:text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact</p>
                            <span className={`text-4xl font-black ${material.inventoryData?.criticalityClass === 'A' ? 'text-rose-600' : 'text-slate-800'}`}>{material.inventoryData?.criticalityClass || 'N/A'}</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{material.inventoryData?.criticalityScore || 0} Points</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost Class</p>
                            <span className="text-4xl font-black text-slate-800">{material.inventoryData?.costClass || 'N/A'}</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Category {material.inventoryData?.costClass}</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Affinity</p>
                            <span className="text-4xl font-black tabular-nums" style={{ color: getServiceLevelColor(material.inventoryData?.serviceLevelTarget || 0) }}>
                                {material.inventoryData?.serviceLevelTarget?.toFixed(1) || 'N/A'}%
                            </span>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Service Level</p>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                         <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${inventoryStatus.color}`}>
                             <span>{inventoryStatus.icon}</span>
                             <span>{inventoryStatus.label}</span>
                         </div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">Calculated by Criticality Engine</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl h-full">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Stocking Parameters
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Min</span>
                            <p className="text-2xl font-black text-slate-800 mt-1">{material.inventoryData?.minStockLevel || 0}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Max</span>
                            <p className="text-2xl font-black text-slate-800 mt-1">{material.inventoryData?.maxStockLevel || 0}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-center">
                            <span className="text-[10px] font-black text-blue-400 uppercase">ROP</span>
                            <p className="text-2xl font-black text-blue-700 mt-1">{material.inventoryData?.reorderPointQty || 0}</p>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-center">
                            <span className="text-[10px] font-black text-indigo-400 uppercase">Safety</span>
                            <p className="text-2xl font-black text-indigo-700 mt-1">{material.inventoryData?.safetyStockQty || 0}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic mt-6 text-center">Method: <span className="font-bold text-slate-600 uppercase tracking-widest">{material.inventoryData?.stockLevelDetermination || 'Manual'}</span></p>
                </div>
            </div>

            {/* Audit Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                {/* 1. Configuration & Capital Audit */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[400px]">
                    <div className="px-6 py-4 border-b bg-slate-900 flex justify-between items-center flex-shrink-0">
                        <div>
                            <h4 className="font-black text-xs text-white uppercase tracking-[0.2em]">Configuration & Capital Audit</h4>
                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">Stocking Decision Trail</p>
                        </div>
                        <span className="bg-slate-800 text-slate-400 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Cap Ledger</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 font-black uppercase text-[10px] tracking-widest">Date / Time</th>
                                    <th className="px-6 py-3 text-right font-black uppercase text-[10px] tracking-widest">Capital Shift</th>
                                    <th className="px-6 py-3 font-black uppercase text-[10px] tracking-widest">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                                            {log.date?.toDate().toLocaleString()}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono font-black ${log.capitalImpact > 0 ? 'text-rose-600' : log.capitalImpact < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {log.capitalImpact > 0 ? '+' : ''}{formatCurrency(log.capitalImpact)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] text-slate-800 font-bold">{log.userName}</div>
                                            <div className="text-[10px] text-slate-500 italic truncate max-w-[150px]" title={log.details}>{log.details}</div>
                                        </td>
                                    </tr>
                                ))}
                                {auditLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-16 text-center text-slate-400 italic">No capital changes recorded.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Material Activity Ledger */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[400px]">
                    <div className="px-6 py-4 border-b bg-indigo-900 flex justify-between items-center flex-shrink-0">
                        <div>
                            <h4 className="font-black text-xs text-white uppercase tracking-[0.2em]">Material Activity Ledger</h4>
                            <p className="text-[9px] text-slate-300 uppercase font-bold tracking-widest mt-1">Unified configuration history</p>
                        </div>
                        <span className="bg-indigo-950 text-indigo-400 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Event Log</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 font-black uppercase text-[10px] tracking-widest">Event Time</th>
                                    <th className="px-6 py-3 font-black uppercase text-[10px] tracking-widest">Tab</th>
                                    <th className="px-6 py-3 font-black uppercase text-[10px] tracking-widest">Action / Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {activityLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                                            {log.timestamp?.toDate().toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                                log.tab === 'Procurement' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                log.tab === 'Inventory' ? 'bg-green-50 text-green-700 border-green-200' :
                                                log.tab === 'Classification' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                log.tab === 'Binning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                                {log.tab}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] text-slate-800 font-bold">{log.action}</div>
                                            <div className="text-[10px] text-slate-500 italic truncate max-w-[200px]" title={log.details}>
                                                <span className="font-bold not-italic mr-1">{log.userName}:</span>
                                                {log.details}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {activityLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-16 text-center text-slate-400 italic">No activity recorded for this material.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col h-[400px]">
                    <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center flex-shrink-0">
                        <h4 className="font-black text-xs text-slate-700 uppercase tracking-widest">Recent Movements</h4>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Record</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-5 py-3 font-black uppercase text-[10px] tracking-widest">Date</th>
                                    <th className="px-5 py-3 font-black uppercase text-[10px] tracking-widest">Type</th>
                                    <th className="px-5 py-3 font-black uppercase text-[10px] tracking-widest">Reference</th>
                                    <th className="px-5 py-3 text-right font-black uppercase text-[10px] tracking-widest">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {movements.map(mov => (
                                    <tr key={mov.id} className={`hover:bg-slate-50 cursor-pointer group transition-colors ${getMovementColor(mov.type, mov.quantity)}`} onClick={() => handleReferenceClick(mov)}>
                                        <td className="px-5 py-2.5 text-slate-500 text-xs font-mono">{mov.date?.toDate().toLocaleDateString()}</td>
                                        <td className="px-5 py-2.5">
                                            <span className="font-black text-[10px] tracking-widest uppercase">{mov.type}</span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="text-xs font-bold text-indigo-600 underline underline-offset-2 decoration-indigo-200 group-hover:decoration-indigo-600 transition-colors truncate max-w-[150px]">
                                                {mov.salesOrderCode || mov.reason || 'Manual Record'}
                                            </div>
                                        </td>
                                        <td className={`px-5 py-2.5 text-right font-black font-mono ${mov.quantity > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                            {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                        </td>
                                    </tr>
                                ))}
                                {movements.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-slate-400 italic">No movements recorded for this material.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Approved Vendors Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col h-[400px]">
                    <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center flex-shrink-0">
                        <h4 className="font-black text-xs text-slate-700 uppercase tracking-widest">Approved Vendors</h4>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sourcing Matrix</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-5 py-3 font-black uppercase text-[10px] tracking-widest">Vendor</th>
                                    <th className="px-4 py-3 font-black uppercase text-[10px] tracking-widest">Agreement</th>
                                    <th className="px-4 py-3 text-right font-black uppercase text-[10px] tracking-widest">Price</th>
                                    <th className="px-4 py-3 text-center font-black uppercase text-[10px] tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {vendors.map(v => {
                                    const isActive = v.hasAgreement && v.agreementStatus === 'Active';
                                    return (
                                        <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${isActive ? 'bg-emerald-50/50' : ''}`}>
                                            <td className="px-5 py-3">
                                                <div className="font-bold text-slate-800 text-xs">{v.vendorName}</div>
                                                <div className="text-[9px] text-slate-400 font-mono tracking-tighter uppercase">{v.vendorCode}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isActive ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Active Agreement</span>
                                                        <span className="text-[10px] font-mono text-slate-500">{v.agreementRef}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Spot Buy</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                                                {v.price ? `${symbol} ${formatCurrency(v.price)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {v.hasAgreement && (
                                                    <button 
                                                        onClick={() => handleViewAgreement(v)}
                                                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest underline underline-offset-4 decoration-indigo-200"
                                                    >
                                                        Show Agreement
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {vendors.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-slate-400 italic">No approved vendors found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <TransactionPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} data={previewData} type={previewType} currencyConfig={currencyConfig} viewCurrency={viewCurrency} />
        </div>
    );
};

export default MaterialDashboardTab;