import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { MaintenanceMasterPlan, MasterPlanTask } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import Button from '../../../Button';
import MasterPlanModal from './MasterPlanModal';
import MasterPlanTaskEditor from './MasterPlanTaskEditor';
import MasterPlanTaskDetail from './MasterPlanTaskDetail';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { collection, query, onSnapshot, doc, deleteDoc, getDocs, orderBy, writeBatch, updateDoc } from 'firebase/firestore';

interface PreventiveMaintenanceTabProps {
  theme: Organisation['theme'];
  organisation: Organisation;
  mode?: 'admin' | 'user';
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const SiteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>;
const DeptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SectionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>;
const AssetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.982.033 2.285-.947 2.285-1.566.379-1.566 2.6 0 2.978.98.238 1.487 1.305.947 2.286-.835 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.566 2.6 1.566 2.978 0a1.533 1.533 0 012.287-.947c1.372.835 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.286c1.566-.379-1.566-2.6 0-2.978a1.532 1.532 0 01-.947-2.286c.835-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
const AssemblyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const PlanIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>;
const TaskIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const PreventiveMaintenanceTab: React.FC<PreventiveMaintenanceTabProps> = ({ theme, organisation, mode = 'admin' }) => {
  const [masterPlans, setMasterPlans] = useState<MaintenanceMasterPlan[]>([]);
  const [hierarchy, setHierarchy] = useState<Record<string, HierarchyNode[]>>({ l3: [], l4: [], l5: [], l6: [], l7: [] });
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [expandedPlanTasks, setExpandedPlanTasks] = useState<Record<string, boolean>>({});
  const [planTasks, setPlanTasks] = useState<Record<string, MasterPlanTask[]>>({});
  const [loading, setLoading] = useState(true);
  
  // Modal/View State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<MaintenanceMasterPlan | null>(null);
  const [initialPlanData, setInitialPlanData] = useState<any>(null);
  const [selectedPlanForTasks, setSelectedPlanForTasks] = useState<MaintenanceMasterPlan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceMasterPlan | null>(null);
  
  // Reset/Disable All State
  const [confirmBulkAction, setConfirmBulkAction] = useState<{id: string, name: string, type: 'RESET' | 'TOGGLE', status: boolean} | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Task Editing State
  const [editingTask, setEditingTask] = useState<{ plan: MaintenanceMasterPlan, task: MasterPlanTask | null } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<{ plan: MaintenanceMasterPlan, task: MasterPlanTask } | null>(null);

  const isAdmin = mode === 'admin';

  // 1. Fetch All Master Plans
  useEffect(() => {
    const unsub = onSnapshot(collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans`), (snap) => {
      setMasterPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceMasterPlan)));
    });
    return unsub;
  }, [organisation.domain]);

  // 2. Initial Hierarchy Fetch (Sites)
  useEffect(() => {
    const fetchInitial = async () => {
        setLoading(true);
        try {
            const orgPath = `organisations/${organisation.domain}`;
            const l1Snap = await getDocs(collection(db, `${orgPath}/level_1`));
            const l3Nodes: HierarchyNode[] = [];
            for (const l1 of l1Snap.docs) {
                const l2Snap = await getDocs(collection(l1.ref, 'level_2'));
                for (const l2 of l2Snap.docs) {
                    const l3Snap = await getDocs(query(collection(l2.ref, 'level_3'), orderBy('name')));
                    l3Snap.forEach(l3 => l3Nodes.push({ id: l3.id, path: l3.ref.path, ...l3.data() } as HierarchyNode));
                }
            }
            setHierarchy(prev => ({ ...prev, l3: l3Nodes }));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchInitial();
  }, [organisation.domain]);

  // 3. Dynamic Node Fetching
  const fetchChildren = async (level: number, parentPath: string) => {
    const snap = await getDocs(query(collection(db, `${parentPath}/level_${level}`), orderBy('name')));
    const nodes = snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode));
    setHierarchy(prev => ({ ...prev, [`l${level}`]: [...(prev[`l${level}`] || []).filter(n => !nodes.some(newN => newN.id === n.id)), ...nodes] }));
  };

  const toggleNode = async (id: string, path: string, level: number) => {
      const isExpanded = !!expandedNodes[id];
      setExpandedNodes(prev => ({ ...prev, [id]: !isExpanded }));
      
      if (!isExpanded && level < 7) {
          await fetchChildren(level + 1, path);
      }
  };

  const togglePlanTasks = (plan: MaintenanceMasterPlan) => {
      const isExpanded = !!expandedPlanTasks[plan.id];
      setExpandedPlanTasks(prev => ({ ...prev, [plan.id]: !isExpanded }));
      
      if (!isExpanded && !planTasks[plan.id]) {
          // Setup real-time listener for plan tasks
          const tasksRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${plan.id}/tasks`);
          onSnapshot(query(tasksRef, orderBy('taskId', 'asc')), (snap) => {
              setPlanTasks(prev => ({
                  ...prev,
                  [plan.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as MasterPlanTask))
              }));
          });
      }
  };

