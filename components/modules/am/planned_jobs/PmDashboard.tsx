
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { MaintenanceMasterPlan, MaintenancePlan } from '../../../../types/am_types';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';

interface PmDashboardProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

const StatCard: React.FC<{ label: string; value: number; subtext: string; color: string; icon: React.ReactNode }> = ({ label, value, subtext, color, icon }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full relative overflow-hidden transition-all hover:shadow-md">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`}></div>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl bg-slate-50 text-slate-600`}>
                {icon}
            </div>
            <span className="text-3xl font-black text-slate-800">{value}</span>
        </div>
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</h4>
        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
);

const PmDashboard: React.FC<PmDashboardProps> = ({ organisation, theme }) => {
    const [masterPlans, setMasterPlans] = useState<MaintenanceMasterPlan[]>([]);
    const [operationalPlans, setOperationalPlans] = useState<MaintenancePlan[]>([]);
    const [planningConfig, setPlanningConfig] = useState({ planningCycle: 'Weekly', weekStartDay: 'Monday' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const orgPath = `organisations/${organisation.domain}`;
        
        // 1. Fetch Planning Config
        getDoc(doc(db, `${orgPath}/modules/AM/settings/planning`)).then(snap => {
            if (snap.exists()) setPlanningConfig(snap.data() as any);
        });

        // 2. Fetch Master Plans (Templates)
        const masterUnsub = onSnapshot(collection(db, `${orgPath}/modules/AM/masterPlans`), (snap) => {
            setMasterPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceMasterPlan)));
        });

        // 3. Fetch Operational Plans (Calls)
        const operationalUnsub = onSnapshot(collection(db, `${orgPath}/modules/AM/maintenancePlans`), (snap) => {
            setOperationalPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenancePlan)));
            setLoading(false);
        });

        return () => {
            masterUnsub();
            operationalUnsub();
        };
    }, [organisation.domain]);

    const stats = useMemo(() => {
        const DURATION_MAP: Record<string, number> = { 'Weekly': 7, 'Bi-Weekly': 14, 'Monthly': 30 };
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        const isPlanMature = (plan: MaintenanceMasterPlan) => {
            if (plan.resetTag) return true;
            if (plan.enabled === false) return false;

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const startDayIdx = days.indexOf(planningConfig.weekStartDay);
            const cycleDays = DURATION_MAP[planningConfig.planningCycle] || 7;

            let nextStart = new Date(now);
            const daysUntilStart = (startDayIdx - now.getDay() + 7) % 7;
            nextStart.setDate(now.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart));
            
            const windowOpenDate = new Date(nextStart);
            windowOpenDate.setDate(nextStart.getDate() - 2);

            if (now < windowOpenDate) return false;
            
            if (!plan.lastCalled) return true;

            const last = new Date(plan.lastCalled);
            const daysSince = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);

            return daysSince >= (cycleDays - 2);
        };

        const matureUncalled = masterPlans.filter(p => isPlanMature(p)).length;
        const calledUnclosed = operationalPlans.filter(p => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(p.status)).length;
        const calledClosed = operationalPlans.filter(p => ['COMPLETED', 'CLOSED'].includes(p.status)).length;

        return { matureUncalled, calledUnclosed, calledClosed };
    }, [masterPlans, operationalPlans, planningConfig]);

    if (loading) {
        return (
            <div className="p-20 text-center">
                <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 font-medium italic">Calculating performance metrics...</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Maintenance Control Dashboard</h2>
                    <p className="text-sm text-slate-500">Real-time status of preventive maintenance templates and operational schedules.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    label="Mature Uncalled" 
                    value={stats.matureUncalled} 
                    subtext="Templates ready for scheduling"
                    color="bg-amber-500"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                    label="Called Unclosed" 
                    value={stats.calledUnclosed} 
                    subtext="Schedules currently in progress"
                    color="bg-blue-500"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                />
                <StatCard 
                    label="Called Closed" 
                    value={stats.calledClosed} 
                    subtext="Historical completed schedules"
                    color="bg-green-500"
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
            </div>

            {/* Information Panel */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-indigo-900 mb-1 uppercase text-xs tracking-wider">Maturity Engine logic</h4>
                    <p className="text-sm text-indigo-800 leading-relaxed">
                        A maintenance template becomes <span className="font-bold">Mature</span> when its planned interval has elapsed and it is within the 2-day window prior to the start of the next <span className="font-bold italic">{planningConfig.planningCycle}</span> cycle (configured to start on <span className="font-bold italic">{planningConfig.weekStartDay}s</span>). Use the <span className="font-bold">Schedule Caller</span> tab to convert mature templates into operational plans.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PmDashboard;
