import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { MaintenanceMasterPlan, MaintenancePlan, WorkOrder, MasterPlanTask, MaintenanceDiscipline, MaintenanceInterval } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import { collection, query, getDocs, doc, writeBatch, Timestamp, orderBy, where, getDoc } from 'firebase/firestore';

interface ScheduleCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
}

const SiteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>;
const DeptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SectionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>;

const ScheduleCallModal: React.FC<ScheduleCallModalProps> = ({ isOpen, onClose, organisation, currentUser, theme }) => {
    const [activeTab, setActiveTab] = useState<'caller' | 'overview'>('caller');
    const [step, setStep] = useState<'l3' | 'l4' | 'l5' | 'disciplines'>('l3');
    const [path, setPath] = useState<{id: string, name: string, level: number}[]>([]);
    const [nodes, setNodes] = useState<HierarchyNode[]>([]);
    const [allMasterPlans, setAllMasterPlans] = useState<MaintenanceMasterPlan[]>([]);
    const [disciplines, setDisciplines] = useState<{code: string, name: string, planCount: number, matureCount: number}[]>([]);
    const [planningConfig, setPlanningConfig] = useState({ planningCycle: 'Weekly', weekStartDay: 'Monday' });
    const [loading, setLoading] = useState(true);
    const [calling, setCalling] = useState(false);

    const DURATION_MAP: Record<string, number> = { 'Weekly': 7, 'Bi-Weekly': 14, 'Monthly': 30 };

    // Helpers
    const getWeekNumber = (d: Date) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const getDayIndex = (dayName: string) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days.indexOf(dayName);
    };

    const addDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    // --- MATURITY CALCULATION ---
    const isPlanMature = (plan: MaintenanceMasterPlan) => {
        if (plan.resetTag) return true;
        if (!plan.enabled) return false;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const startDayIdx = getDayIndex(planningConfig.weekStartDay);
        const cycleDays = DURATION_MAP[planningConfig.planningCycle] || 7;

        // 1. Calculate NEXT cycle start date
        let nextStart = new Date(now);
        const daysUntilStart = (startDayIdx - now.getDay() + 7) % 7;
        nextStart.setDate(now.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart));
        
        // 2. Window opens 2 days before nextStart
        const windowOpenDate = new Date(nextStart);
        windowOpenDate.setDate(nextStart.getDate() - 2);

        const isWithinWindow = now >= windowOpenDate;
        
        // 3. Interval Logic (Was it called recently?)
        if (!plan.lastCalled) return isWithinWindow;

        const last = new Date(plan.lastCalled);
        const daysSince = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);

        // Mature if within window AND not called in the last (Cycle - 2) days
        return isWithinWindow && daysSince >= (cycleDays - 2);
    };

    const getMatureCountForPath = (pathString: string) => {
        return allMasterPlans.filter(p => p.assemblyPath.includes(pathString) && isPlanMature(p)).length;
    };

    // 1. Initial Data Fetch (Registry-wide)
    useEffect(() => {
        if (!isOpen) return;
        const fetchAll = async () => {
            setLoading(true);
            try {
                const orgPath = `organisations/${organisation.domain}`;
                
                // Fetch Config
                const configSnap = await getDoc(doc(db, `${orgPath}/modules/AM/settings/planning`));
                if (configSnap.exists()) setPlanningConfig(configSnap.data() as any);

                // Fetch ALL Master Plans for global counting
                const plansRef = collection(db, `${orgPath}/modules/AM/masterPlans`);
                const plansSnap = await getDocs(plansRef);
                const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceMasterPlan));
                setAllMasterPlans(allPlans);

                // Fetch Root Nodes (L3)
                const l1Snap = await getDocs(collection(db, `${orgPath}/level_1`));
                const l3Nodes: HierarchyNode[] = [];
                for (const l1 of l1Snap.docs) {
                    const l2Snap = await getDocs(collection(l1.ref, 'level_2'));
                    for (const l2 of l2Snap.docs) {
                        const l3Snap = await getDocs(query(collection(l2.ref, 'level_3'), orderBy('name')));
                        l3Snap.forEach(l3 => l3Nodes.push({ id: l3.id, path: l3.ref.path, ...l3.data() } as HierarchyNode));
                    }
                }
                setNodes(l3Nodes.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchAll();
    }, [isOpen, organisation.domain]);

    // 2. Drill Down Navigation
    const handleNodeClick = async (node: HierarchyNode, level: number) => {
        const matureInScope = getMatureCountForPath(node.path!);
        if (matureInScope === 0 && level < 5) return; // Prevent clicking empty nodes

        const newPath = [...path, { id: node.id!, name: node.name, level }];
        setPath(newPath);
        
        if (level < 5) {
            setLoading(true);
            const nextLevel = level + 1;
            const snap = await getDocs(query(collection(db, `${node.path}/level_${nextLevel}`), orderBy('name')));
            setNodes(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)).sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setStep(`l${nextLevel}` as any);
            setLoading(false);
        } else {
            // Level 5 reached - Show Discipline Summary
            const plans = allMasterPlans.filter(p => p.assemblyPath.includes(node.path!) && p.enabled);

            const grouped: Record<string, {name: string, plans: MaintenanceMasterPlan[]}> = {};
            plans.forEach(p => {
                if (!grouped[p.disciplineCode]) grouped[p.disciplineCode] = { name: p.disciplineName, plans: [] };
                grouped[p.disciplineCode].plans.push(p);
            });

            const discSummary = Object.entries(grouped).map(([code, info]) => {
                const maturePlans = info.plans.filter(p => isPlanMature(p));
                return {
                    code,
                    name: info.name,
                    planCount: info.plans.length,
                    matureCount: maturePlans.length
                };
            });

            setDisciplines(discSummary.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setStep('disciplines');
        }
    };

    const handleCallSchedule = async (disciplineCode: string) => {
        const plansToCall = allMasterPlans.filter(p => 
            p.disciplineCode === disciplineCode && 
            p.assemblyPath.includes(path[path.length-1].id) && 
            isPlanMature(p)
        );

        if (plansToCall.length === 0) return;

        setCalling(true);
        const batch = writeBatch(db);
        const todayStr = new Date().toISOString().split('T')[0];
        
        const startDayIdx = getDayIndex(planningConfig.weekStartDay);
        const nextWeekStart = addDays(new Date(), (startDayIdx - new Date().getDay() + 7) % 7);
        const cycleDuration = DURATION_MAP[planningConfig.planningCycle] || 7;
        const targetStartDate = nextWeekStart;
        const targetEndDate = addDays(targetStartDate, cycleDuration - 1);

        try {
            const orgPath = `organisations/${organisation.domain}`;
            const countersRef = doc(db, `${orgPath}/modules/AM/settings/counters`);
            const counterSnap = await getDoc(countersRef);
            let counters = { maintenancePlanCounter: 0, workOrderCounter: 0 };
            if (counterSnap.exists()) counters = counterSnap.data() as any;

            const l3 = path.find(p => p.level === 3);
            const l4 = path.find(p => p.level === 4);
            const l5 = path.find(p => p.level === 5);

            const newPlanId = `MP${String(++counters.maintenancePlanCounter).padStart(6, '0')}`;
            const plansCollectionRef = collection(db, `${orgPath}/modules/AM/maintenancePlans`);
            const planRef = doc(plansCollectionRef);
            const disciplineName = disciplines.find(d => d.code === disciplineCode)?.name || '';
            
            const planName = `SCHEPM_${l5?.name.substring(0, 5).toUpperCase() || 'SEC'}_${disciplineCode}_W${getWeekNumber(targetStartDate)}_${targetStartDate.getFullYear()}`;

            const operationalPlan: Omit<MaintenancePlan, 'id'> = {
                planId: newPlanId,
                planName: planName,
                year: targetStartDate.getFullYear(),
                week: getWeekNumber(targetStartDate),
                scheduledStartDate: targetStartDate.toISOString().split('T')[0],
                scheduledEndDate: targetEndDate.toISOString().split('T')[0],
                durationDays: cycleDuration,
                status: 'OPEN',
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now(),
                workStartTime: '00:00',
                workEndTime: '23:59',
                // Metadata for filtering
                disciplineCode,
                disciplineName,
                intervalCode: plansToCall[0]?.intervalCode || '',
                intervalName: plansToCall[0]?.intervalName || '',
                // Hierarchy
                allocationLevel3Id: l3?.id || '',
                allocationLevel3Name: l3?.name || '',
                allocationLevel4Id: l4?.id || '',
                allocationLevel4Name: l4?.name || '',
                allocationLevel5Id: l5?.id || '',
                allocationLevel5Name: l5?.name || ''
            };
            batch.set(planRef, operationalPlan);

            for (const master of plansToCall) {
                const woRef = doc(collection(db, `${orgPath}/modules/AM/workOrders`));
                const newWoId = `WO${String(++counters.workOrderCounter).padStart(8, '0')}`;
                
                const workOrder: Omit<WorkOrder, 'id'> = {
                    woId: newWoId,
                    workRequestRef: '', 
                    wrId: 'AUTO_PM',
                    title: `[PM] ${master.code}`,
                    description: `Automated Preventive Maintenance call for ${master.assemblyName} (${master.code})`,
                    assemblyPath: master.assemblyPath,
                    assemblyName: master.assemblyName,
                    assemblyCode: master.code,
                    allocationLevel1Id: currentUser.allocationLevel1Id || '',
                    allocationLevel1Name: currentUser.allocationLevel1Name || '',
                    allocationLevel2Id: currentUser.allocationLevel2Id || '',
                    allocationLevel2Name: currentUser.allocationLevel2Name || '',
                    allocationLevel3Id: operationalPlan.allocationLevel3Id,
                    allocationLevel3Name: operationalPlan.allocationLevel3Name,
                    allocationLevel4Id: operationalPlan.allocationLevel4Id,
                    allocationLevel4Name: operationalPlan.allocationLevel4Name,
                    allocationLevel5Id: operationalPlan.allocationLevel5Id,
                    allocationLevel5Name: operationalPlan.allocationLevel5Name,
                    allocationLevel6Id: master.assemblyPath.split('/')[13] || '', 
                    allocationLevel6Name: '', 
                    allocationLevel7Id: master.assemblyId, 
                    allocationLevel7Name: master.assemblyName,
                    createdAt: Timestamp.now(),
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    status: 'SCHEDULED', 
                    pmNumber: newPlanId,
                    scheduledStartDate: operationalPlan.scheduledStartDate,
                    scheduledEndDate: operationalPlan.scheduledEndDate,
                    raisedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    tagSource: 'System (PM)',
                    impactCategoryName: 'Asset Integrity',
                    impactSubcategoryName: 'Routine Maintenance',
                    impactSubcategoryDescription: 'Standard scheduled PM task.'
                };
                batch.set(woRef, workOrder);

                const masterTasksSnap = await getDocs(collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${master.id}/tasks`));
                const masterTasks = masterTasksSnap.docs.map(d => ({id: d.id, ...d.data()} as MasterPlanTask));

                for (const mt of masterTasks) {
                    const tRef = doc(collection(woRef, 'tasks'));
                    batch.set(tRef, {
                        ...mt,
                        id: tRef.id,
                        status: 'PENDING',
                        createdAt: Timestamp.now(),
                        createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                        requiredSpares: mt.requiredSpares || [],
                        requiredServices: mt.requiredServices || [],
                        riskAssessments: mt.riskAssessments || []
                    });
                }

                batch.update(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, master.id), {
                    lastCalled: todayStr,
                    resetTag: false
                });
            }

            batch.set(countersRef, counters, { merge: true });
            await batch.commit();
            alert(`Call Complete: Generated Maintenance Plan ${newPlanId}`);
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Call failed: " + e.message);
        } finally {
            setCalling(false);
        }
    };

    // --- OVERVIEW DATA CALCULATION ---
    const overviewData = useMemo(() => {
        const grouped: Record<string, { interval: string, total: number, mature: number, nextMaturity: string }> = {};
        
        allMasterPlans.forEach(p => {
            if (!grouped[p.intervalCode]) {
                const now = new Date();
                const startDayIdx = getDayIndex(planningConfig.weekStartDay);
                let nextStart = new Date(now);
                const daysUntilStart = (startDayIdx - now.getDay() + 7) % 7;
                nextStart.setDate(now.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart));
                const maturityDate = new Date(nextStart);
                maturityDate.setDate(nextStart.getDate() - 2);

                grouped[p.intervalCode] = {
                    interval: p.intervalName,
                    total: 0,
                    mature: 0,
                    nextMaturity: maturityDate.toLocaleDateString()
                };
            }
            grouped[p.intervalCode].total++;
            if (isPlanMature(p)) grouped[p.intervalCode].mature++;
        });

        return Object.values(grouped).sort((a,b) => (a.interval || '').localeCompare(b.interval || ''));
    }, [allMasterPlans, planningConfig]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Maintenance Call Manager" size="5xl">
            <div className="space-y-6">
                {/* Tab Header */}
                <div className="flex border-b border-slate-200">
                    <button 
                        onClick={() => setActiveTab('caller')}
                        className={`px-6 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'caller' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        SCHEDULE CALLER
                    </button>
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        MATURITY OVERVIEW
                    </button>
                </div>

                {activeTab === 'caller' ? (
                    <>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-x-auto">
                            <button onClick={() => { setPath([]); setStep('l3'); }} className="hover:text-indigo-600 transition-colors">Registry</button>
                            {path.map((p, i) => (
                                <React.Fragment key={p.id}>
                                    <span>/</span>
                                    <button className="text-slate-800">{p.name}</button>
                                </React.Fragment>
                            ))}
                        </div>

                        {loading ? (
                            <div className="p-20 text-center"><div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-600 mx-auto"></div><p className="mt-4 text-slate-500 font-medium italic">Navigating technical structure...</p></div>
                        ) : (
                            <div className="animate-fade-in">
                                {step !== 'disciplines' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {nodes.map(node => {
                                            const Icon = step === 'l3' ? SiteIcon : step === 'l4' ? DeptIcon : SectionIcon;
                                            const matureCount = getMatureCountForPath(node.path!);
                                            const isDisabled = matureCount === 0;

                                            return (
                                                <button 
                                                    key={node.id} 
                                                    disabled={isDisabled}
                                                    onClick={() => handleNodeClick(node, parseInt(step.substring(1)))}
                                                    className={`p-4 border rounded-xl transition-all text-left flex items-center gap-4 group relative ${
                                                        isDisabled 
                                                        ? 'bg-slate-50 border-slate-200 grayscale opacity-60 cursor-not-allowed' 
                                                        : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                                                    }`}
                                                >
                                                    <div className={`p-3 rounded-lg transition-colors ${isDisabled ? 'bg-slate-100' : 'bg-slate-100 group-hover:bg-indigo-50'}`}><Icon /></div>
                                                    <div className="overflow-hidden pr-8">
                                                        <p className="font-bold text-slate-800 truncate">{node.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">CODE: {node.code}</p>
                                                    </div>
                                                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${isDisabled ? 'bg-slate-200 text-slate-500' : 'bg-green-100 text-green-700 border border-green-200 shadow-sm'}`}>
                                                        {matureCount} Mature
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-4 shadow-sm">
                                            <div className="bg-white px-3 py-1 rounded-full shadow-sm text-indigo-600 font-bold text-xs uppercase border border-indigo-100">Cycle: {planningConfig.planningCycle}</div>
                                            <div className="bg-white px-3 py-1 rounded-full shadow-sm text-indigo-600 font-bold text-xs uppercase border border-indigo-100">Week Starts: {planningConfig.weekStartDay}</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {disciplines.map(disc => (
                                                <div key={disc.code} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                    <div className={`absolute top-0 left-0 w-2 h-full ${disc.matureCount > 0 ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{disc.name}</h4>
                                                            <p className="text-xs text-slate-500 font-medium">Registry: {disc.planCount} templates</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`text-2xl font-black ${disc.matureCount > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{disc.matureCount}</div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Mature Jobs</p>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        onClick={() => handleCallSchedule(disc.code)} 
                                                        disabled={disc.matureCount === 0 || calling} 
                                                        isLoading={calling}
                                                        className={`w-full !py-2.5 !text-xs font-black tracking-widest ${disc.matureCount > 0 ? 'shadow-lg shadow-indigo-100' : 'opacity-50 grayscale'}`}
                                                    >
                                                        CALL DISCIPLINE SCHEDULE
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6">Maturity Statistics by Interval</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {overviewData.map(item => (
                                    <div key={item.interval} className="p-5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center group hover:border-indigo-300 transition-colors">
                                        <div className="space-y-1">
                                            <h4 className="text-base font-bold text-slate-700">{item.interval}</h4>
                                            <p className="text-xs text-slate-500">Next Maturity Cycle opens: <span className="font-bold text-indigo-600">{item.nextMaturity}</span></p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-400 uppercase">Registry</span>
                                                    <span className="text-lg font-black text-slate-800">{item.total}</span>
                                                </div>
                                                <div className="w-px h-8 bg-slate-200"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-green-600 uppercase">Mature</span>
                                                    <span className="text-lg font-black text-green-600">{item.mature}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-900 rounded-2xl text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10"><svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 001 1v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 1 0 2 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                            <h4 className="text-sm font-black uppercase tracking-widest opacity-60 mb-2">Configuration Summary</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                <div><p className="text-2xl font-black">{allMasterPlans.length}</p><p className="text-[10px] font-bold uppercase opacity-60">Total Templates</p></div>
                                <div><p className="text-2xl font-black">{allMasterPlans.filter(p => isPlanMature(p)).length}</p><p className="text-[10px] font-bold uppercase opacity-60">Total Mature</p></div>
                                <div><p className="text-2xl font-black uppercase">{planningConfig.planningCycle}</p><p className="text-[10px] font-bold uppercase opacity-60">Planning Cycle</p></div>
                                <div><p className="text-2xl font-black uppercase">{planningConfig.weekStartDay}</p><p className="text-[10px] font-bold uppercase opacity-60">Week Start</p></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ScheduleCallModal;