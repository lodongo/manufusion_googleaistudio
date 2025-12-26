
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, where, documentId } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { Reservation, WorkOrder } from '../../../types/am_types';
import Input from '../../Input';

interface ReservationListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

// Extended type to include linked WO date
interface ExtendedReservation extends Reservation {
    woScheduledEndDate?: string;
    woStatus?: string;
}

// Chart Component
const StatusChart: React.FC<{ data: { label: string, value: number, color: string }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end space-x-8 h-64 w-full justify-center pb-6">
            {data.map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 group w-24">
                    <div className="relative w-full h-48 bg-slate-100 rounded-t-lg flex items-end overflow-hidden">
                        <div 
                            className={`w-full transition-all duration-1000 ${item.color}`} 
                            style={{ height: `${(item.value / maxValue) * 100}%` }}
                        ></div>
                         <div className="absolute top-0 w-full text-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-slate-600">
                             {item.value}
                         </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span>
                    <span className="text-lg font-bold text-slate-800">{item.value}</span>
                </div>
            ))}
        </div>
    );
};

const ReservationList: React.FC<ReservationListProps> = ({ organisation, theme }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'active' | 'closed'>('dashboard');
    const [reservations, setReservations] = useState<ExtendedReservation[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterL3, setFilterL3] = useState('');
    const [filterL4, setFilterL4] = useState('');
    const [filterL5, setFilterL5] = useState('');
    const [dateFilter, setDateFilter] = useState<'today'|'yesterday'|'week'|'month'|'year'|'custom' | 'all'>('month');
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });

    // Hierarchy Options
    const [hierarchy, setHierarchy] = useState<any[]>([]);

    useEffect(() => {
        // Fetch hierarchy for filters
        const fetchHierarchy = async () => {
             const groupQ = db.collectionGroup('level_5');
             const snap = await groupQ.get();
             const nodes = snap.docs
                .filter(d => d.ref.path.includes(organisation.domain))
                .map(d => {
                    const data = d.data();
                    const parts = d.ref.path.split('/');
                    return {
                        id: d.id,
                        name: data.name,
                        l3Id: parts[7],
                        l4Id: parts[9],
                        // We need names for L3/L4, simplified here by just grouping IDs for filtering
                    };
                });
             setHierarchy(nodes);
        };
        fetchHierarchy();
    }, [organisation.domain]);

    useEffect(() => {
        setLoading(true);
        const ref = collection(db, `organisations/${organisation.domain}/modules/IN/Reservations`);
        const q = query(ref, orderBy('reservedAt', 'desc'));
        
        const unsub = onSnapshot(q, async (snap) => {
            const rawReservations = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtendedReservation));
            
            // Collect Unique Work Order IDs to fetch schedule dates
            const woIds = Array.from(new Set(rawReservations.map(r => r.workOrderId).filter(Boolean)));
            const woMap = new Map<string, { end: string, status: string }>();

            if (woIds.length > 0) {
                // Fetch WOs in chunks of 10
                const chunks = [];
                for (let i = 0; i < woIds.length; i += 10) {
                    chunks.push(woIds.slice(i, i + 10));
                }

                await Promise.all(chunks.map(async chunk => {
                    // Note: This query assumes 'woId' field in WorkOrder matches the reservation's workOrderId. 
                    // Usually reservation.workOrderId stores the DISPLAY ID (e.g. WO001), but we need to query by that field.
                    const woQ = query(collection(db, `organisations/${organisation.domain}/modules/AM/workOrders`), where('woId', 'in', chunk));
                    const woSnap = await getDocs(woQ);
                    woSnap.forEach(d => {
                        const data = d.data() as WorkOrder;
                        if (data.scheduledEndDate) {
                            woMap.set(data.woId, { end: data.scheduledEndDate, status: data.status });
                        }
                    });
                }));
            }

            const enriched = rawReservations.map(r => ({
                ...r,
                woScheduledEndDate: woMap.get(r.workOrderId)?.end,
                woStatus: woMap.get(r.workOrderId)?.status
            }));

            setReservations(enriched);
            setLoading(false);
        });
        
        return () => unsub();
    }, [organisation.domain]);

    // Derived Data based on filters
    const filteredReservations = useMemo(() => {
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

        return reservations.filter(r => {
            // Hierarchy Filter
            if (filterL3 && r.level_3_id !== filterL3) return false;
            if (filterL4 && r.level_4_id !== filterL4) return false;
            if (filterL5 && r.warehouseId !== filterL5 && r.level_4_id !== filterL5) return false; // checking warehouse ID match or generic section match

            // Date Filter
            if (startDate && endDate) {
                const rDate = r.reservedAt.toDate();
                if (rDate < startDate || rDate > endDate) return false;
            }

            return true;
        });
    }, [reservations, filterL3, filterL4, filterL5, dateFilter, dateRange]);

    const stats = useMemo(() => {
        const active = filteredReservations.filter(r => ['RESERVED', 'PR REQUIRED', 'PR RAISED'].includes(r.status));
        const issued = filteredReservations.filter(r => r.status === 'ISSUED');
        const cancelled = filteredReservations.filter(r => r.status === 'CANCELLED');
        return {
            activeCount: active.length,
            issuedCount: issued.length,
            cancelledCount: cancelled.length,
            total: filteredReservations.length
        };
    }, [filteredReservations]);

    const chartData = [
        { label: 'Active', value: stats.activeCount, color: 'bg-blue-500' },
        { label: 'Issued', value: stats.issuedCount, color: 'bg-green-500' },
        { label: 'Cancelled', value: stats.cancelledCount, color: 'bg-red-500' },
    ];

    const TabButton: React.FC<{ id: string, label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
            {label}
        </button>
    );

    // Dropdown helpers
    const uniqueL3s = Array.from(new Set(hierarchy.map(h => h.l3Id))).filter(Boolean);
    const uniqueL4s = Array.from(new Set(hierarchy.filter(h => !filterL3 || h.l3Id === filterL3).map(h => h.l4Id))).filter(Boolean);
    const uniqueL5s = Array.from(new Set(hierarchy.filter(h => (!filterL3 || h.l3Id === filterL3) && (!filterL4 || h.l4Id === filterL4)).map(h => h.id))).filter(Boolean);

    const isOverdue = (dateStr?: string) => {
        if (!dateStr) return false;
        const target = new Date(dateStr);
        const today = new Date();
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays < -7;
    };

    if (loading) return <div className="p-8 text-center">Loading reservations...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Material Reservations</h3>
            </div>

            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-4">
                    <TabButton id="dashboard" label="Dashboard" />
                    <TabButton id="active" label="Active Reservations" />
                    <TabButton id="closed" label="Closed History" />
                </nav>
            </div>

            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Filters */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="col-span-1 md:col-span-4 font-bold text-xs text-slate-500 uppercase">Filters</div>
                        
                        <select value={filterL3} onChange={e => {setFilterL3(e.target.value); setFilterL4(''); setFilterL5('');}} className="p-2 border rounded text-sm">
                            <option value="">All Sites (Level 3)</option>
                            {uniqueL3s.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                        <select value={filterL4} onChange={e => {setFilterL4(e.target.value); setFilterL5('');}} className="p-2 border rounded text-sm" disabled={!filterL3}>
                            <option value="">All Depts (Level 4)</option>
                            {uniqueL4s.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                        <select value={filterL5} onChange={e => setFilterL5(e.target.value)} className="p-2 border rounded text-sm" disabled={!filterL4}>
                            <option value="">All Sections (Level 5)</option>
                            {uniqueL5s.map(id => <option key={id} value={id}>{hierarchy.find(h => h.id === id)?.name || id}</option>)}
                        </select>

                        <div className="flex gap-2">
                             <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="p-2 border rounded text-sm flex-1">
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                                <option value="year">This Year</option>
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

                    {/* Stats & Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <h4 className="font-bold text-slate-700 mb-6">Reservation Status Overview</h4>
                            <StatusChart data={chartData} />
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 bg-red-50">
                                <h4 className="text-red-800 font-bold uppercase text-xs tracking-wider">Cancelled Reservations</h4>
                                <p className="text-4xl font-extrabold text-red-600 mt-2">{stats.cancelledCount}</p>
                                <p className="text-xs text-red-400 mt-1">Within selected period</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-200 bg-blue-50">
                                <h4 className="text-blue-800 font-bold uppercase text-xs tracking-wider">Active Reservations</h4>
                                <p className="text-4xl font-extrabold text-blue-600 mt-2">{stats.activeCount}</p>
                            </div>
                             <div className="bg-white p-6 rounded-lg shadow-sm border border-green-200 bg-green-50">
                                <h4 className="text-green-800 font-bold uppercase text-xs tracking-wider">Issued Reservations</h4>
                                <p className="text-4xl font-extrabold text-green-600 mt-2">{stats.issuedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'active' && (
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Res ID</th>
                                <th className="px-4 py-3 text-left">Work Order / Task</th>
                                <th className="px-4 py-3 text-left">Material</th>
                                <th className="px-4 py-3 text-left">Warehouse</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-center">WO Schedule</th>
                                <th className="px-4 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredReservations
                                .filter(r => ['RESERVED', 'PR REQUIRED', 'PR RAISED'].includes(r.status))
                                .map(res => {
                                    const overdue = isOverdue(res.woScheduledEndDate);
                                    return (
                                        <tr key={res.id} className={`hover:bg-slate-50 ${overdue ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>
                                            <td className="px-4 py-3 font-mono text-blue-600">{res.reservationId}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold">{res.workOrderId}</div>
                                                <div className="text-xs text-slate-500">{res.taskId}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{res.materialName}</div>
                                                <div className="text-xs font-mono text-slate-500">{res.materialCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{res.warehouseName}</td>
                                            <td className="px-4 py-3 text-right font-bold">{res.quantity} {res.uom}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="text-xs text-slate-600">{res.woScheduledEndDate || 'N/A'}</div>
                                                {overdue && <span className="text-[10px] font-bold text-red-600 uppercase">Overdue &gt; 7 Days</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800`}>
                                                    {res.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {filteredReservations.filter(r => ['RESERVED', 'PR REQUIRED', 'PR RAISED'].includes(r.status)).length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No active reservations found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'closed' && (
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Res ID</th>
                                <th className="px-4 py-3 text-left">Work Order</th>
                                <th className="px-4 py-3 text-left">Material</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-center">Final Status</th>
                                <th className="px-4 py-3 text-left">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                             {filteredReservations
                                .filter(r => ['ISSUED', 'CANCELLED'].includes(r.status))
                                .map(res => (
                                    <tr key={res.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-slate-600">{res.reservationId}</td>
                                        <td className="px-4 py-3 text-slate-600">{res.workOrderId}</td>
                                        <td className="px-4 py-3">
                                            <div>{res.materialName}</div>
                                            <div className="text-xs text-slate-400">{res.materialCode}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">{res.quantity}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${res.status === 'ISSUED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {res.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {res.reservedAt.toDate().toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                             }
                             {filteredReservations.filter(r => ['ISSUED', 'CANCELLED'].includes(r.status)).length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No closed history found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ReservationList;
