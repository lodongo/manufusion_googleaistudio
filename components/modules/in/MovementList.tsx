
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collectionGroup, query, where, orderBy, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { MaterialMovement } from '../../../types/in_types';

interface MovementListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currencyConfig: { local: string; base: string; rate: number };
}

// Helper to parse path
const parsePath = (path?: string) => {
    if (!path) return { l3: '', l4: '', l5: '' };
    const parts = path.split('/');
    return {
        l3: parts[7] || '',
        l4: parts[9] || '',
        l5: parts[11] || ''
    };
};

const ValueGauge: React.FC<{ value: number; max: number; label: string }> = ({ value, max, label }) => {
    // Clamp value between -max and max for display
    const limit = max === 0 ? 100 : max;
    const clampedValue = Math.max(-limit, Math.min(limit, value));
    const angle = (clampedValue / limit) * 90;
    
    const color = value > 0 ? '#ef4444' : '#22c55e'; // Red for increase (cost), Green for decrease (issue/sales) - typical logic may vary
    const isZero = Math.abs(value) < 0.01;

    return (
        <div className="flex flex-col items-center justify-center relative h-32 w-full">
            <svg viewBox="0 0 200 110" className="w-48 h-28">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
                <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#22c55e" strokeWidth="20" strokeLinecap="round" strokeOpacity="0.2" />
                <path d="M 100 20 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" strokeOpacity="0.2" />
                <g transform={`translate(100, 100) rotate(${angle})`}>
                    <path d="M -4 0 L 0 -75 L 4 0 Z" fill="#334155" />
                    <circle cx="0" cy="0" r="6" fill="#334155" />
                </g>
                <text x="20" y="120" fontSize="12" fill="#22c55e" textAnchor="middle">Low</text>
                <text x="180" y="120" fontSize="12" fill="#ef4444" textAnchor="middle">High</text>
            </svg>
            <div className="text-center -mt-6">
                <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
                <p className={`text-lg font-bold ${isZero ? 'text-slate-700' : color}`}>
                    {value.toFixed(2)}%
                </p>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; qty: number; amt: string; color: string; }> = ({ title, qty, amt, color }) => (
    <div className={`p-4 rounded-lg shadow-sm border-l-4 ${color} bg-white`}>
        <p className="text-xs text-slate-500 font-bold uppercase">{title}</p>
        <div className="mt-2 flex justify-between items-end">
             <div>
                 <p className="text-xs text-slate-400 uppercase">Qty</p>
                 <p className="text-lg font-bold text-slate-700">{qty.toLocaleString()}</p>
             </div>
             <div className="text-right">
                 <p className="text-xs text-slate-400 uppercase">Value</p>
                 <p className="text-lg font-bold text-slate-700">{amt}</p>
             </div>
        </div>
    </div>
);

const MovementList: React.FC<MovementListProps> = ({ organisation, theme, currencyConfig }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard');
    const [movements, setMovements] = useState<MaterialMovement[]>([]);
    const [inventoryCapital, setInventoryCapital] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [dateFilter, setDateFilter] = useState<'today'|'yesterday'|'week'|'month'|'year'|'custom'>('month');
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
    
    const [filterL3, setFilterL3] = useState('');
    const [filterL4, setFilterL4] = useState('');
    const [filterL5, setFilterL5] = useState('');
    
    const [l3Options, setL3Options] = useState<{id: string, name: string}[]>([]);
    const [l4Options, setL4Options] = useState<{id: string, name: string, l3Id: string}[]>([]);
    const [l5Options, setL5Options] = useState<{id: string, name: string, l4Id: string}[]>([]);

    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');

    // Fetch Hierarchy
    useEffect(() => {
        const fetchHierarchy = async () => {
             const orgPathPrefix = `organisations/${organisation.domain}`;
             const isOrg = (doc: any) => doc.ref.path.startsWith(orgPathPrefix);

             try {
                const [l3Snap, l4Snap, l5Snap] = await Promise.all([
                    getDocs(collectionGroup(db, 'level_3')),
                    getDocs(collectionGroup(db, 'level_4')),
                    getDocs(collectionGroup(db, 'level_5'))
                ]);

                // Explicitly cast data to { name: string } to fix the unknown type error
                // Use Set/Map to Deduplicate by ID
                const l3Raw = l3Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    return { id: d.id, name: data.name };
                });
                const l3Unique = Array.from(new Map(l3Raw.map(item => [item.id, item])).values()) as { id: string, name: string }[];
                setL3Options(l3Unique.sort((a,b) => a.name.localeCompare(b.name)));
                
                const l4Raw = l4Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    const parts = d.ref.path.split('/');
                    return { id: d.id, name: data.name, l3Id: parts[parts.length - 3] };
                });
                // Deduplicate L4 by ID
                const l4Unique = Array.from(new Map(l4Raw.map(item => [item.id, item])).values()) as { id: string, name: string, l3Id: string }[];
                setL4Options(l4Unique.sort((a,b) => a.name.localeCompare(b.name)));

                const l5Raw = l5Snap.docs.filter(isOrg).map(d => {
                    const data: any = d.data();
                    const parts = d.ref.path.split('/');
                    return { id: d.id, name: data.name, l4Id: parts[parts.length - 3] };
                });
                // Deduplicate L5 by ID
                const l5Unique = Array.from(new Map(l5Raw.map(item => [item.id, item])).values()) as { id: string, name: string, l4Id: string }[];
                setL5Options(l5Unique.sort((a,b) => a.name.localeCompare(b.name)));

             } catch (error) { console.error("Error loading context filters", error); }
        };
        fetchHierarchy();
    }, [organisation.domain]);

    // Fetch Inventory Capital (Current Stock Value)
    useEffect(() => {
        const fetchCapital = async () => {
            // This can be expensive. We fetch all materials in org to sum up value.
            // Optimized: Fetch only necessary fields if possible, or use a cached aggregate if available.
            // Here we fetch materials collection group filtered by org path.
            const matQuery = query(collectionGroup(db, 'materials'));
            const snap = await getDocs(matQuery);
            let totalCap = 0;
            snap.forEach(doc => {
                 if (doc.ref.path.startsWith(`organisations/${organisation.domain}`)) {
                     const d = doc.data();
                     const qty = d.inventoryData?.issuableQuantity || 0;
                     const cost = d.procurementData?.standardPrice || 0;
                     totalCap += (qty * cost);
                 }
            });
            setInventoryCapital(totalCap);
        };
        fetchCapital();
    }, [organisation.domain]);

    // Fetch Movements
    useEffect(() => {
        setLoading(true);
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

        const movementsGroup = collectionGroup(db, 'materialMovements');
        let q = query(movementsGroup, orderBy('date', 'desc'));

        if (startDate && endDate) {
            q = query(movementsGroup, where('date', '>=', Timestamp.fromDate(startDate)), where('date', '<=', Timestamp.fromDate(endDate)), orderBy('date', 'desc'));
        } else {
             q = query(movementsGroup, orderBy('date', 'desc'), where('date', '<=', Timestamp.now())); 
        }
        
        const unsubscribe = onSnapshot(q, snap => {
            const loaded = snap.docs
                .filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(d => ({ id: d.id, ...d.data() } as MaterialMovement));
            setMovements(loaded);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [organisation.domain, dateFilter, dateRange]);

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            if (!filterL3 && !filterL4 && !filterL5) return true;
            const { l3, l4, l5 } = parsePath(m.warehousePath);
            if (filterL3 && l3 !== filterL3) return false;
            if (filterL4 && l4 !== filterL4) return false;
            if (filterL5 && l5 !== filterL5) return false;
            return true;
        });
    }, [movements, filterL3, filterL4, filterL5]);

    const stats = useMemo(() => {
        let netIssueVal = 0, netIssueQty = 0;
        let netReceiptVal = 0, netReceiptQty = 0;
        let netAdjVal = 0, netAdjQty = 0;

        filteredMovements.forEach(m => {
            const val = m.totalValue || 0;
            const qty = m.quantity || 0;

            if (m.type === 'ISSUE') { netIssueVal += val; netIssueQty += qty; }
            if (m.type === 'RECEIPT') { netReceiptVal += val; netReceiptQty += qty; }
            if (m.type === 'ADJUSTMENT') { netAdjVal += val; netAdjQty += qty; } 
        });

        const netMovementValue = (netReceiptVal + netAdjVal) - netIssueVal;
        const capitalPercent = inventoryCapital > 0 ? (netMovementValue / inventoryCapital) * 100 : 0;

        return { netIssueVal, netIssueQty, netReceiptVal, netReceiptQty, netAdjVal, netAdjQty, netMovementValue, capitalPercent };
    }, [filteredMovements, inventoryCapital]);

    const filteredL4Options = useMemo(() => l4Options.filter(l4 => !filterL3 || l4.l3Id === filterL3), [l4Options, filterL3]);
    const filteredL5Options = useMemo(() => l5Options.filter(l5 => (!filterL4 || l5.l4Id === filterL4) && (!filterL3 || l4Options.find(l4 => l4.id === l5.l4Id)?.l3Id === filterL3)), [l5Options, filterL4, filterL3, l4Options]);

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
                <h3 className="text-lg font-bold text-slate-800">Inventory Movements</h3>
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

            <div className="border-b border-slate-200 flex-shrink-0">
                <nav className="-mb-px flex space-x-4">
                    <TabButton id="dashboard" label="Dashboard" />
                    <TabButton id="list" label="Movements List" />
                </nav>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
                 <div className="col-span-1 md:col-span-4 font-bold text-xs text-slate-500 uppercase">Filters</div>
                 <select value={filterL3} onChange={e => {setFilterL3(e.target.value); setFilterL4(''); setFilterL5('');}} className="p-2 border rounded text-sm"><option value="">All Sites</option>{l3Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</select>
                <select value={filterL4} onChange={e => {setFilterL4(e.target.value); setFilterL5('');}} className="p-2 border rounded text-sm" disabled={!filterL3}><option value="">All Depts</option>{filteredL4Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</select>
                <select value={filterL5} onChange={e => setFilterL5(e.target.value)} className="p-2 border rounded text-sm" disabled={!filterL4}><option value="">All Warehouses</option>{filteredL5Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</select>
                <div className="flex gap-2">
                     <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="p-2 border rounded text-sm flex-1">
                        <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option><option value="custom">Custom</option>
                    </select>
                    {dateFilter === 'custom' && (<div className="flex gap-1"><input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-1 border rounded text-xs w-24"/><input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-1 border rounded text-xs w-24"/></div>)}
                </div>
            </div>

            {loading ? <div className="p-8 text-center">Loading data...</div> : (
                <>
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in space-y-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard title="Net Issue (Out)" qty={stats.netIssueQty} amt={`${currencySymbol} ${formatCurrency(stats.netIssueVal)}`} color="border-red-500" />
                            <StatCard title="Net Receipt (In)" qty={stats.netReceiptQty} amt={`${currencySymbol} ${formatCurrency(stats.netReceiptVal)}`} color="border-green-500" />
                            <StatCard title="Net Adjustment" qty={stats.netAdjQty} amt={`${currencySymbol} ${formatCurrency(stats.netAdjVal)}`} color="border-blue-500" />
                            
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <p className="text-xs text-slate-500 font-bold uppercase">Current Stock Capital</p>
                                <p className="text-2xl font-bold text-slate-800 mt-2">{currencySymbol} {formatCurrency(inventoryCapital)}</p>
                                <div className="mt-2 flex items-center justify-between">
                                     <span className="text-xs text-slate-400">Total Value</span>
                                     <span className={`text-xs font-bold ${stats.netMovementValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                         {stats.netMovementValue > 0 ? '+' : ''}{currencySymbol} {formatCurrency(stats.netMovementValue)} (Net Move)
                                     </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <div className="col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                                 <h4 className="font-bold text-slate-700 mb-4">Movement Trends</h4>
                                 <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed rounded bg-slate-50">
                                     Chart visualization coming soon
                                 </div>
                             </div>
                             <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
                                <ValueGauge value={stats.capitalPercent} max={20} label="Net Move % of Capital" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'list' && (
                    <div className="bg-white rounded-lg border shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[400px] animate-fade-in">
                        <div className="flex-1 overflow-auto relative">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Movement ID</th>
                                        <th className="px-4 py-3 text-center">Type</th>
                                        <th className="px-4 py-3 text-left">Material</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Value ({currencySymbol})</th>
                                        <th className="px-4 py-3 text-left">Reference</th>
                                        <th className="px-4 py-3 text-left">Date / By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredMovements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{mov.movementId}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    mov.type === 'ISSUE' ? 'bg-orange-100 text-orange-800' :
                                                    mov.type === 'RECEIPT' ? 'bg-green-100 text-green-800' :
                                                    mov.type === 'ADJUSTMENT' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>{mov.type}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{mov.materialName}</div>
                                                <div className="text-xs font-mono text-slate-500">{mov.materialCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">{mov.quantity}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(mov.totalValue)}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600">
                                                {mov.salesOrderCode ? `SO: ${mov.salesOrderCode}` : ''}
                                                {mov.reason ? `Reason: ${mov.reason}` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                <div>{mov.date.toDate().toLocaleDateString()}</div>
                                                <div>{mov.createdBy.name}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredMovements.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No movements found matching criteria.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default MovementList;
