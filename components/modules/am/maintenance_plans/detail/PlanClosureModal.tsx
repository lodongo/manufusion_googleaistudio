
import React, { useState, useEffect } from 'react';
import type { WorkOrder, EnrichedTask, Reservation, WorkOrderTask } from '../../../../../types/am_types';
import type { AppUser } from '../../../../../types';
import Modal from '../../../../common/Modal';
import Button from '../../../../Button';
import Input from '../../../../Input';
import { db } from '../../../../../services/firebase';
import { doc, writeBatch, Timestamp, collection, getDocs, query, where } from 'firebase/firestore';

interface PlanClosureModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: string;
    workOrders: WorkOrder[];
    allTasks: EnrichedTask[];
    reservations: Reservation[];
    organisationDomain: string;
    onCloseComplete: () => void;
    currentUser: AppUser;
}

interface IncidentDraft {
    hazardId?: string; // If from RA
    hazardName?: string; 
    description: string;
    severity: 'Low' | 'Medium' | 'High';
    // For unassessed:
    injuryCategoryId?: string;
    injuryId?: string;
}

interface TaskClosureData {
    taskId: string;
    isCompleted: boolean;
    actualDuration: number;
    comments: string;
    safetyIncidents: IncidentDraft[];
    canComplete: boolean; // Computed based on spares
}

interface InjuryCategory {
    id: string;
    name: string;
    code: string;
    description?: string;
}

interface SpecificInjury {
    id: string;
    name: string;
    description?: string;
}