  const handleDeletePlan = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async () => {
      if (!confirmDeleteTask) return;
      try {
          const { plan, task } = confirmDeleteTask;
          await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${plan.id}/tasks`, task.id));
          setConfirmDeleteTask(null);
      } catch (e) { console.error(e); }
  };

  const handleTogglePlanEnabled = async (planId: string, targetStatus: boolean) => {
      try {
          const batch = writeBatch(db);
          // 1. Update Plan
          batch.update(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, planId), {
              enabled: targetStatus
          });

          // 2. Update all tasks for this plan
          const tasksRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${planId}/tasks`);
          const tasksSnap = await getDocs(tasksRef);
          tasksSnap.forEach(tDoc => {
              batch.update(tDoc.ref, { enabled: targetStatus });
          });

          await batch.commit();
      } catch (e) { console.error(e); }
  };

  const handleToggleTaskEnabled = async (planId: string, taskId: string, targetStatus: boolean) => {
      try {
          const batch = writeBatch(db);
          const taskRef = doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${planId}/tasks`, taskId);
          
          // 1. Update Task
          batch.update(taskRef, { enabled: targetStatus });

          // 2. "Bubble Up" logic
          if (targetStatus === true) {
              // If we enable a task, the plan MUST be enabled
              batch.update(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, planId), {
                  enabled: true
              });
          } else {
              // If we disable a task, check if this was the last enabled task
              const otherTasks = planTasks[planId]?.filter(t => t.id !== taskId) || [];
              const anyOtherEnabled = otherTasks.some(t => t.enabled !== false);
              
              if (!anyOtherEnabled) {
                  // If all other tasks are disabled, disable the plan automatically
                  batch.update(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, planId), {
                      enabled: false
                  });
              }
          }

          await batch.commit();
      } catch (e) { console.error(e); }
  };

  const handleBulkActionAtLevel5 = async () => {
      if (!confirmBulkAction) return;
      setIsProcessingBulk(true);
      try {
          const targets = masterPlans.filter(p => p.assemblyPath.includes(confirmBulkAction.id));
          
          if (targets.length === 0) {
              alert("No plans found under this section.");
              setConfirmBulkAction(null);
              return;
          }

          const batch = writeBatch(db);
          const today = new Date().toISOString().split('T')[0];

          for (const p of targets) {
              const pRef = doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans`, p.id);
              if (confirmBulkAction.type === 'RESET') {
                  batch.update(pRef, { resetTag: true, lastCalled: today });
              } else {
                  // Cascade status to all plans and their tasks
                  batch.update(pRef, { enabled: confirmBulkAction.status });
                  const tRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${p.id}/tasks`);
                  const tSnap = await getDocs(tRef);
                  tSnap.forEach(td => batch.update(td.ref, { enabled: confirmBulkAction.status }));
              }
          }

          await batch.commit();
          setConfirmBulkAction(null);
      } catch (e) {
          console.error(e);
          alert("Bulk operation failed.");
      } finally {
          setIsProcessingBulk(false);
      }
  };

  // --- HIERARCHY RENDERER ---
  const NodeItem: React.FC<{ node: HierarchyNode; level: number }> = ({ node, level }) => {
    const isExpanded = !!expandedNodes[node.id!];
    const children = hierarchy[`l${level + 1}`]?.filter(c => c.path?.startsWith(node.path || ''));
    
    // Aggregation Logic for Level 5
    const plansInScope = masterPlans.filter(p => p.assemblyPath.includes(node.id!));
    const plansDirect = masterPlans.filter(p => p.assemblyId === node.id);
    
    const plans = level === 5 ? plansInScope : level === 7 ? plansDirect : [];

    const isLevel5 = level === 5;
    const allPlansDisabled = isLevel5 && plans.length > 0 && plans.every(p => !p.enabled);
    const anyPlanResetting = isLevel5 && plans.some(p => p.resetTag === true);

    const Icon = level === 3 ? SiteIcon : level === 4 ? DeptIcon : level === 5 ? SectionIcon : level === 6 ? AssetIcon : AssemblyIcon;

    return (
        <div className={`border-l border-slate-200 ml-4 animate-fade-in`}>
            <div 
                onClick={() => toggleNode(node.id!, node.path!, level)}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
            >
                <div className="flex items-center gap-3">
                    <ChevronIcon expanded={isExpanded} />
                    <Icon />
                    <div>
                        <span className="text-sm font-bold text-slate-700">{node.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">({node.code})</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isLevel5 && isAdmin && (
                        <div className="flex gap-1">
                             {!anyPlanResetting && (
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); setConfirmBulkAction({id: node.id!, name: node.name, type: 'RESET', status: true}); }}
                                    className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-bold uppercase hover:bg-amber-700 shadow-sm flex items-center gap-1"
                                >
                                    Reset All
                                </button>
                             )}
                             <button 
                                onClick={(e) => { e.stopPropagation(); setConfirmBulkAction({id: node.id!, name: node.name, type: 'TOGGLE', status: !!allPlansDisabled}); }}
                                className={`px-2 py-0.5 text-white rounded text-[10px] font-bold uppercase shadow-sm transition-colors ${allPlansDisabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {allPlansDisabled ? 'Enable All' : 'Disable All'}
                            </button>
                        </div>
                    )}
                    {level === 7 && isAdmin && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setInitialPlanData({ assemblyId: node.id, assemblyName: node.name, assemblyPath: node.path }); setIsPlanModalOpen(true); }}
                            className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase hover:bg-indigo-700 shadow-sm"
                        >
                            + New Plan
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="mt-1">
                    {/* Render sub-nodes */}
                    {level < 7 && (children || []).map(child => <NodeItem key={child.id} node={child} level={level + 1} />)}
                    
                    {/* Render Plans at Management Levels (L5 and L7) */}
                    {(level === 5 || level === 7) && (
                        <div className="ml-8 space-y-2 py-2 pr-4 border-l border-indigo-100 pl-4">
                            {(level === 5 && plans.length > 0) && <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Equipment Maintenance Registry (Recursive)</p>}
                            {plans.length === 0 ? (
                                level === 7 ? <p className="text-[10px] text-slate-400 italic">No templates defined for this assembly.</p> : null
                            ) : (
                                plans.map(plan => {
                                    const isTasksExpanded = !!expandedPlanTasks[plan.id];
                                    const tasks = planTasks[plan.id] || [];

                                    return (
                                        <div key={plan.id} className={`flex flex-col border rounded-lg shadow-sm hover:border-indigo-300 transition-all bg-white group overflow-hidden mb-2 ${!plan.enabled ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                            <div 
                                                className={`flex items-center justify-between p-3 cursor-pointer ${!plan.enabled ? 'bg-slate-100' : 'bg-slate-50'}`}
                                                onClick={() => togglePlanTasks(plan)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ChevronIcon expanded={isTasksExpanded} />
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <PlanIcon />
                                                            <p className={`text-xs font-black uppercase leading-none ${!plan.enabled ? 'text-slate-400 line-through' : 'text-indigo-700'}`}>{plan.code}</p>
                                                            {plan.resetTag && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 uppercase border border-amber-200">Reset</span>}
                                                            {!plan.enabled && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-100 text-red-700 uppercase border border-red-200">Disabled</span>}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">{plan.disciplineName} • {plan.intervalName}</p>
                                                        {level === 5 && <p className="text-[9px] text-indigo-400 font-bold uppercase mt-0.5">Asset: {plan.assemblyName}</p>}
                                                        {plan.lastCalled && <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">Last: {plan.lastCalled}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Plan Enabled Toggle */}
                                                    {isAdmin && (
                                                        <label className="relative inline-flex items-center cursor-pointer scale-75" onClick={e => e.stopPropagation()}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={plan.enabled} 
                                                                onChange={() => handleTogglePlanEnabled(plan.id, !plan.enabled)}
                                                                className="sr-only peer" 
                                                            />
                                                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                        </label>
                                                    )}

                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPlanForTasks(plan); }}
                                                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase hover:bg-indigo-700"
                                                    >
                                                        Manage Scope
                                                    </button>
                                                    {isAdmin && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setPlanToEdit(plan); setInitialPlanData(null); setIsPlanModalOpen(true); }}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600"
                                                            >
                                                                <EditIcon />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(plan); }} className="p-1.5 text-slate-400 hover:text-red-600"><DeleteIcon /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Nested Task List */}
                                            {isTasksExpanded && (
                                                <div className="p-2 bg-white space-y-1 animate-fade-in border-t border-slate-100">
                                                    <div className="flex justify-between items-center px-2 py-1 mb-1">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technical Tasks</span>
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={() => setEditingTask({ plan, task: null })}
                                                                className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase"
                                                            >
                                                                + Quick Add Task
                                                            </button>
                                                        )}
                                                    </div>
                                                    {tasks.length === 0 ? (
                                                        <p className="text-[10px] text-slate-400 italic px-2 py-2">No tasks defined in scope.</p>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {tasks.map(task => (
                                                                <div key={task.id} className={`flex items-center justify-between p-2 rounded border border-transparent hover:border-slate-200 transition-all group/task ${task.enabled === false ? 'bg-slate-50 opacity-60' : 'bg-slate-50/50'}`}>
                                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                                        <TaskIcon />
                                                                        <div className="truncate">
                                                                            <span className="text-[10px] font-mono font-bold text-slate-500 mr-2">{task.taskId}</span>
                                                                            <span className={`text-xs font-semibold ${task.enabled === false ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.taskName}</span>
                                                                            <span className="text-[9px] text-slate-400 ml-2 uppercase font-medium">{task.estimatedDurationHours}h</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {/* Task Enabled Toggle */}
                                                                        {isAdmin && (
                                                                            <>
                                                                                <label className="relative inline-flex items-center cursor-pointer scale-[0.6] opacity-0 group-hover/task:opacity-100 transition-opacity">
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        checked={task.enabled !== false} 
                                                                                        onChange={() => handleToggleTaskEnabled(plan.id, task.id, task.enabled === false)}
                                                                                        className="sr-only peer" 
                                                                                    />
                                                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                                                </label>

                                                                                <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                                                                    <button onClick={() => setEditingTask({ plan, task })} className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"><EditIcon /></button>
                                                                                    <button onClick={() => setConfirmDeleteTask({ plan, task })} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"><DeleteIcon /></button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
    );
  };

  if (selectedPlanForTasks) {
      return (
          <MasterPlanTaskEditor 
            plan={selectedPlanForTasks} 
            onBack={() => setSelectedPlanForTasks(null)}
            organisation={organisation}
            theme={theme}
          />
      );
  }

  if (editingTask) {
      return (
          <MasterPlanTaskDetail 
            plan={editingTask.plan}
            task={editingTask.task}
            onBack={() => setEditingTask(null)}
            organisation={organisation}
            theme={theme}
          />
      );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md min-h-[600px] space-y-12">
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-4">
            <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Maintenance Registry Explorer</h2>
                <p className="text-sm text-slate-500">Navigate the technical structure to manage master maintenance plans and their associated tasks.</p>
                {!isAdmin && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-medium flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        To create a new maintenance plan template, please contact your System Administrator.
                    </div>
                )}
            </div>
            {isAdmin && (
                <Button 
                    onClick={() => { setPlanToEdit(null); setInitialPlanData(null); setIsPlanModalOpen(true); }}
                    style={{ backgroundColor: theme.colorPrimary }}
                    className="!w-auto px-6 shadow-lg shadow-indigo-100"
                >
                    Create Blank Plan (Header Only)
                </Button>
            )}
        </div>

        {/* Hierarchical Explorer */}
        {loading ? (
            <div className="p-20 text-center"><div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-slate-400 mx-auto"></div></div>
        ) : (
            <div className="max-w-4xl">
                {hierarchy.l3.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-xl border-2 border-dashed">
                        <p className="text-slate-500 font-medium">No Sites (L3) configured in your organization hierarchy.</p>
                    </div>
                ) : (
                    <div className="space-y-1 pr-4">
                        {hierarchy.l3.map(site => <NodeItem key={site.id} node={site} level={3} />)}
                    </div>
                )}
            </div>
        )}
      </div>

      <MasterPlanModal 
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        organisation={organisation}
        theme={theme}
        planToEdit={planToEdit}
        initialData={initialPlanData}
      />

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeletePlan}
        title="Delete Master Plan?"
        message={`Delete template "${confirmDelete?.code}"?`}
      />

      <ConfirmationModal
        isOpen={!!confirmDeleteTask}
        onClose={() => setConfirmDeleteTask(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task Template?"
        message={`Are you sure you want to remove the task "${confirmDeleteTask?.task.taskName}" from this plan template?`}
      />

      <ConfirmationModal
        isOpen={!!confirmBulkAction}
        onClose={() => setConfirmBulkAction(null)}
        onConfirm={handleBulkActionAtLevel5}
        title={confirmBulkAction?.type === 'RESET' ? "Reset All Section Tasks" : (confirmBulkAction?.status ? "Enable All Section Tasks" : "Disable All Section Tasks")}
        message={`Are you sure you want to ${confirmBulkAction?.type === 'RESET' ? 'reset' : (confirmBulkAction?.status ? 'enable' : 'disable')} all maintenance master plans under "${confirmBulkAction?.name}"?`}
        isLoading={isProcessingBulk}
        confirmButtonText={`Yes, ${confirmBulkAction?.type === 'RESET' ? 'Reset' : (confirmBulkAction?.status ? 'Enable' : 'Disable')} All`}
        confirmButtonClass={confirmBulkAction?.type === 'RESET' ? "bg-amber-600 hover:bg-amber-700" : (confirmBulkAction?.status ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
      />
    </div>
  );
};

export default PreventiveMaintenanceTab;