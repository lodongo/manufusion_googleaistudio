
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, Timestamp, getDocs, where, collectionGroup, getDoc } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { SalesOrder, MaterialMovement } from '../../../types/in_types';
import Button from '../../Button';
import SettleCostsModal from './SettleCostsModal';
import PurchaseOrderModal from '../pr/orders/PurchaseOrderModal'; 
import Modal from '../../common/Modal';
import Input from '../../Input';

interface SalesOrderListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
    currencyConfig: { local: string; base: string; rate: number };
}

interface IssueItemState {
    order: SalesOrder;
    item: any;
    index: number;
    maxQty: number;
    balance: number;
    stock: number;
}

const IssueQuantityModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: IssueItemState | null;
    onConfirm: (qty: number, warehousePath: string, warehouseName: string) => void;
    loading: boolean;
    organisation: Organisation;
}> = ({ isOpen, onClose, data, onConfirm, loading, organisation }) => {
    const [qty, setQty] = useState<number | ''>('');
    const [error, setError] = useState('');
    
    const [l4Options, setL4Options] = useState<{id: string, name: string}[]>([]);
    const [l5Options, setL5Options] = useState<{id: string, name: string}[]>([]);
    const [l4Id, setL4Id] = useState('');
    const [l5Id, setL5Id] = useState('');
    
    const [availStock, setAvailStock] = useState<number>(0);
    const [loadingStock, setLoadingStock] = useState(false);

    useEffect(() => {
        if (isOpen && data) {
            setQty('');
            setError('');
            setL4Options([]);
            setL5Options([]);
            setL4Id('');
            setL5Id('');
            setAvailStock(0);

            if (data.order.allocationLevel3Id) {
                 const l3Path = `organisations/${organisation.domain}/level_1/${data.order.allocationLevel1Id}/level_2/${data.order.allocationLevel2Id}/level_3/${data.order.allocationLevel3Id}`;
                 const l4Ref = collection(db, `${l3Path}/level_4`);
                 getDocs(query(l4Ref, orderBy('name'))).then(snap => {
                     setL4Options(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
                     
                     if (data.item.allocationLevel4Id) {
                         setL4Id(data.item.allocationLevel4Id);
                     } else if (data.order.allocationLevel4Id) {
                         setL4Id(data.order.allocationLevel4Id);
                     }
                 });
            }
        }
    }, [isOpen, data, organisation.domain]);

    useEffect(() => {
        if (data && l4Id) {
            const l3Path = `organisations/${organisation.domain}/level_1/${data.order.allocationLevel1Id}/level_2/${data.order.allocationLevel2Id}/level_3/${data.order.allocationLevel3Id}`;
            const l5Ref = collection(db, `${l3Path}/level_4/${l4Id}/level_5`);
            getDocs(query(l5Ref, orderBy('name'))).then(snap => {
                setL5Options(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
                
                 if (data.item.allocationLevel5Id && data.item.allocationLevel4Id === l4Id) {
                     setL5Id(data.item.allocationLevel5Id);
                 } else if (data.order.allocationLevel5Id && data.order.allocationLevel4Id === l4Id) {
                     setL5Id(data.order.allocationLevel5Id);
                 } else {
                     setL5Id('');
                 }
            });
        } else {
            setL5Options([]);
            setL5Id('');
        }
    }, [l4Id, data, organisation.domain]);

    useEffect(() => {
        if (data && l4Id && l5Id) {
            setLoadingStock(true);
             const matPath = `organisations/${organisation.domain}/level_1/${data.order.allocationLevel1Id}/level_2/${data.order.allocationLevel2Id}/level_3/${data.order.allocationLevel3Id}/level_4/${l4Id}/level_5/${l5Id}/materials/${data.item.materialId}`;
             
            getDoc(doc(db, matPath)).then(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    setAvailStock(d?.inventoryData?.issuableQuantity || 0);
                } else {
                    setAvailStock(0);
                }
                setLoadingStock(false);
            }).catch(e => {
                console.error(e);
                setAvailStock(0);
                setLoadingStock(false);
            });
        } else {
            setAvailStock(0);
        }
    }, [l4Id, l5Id, data, organisation.domain]);

    const handleConfirm = () => {
        if (!data) return;
        if (!l4Id || !l5Id) {
            setError("Please select a warehouse.");
            return;
        }

        const val = Number(qty);

        if (val <= 0) {
            setError("Quantity must be greater than 0.");
            return;
        }
        
        if (val > availStock) {
            setError(`Insufficient stock in selected warehouse. Available: ${availStock}`);
            return;
        }
        
        if (val > data.balance) {
             setError(`Quantity cannot exceed order balance (${data.balance}).`);
             return;
        }
        
        const selectedL5Name = l5Options.find(o => o.id === l5Id)?.name || 'Unknown';
        const path = `organisations/${organisation.domain}/level_1/${data.order.allocationLevel1Id}/level_2/${data.order.allocationLevel2Id}/level_3/${data.order.allocationLevel3Id}/level_4/${l4Id}/level_5/${l5Id}`;
        
        onConfirm(val, path, selectedL5Name);
    };

    if (!isOpen || !data) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Issue Material" size="md">
            <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded text-sm space-y-1 border border-slate-200">
                    <p><strong>Item:</strong> {data.item.materialName}</p>
                    <p><strong>Order Balance:</strong> {data.balance} {data.item.uom}</p>
                    {data.item.reservationId && <p className="text-blue-600 font-bold">Reservation: {data.item.reservationId}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-sm font-medium text-slate-700">Department (L4)</label>
                         <select className="mt-1 block w-full p-2 border border-slate-300 rounded-md" value={l4Id} onChange={e => setL4Id(e.target.value)}>
                             <option value="">Select Dept...</option>
                             {l4Options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-slate-700">Warehouse (L5)</label>
                         <select className="mt-1 block w-full p-2 border border-slate-300 rounded-md" value={l5Id} onChange={e => setL5Id(e.target.value)} disabled={!l4Id}>
                             <option value="">Select Warehouse...</option>
                             {l5Options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                         </select>
                     </div>
                </div>
                
                <div className="p-2 bg-blue-50 rounded text-center">
                     <p className="text-xs text-blue-600 font-bold uppercase">Stock Available in Selected Warehouse</p>
                     <p className="text-2xl font-bold text-blue-800">{loadingStock ? '...' : availStock}</p>
                </div>

                <Input 
                    id="issueQty"
                    label="Quantity to Issue"
                    type="number" 
                    value={qty} 
                    onChange={e => {
                        setQty(Number(e.target.value));
                        setError('');
                    }}
                    min={0}
                    max={Math.min(data.balance, availStock)}
                />
                
                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleConfirm} isLoading={loading}>Confirm Issue</Button>
                </div>
            </div>
        </Modal>
    );
};

const SalesOrderDetailModal: React.FC<{
    order: SalesOrder;
    isOpen: boolean;
    onClose: () => void;
    onIssueItem: (order: SalesOrder, item: any, index: number, currentStock: number) => void;
    onSettle: (order: SalesOrder) => void;
    theme: Organisation['theme'];
    viewCurrency: 'local' | 'base';
    currencyConfig: { local: string; base: string; rate: number };
}> = ({ order, isOpen, onClose, onIssueItem, onSettle, theme, viewCurrency, currencyConfig }) => {
    if (!isOpen) return null;
    const hasItemsToSettle = order.items.some(item => item.issuedQuantity > (item.settledQuantity || 0));

    const formatCurrency = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    const symbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Sales Order: ${order.code}`} size="5xl">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                    <div>
                        <p className="text-slate-500 font-medium">Work Order</p>
                        <p className="font-semibold text-slate-700">{order.workOrderDisplayId}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 font-medium">Status</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        order.status === 'SETTLED' ? 'bg-green-100 text-green-800' :
                                        order.status === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
                                        order.status === 'PARTIALLY_ISSUED' ? 'bg-orange-100 text-orange-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>{order.status}</span>
                    </div>
                    <div>
                        <p className="text-slate-500 font-medium">Total Cost</p>
                        <p className="font-semibold text-slate-700">{symbol} {formatCurrency(order.totalCost)}</p>
                    </div>
                     <div>
                        <p className="text-slate-500 font-medium">Asset</p>
                        <p className="font-semibold text-slate-700">{order.assetDetails.name}</p>
                    </div>
                     <div>
                        <p className="text-slate-500 font-medium">Location</p>
                        <p className="font-semibold text-slate-700">{order.assetDetails.location}</p>
                    </div>
                    <div>
                         <p className="text-slate-500 font-medium">Date Created</p>
                         <p className="font-semibold text-slate-700">{order.createdAt.toDate().toLocaleDateString()}</p>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-slate-700 mb-2">Order Items</h4>
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="min-w-full text-sm divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-slate-600">Item</th>
                                    <th className="px-4 py-2 text-left text-slate-600">Code</th>
                                    <th className="px-4 py-2 text-right text-slate-600">Ordered</th>
                                    <th className="px-4 py-2 text-right text-slate-600">Issued</th>
                                    <th className="px-4 py-2 text-right text-slate-600">Balance</th>
                                    <th className="px-4 py-2 text-right text-slate-600 bg-blue-50">Ref</th>
                                    <th className="px-4 py-2 text-right text-slate-600">Unit Cost</th>
                                    <th className="px-4 py-2 text-right text-slate-600">Total</th>
                                    <th className="px-4 py-2 text-center text-slate-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {order.items.map((item, idx) => {
                                    const balance = item.quantity - item.issuedQuantity;
                                    return (
                                        <tr key={idx} className={balance > 0 ? 'bg-orange-50' : ''}>
                                            <td className="px-4 py-2 font-medium text-slate-700">{item.materialName}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-slate-500">{item.materialCode}</td>
                                            <td className="px-4 py-2 text-right font-bold">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-2 text-right text-blue-600 font-semibold">{item.issuedQuantity}</td>
                                            <td className={`px-4 py-2 text-right font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {balance}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono bg-blue-50 text-slate-700 text-xs">
                                                {item.reservationId ? <span className="text-blue-700 font-bold" title="Reserved Stock">{item.reservationId}</span> : 'Open'}
                                            </td>
                                            <td className="px-4 py-2 text-right">{symbol} {formatCurrency(item.unitCost)}</td>
                                            <td className="px-4 py-2 text-right text-slate-700">{symbol} {formatCurrency(item.totalCost)}</td>
                                            <td className="px-4 py-2 text-center">
                                                {balance > 0 && (
                                                    <Button 
                                                        onClick={() => onIssueItem(order, item, idx, 9999)} 
                                                        className="!w-auto !py-1 !px-3 !text-xs"
                                                        title={"Issue item"}
                                                    >
                                                        Issue
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    {hasItemsToSettle && (
                        <Button onClick={() => onSettle(order)} className="!w-auto bg-green-600 hover:bg-green-700">
                            Settle Costs
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

const StatCard: React.FC<{ title: string; value: string | number; color: string; subtext?: string }> = ({ title, value, color, subtext }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4" style={{ borderColor: color }}>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
);

const SalesOrderList: React.FC<SalesOrderListProps> = ({ organisation, theme, currentUser, currencyConfig }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'open' | 'closed'>('dashboard');
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [returns, setReturns] = useState<MaterialMovement[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [settleModalOrder, setSettleModalOrder] = useState<SalesOrder | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [issueModalData, setIssueModalData] = useState<IssueItemState | null>(null);
    const [issuing, setIssuing] = useState(false);

    // Filters
    const [filterL3, setFilterL3] = useState('');
    const [filterL4, setFilterL4] = useState('');
    const [filterL5, setFilterL5] = useState('');
    const [dateFilter, setDateFilter] = useState<'today'|'yesterday'|'week'|'month'|'year'|'custom' | 'all'>('month');
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });

    // Hierarchy Options
    const [l3Nodes, setL3Nodes] = useState<{id: string, name: string}[]>([]);
    const [l4Nodes, setL4Nodes] = useState<{id: string, name: string, l3Id: string}[]>([]);
    const [l5Nodes, setL5Nodes] = useState<{id: string, name: string, l4Id: string}[]>([]);

    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');

    // 1. Fetch Hierarchy (Nodes with Names) - Deduplicated
    useEffect(() => {
        const fetchContext = async () => {
             const orgPathPrefix = `organisations/${organisation.domain}`;
             const isOrg = (doc: any) => doc.ref.path.startsWith(orgPathPrefix);

             try {
                const [l3Snap, l4Snap, l5Snap] = await Promise.all([
                    getDocs(collectionGroup(db, 'level_3')),
                    getDocs(collectionGroup(db, 'level_4')),
                    getDocs(collectionGroup(db, 'level_5'))
                ]);

                // Deduplicate L3
                const l3Raw = l3Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    return { id: d.id, name: data.name };
                });
                const l3Unique = Array.from(new Map(l3Raw.map(item => [item.id, item])).values()) as { id: string, name: string }[];
                setL3Nodes(l3Unique.sort((a,b) => a.name.localeCompare(b.name)));
                
                // Deduplicate L4 (Ensure ID + Name is unique enough for filter usage)
                const l4Raw = l4Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    const parts = d.ref.path.split('/');
                    return { id: d.id, name: data.name, l3Id: parts[parts.length-3] };
                });
                const l4Unique = Array.from(new Map(l4Raw.map(item => [item.id, item])).values()) as { id: string, name: string, l3Id: string }[];
                setL4Nodes(l4Unique.sort((a,b) => a.name.localeCompare(b.name)));

                // Deduplicate L5
                const l5Raw = l5Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    const parts = d.ref.path.split('/');
                    return { id: d.id, name: data.name, l4Id: parts[parts.length-3] };
                });
                const l5Unique = Array.from(new Map(l5Raw.map(item => [item.id, item])).values()) as { id: string, name: string, l4Id: string }[];
                setL5Nodes(l5Unique.sort((a,b) => a.name.localeCompare(b.name)));

             } catch (e) { console.error(e); }
        };
        fetchContext();
    }, [organisation.domain]);

    // 2. Fetch Orders & Returns
    useEffect(() => {
        const ref = collection(db, `organisations/${organisation.domain}/modules/IN/salesOrders`);
        const q = query(ref, orderBy('createdAt', 'desc'));
        
        const returnsRef = collectionGroup(db, 'materialMovements');
        const qReturns = query(returnsRef, where('type', '==', 'RETURN'));

        const unsubOrders = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)));
            setLoading(false);
        });

        const unsubReturns = onSnapshot(qReturns, (snap) => {
            const orgReturns = snap.docs
                .filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(d => ({ id: d.id, ...d.data() } as MaterialMovement));
            setReturns(orgReturns);
        });

        return () => { unsubOrders(); unsubReturns(); };
    }, [organisation.domain]);

    // 3. Filter Logic
    const filteredOrders = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (dateFilter === 'today') {
            startDate = startOfDay;
            endDate = new Date(startOfDay); endDate.setHours(23,59,59);
        } else if (dateFilter === 'yesterday') {
            startDate = new Date(startOfDay); startDate.setDate(startDate.getDate() - 1);
            endDate = new Date(startDate); endDate.setHours(23,59,59);
        } else if (dateFilter === 'week') {
            startDate = new Date(startOfDay); startDate.setDate(startDate.getDate() - startDate.getDay());
            endDate = new Date();
        } else if (dateFilter === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (dateFilter === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else if (dateFilter === 'custom' && dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end); endDate.setHours(23,59,59);
        }

        return orders.filter(o => {
            if (activeTab === 'open' && ['ISSUED', 'SETTLED'].includes(o.status)) return false;
            if (activeTab === 'closed' && !['ISSUED', 'SETTLED'].includes(o.status)) return false;
            
            if (filterL3 && o.allocationLevel3Id !== filterL3) return false;
            if (filterL4 && o.allocationLevel4Id !== filterL4) return false;
            if (filterL5 && o.allocationLevel5Id !== filterL5) return false;

            if (startDate && endDate) {
                const oDate = o.createdAt.toDate();
                if (oDate < startDate || oDate > endDate) return false;
            }

            return true;
        });
    }, [orders, activeTab, filterL3, filterL4, filterL5, dateFilter, dateRange]);

    const filteredReturns = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (dateFilter === 'today') { startDate = startOfDay; endDate = new Date(startOfDay); endDate.setHours(23,59,59); }
        else if (dateFilter === 'yesterday') { startDate = new Date(startOfDay); startDate.setDate(startDate.getDate() - 1); endDate = new Date(startDate); endDate.setHours(23,59,59); }
        else if (dateFilter === 'week') { startDate = new Date(startOfDay); startDate.setDate(startDate.getDate() - startDate.getDay()); endDate = new Date(); }
        else if (dateFilter === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
        else if (dateFilter === 'year') { startDate = new Date(now.getFullYear(), 0, 1); endDate = new Date(now.getFullYear(), 11, 31); }
        else if (dateFilter === 'custom' && dateRange.start && dateRange.end) { startDate = new Date(dateRange.start); endDate = new Date(dateRange.end); endDate.setHours(23,59,59); }

        return returns.filter(r => {
             if (startDate && endDate) {
                const rDate = r.date.toDate();
                if (rDate < startDate || rDate > endDate) return false;
            }
            return true;
        });
    }, [returns, dateFilter, dateRange]);

    // Metrics Calculation
    const dashboardMetrics = useMemo(() => {
        let totalIssuedQty = 0;
        let totalIssuedVal = 0;
        let partialIssuedQty = 0;
        let partialIssuedVal = 0;
        let totalAgeMinutes = 0;
        let openOrderCount = 0;

        filteredOrders.forEach(o => {
            const isFull = o.status === 'ISSUED' || o.status === 'SETTLED';
            const isPartial = o.status === 'PARTIALLY_ISSUED';
            
            o.items.forEach(item => {
                if (isFull) {
                    totalIssuedQty += item.issuedQuantity;
                    totalIssuedVal += item.issuedQuantity * item.unitCost;
                }
                if (isPartial) {
                    partialIssuedQty += item.issuedQuantity;
                    partialIssuedVal += item.issuedQuantity * item.unitCost;
                }
            });

            if (['CREATED', 'PRINTED', 'PARTIALLY_ISSUED'].includes(o.status)) {
                openOrderCount++;
                const created = o.createdAt.toDate().getTime();
                const now = new Date().getTime();
                totalAgeMinutes += (now - created) / (1000 * 60);
            }
        });

        const returnsQty = filteredReturns.reduce((acc, r) => acc + r.quantity, 0);
        const returnsVal = filteredReturns.reduce((acc, r) => acc + r.totalValue, 0);
        const avgAgeDays = openOrderCount > 0 ? (totalAgeMinutes / openOrderCount / 60 / 24).toFixed(1) : '0';

        return {
            totalIssuedQty,
            totalIssuedVal,
            partialIssuedQty,
            partialIssuedVal,
            avgAgeDays,
            returnsQty,
            returnsVal
        };
    }, [filteredOrders, filteredReturns]);

    // --- Action Handlers ---
    const handleItemIssueClick = (order: SalesOrder, item: any, index: number, currentStock: number) => {
        const balance = item.quantity - item.issuedQuantity;
        if (balance <= 0) return;
        setIssueModalData({
            order, item, index, balance, stock: currentStock, maxQty: balance
        });
    };

    const executeItemIssue = async (qty: number, warehousePath: string, warehouseName: string) => {
        if (!issueModalData) return;
        const { order, item, index } = issueModalData;
        setIssuing(true);
        try {
            await db.runTransaction(async (t) => {
                const matRef = db.doc(`${warehousePath}/materials/${item.materialId}`);
                const orderRef = db.doc(`organisations/${organisation.domain}/modules/IN/salesOrders/${order.id}`);
                
                const matDoc = await t.get(matRef);
                const orderDoc = await t.get(orderRef);

                if (!matDoc.exists) throw new Error(`Material not found in ${warehouseName}.`);
                if (!orderDoc.exists) throw new Error("Order not found");
                
                const currentOrder = orderDoc.data() as SalesOrder;
                const currentItem = currentOrder.items[index];
                if (currentItem.materialId !== item.materialId) throw new Error("Item mismatch during transaction");
                
                const liveInventory = matDoc.data()?.inventoryData || {};
                const currentIssuable = liveInventory.issuableQuantity || 0;
                const currentReserved = liveInventory.reservedQuantity || 0;
                
                let isDeductingReserved = false;
                if (item.reservationId && item.warehousePath === warehousePath) {
                     const resRef = db.doc(`organisations/${organisation.domain}/modules/IN/Reservations/${item.reservationId}`);
                     const resDoc = await t.get(resRef);
                     if (resDoc.exists) {
                         t.update(matRef, { 'inventoryData.reservedQuantity': Math.max(0, currentReserved - qty) });
                         t.update(resRef, { status: 'ISSUED', issuedAt: Timestamp.now(), issuedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` } });
                         isDeductingReserved = true;
                     }
                } 
                if (!isDeductingReserved) {
                    if (currentIssuable < qty) throw new Error(`Insufficient stock in ${warehouseName}. Available: ${currentIssuable}`);
                    t.update(matRef, { 'inventoryData.issuableQuantity': currentIssuable - qty });
                }

                currentItem.issuedQuantity += qty;
                const isFullyIssued = currentOrder.items.every(i => i.issuedQuantity >= i.quantity);
                const newStatus = isFullyIssued ? 'ISSUED' : 'PARTIALLY_ISSUED';
                
                t.update(orderRef, { items: currentOrder.items, status: newStatus });

                const moveRef = db.collection(`${warehousePath}/materialMovements`).doc();
                t.set(moveRef, {
                    movementId: `ISS-${order.code}-${item.materialCode}-${Date.now()}`,
                    type: 'ISSUE',
                    salesOrderCode: order.code,
                    workOrderId: order.workOrderId,
                    taskId: item.taskId,
                    materialId: item.materialId,
                    materialCode: item.materialCode,
                    materialName: item.materialName,
                    quantity: qty,
                    unitPrice: item.unitCost,
                    totalValue: qty * item.unitCost,
                    warehousePath: warehousePath,
                    warehouseName: warehouseName,
                    date: Timestamp.now(),
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
                });
            });
            setIssueModalData(null);
        } catch (e: any) {
            console.error(e);
            alert("Failed: " + e.message);
        } finally {
            setIssuing(false);
        }
    };

    const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId]);

    const filteredL4Options = useMemo(() => {
        if (!filterL3) return [];
        return l4Nodes.filter(n => n.l3Id === filterL3);
    }, [l4Nodes, filterL3]);

    const filteredL5Options = useMemo(() => {
        if (!filterL4) return [];
        return l5Nodes.filter(n => n.l4Id === filterL4);
    }, [l5Nodes, filterL4]);

    const TabButton: React.FC<{ id: string, label: string }> = ({ id, label }) => (
        <button onClick={() => setActiveTab(id as any)} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>
    );

    const formatCurrency = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') {
            amount = val / (currencyConfig.rate || 1);
        }
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const currencySymbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-slate-800">Sales Orders</h3>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-md p-1">
                        <select 
                            value={viewCurrency} 
                            onChange={(e) => setViewCurrency(e.target.value as any)}
                            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-slate-700"
                        >
                            <option value="local">{currencyConfig.local} (Local)</option>
                            <option value="base">{currencyConfig.base} (Base)</option>
                        </select>
                    </div>
                    {viewCurrency === 'base' && <span className="text-xs text-slate-500">Rate: {currencyConfig.rate}</span>}
                </div>
            </div>
            
            {/* Filters Area - Visible for all tabs */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
                 <div className="col-span-1 md:col-span-4 font-bold text-xs text-slate-500 uppercase">Context Filters</div>
                 
                 <select value={filterL3} onChange={e => {setFilterL3(e.target.value); setFilterL4(''); setFilterL5('');}} className="p-2 border rounded text-sm">
                    <option value="">All Sites</option>
                    {l3Nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                 </select>

                <select value={filterL4} onChange={e => {setFilterL4(e.target.value); setFilterL5('');}} className="p-2 border rounded text-sm" disabled={!filterL3}>
                    <option value="">All Depts</option>
                    {filteredL4Options.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>

                <select value={filterL5} onChange={e => setFilterL5(e.target.value)} className="p-2 border rounded text-sm" disabled={!filterL4}>
                    <option value="">All Sections</option>
                    {filteredL5Options.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                
                <div className="flex gap-2">
                     <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="p-2 border rounded text-sm flex-1">
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom</option>
                    </select>
                    {dateFilter === 'custom' && (
                        <div className="flex gap-1">
                            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-1 border rounded text-xs w-24"/>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-1 border rounded text-xs w-24"/>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-b border-slate-200 flex-shrink-0">
                <nav className="-mb-px flex space-x-4">
                    <TabButton id="dashboard" label="Dashboard" />
                    <TabButton id="open" label="Open Orders" />
                    <TabButton id="closed" label="Closed Orders" />
                </nav>
            </div>

            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in overflow-y-auto">
                    {/* Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Total Issued" value={dashboardMetrics.totalIssuedQty} color="border-green-500" subtext={`${currencySymbol} ${formatCurrency(dashboardMetrics.totalIssuedVal)}`} />
                        <StatCard title="Partial Issues" value={dashboardMetrics.partialIssuedQty} color="border-orange-500" subtext={`${currencySymbol} ${formatCurrency(dashboardMetrics.partialIssuedVal)}`} />
                        <StatCard title="Avg Age (Open)" value={dashboardMetrics.avgAgeDays} color="border-blue-500" subtext="Days" />
                        <StatCard title="Returns" value={dashboardMetrics.returnsQty} color="border-red-500" subtext={`-${currencySymbol} ${formatCurrency(dashboardMetrics.returnsVal)}`} />
                    </div>
                </div>
            )}

            {(activeTab === 'open' || activeTab === 'closed') && (
                <div className="overflow-x-auto bg-white rounded-lg border shadow-sm flex-1">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Code</th>
                                <th className="px-4 py-3 text-left">Work Order</th>
                                <th className="px-4 py-3 text-left">Asset</th>
                                <th className="px-4 py-3 text-right">Value ({currencySymbol})</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-left">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
                                    <td className="px-4 py-3 font-mono text-blue-600 font-medium">{order.code}</td>
                                    <td className="px-4 py-3 text-slate-700">{order.workOrderDisplayId}</td>
                                    <td className="px-4 py-3 text-slate-700">{order.assetDetails.name}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(order.totalCost)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            order.status === 'SETTLED' ? 'bg-green-100 text-green-800' :
                                            order.status === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
                                            order.status === 'PARTIALLY_ISSUED' ? 'bg-orange-100 text-orange-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>{order.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{order.createdAt.toDate().toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No orders found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedOrder && (
                <SalesOrderDetailModal 
                    order={selectedOrder}
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrderId(null)}
                    onIssueItem={handleItemIssueClick}
                    onSettle={(o) => { setSettleModalOrder(o); setSelectedOrderId(null); }}
                    theme={theme}
                    viewCurrency={viewCurrency}
                    currencyConfig={currencyConfig}
                />
            )}

            {issueModalData && (
                <IssueQuantityModal 
                    isOpen={!!issueModalData}
                    onClose={() => setIssueModalData(null)}
                    data={issueModalData}
                    onConfirm={executeItemIssue}
                    loading={issuing}
                    organisation={organisation}
                />
            )}

            {settleModalOrder && (
                <SettleCostsModal 
                    isOpen={!!settleModalOrder}
                    onClose={() => setSettleModalOrder(null)}
                    salesOrder={settleModalOrder}
                    organisation={organisation}
                    currentUser={currentUser}
                    onSettled={() => {}}
                />
            )}
        </div>
    );
};

export default SalesOrderList;