const PlanClosureModal: React.FC<PlanClosureModalProps> = ({ 
    isOpen, onClose, planId, workOrders, allTasks, reservations, organisationDomain, onCloseComplete, currentUser 
}) => {
    const [closureData, setClosureData] = useState<Record<string, TaskClosureData>>({});
    const [breakInTasks, setBreakInTasks] = useState<Partial<WorkOrderTask>[]>([]);
    const [selectedWoId, setSelectedWoId] = useState<string>(workOrders[0]?.id || '');
    const [isSaving, setIsSaving] = useState(false);
    
    // SHE Data for Unassessed Incidents
    const [injuryCategories, setInjuryCategories] = useState<InjuryCategory[]>([]);
    const [injuriesMap, setInjuriesMap] = useState<Record<string, SpecificInjury[]>>({});
    
    // Break-in form state
    const [newBreakInTask, setNewBreakInTask] = useState({ name: '', description: '', duration: 1 });
    const [newBreakInStatus, setNewBreakInStatus] = useState<'COMPLETED' | 'PENDING'>('COMPLETED');

    const currentUserName = `${currentUser.firstName} ${currentUser.lastName}`;

    // Fetch SHE Data
    useEffect(() => {
        if (isOpen) {
            const fetchSheData = async () => {
                try {
                    const catRef = collection(db, 'modules/SHE/Injuries');
                    const qCat = query(catRef, where('enabled', '==', true));
                    const catSnap = await getDocs(qCat);
                    
                    const cats = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as InjuryCategory));
                    setInjuryCategories(cats.sort((a,b) => a.name.localeCompare(b.name)));

                    const newInjuriesMap: Record<string, SpecificInjury[]> = {};
                    
                    await Promise.all(cats.map(async (cat) => {
                        const subRef = collection(db, `modules/SHE/Injuries/${cat.id}/Injuries`);
                        const qSub = query(subRef, where('enabled', '==', true));
                        const subSnap = await getDocs(qSub);
                        newInjuriesMap[cat.id] = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as SpecificInjury)).sort((a,b) => a.name.localeCompare(b.name));
                    }));
                    
                    setInjuriesMap(newInjuriesMap);
                } catch (error) {
                    console.error("Error fetching SHE data:", error);
                }
            };
            fetchSheData();
        }
    }, [isOpen]);

    // Initialize closure data structure
    useEffect(() => {
        if (isOpen) {
            const initialData: Record<string, TaskClosureData> = {};
            allTasks.forEach(task => {
                // Check if all spares for this task are ISSUED
                const taskSpares = task.requiredSpares || [];
                const taskReservations = reservations.filter(r => r.taskId === task.taskId);
                
                // A task can complete if it has no spares, OR if all its spares have matching ISSUED reservations
                // Note: Simply checking reservation status is usually enough if reservations were generated 1:1 with requirements
                const allSparesIssued = taskSpares.every(spare => {
                    const res = taskReservations.find(r => r.materialId === spare.materialId);
                    return res && res.status === 'ISSUED';
                });
                
                const canComplete = taskSpares.length === 0 || allSparesIssued;

                initialData[task.id] = {
                    taskId: task.id,
                    isCompleted: false,
                    actualDuration: task.estimatedDurationHours || 0,
                    comments: '',
                    safetyIncidents: [],
                    canComplete
                };
            });
            setClosureData(initialData);
            setBreakInTasks([]);
        }
    }, [isOpen, allTasks, reservations]);

    const handleTaskChange = (taskId: string, field: keyof TaskClosureData, value: any) => {
        setClosureData(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], [field]: value }
        }));
    };

    const handleSafetyIncident = (taskId: string, incident: IncidentDraft) => {
        setClosureData(prev => ({
            ...prev,
            [taskId]: { 
                ...prev[taskId], 
                safetyIncidents: [...prev[taskId].safetyIncidents, incident] 
            }
        }));
    };
    
    const updateSafetyIncident = (taskId: string, index: number, field: keyof IncidentDraft, value: any) => {
        setClosureData(prev => {
            const newIncidents = [...prev[taskId].safetyIncidents];
            const incident = { ...newIncidents[index], [field]: value };
            
            // Auto-update name/description if category/injury changes for unassessed
            if (!incident.hazardId) {
                if (field === 'injuryCategoryId') {
                    incident.injuryId = ''; // Reset sub
                }
                
                if (field === 'injuryCategoryId' || field === 'injuryId') {
                    const cat = injuryCategories.find(c => c.id === incident.injuryCategoryId);
                    const inj = injuriesMap[incident.injuryCategoryId || '']?.find(i => i.id === incident.injuryId);
                    
                    if (cat && inj) {
                        incident.hazardName = `${cat.name} - ${inj.name}`;
                        incident.description = inj.description || cat.description || '';
                    } else if (cat) {
                        incident.hazardName = `${cat.name} - ...`;
                    }
                }
            }
            
            newIncidents[index] = incident;
            return {
                ...prev,
                [taskId]: { ...prev[taskId], safetyIncidents: newIncidents }
            };
        });
    };
    
    const removeSafetyIncident = (taskId: string, index: number) => {
        setClosureData(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                safetyIncidents: prev[taskId].safetyIncidents.filter((_, i) => i !== index)
            }
        }));
    };

    const handleAddBreakInTask = () => {
        if (!newBreakInTask.name || !selectedWoId) return;
        
        const wo = workOrders.find(w => w.id === selectedWoId);
        const newTask: Partial<WorkOrderTask> & { workOrderId: string, tempId: string } = {
            tempId: `breakin_${Date.now()}`,
            workOrderId: selectedWoId,
            taskId: `${wo?.woId}-BK-${breakInTasks.length + 1}`, // Temporary display ID
            taskName: newBreakInTask.name,
            description: newBreakInTask.description,
            estimatedDurationHours: newBreakInTask.duration,
            status: newBreakInStatus, // Use selected status
            isBreakin: true,
            createdAt: Timestamp.now(),
            createdBy: { uid: currentUser.uid, name: currentUserName }
        };
        
        setBreakInTasks(prev => [...prev, newTask]);
        setNewBreakInTask({ name: '', description: '', duration: 1 });
        setNewBreakInStatus('COMPLETED'); // Reset to default
    };

    const handleConfirmClosure = async () => {
        // Validate
        for (const taskId in closureData) {
            const data = closureData[taskId];
            if (data.isCompleted) {
                for (const inc of data.safetyIncidents) {
                    if (!inc.hazardId && (!inc.injuryCategoryId || !inc.injuryId)) {
                        alert(`Please select a Risk Category and Subcategory for the unassessed incident in task ${taskId}`);
                        return;
                    }
                }
            }
        }
        
        setIsSaving(true);
        const batch = writeBatch(db);
        
        try {
            // 1. Update Tasks
            Object.values(closureData).forEach((data: TaskClosureData) => {
                if (data.isCompleted) {
                    const taskRef = db.doc(`organisations/${organisationDomain}/modules/AM/workOrders/${allTasks.find(t => t.id === data.taskId)?.workOrderId}/tasks/${data.taskId}`);
                    batch.update(taskRef, {
                        status: 'COMPLETED',
                        actualDurationHours: data.actualDuration,
                        completionComments: data.comments,
                        safetyIncidents: data.safetyIncidents,
                        completedAt: Timestamp.now(),
                        updatedBy: { uid: currentUser.uid, name: currentUserName }
                    });
                }
            });

            // 2. Add Break-in Tasks
            for (const bt of breakInTasks) {
                const woRef = db.doc(`organisations/${organisationDomain}/modules/AM/workOrders/${(bt as any).workOrderId}`);
                const taskCol = db.collection(woRef, 'tasks');
                const newRef = doc(taskCol);
                
                // Get real count for ID if needed, or just append
                const { tempId, ...taskData } = bt as any;
                
                // Only add completedAt if status is COMPLETED
                const completionData = taskData.status === 'COMPLETED' ? { completedAt: Timestamp.now() } : {};

                batch.set(newRef, {
                    ...taskData,
                    id: newRef.id,
                    ...completionData
                });
            }

            // 3. Close Work Orders (if all tasks complete)
            workOrders.forEach(wo => {
                const woTasks = allTasks.filter(t => t.workOrderId === wo.id);
                // Check existing planned tasks
                const allPlannedDone = woTasks.every(t => closureData[t.id]?.isCompleted);
                
                // Check new break-in tasks for this WO
                const woBreakIns = breakInTasks.filter((t: any) => t.workOrderId === wo.id);
                const allBreakInsDone = woBreakIns.every(t => t.status === 'COMPLETED');

                // WO closes only if ALL planned tasks are done AND all added break-in tasks are marked as completed.
                if (allPlannedDone && allBreakInsDone) {
                    const woRef = db.doc(`organisations/${organisationDomain}/modules/AM/workOrders/${wo.id}`);
                    batch.update(woRef, {
                        status: 'COMPLETED',
                        actualCompletionDate: Timestamp.now()
                    });
                }
            });

            // 4. Close Plan
            // Plan is completed if ALL linked WOs are completed.
            const allWOsWillClose = workOrders.every(wo => {
                 const woTasks = allTasks.filter(t => t.workOrderId === wo.id);
                 const allPlannedDone = woTasks.every(t => closureData[t.id]?.isCompleted);
                 const woBreakIns = breakInTasks.filter((t: any) => t.workOrderId === wo.id);
                 const allBreakInsDone = woBreakIns.every(t => t.status === 'COMPLETED');
                 return allPlannedDone && allBreakInsDone;
            });

            if (allWOsWillClose) {
                const planRef = db.doc(`organisations/${organisationDomain}/modules/AM/maintenancePlans/${planId}`);
                batch.update(planRef, { status: 'COMPLETED' });
            } 
            
            await batch.commit();
            onCloseComplete();
            onClose();

        } catch (e) {
            console.error(e);
            alert("Failed to close plan.");
        } finally {
            setIsSaving(false);
        }
    };

    const activeWo = workOrders.find(w => w.id === selectedWoId);
    const activeTasks = allTasks.filter(t => t.workOrderId === selectedWoId && !t.isSafetyTask);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Close Maintenance Plan" size="6xl">
            <div className="flex flex-col h-[75vh]">
                <div className="flex gap-4 h-full overflow-hidden">
                    {/* Sidebar: Work Orders */}
                    <div className="w-1/4 border-r pr-4 overflow-y-auto">
                        <h4 className="font-bold text-slate-700 mb-3">Work Orders</h4>
                        <div className="space-y-2">
                            {workOrders.map(wo => {
                                const woTasks = allTasks.filter(t => t.workOrderId === wo.id && !t.isSafetyTask);
                                const completedCount = woTasks.filter(t => closureData[t.id]?.isCompleted).length;
                                const isFullyReady = completedCount === woTasks.length;
                                
                                return (
                                    <div 
                                        key={wo.id} 
                                        onClick={() => setSelectedWoId(wo.id)}
                                        className={`p-3 rounded cursor-pointer border ${selectedWoId === wo.id ? 'bg-blue-50 border-blue-500' : 'bg-white hover:bg-slate-50'}`}
                                    >
                                        <p className="font-bold text-sm text-slate-800">{wo.woId}</p>
                                        <p className="text-xs text-slate-500 truncate">{wo.title}</p>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{completedCount}/{woTasks.length} Tasks</span>
                                            {isFullyReady && <span className="text-green-600 font-bold text-xs">Ready</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content: Tasks for selected WO */}
                    <div className="w-3/4 pl-2 overflow-y-auto pr-2">
                        {activeWo && (
                            <div className="space-y-6 pb-6">
                                <div className="border-b pb-2 mb-4">
                                    <h3 className="text-xl font-bold text-slate-800">{activeWo.title}</h3>
                                    <p className="text-sm text-slate-500">{activeWo.woId} - {activeWo.allocationLevel6Name}</p>
                                </div>

                                {activeTasks.map(task => {
                                    const data = closureData[task.id];
                                    if (!data) return null;
                                    
                                    return (
                                        <div key={task.id} className={`p-4 border rounded-lg ${data.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={data.isCompleted} 
                                                        onChange={e => handleTaskChange(task.id, 'isCompleted', e.target.checked)}
                                                        disabled={!data.canComplete}
                                                        className="w-5 h-5 rounded text-green-600 focus:ring-green-500 disabled:opacity-50"
                                                    />
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{task.taskName}</h4>
                                                        {!data.canComplete && <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">Spares Not Issued</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Actual Hrs:</label>
                                                    <input 
                                                        type="number" 
                                                        value={data.actualDuration} 
                                                        onChange={e => handleTaskChange(task.id, 'actualDuration', Number(e.target.value))}
                                                        className="w-16 p-1 text-sm border rounded"
                                                        min={0}
                                                        disabled={!data.isCompleted}
                                                    />
                                                </div>
                                            </div>

                                            {data.isCompleted && (
                                                <div className="space-y-4 pl-8 border-l-2 border-slate-200 ml-2">
                                                    {/* Safety Reporting */}
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Safety Report</p>
                                                        <div className="space-y-2">
                                                            {/* Original Risks */}
                                                            {(task.riskAssessments || []).map(ra => (
                                                                <div key={ra.id} className="flex items-center gap-2 text-sm">
                                                                    <span className="text-slate-600 w-1/3 truncate" title={ra.hazardName}>{ra.hazardName}</span>
                                                                    <button 
                                                                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                                                        onClick={() => handleSafetyIncident(task.id, {
                                                                            hazardId: ra.id,
                                                                            hazardName: ra.hazardName,
                                                                            description: 'Incident occurred during task execution.',
                                                                            severity: 'Medium'
                                                                        })}
                                                                    >
                                                                        Report Incident
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            
                                                            {/* Reported Incidents */}
                                                            {data.safetyIncidents.map((inc, idx) => {
                                                                const isUnassessed = !inc.hazardId;
                                                                
                                                                return (
                                                                <div key={idx} className="flex flex-col gap-2 bg-red-50 p-3 rounded border border-red-100">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-bold text-red-800 text-xs">{inc.hazardName || 'New Incident'}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <select 
                                                                                value={inc.severity} 
                                                                                onChange={e => updateSafetyIncident(task.id, idx, 'severity', e.target.value)}
                                                                                className="text-xs p-1 border rounded"
                                                                            >
                                                                                <option value="Low">Low</option>
                                                                                <option value="Medium">Medium</option>
                                                                                <option value="High">High</option>
                                                                            </select>
                                                                            <button onClick={() => removeSafetyIncident(task.id, idx)} className="text-red-400 hover:text-red-600">×</button>
                                                                        </div>
                                                                    </div>

                                                                    {isUnassessed && (
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                             <select 
                                                                                className="text-xs p-1 border rounded w-full"
                                                                                value={inc.injuryCategoryId || ''}
                                                                                onChange={e => updateSafetyIncident(task.id, idx, 'injuryCategoryId', e.target.value)}
                                                                             >
                                                                                 <option value="">Select Risk Category...</option>
                                                                                 {injuryCategories.map(cat => (
                                                                                     <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                                                 ))}
                                                                             </select>
                                                                             <select 
                                                                                className="text-xs p-1 border rounded w-full"
                                                                                value={inc.injuryId || ''}
                                                                                onChange={e => updateSafetyIncident(task.id, idx, 'injuryId', e.target.value)}
                                                                                disabled={!inc.injuryCategoryId}
                                                                             >
                                                                                 <option value="">Select Subcategory...</option>
                                                                                 {(injuriesMap[inc.injuryCategoryId || ''] || []).map(inj => (
                                                                                     <option key={inj.id} value={inj.id}>{inj.name}</option>
                                                                                 ))}
                                                                             </select>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <Input 
                                                                        value={inc.description} 
                                                                        onChange={e => updateSafetyIncident(task.id, idx, 'description', e.target.value)}
                                                                        className="text-xs"
                                                                        label=""
                                                                        id={`inc_desc_${idx}`}
                                                                        placeholder="Description of the incident..."
                                                                    />
                                                                </div>
                                                                );
                                                            })}

                                                            <button 
                                                                className="text-xs text-blue-600 hover:underline"
                                                                onClick={() => handleSafetyIncident(task.id, {
                                                                    description: '',
                                                                    severity: 'Low'
                                                                })}
                                                            >
                                                                + Add Unassessed Incident
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Comments */}
                                                    <div>
                                                        <Input 
                                                            id={`comments_${task.id}`}
                                                            label="Completion Comments" 
                                                            as="textarea" 
                                                            value={data.comments} 
                                                            onChange={e => handleTaskChange(task.id, 'comments', e.target.value)}
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Break-in Jobs Section for this WO */}
                                <div className="mt-8 pt-4 border-t border-slate-300">
                                    <h4 className="font-bold text-slate-700 mb-2">Break-in Work (Unplanned)</h4>
                                    <div className="space-y-2 mb-4">
                                        {breakInTasks.filter((t: any) => t.workOrderId === activeWo.id).map((bt: any, idx) => (
                                            <div key={idx} className={`p-3 border rounded flex justify-between items-center ${bt.status === 'COMPLETED' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                                <div>
                                                    <span className="font-bold text-slate-800 block">{bt.taskName}</span>
                                                    <span className="text-xs text-slate-600 whitespace-pre-wrap">{bt.description} ({bt.estimatedDurationHours} hrs)</span>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${bt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {bt.status === 'COMPLETED' ? 'Done & Closed' : 'Left Open'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="bg-slate-50 p-4 rounded border">
                                        <h5 className="font-semibold text-sm mb-3">Add New Break-in Task</h5>
                                        <div className="space-y-3">
                                            <Input 
                                                id="biName" 
                                                label="Task Name" 
                                                value={newBreakInTask.name} 
                                                onChange={e => setNewBreakInTask({...newBreakInTask, name: e.target.value})} 
                                                placeholder="e.g. Replaced leaking hose"
                                            />
                                            <Input 
                                                id="biDesc" 
                                                as="textarea"
                                                label="Description of Work" 
                                                value={newBreakInTask.description} 
                                                onChange={e => setNewBreakInTask({...newBreakInTask, description: e.target.value})} 
                                                rows={2}
                                                placeholder="Details about the unplanned work..."
                                            />
                                            <div className="flex gap-4">
                                                <div className="w-32">
                                                    <Input 
                                                        id="biDur" 
                                                        label="Actual Hrs" 
                                                        type="number" 
                                                        value={newBreakInTask.duration} 
                                                        onChange={e => setNewBreakInTask({...newBreakInTask, duration: Number(e.target.value)})} 
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                                    <div className="flex gap-4 pt-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                name="breakInStatus" 
                                                                checked={newBreakInStatus === 'COMPLETED'} 
                                                                onChange={() => setNewBreakInStatus('COMPLETED')}
                                                                className="text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">Completed (Close)</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                name="breakInStatus" 
                                                                checked={newBreakInStatus === 'PENDING'} 
                                                                onChange={() => setNewBreakInStatus('PENDING')}
                                                                className="text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm">Open (For Planning)</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <Button onClick={handleAddBreakInTask} disabled={!newBreakInTask.name} className="!w-auto">Add Task</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-2 mt-auto">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleConfirmClosure} isLoading={isSaving} className="!bg-green-600 hover:!bg-green-700">Confirm Closure</Button>
                </div>
            </div>
        </Modal>
    );
};

export default PlanClosureModal;
