
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
// Use compat SDK for consistency with other files
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation } from '../../../types';
import type { StockTakeSession, StockTakeCountSheet } from '../../../types/in_types';

interface StockTakeDashboardProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

const StatCard: React.FC<{ title: string; value: string | number; color: string; icon?: React.ReactNode }> = ({ title, value, color, icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 flex items-center justify-between" style={{ borderColor: color }}>
        <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        {icon && <div className="text-slate-300">{icon}</div>}
    </div>
);

const StockTakeDashboard: React.FC<StockTakeDashboardProps> = ({ organisation, theme }) => {
    const [sessions, setSessions] = useState<StockTakeSession[]>([]);
    const [sheets, setSheets] = useState<StockTakeCountSheet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        
        // Using collectionGroup to fetch all sessions within the organisation
        const sessionsQuery = db.collectionGroup('stockTakeSessions');
        const sheetsQuery = db.collectionGroup('countSheets');

        const unsubSessions = sessionsQuery.onSnapshot(snapshot => {
            const orgSessions = snapshot.docs
                .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(doc => ({ id: doc.id, ...doc.data() } as StockTakeSession));
            setSessions(orgSessions);
        });

        const unsubSheets = sheetsQuery.onSnapshot(snapshot => {
             const orgSheets = snapshot.docs
                .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(doc => ({ id: doc.id, ...doc.data() } as StockTakeCountSheet));
             setSheets(orgSheets);
             setLoading(false); // Assume loading finishes when both listeners fire at least once
        });

        return () => {
            unsubSessions();
            unsubSheets();
        };
    }, [organisation.domain]);

    const stats = useMemo(() => {
        const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
        const completedSessions = sessions.filter(s => s.status === 'COMPLETED');
        
        const pendingReviewSheets = sheets.filter(s => s.status === 'COUNTED');
        const postedSheets = sheets.filter(s => s.status === 'POSTED' || s.status === 'SETTLED');
        
        let totalValueVariance = 0;
        let totalQtyVariance = 0;
        let totalItemsCounted = 0;

        postedSheets.forEach(s => {
            if (s.varianceStats) {
                totalValueVariance += (s.varianceStats.totalValueVariance || 0);
                totalQtyVariance += (s.varianceStats.totalQtyVariance || 0);
            }
            if (s.items) {
                totalItemsCounted += s.items.length;
            }
        });
        
        const accuracy = totalItemsCounted > 0 
            ? Math.max(0, 100 - (Math.abs(totalQtyVariance) / totalItemsCounted * 100)) 
            : 100;

        return {
            activeCount: activeSessions.length,
            completedCount: completedSessions.length,
            pendingReviews: pendingReviewSheets.length,
            netVariance: totalValueVariance,
            accuracy: accuracy.toFixed(1)
        };
    }, [sessions, sheets]);

    // Helper to safely render dates that might be Timestamps or Strings
    const safeRenderDate = (val: any) => {
        if (!val) return 'N/A';
        if (typeof val === 'string') return val;
        if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString(); // Firebase Timestamp
        if (val instanceof Date) return val.toLocaleDateString();
        return String(val);
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading dashboard metrics...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Active Sessions" 
                    value={stats.activeCount} 
                    color={theme.colorPrimary} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                />
                <StatCard 
                    title="Pending Reviews" 
                    value={stats.pendingReviews} 
                    color="#f59e0b" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                    title="Net Variance ($)" 
                    value={stats.netVariance.toLocaleString(undefined, {style: 'currency', currency: 'USD'})} 
                    color={stats.netVariance > 0 ? "#10b981" : "#ef4444"} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                    title="Calculated Accuracy" 
                    value={`${stats.accuracy}%`} 
                    color="#3b82f6" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-4">Recent Active Sessions</h4>
                    <div className="space-y-3">
                        {sessions.filter(s => s.status === 'ACTIVE').slice(0, 5).map(s => (
                            <div key={s.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded">
                                <div>
                                    <p className="font-medium text-sm text-slate-800">{s.configName}</p>
                                    <p className="text-xs text-slate-500">{s.warehouseName} | Due: {safeRenderDate(s.endDate)}</p>
                                </div>
                                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">{s.type}</span>
                            </div>
                        ))}
                        {sessions.filter(s => s.status === 'ACTIVE').length === 0 && <p className="text-sm text-slate-400 italic">No active sessions.</p>}
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-4">Recent Completed Sessions</h4>
                     <div className="space-y-3">
                        {sessions.filter(s => s.status === 'COMPLETED').slice(0, 5).map(s => (
                            <div key={s.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded">
                                <div>
                                    <p className="font-medium text-sm text-slate-800">{s.configName}</p>
                                    <p className="text-xs text-slate-500">{s.warehouseName}</p>
                                </div>
                                <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded">DONE</span>
                            </div>
                        ))}
                         {sessions.filter(s => s.status === 'COMPLETED').length === 0 && <p className="text-sm text-slate-400 italic">No recently completed sessions.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockTakeDashboard;
