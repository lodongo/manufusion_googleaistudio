import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeCountSheet, StockTakeSession } from '../../../types/in_types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Button from '../../Button';

interface StockTakeHistoricalProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const StockTakeHistorical: React.FC<StockTakeHistoricalProps> = ({ organisation, theme, currentUser }) => {
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [warehouseId, setWarehouseId] = useState('');
    
    const [viewType, setViewType] = useState<'SESSIONS' | 'SHEETS'>('SESSIONS');
    
    const [completedSessions, setCompletedSessions] = useState<StockTakeSession[]>([]);
    const [settledSheets, setSettledSheets] = useState<StockTakeCountSheet[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch Warehouses
    useEffect(() => {
        const fetchWarehouses = async () => {
             const groupQ = db.collectionGroup('level_5').where('sectionType', '>=', 'Capital Inventory').where('sectionType', '<', 'Capital Inventory\uf8ff');
             const snap = await groupQ.get();
             const nodes = snap.docs
                .filter(d => d.ref.path.includes(organisation.domain))
                .map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode));
             setHierarchy(nodes);
        };
        fetchWarehouses();
    }, [organisation.domain]);

    // Fetch Historical Data based on Warehouse and View Type
    useEffect(() => {
        if (!warehouseId) {
            setCompletedSessions([]);
            setSettledSheets([]);
            return;
        }

        const whNode = hierarchy.find(n => n.id === warehouseId);
        if (!whNode || !whNode.path) return;

        setLoading(true);
        
        if (viewType === 'SESSIONS') {
            const sessionsRef = db.collection(`${whNode.path}/stockTakeSessions`);
            // Fetch COMPLETED sessions
            const q = sessionsRef.where('status', '==', 'COMPLETED').orderBy('createdAt', 'desc');
            const unsub = q.onSnapshot((snap) => {
                setCompletedSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTakeSession)));
                setLoading(false);
            });
            return () => unsub();
        } else {
            // Fetch SETTLED or Closed sheets
            const sheetsRef = db.collectionGroup('countSheets');
            
            const unsub = sheetsRef.onSnapshot((snap) => {
                const sheets = snap.docs
                    .filter(doc => doc.ref.path.startsWith(whNode.path!) && (doc.data().status === 'SETTLED' || doc.data().status === 'CLOSED' || doc.data().status === 'COMPLETED'))
                    .map(d => ({ id: d.id, ...d.data() } as StockTakeCountSheet))
                    .sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
                    
                setSettledSheets(sheets);
                setLoading(false);
            });
            return () => unsub();
        }
    }, [warehouseId, viewType, hierarchy]);

    const handlePrintSheet = (sheet: StockTakeCountSheet) => {
        alert("PDF download is temporarily disabled.");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Warehouse</label>
                    <select 
                        value={warehouseId} 
                        onChange={e => setWarehouseId(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm"
                    >
                        <option value="">-- Select --</option>
                        {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                </div>
                <div className="flex bg-slate-100 rounded p-1">
                    <button 
                        onClick={() => setViewType('SESSIONS')}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${viewType === 'SESSIONS' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Sessions
                    </button>
                    <button 
                        onClick={() => setViewType('SHEETS')}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${viewType === 'SHEETS' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        PI Documents
                    </button>
                </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {loading ? <div className="p-8 text-center">Loading history...</div> : (
                    warehouseId ? (
                        viewType === 'SESSIONS' ? (
                            completedSessions.length === 0 ? <div className="p-8 text-center text-slate-500">No completed sessions found.</div> :
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Session Name</th>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Date Range</th>
                                        <th className="px-4 py-3 text-center">Items Counted</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {completedSessions.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{s.configName}</td>
                                            <td className="px-4 py-3 text-slate-600">{s.type}</td>
                                            <td className="px-4 py-3 text-slate-500">{s.startDate} - {s.endDate}</td>
                                            <td className="px-4 py-3 text-center">{s.totalItemsCounted} / {s.totalItemsInScope}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">COMPLETED</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            settledSheets.length === 0 ? <div className="p-8 text-center text-slate-500">No historical PI documents found.</div> :
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">PI Number</th>
                                        <th className="px-4 py-3 text-left">Batch Name</th>
                                        <th className="px-4 py-3 text-center">Items</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {settledSheets.map(sheet => (
                                        <tr key={sheet.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-blue-600">{sheet.piNumber}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{sheet.batchName}</td>
                                            <td className="px-4 py-3 text-center">{sheet.items?.length || 0}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${sheet.status === 'SETTLED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {sheet.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button onClick={() => handlePrintSheet(sheet)} variant="secondary" className="!w-auto !py-1 !px-2 !text-xs">
                                                    Download PDF
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        <div className="p-12 text-center text-slate-400">Select a warehouse to view history.</div>
                    )
                )}
            </div>
        </div>
    );
};

export default StockTakeHistorical;