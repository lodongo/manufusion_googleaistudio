import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation, AppUser } from '../../../../types';
import type { MaintenancePlan, WorkOrder } from '../../../../types/am_types';
import Button from '../../../Button';
import { collection, onSnapshot, query, orderBy, getDocs, collectionGroup, where } from 'firebase/firestore';

interface PlannedJobsListProps {
    theme: Organisation['theme'];
    onOpenSchedules: () => void;
    organisation: Organisation;
    onSelectPlan: (plan: MaintenancePlan) => void;
}

const PlannedJobsList: React.FC<PlannedJobsListProps> = ({ theme, onOpenSchedules, organisation, onSelectPlan }) => {
    const [plans, setPlans] = useState<MaintenancePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter States
    const [filterL3, setFilterL3] = useState('');
    const [filterL4, setFilterL4] = useState('');
    const [filterL5, setFilterL5] = useState('');
    const [filterDiscipline, setFilterDiscipline] = useState('');
    const [filterInterval, setFilterInterval] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Metadata for dropdowns
    const [facets, setFacets] = useState({
        l3: [] as {id: string, name: string}[],
        l4: [] as {id: string, name: string}[],
        l5: [] as {id: string, name: string}[],
        disciplines: [] as {code: string, name: string}[],
        intervals: [] as {code: string, name: string}[],
        statuses: ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'CLOSED']
    });

    useEffect(() => {
        const plansRef = collection(db, `organisations/${organisation.domain}/modules/AM/maintenancePlans`);
        const q = query(plansRef, orderBy('createdAt', 'desc'));
        
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenancePlan));
            setPlans(data);
            
            // Build Facets
            const l3 = new Map(), l4 = new Map(), l5 = new Map();
            const discs = new Map(), ints = new Map();

            data.forEach(p => {
                // Only build facets from relevant plans (SCHEPM_)
                if (!(p.planName || '').startsWith('SCHEPM_')) return;

                if (p.allocationLevel3Id) l3.set(p.allocationLevel3Id, p.allocationLevel3Name || p.allocationLevel3Id);
                if (p.allocationLevel4Id) l4.set(p.allocationLevel4Id, p.allocationLevel4Name || p.allocationLevel4Id);
                if (p.allocationLevel5Id) l5.set(p.allocationLevel5Id, p.allocationLevel5Name || p.allocationLevel5Id);
                
                if (p.disciplineCode) {
                    discs.set(p.disciplineCode, p.disciplineName || p.disciplineCode);
                }
                if (p.intervalCode) {
                    ints.set(p.intervalCode, p.intervalName || p.intervalCode);
                }
            });

            setFacets(prev => ({
                ...prev,
                l3: Array.from(l3).map(([id, name]) => ({id, name: String(name || '')})).sort((a,b) => a.name.localeCompare(b.name)),
                l4: Array.from(l4).map(([id, name]) => ({id, name: String(name || '')})).sort((a,b) => a.name.localeCompare(b.name)),
                l5: Array.from(l5).map(([id, name]) => ({id, name: String(name || '')})).sort((a,b) => a.name.localeCompare(b.name)),
                disciplines: Array.from(discs).map(([code, name]) => ({code, name: String(name || '')})).sort((a,b) => a.name.localeCompare(b.name)),
                intervals: Array.from(ints).map(([code, name]) => ({code, name: String(name || '')})).sort((a,b) => a.name.localeCompare(b.name))
            }));

            setLoading(false);
        }, (error) => {
            console.error("Error fetching plans: ", error);
            setLoading(false);
        });
        
        return () => unsub();
    }, [organisation.domain]);

    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            // New constraint: must start with SCHEPM_
            if (!(p.planName || '').startsWith('SCHEPM_')) return false;

            const matchesSearch = !searchTerm || (p.planName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.planId || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesL3 = !filterL3 || p.allocationLevel3Id === filterL3;
            const matchesL4 = !filterL4 || p.allocationLevel4Id === filterL4;
            const matchesL5 = !filterL5 || p.allocationLevel5Id === filterL5;
            const matchesDisc = !filterDiscipline || p.disciplineCode === filterDiscipline;
            const matchesInt = !filterInterval || p.intervalCode === filterInterval;
            const matchesStatus = !filterStatus || p.status === filterStatus;

            return matchesSearch && matchesL3 && matchesL4 && matchesL5 && matchesDisc && matchesInt && matchesStatus;
        });
    }, [plans, searchTerm, filterL3, filterL4, filterL5, filterDiscipline, filterInterval, filterStatus]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'OPEN': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'SCHEDULED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">PM Schedule Registry</h2>
                    <p className="text-sm text-slate-500">View and track all operational maintenance schedules called from templates.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search schedules..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <Button 
                        onClick={onOpenSchedules} 
                        style={{ backgroundColor: theme.colorPrimary }}
                        className="!w-auto flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                        CALL SCHEDULE
                    </Button>
                </div>
            </div>

            {/* Filter Shelf */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Site</label>
                    <select value={filterL3} onChange={e => setFilterL3(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Sites</option>
                        {facets.l3.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dept</label>
                    <select value={filterL4} onChange={e => setFilterL4(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Depts</option>
                        {facets.l4.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                    <select value={filterL5} onChange={e => setFilterL5(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Sections</option>
                        {facets.l5.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discipline</label>
                    <select value={filterDiscipline} onChange={e => setFilterDiscipline(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Disciplines</option>
                        {facets.disciplines.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Interval</label>
                    <select value={filterInterval} onChange={e => setFilterInterval(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Intervals</option>
                        {facets.intervals.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 bg-white border rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Statuses</option>
                        {facets.statuses.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div></div>
                ) : filteredPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400 font-medium">No called schedules match your criteria.</p>
                        <button onClick={() => {setFilterL3(''); setFilterL4(''); setFilterL5(''); setFilterDiscipline(''); setFilterInterval(''); setFilterStatus(''); setSearchTerm('');}} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Clear all filters</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredPlans.map(plan => (
                            <div 
                                key={plan.id} 
                                onClick={() => onSelectPlan(plan)}
                                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                            >
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{plan.planId}</span>
                                        <h3 className="text-lg font-bold text-slate-800">{plan.planName}</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {plan.allocationLevel3Name}</span>
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {plan.allocationLevel4Name}</span>
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {plan.allocationLevel5Name}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-6 text-right">
                                    <div className="hidden lg:block">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={plan.disciplineName}>{plan.disciplineCode}</span>
                                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200" title={plan.intervalName}>{plan.intervalCode}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</p>
                                        <p className="text-xs font-bold text-slate-700">{plan.scheduledStartDate} → {plan.scheduledEndDate}</p>
                                        <p className="text-[10px] font-mono text-slate-400 uppercase">Wk {plan.week}, {plan.year}</p>
                                    </div>
                                    <div className="flex flex-col items-center min-w-[100px]">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shadow-sm ${getStatusColor(plan.status)}`}>
                                            {plan.status}
                                        </span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlannedJobsList;