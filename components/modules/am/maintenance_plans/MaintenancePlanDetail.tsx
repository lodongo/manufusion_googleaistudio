
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder, MaintenancePlan, Break, Reservation, EnrichedTask, SpareMetadata, ServiceItem } from '../../../../types/am_types';
import type { SalesOrder, JournalLineConfig } from '../../../../types/in_types';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import ConfirmationModal from '../../../common/ConfirmationModal';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Tab Imports
import PlanConfigurationTab from './detail/PlanConfigurationTab';
import PlanTasksTab from './detail/PlanTasksTab';
import PlanGanttTab from './detail/PlanGanttTab';
import PlanResourcesTab from './detail/PlanResourcesTab';
import PlanClosureModal from './detail/PlanClosureModal';
import LinkWorkOrderModal from './LinkWorkOrderModal';
import { WorkOrderTicket } from '../../work_orders/WorkOrderTicket';
import { CreateOrderConfigModal } from './detail/PlanSetupTab'; // Import the simplified modal

const { Timestamp } = firebase.firestore;

interface MaintenancePlanDetailProps {
    plan: MaintenancePlan;
    onBack: () => void;
    onViewWorkOrder: (workOrder: WorkOrder) => void;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
}

// --- HELPER FUNCTIONS & LOCAL COMPONENTS ---
const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// ... [Keep existing helper components: SalesOrderPreviewModal, ReservationDetailModal, calculateSchedule] ...

const calculateSchedule = (rawTasks: EnrichedTask[], plan: MaintenancePlan): EnrichedTask[] => {
    // ... (same logic as before, assuming it's available in scope or imported if separated)
    if (!rawTasks || rawTasks.length === 0) return [];
    // 1. Explode tasks into Safety Tasks + Main Tasks
    const expandedTasks: EnrichedTask[] = [];

    rawTasks.forEach(task => {
        const safetyControls: any[] = [];
        if (task.riskAssessments) {
            task.riskAssessments.forEach(ra => {
                if (ra.controls) {
                    ra.controls.forEach(c => {
                        if (c.isPreTask) safetyControls.push(c);
                    });
                }
            });
        }

        if (safetyControls.length > 0) {
            let previousSafetyTaskId: string | null = null;
            
            safetyControls.forEach((control, index) => {
                const safetyTaskId = `${task.id}_S${index + 1}`;
                const safetyTask: EnrichedTask = {
                    ...task,
                    id: safetyTaskId,
                    taskId: `${task.taskId}-S${index + 1}`,
                    taskName: `[SAFETY] ${control.controlName}`,
                    description: control.controlDescription,
                    estimatedDurationHours: (control.durationMinutes || 15) / 60,
                    assignedTo: control.assignedToUid ? [{ uid: control.assignedToUid, name: control.assignedToName || 'Unknown' }] : [],
                    isSafetyTask: true,
                    originalTaskId: task.id,
                    precedingTaskId: index === 0 ? task.precedingTaskId : previousSafetyTaskId,
                    scheduledStartDate: index === 0 ? task.scheduledStartDate : undefined, 
                    scheduledStartTime: index === 0 ? task.scheduledStartTime : undefined,
                    workOrderId: task.workOrderId,
                    workOrderPath: task.workOrderPath,
                    woId: task.woId,
                    taskTypeCategory: 'Safety',
                    taskTypeModeCode: 'SAFETY',
                    taskTypeModeName: 'Safety Control',
                    maintenanceTypeCode: 'SFT',
                    maintenanceTypeName: 'Safety',
                    discipline: 'Safety',
                    status: task.status,
                    createdAt: task.createdAt,
                    createdBy: task.createdBy
                };
                expandedTasks.push(safetyTask);
                previousSafetyTaskId = safetyTaskId;
            });

            const mainTaskWithSafetyDep = {
                ...task,
                precedingTaskId: previousSafetyTaskId,
                scheduledStartDate: undefined, 
                scheduledStartTime: undefined
            };
            expandedTasks.push(mainTaskWithSafetyDep);

        } else {
            expandedTasks.push(task);
        }
    });

    const tasks = expandedTasks; 
    
    const workStartTimeStr = plan.workStartTime || '08:00';
    const workEndTimeStr = plan.workEndTime || '17:00';
    const workStartMins = parseTime(workStartTimeStr);
    const workEndMins = parseTime(workEndTimeStr);

    const breaks = (plan.breaks || []).map(b => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime)
    })).sort((a, b) => a.start - b.start);

    const planStartDateTime = new Date(`${plan.scheduledStartDate}T${workStartTimeStr}:00`);
    const planEndDateTime = new Date(`${plan.scheduledEndDate}T${workEndTimeStr}:00`);

    const addWorkHoursWithBreaks = (startDate: Date, hours: number): Date => {
        let currentDate = new Date(startDate.getTime());
        let remainingMillis = hours * 3600 * 1000;

        if (remainingMillis <= 0) return currentDate;

        let safetyLoop = 0;
        const maxLoops = 10000; 

        while (remainingMillis > 0 && safetyLoop < maxLoops) {
            safetyLoop++;

            const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();
            
            if (currentMins < workStartMins) {
                currentDate.setHours(0,0,0,0);
                currentDate.setMinutes(workStartMins);
                continue;
            }

            if (currentMins >= workEndMins) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(0,0,0,0);
                currentDate.setMinutes(workStartMins);
                continue;
            }

            let inBreak = false;
            for (const b of breaks) {
                if (currentMins >= b.start && currentMins < b.end) {
                    currentDate.setHours(0,0,0,0);
                    currentDate.setMinutes(b.end);
                    inBreak = true;
                    break;
                }
            }
            if (inBreak) continue;

            let nextEventMins = workEndMins;
            for (const b of breaks) {
                if (b.start > currentMins) {
                    nextEventMins = Math.min(nextEventMins, b.start);
                    break; 
                }
            }

            const nextEventDate = new Date(currentDate);
            nextEventDate.setHours(0,0,0,0);
            nextEventDate.setMinutes(nextEventMins);
            
            const millisToNextEvent = nextEventDate.getTime() - currentDate.getTime();
            
            if (millisToNextEvent >= remainingMillis) {
                currentDate = new Date(currentDate.getTime() + remainingMillis);
                remainingMillis = 0;
            } else {
                currentDate = new Date(nextEventDate.getTime());
                remainingMillis -= millisToNextEvent;
            }
        }
        return currentDate;
    };

    const taskMap = new Map<string, EnrichedTask>(tasks.map(t => [t.id, t]));
    const schedule = new Map<string, { ganttStartDate: Date, ganttEndDate: Date }>();
    const tasksToSchedule = new Set<string>(tasks.map(t => t.id));
    let maxPasses = tasks.length * 3;

    while (tasksToSchedule.size > 0 && maxPasses > 0) {
        let scheduledInPass = false;
        const taskIds = Array.from(tasksToSchedule); 

        for (const taskId of taskIds) {
            const task = taskMap.get(taskId);
            if (!task) {
                tasksToSchedule.delete(taskId);
                continue;
            }
            
            const preReqId = task.precedingTaskId;
            
            if (preReqId && !schedule.has(preReqId)) {
                if (taskMap.has(preReqId)) {
                    continue; 
                }
            }

            let startTime: Date;
            if (preReqId && schedule.has(preReqId)) {
                startTime = new Date(schedule.get(preReqId)!.ganttEndDate);
            } else {
                if (task.scheduledStartDate && task.scheduledStartTime) {
                    startTime = new Date(`${task.scheduledStartDate}T${task.scheduledStartTime}:00`);
                } else {
                    startTime = new Date(planStartDateTime);
                }
            }

            if (startTime.getTime() < planStartDateTime.getTime()) {
                startTime = new Date(planStartDateTime);
            }

            let duration = Math.max(task.estimatedDurationHours || 0.25, 0.25);
            let endTime = addWorkHoursWithBreaks(startTime, duration);

            if (endTime.getTime() > planEndDateTime.getTime()) {
                endTime = new Date(planEndDateTime);
                if (startTime.getTime() > planEndDateTime.getTime()) {
                    startTime = new Date(planEndDateTime); 
                }
            }

            schedule.set(task.id, { ganttStartDate: startTime, ganttEndDate: endTime });
            tasksToSchedule.delete(taskId);
            scheduledInPass = true;
        }
        maxPasses--;
        if (!scheduledInPass && tasksToSchedule.size > 0) {
            tasksToSchedule.forEach(tid => {
                schedule.set(tid, { ganttStartDate: planStartDateTime, ganttEndDate: addWorkHoursWithBreaks(planStartDateTime, 1) });
            });
            break; 
        }
    }

    return tasks.map(task => ({
        ...task,
        ...schedule.get(task.id),
    })).filter(t => t.ganttStartDate && t.ganttEndDate).sort((a,b) => a.ganttStartDate!.getTime() - b.ganttStartDate!.getTime());
};

const SalesOrderPreviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    salesOrder: SalesOrder;
    plan: MaintenancePlan;
}> = ({ isOpen, onClose, salesOrder, plan }) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownloadPDF = async () => {
        const input = document.getElementById('printable-issue-slip');
        if (!input) return;
        setIsGenerating(true);

        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`IssueSlip_${salesOrder.code}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sales Order Preview" size="4xl">
            <div className="bg-slate-100 p-8 rounded-md overflow-y-auto max-h-[70vh]">
                <div id="printable-issue-slip" className="bg-white shadow-lg p-8 mx-auto max-w-3xl text-sm text-slate-800" style={{ minHeight: '800px' }}>
                    <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-start">
                         <div>
                             <h1 className="text-2xl font-bold uppercase tracking-wide">Issue Slip</h1>
                             <p className="text-slate-500 font-mono">{salesOrder.code}</p>
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-lg">WORK ORDER: {salesOrder.workOrderDisplayId}</p>
                             <p>{new Date().toLocaleDateString()}</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Asset / Location</p>
                            <p className="font-semibold text-lg">{salesOrder.assetDetails.name}</p>
                            <p>{salesOrder.assetDetails.location}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-slate-500 uppercase font-bold">Plan Reference</p>
                             <p>{salesOrder.maintenancePlanId}</p>
                        </div>
                    </div>

                    <table className="w-full mb-8 border-collapse">
                        <thead>
                            <tr className="border-b-2 border-slate-800 text-left">
                                <th className="py-2">Item Description</th>
                                <th className="py-2 text-center">Part No.</th>
                                <th className="py-2 text-center">Res. ID</th>
                                <th className="py-2 text-right">Ordered</th>
                                <th className="py-2 text-right">Issued</th>
                                <th className="py-2 text-right">Unit Cost</th>
                                <th className="py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesOrder.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-slate-200">
                                    <td className="py-3">
                                        <p className="font-semibold">{item.materialName}</p>
                                        <p className="text-xs text-slate-500">Task: {item.taskId}</p>
                                    </td>
                                    <td className="py-3 text-center font-mono text-xs">{item.materialCode}</td>
                                    <td className="py-3 text-center font-mono text-xs">{item.reservationId || '-'}</td>
                                    <td className="py-3 text-right font-bold">{item.quantity} {item.uom}</td>
                                    <td className="py-3 text-right font-bold text-green-600">{item.issuedQuantity} {item.uom}</td>
                                    <td className="py-3 text-right">${item.unitCost.toFixed(2)}</td>
                                    <td className="py-3 text-right">${item.totalCost.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} className="py-4 text-right font-bold uppercase">Total Estimated Value</td>
                                <td className="py-4 text-right font-bold text-lg">${salesOrder.totalCost.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-12 pt-8 border-t-2 border-slate-200">
                        {/* Plan Approval Note */}
                        <div className="text-center mb-12">
                            <p className="font-medium mb-1">This issue slip has been approved by virtue of approving the Maintenance plan.</p>
                            {plan.approvals?.stage2 ? (
                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Authorized by: {plan.approvals.stage2.name} on {new Date(plan.approvals.stage2.date).toLocaleDateString()}
                                </p>
                            ) : <p className="text-xs text-slate-400 uppercase italic">Plan Approval Pending</p>}
                        </div>

                        {/* Physical Handover Signatures */}
                        <div className="grid grid-cols-2 gap-12">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-8">Issued By (Storekeeper)</p>
                                <div className="border-b border-slate-800 mb-1"></div>
                                <div className="flex justify-between text-xs">
                                    <span>Signature</span>
                                    <span>Date</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-8">Received By (Technician)</p>
                                <div className="border-b border-slate-800 mb-1"></div>
                                <div className="flex justify-between text-xs">
                                    <span>Signature</span>
                                    <span>Date</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t mt-4">
                <Button onClick={handleDownloadPDF} isLoading={isGenerating} className="!w-auto flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    Download PDF
                </Button>
            </div>
        </Modal>
    );
};

const ReservationDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    reservation: Reservation;
}> = ({ isOpen, onClose, reservation }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Reservation: ${reservation.reservationId}`}>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Work Order</p>
                        <p className="font-semibold">{reservation.workOrderId}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Task</p>
                        <p className="font-semibold">{reservation.taskId}</p>
                    </div>
                     <div>
                        <p className="text-sm font-medium text-slate-500">Material</p>
                        <p className="font-semibold">{reservation.materialName} ({reservation.materialCode})</p>
                    </div>
                    <div>
                         <p className="text-sm font-medium text-slate-500">Quantity</p>
                         <p className="font-semibold">{reservation.quantity} {reservation.uom}</p>
                    </div>
                     <div>
                         <p className="text-sm font-medium text-slate-500">Warehouse</p>
                         <p className="font-semibold">{reservation.warehouseName}</p>
                    </div>
                    <div>
                         <p className="text-sm font-medium text-slate-500">Status</p>
                         <p className={`font-semibold ${reservation.status === 'ISSUED' ? 'text-green-600' : 'text-blue-600'}`}>{reservation.status}</p>
                    </div>
                </div>
                <div className="border-t pt-4 mt-2">
                    <p className="text-xs text-slate-500">Reserved By: {reservation.reservedBy.name} on {reservation.reservedAt.toDate().toLocaleString()}</p>
                </div>
             </div>
        </Modal>
    );
};


const MaintenancePlanDetail: React.FC<MaintenancePlanDetailProps> = ({ plan, onBack, onViewWorkOrder, organisation, currentUser, theme }) => {
    const [currentPlan, setCurrentPlan] = useState<MaintenancePlan>(plan);
    const [activeTab, setActiveTab] = useState('config');
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [allTasks, setAllTasks] = useState<EnrichedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [planReservations, setPlanReservations] = useState<Reservation[]>([]);
    const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

    // Sales Orders
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loadingSalesOrders, setLoadingSalesOrders] = useState(false);
    const [previewSalesOrder, setPreviewSalesOrder] = useState<SalesOrder | null>(null);
    const [createOrderModal, setCreateOrderModal] = useState<{ isOpen: boolean, workOrder: WorkOrder | null }>({ isOpen: false, workOrder: null });
    
    // Editable State
    const [editablePlan, setEditablePlan] = useState({
        startDate: plan.scheduledStartDate,
        endDate: plan.scheduledEndDate,
        workStartTime: plan.workStartTime || '08:00',
        workEndTime: plan.workEndTime || '17:00'
    });
    const [breaks, setBreaks] = useState<Break[]>(plan.breaks || []);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    
    // Modals for Task View
    const [viewingSparesFor, setViewingSparesFor] = useState<EnrichedTask | null>(null);
    const [viewingRisksFor, setViewingRisksFor] = useState<EnrichedTask | null>(null);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
    
    // Scheduling Confirmation Modal State
    const [scheduleConfirmOpen, setScheduleConfirmOpen] = useState(false);
    
    const [sparesStock, setSparesStock] = useState<Record<string, number>>({}); 
    const [sparesMetadata, setSparesMetadata] = useState<Record<string, SpareMetadata>>({});
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [hasSpareConflict, setHasSpareConflict] = useState(false);

    const isPlanCommitted = currentPlan.status === 'IN_PROGRESS' || currentPlan.status === 'SCHEDULED' || currentPlan.status === 'COMPLETED';
    const isPlanScheduled = currentPlan.status === 'SCHEDULED';

    const tabs = [
        { id: 'config', label: 'Configuration' },
        { id: 'tasks', label: 'Tasks List' },
        { id: 'gantt', label: 'Gantt Chart' },
        { id: 'resources', label: 'Resource Loading' }
    ];

    const TabButton: React.FC<{ tabId: string, label: string, active: string, onClick: (id: string) => void }> = ({ tabId, label, active, onClick }) => (
        <button
          onClick={() => onClick(tabId)}
          className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
            active === tabId
              ? '' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          style={active === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
          {label}
        </button>
    );

    // Listen to plan updates
    useEffect(() => {
        const planRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('maintenancePlans').doc(plan.id);
        const unsub = planRef.onSnapshot(snap => {
            if (snap.exists) {
                setCurrentPlan({ id: snap.id, ...snap.data() } as MaintenancePlan);
            }
        });
        return unsub;
    }, [plan.id, organisation.domain]);

    useEffect(() => {
        setLoading(true);
        const woRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workOrders');
        const q = woRef.where('pmNumber', '==', plan.planId);

        const unsubscribe = q.onSnapshot(async (woSnapshot) => {
            const fetchedWorkOrders = woSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
            setWorkOrders(fetchedWorkOrders);

            if (fetchedWorkOrders.length === 0) {
                setAllTasks([]);
                setLoading(false);
                return;
            }

            const unsubscribes: (()=>void)[] = [];
            fetchedWorkOrders.forEach(wo => {
                const tasksInWoRef = db.collection(`organisations/${organisation.domain}/modules/AM/workOrders/${wo.id}/tasks`);
                const unsub = tasksInWoRef.onSnapshot(taskSnap => {
                    const updatedTasks = taskSnap.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        workOrderId: wo.id,
                        workOrderPath: `organisations/${organisation.domain}/modules/AM/workOrders/${wo.id}`,
                        woId: wo.woId,
                        allocationLevel2Id: wo.allocationLevel2Id,
                        allocationLevel3Id: wo.allocationLevel3Id,
                        allocationLevel4Id: wo.allocationLevel4Id,
                        allocationLevel5Id: wo.allocationLevel5Id,
                        allocationLevel6Id: wo.allocationLevel6Id,
                        allocationLevel2Name: wo.allocationLevel2Name,
                        allocationLevel3Name: wo.allocationLevel3Name,
                        allocationLevel4Name: wo.allocationLevel4Name,
                        allocationLevel5Name: wo.allocationLevel5Name,
                        allocationLevel6Name: wo.allocationLevel6Name,
                    } as EnrichedTask));
                    
                    setAllTasks(prev => {
                        const otherTasks = prev.filter(t => t.workOrderId !== wo.id);
                        return [...otherTasks, ...updatedTasks].sort((a,b) => (a.taskId || '').localeCompare(b.taskId || ''));
                    });
                });
                unsubscribes.push(unsub);
            });
            
            setLoading(false);
            return () => unsubscribes.forEach(unsub => unsub());

        }, (err) => {
            setError("Failed to load plan details.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [plan.planId, organisation.domain]);

    // Fetch reservations if plan is committed
    useEffect(() => {
        if (!isPlanCommitted) {
            setPlanReservations([]);
            return;
        }
        const resRef = db.collection(`organisations/${organisation.domain}/modules/IN/Reservations`);
        const q = resRef.where('maintenancePlanId', '==', plan.planId);
        const unsub = q.onSnapshot(snapshot => {
            setPlanReservations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
        });
        return unsub;
    }, [isPlanCommitted, plan.planId, organisation.domain]);

    // Fetch Sales Orders
    useEffect(() => {
        if (!isPlanCommitted) {
            setSalesOrders([]);
            return;
        }
        setLoadingSalesOrders(true);
        const soRef = db.collection(`organisations/${organisation.domain}/modules/IN/salesOrders`);
        const q = soRef.where('maintenancePlanId', '==', plan.planId);
        const unsub = q.onSnapshot(snapshot => {
            setSalesOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)));
            setLoadingSalesOrders(false);
        }, err => {
            console.error("Error fetching sales orders:", err);
            setLoadingSalesOrders(false);
        });
        return unsub;
    }, [isPlanCommitted, plan.planId, organisation.domain]);

    // Calculate schedule
    const scheduledTasks = useMemo(() => calculateSchedule(allTasks, { ...currentPlan, ...editablePlan, breaks }), [allTasks, currentPlan, editablePlan, breaks]);

    // Fetch stock levels & metadata
    useEffect(() => {
        if (allTasks.length === 0) { setSparesStock({}); setSparesMetadata({}); return; }
        const sparesToTrack = new Map<string, string>();
        allTasks.forEach(task => {
            task.requiredSpares?.forEach(spare => {
                if (spare.warehousePath && spare.materialId) {
                     sparesToTrack.set(spare.materialId, `${spare.warehousePath}/materials/${spare.materialId}`);
                }
            });
        });

        if (sparesToTrack.size === 0) { setSparesStock({}); setSparesMetadata({}); return; }
        
        const unsubscribes: (() => void)[] = [];
        
        sparesToTrack.forEach((path, matId) => {
            const unsub = db.doc(path).onSnapshot((snap) => {
                 const data = snap.data() as any;
                 if (data) {
                     const qty = data.inventoryData?.issuableQuantity || 0;
                     setSparesStock(prev => ({ ...prev, [matId]: qty }));

                     const meta: SpareMetadata = {
                         price: data.procurementData?.standardPrice || 0,
                         leadTimeDays: data.procurementData?.leadTimeDays || 0,
                         name: data.procurementComponentName || 'Unknown',
                         code: data.materialCode || '',
                         bin: data.inventoryData?.bin || data.bin
                     };
                     setSparesMetadata(prev => ({...prev, [matId]: meta}));
                 }
            }, (error) => { console.warn(`Could not fetch stock for ${matId}`, error); });
            unsubscribes.push(unsub);
        });
        
        return () => unsubscribes.forEach(u => u());
    }, [allTasks]);

    // Check conflicts
    useEffect(() => {
        let conflictFound = false;
        const planEndDateObj = new Date(editablePlan.endDate);
        
        allTasks.forEach(task => {
            task.requiredSpares?.forEach(spare => {
                 const meta = sparesMetadata[spare.materialId];
                 if (meta) {
                     const arrivalDate = new Date();
                     arrivalDate.setDate(arrivalDate.getDate() + (meta.leadTimeDays || 0));
                     
                     const deadline = new Date(planEndDateObj);
                     deadline.setDate(deadline.getDate() + 7);
                     
                     if (arrivalDate > deadline) {
                         conflictFound = true;
                     }
                 }
            });
        });
        setHasSpareConflict(conflictFound);
    }, [sparesMetadata, allTasks, editablePlan.endDate]);
    
    const criticalPathTasks = useMemo(() => {
        const cp = new Set<string>();
        if (scheduledTasks.length > 0) {
            const lastTaskEnd = Math.max(...scheduledTasks.map(t => t.ganttEndDate?.getTime() || 0));
            const endTasks = scheduledTasks.filter(t => t.ganttEndDate?.getTime() === lastTaskEnd);
            
            const tracePredecessors = (taskId: string) => {
                cp.add(taskId);
                const task = scheduledTasks.find(t => t.id === taskId);
                if (task && task.precedingTaskId) {
                    tracePredecessors(task.precedingTaskId);
                }
            };
            endTasks.forEach(t => tracePredecessors(t.id));
        }
        return cp;
    }, [scheduledTasks]);

    const validations = useMemo(() => {
        const startDate = new Date(editablePlan.startDate);
        const endDate = new Date(editablePlan.endDate);
        const datesValid = startDate <= endDate;
        const hasWorkOrders = workOrders.length > 0;

        let sparesStockValid = true;
        allTasks.forEach(task => {
            task.requiredSpares?.forEach(s => {
                if ((sparesStock[s.materialId] || 0) < s.quantity) sparesStockValid = false;
            });
        });

        const sparesDelayValid = !hasSpareConflict;

        let resourceOverlap = false;
        const resourceTasksMap = new Map<string, EnrichedTask[]>();
        
        scheduledTasks.forEach(t => {
             if (t.assignedTo) {
                 t.assignedTo.forEach(u => {
                     if (!resourceTasksMap.has(u.uid)) resourceTasksMap.set(u.uid, []);
                     resourceTasksMap.get(u.uid)!.push(t);
                 });
             }
        });

        resourceTasksMap.forEach((tasks) => {
             const sorted = tasks.filter(t => t.ganttStartDate && t.ganttEndDate).sort((a,b) => a.ganttStartDate!.getTime() - b.ganttStartDate!.getTime());
             for(let i=0; i < sorted.length - 1; i++) {
                 if (sorted[i].ganttEndDate! > sorted[i+1].ganttStartDate!) {
                     resourceOverlap = true;
                     break;
                 }
             }
        });

        let resourceOverloaded = false;
        
        const ps = new Date(`${editablePlan.startDate}T${editablePlan.workStartTime}:00`);
        const pe = new Date(`${editablePlan.endDate}T${editablePlan.workEndTime}:00`);
        const days = Math.ceil((pe.getTime() - ps.getTime()) / (1000 * 3600 * 24));
        
        const dailyStartMins = parseTime(editablePlan.workStartTime);
        const dailyEndMins = parseTime(editablePlan.workEndTime);
        let dailyBreakMins = 0;
        breaks.forEach(b => dailyBreakMins += (parseTime(b.endTime) - parseTime(b.startTime)));
        
        const dailyWorkHours = Math.max(0, (dailyEndMins - dailyStartMins - dailyBreakMins) / 60);
        const totalCapacityHours = days * dailyWorkHours;

        resourceTasksMap.forEach((tasks) => {
            const totalTaskHours = tasks.reduce((acc, t) => acc + (t.estimatedDurationHours || 0), 0);
            if (totalTaskHours > totalCapacityHours) {
                resourceOverloaded = true;
            }
        });

        let servicesValid = true;
        const planStart = new Date(editablePlan.startDate);
        planStart.setHours(0,0,0,0);
        
        for (const task of allTasks) {
            if (task.requiredServices && task.requiredServices.length > 0) {
                for (const s of task.requiredServices) {
                    if (s.availabilityStatus === 'Not Contacted') {
                        servicesValid = false;
                        break;
                    }
                    if (s.availabilityStatus === 'Not Available') {
                        if (!s.tentativeDate) {
                            servicesValid = false;
                            break;
                        }
                        const tentDate = new Date(s.tentativeDate);
                        tentDate.setHours(0,0,0,0);
                        if (tentDate > planStart) {
                            servicesValid = false;
                            break;
                        }
                    }
                }
            }
            if (!servicesValid) break;
        }

        let safetyValid = true;
        let hasAssessment = false;
        for (const t of allTasks) {
             if (t.riskAssessments && t.riskAssessments.length > 0) {
                 hasAssessment = true;
                 for (const ra of t.riskAssessments) {
                     if (ra.residualScore >= ra.initialScore || !ra.isResidualTolerable) {
                         safetyValid = false;
                     }
                 }
             }
        }
        
        // Ensure at least one task has safety check if tasks exist
        if (allTasks.length > 0 && !hasAssessment) {
             safetyValid = false;
        }

        return {
            datesValid,
            sparesStockValid,
            sparesDelayValid,
            resourceOverlap,
            resourceOverloaded,
            servicesValid,
            hasWorkOrders,
            safetyValid,
            canCommit: datesValid && !resourceOverlap && !resourceOverloaded && sparesDelayValid && servicesValid && hasWorkOrders && safetyValid && !isPlanCommitted 
        };

    }, [editablePlan, breaks, scheduledTasks, sparesStock, hasSpareConflict, allTasks, isPlanCommitted, workOrders]);
    
    const handleUpdatePlanDetails = async () => {
        if (isPlanCommitted) { alert("Cannot update details of a committed plan."); return; }
        setIsSaving(true);
        const planRef = db.doc(`organisations/${organisation.domain}/modules/AM/maintenancePlans/${plan.id}`);
        const batch = db.batch();
        
        const planUpdate = {
            scheduledStartDate: editablePlan.startDate,
            scheduledEndDate: editablePlan.endDate,
            workStartTime: editablePlan.workStartTime,
            workEndTime: editablePlan.workEndTime,
            breaks: breaks
        };
        batch.update(planRef, planUpdate);

        workOrders.forEach(wo => {
            const woRef = db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${wo.id}`);
            batch.update(woRef, {
                scheduledStartDate: editablePlan.startDate,
                scheduledEndDate: editablePlan.endDate
            });
        });

        try {
            await batch.commit();
            alert("Plan details updated successfully.");
        } catch (err) {
            console.error(err);
            alert("Failed to update dates.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const generateReservationId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'RES';
        for (let i = 0; i < 7; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleInitiateCommit = () => {
        if (!validations?.canCommit) {
             alert("Cannot commit plan. Please resolve the validation errors marked with ❌ in the Setup tab checklist.");
             return;
        }
        setIsImpactModalOpen(true);
    };

    const handleApprovePlan = async (stage: 1 | 2) => {
        try {
            const userStamp = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}`, date: new Date().toISOString() };
            await db.doc(`organisations/${organisation.domain}/modules/AM/maintenancePlans/${plan.id}`).update({
                [`approvals.stage${stage}`]: userStamp
            });
        } catch (e: any) {
            console.error("Approval failed:", e);
            alert("Failed to approve plan.");
        }
    };

    const executeCommitPlan = async () => {
        if (!currentPlan.approvals?.stage2) {
             alert("Plan must be fully approved (Stage 2) before committing.");
             return;
        }

        setIsCommitting(true);
        setIsImpactModalOpen(false); 
        
        const batch = db.batch();
        
        const planRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('maintenancePlans').doc(plan.id);
        batch.update(planRef, { status: 'IN_PROGRESS' });

        workOrders.forEach(wo => {
            const woRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workOrders').doc(wo.id);
            batch.update(woRef, { status: 'SCHEDULED' }); 
        });

        allTasks.forEach(task => {
            const wo = workOrders.find(w => w.id === task.workOrderId);
            if (!wo) return;

            task.requiredSpares?.forEach(spare => {
                 const resId = generateReservationId();
                 const resRef = db.collection(`organisations/${organisation.domain}/modules/IN/Reservations`).doc(resId);
                 
                 const reservationData: Omit<Reservation, 'id'> = {
                     reservationId: resId,
                     maintenancePlanId: plan.planId,
                     status: 'RESERVED',
                     materialId: spare.materialId,
                     materialName: spare.name || 'Unknown',
                     materialCode: spare.materialCode || '',
                     quantity: spare.quantity || 0,
                     uom: spare.uom || 'Unit',
                     
                     level_1_id: wo.allocationLevel1Id || '',
                     level_2_id: wo.allocationLevel2Id || '',
                     level_3_id: wo.allocationLevel3Id || '',
                     level_4_id: wo.allocationLevel4Id || '',
                     
                     warehouseId: spare.warehouseId || '',
                     warehouseName: spare.warehouseName || '',
                     
                     workOrderId: wo.woId,
                     workOrderPath: task.workOrderPath || '',
                     taskId: task.taskId,
                     taskPath: `organisations/${organisation.domain}/modules/AM/workOrders/${wo.id}/tasks/${task.id}`,
                     
                     reservedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                     reservedAt: Timestamp.now(),
                 };
                 
                 batch.set(resRef, reservationData);
            });
        });

        try {
            await batch.commit();
        } catch (e: any) {
            console.error("Commit failed:", e);
            alert("Failed to commit plan: " + e.message);
        } finally {
            setIsCommitting(false);
        }
    };
    
    // Updated: Actually Schedule Action (Moves from IN_PROGRESS to SCHEDULED)
    // Now just opens the modal
    const handleActuallySchedule = () => {
        setScheduleConfirmOpen(true);
    };

    const confirmActuallySchedule = async () => {
        setIsSaving(true);
        const batch = db.batch();
        
        try {
            const planRef = db.doc(`organisations/${organisation.domain}/modules/AM/maintenancePlans/${plan.id}`);
            batch.update(planRef, { status: 'SCHEDULED' });

            workOrders.forEach(wo => {
                const woRef = db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${wo.id}`);
                batch.update(woRef, { status: 'SCHEDULED' });
            });

            await batch.commit();
            // No alert needed if modal closes and UI updates, or simple toast
        } catch (e: any) {
            console.error("Scheduling failed:", e);
            alert("Failed to schedule plan.");
        } finally {
            setIsSaving(false);
            setScheduleConfirmOpen(false);
        }
    };

    const handleRemoveWorkOrder = async (workOrder: WorkOrder) => {
        if (isPlanCommitted) return;
        if (!window.confirm(`Remove Work Order ${workOrder.woId} from this plan? This will unschedule it.`)) return;
        
        setIsSaving(true);
        try {
            const woRef = db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${workOrder.id}`);
            await woRef.update({
                status: 'OPEN',
                scheduledStartDate: null,
                scheduledEndDate: null,
                pmNumber: null
            });
        } catch (err) {
            console.error(err);
            alert("Failed to remove work order.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePlan = async () => {
        if (workOrders.length > 0) {
            alert("Cannot delete a plan with work orders attached. Please remove them from the schedule first.");
            return;
        }
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        setIsSaving(true);
        const planRef = db.doc(`organisations/${organisation.domain}/modules/AM/maintenancePlans/${plan.id}`);
        try {
            await planRef.delete();
            onBack();
        } catch (err) {
            console.error(err);
            alert("Failed to delete plan.");
        } finally {
            setIsSaving(false);
            setDeleteConfirmOpen(false);
        }
    };

    const handleTaskUpdate = async (taskId: string, workOrderId: string, field: string, value: any) => {
        if (isPlanCommitted) return; 
        if (field === 'scheduledStartDate' || field === 'scheduledStartTime') {
            const newDateStr = field === 'scheduledStartDate' ? value : allTasks.find(t => t.id === taskId)?.scheduledStartDate;
            
            if (newDateStr) {
                const planStart = new Date(editablePlan.startDate);
                const planEnd = new Date(editablePlan.endDate);
                const taskStart = new Date(newDateStr);
                
                planStart.setHours(0,0,0,0);
                planEnd.setHours(0,0,0,0);
                taskStart.setHours(0,0,0,0);

                if (taskStart < planStart || taskStart > planEnd) {
                    alert(`Task date must be within the plan duration (${editablePlan.startDate} to ${editablePlan.endDate}).`);
                    return;
                }
            }
        }

        const taskRef = db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${workOrderId}/tasks/${taskId}`);
        try {
            const updateData: {[key: string]: any} = { [field]: value };
            if (field === 'precedingTaskId' && value) {
                updateData.scheduledStartDate = null;
                updateData.scheduledStartTime = null;
            }
            await taskRef.update(updateData);
        } catch (error) {
            console.error(`Failed to update task ${field}:`, error);
            setError(`Failed to update task ${field}.`);
        }
    };

    const handlePrintWorkTicket = async (wo: WorkOrder) => {
        setIsSaving(true);
        try {
            const woTasks = allTasks.filter(t => t.workOrderId === wo.id);
            if (woTasks.length === 0) {
                alert("No tasks found for this Work Order.");
                setIsSaving(false);
                return;
            }
            alert("Please use the 'Print Summary' tab to print tickets.");
        } catch (e: any) {
            console.error("Print failed:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateSalesOrder = async (wo: WorkOrder, config: any[]) => {
         setIsSaving(true);
         setCreateOrderModal({ isOpen: false, workOrder: null });
         try {
             const woTasks = allTasks.filter(t => t.workOrderId === wo.id);
             
             // Aggregate items for the sales order
             const items: SalesOrder['items'] = [];
             let orderTotalCost = 0;
             const resIdsToUpdate: string[] = [];

             woTasks.forEach(task => {
                 if (task.requiredSpares) {
                     task.requiredSpares.forEach(spare => {
                         const unitCost = sparesMetadata[spare.materialId]?.price || 0;
                         const totalCost = unitCost * spare.quantity;
                         orderTotalCost += totalCost;

                         // Find reservation ID from existing planReservations if it matches task and material
                         const res = planReservations.find(r => r.taskId === task.taskId && r.materialId === spare.materialId);
                         if (res && res.id) {
                             resIdsToUpdate.push(res.id); // Store Firestore ID for status update
                         }
                         
                         const bin = sparesMetadata[spare.materialId]?.bin || 'No Bin';

                         items.push({
                             taskId: task.taskId,
                             materialId: spare.materialId,
                             materialName: spare.name,
                             materialCode: spare.materialCode,
                             quantity: spare.quantity,
                             issuedQuantity: 0,
                             settledQuantity: 0,
                             uom: spare.uom,
                             unitCost: unitCost,
                             totalCost: totalCost,
                             reservationId: res?.reservationId, // Store Display ID in SO item
                             warehousePath: spare.warehousePath,
                             warehouseName: spare.warehouseName,
                             allocationLevel3Id: wo.allocationLevel3Id,
                             allocationLevel4Id: wo.allocationLevel4Id,
                             allocationLevel5Id: wo.allocationLevel5Id,
                             bin: bin
                         });
                     });
                 }
             });

             if (items.length === 0) {
                 alert("No spare parts found in this Work Order to create a Sales Order.");
                 setIsSaving(false);
                 return;
             }

             const counterRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('IN').collection('settings').doc('counters');
             const salesOrdersRef = db.collection(`organisations/${organisation.domain}/modules/IN/salesOrders`);

             await db.runTransaction(async (transaction) => {
                 const counterDoc = await transaction.get(counterRef);
                 let newCount = 1;
                 if (counterDoc.exists) {
                     newCount = (counterDoc.data()?.salesOrderCounter || 0) + 1;
                 }
                 const soCode = `SLO_${newCount.toString().padStart(6, '0')}`;

                 const newSalesOrder: Omit<SalesOrder, 'id'> = {
                     code: soCode,
                     workOrderId: wo.id,
                     workOrderDisplayId: wo.woId,
                     maintenancePlanId: plan.planId,
                     status: 'CREATED',
                     totalCost: orderTotalCost,
                     items: items,
                     assetDetails: {
                         name: wo.allocationLevel6Name || 'Unknown Asset',
                         location: `${wo.allocationLevel3Name} > ${wo.allocationLevel4Name}`
                     },
                     journalConfig: config,
                     createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                     createdAt: Timestamp.now(),
                     // Add location context to sales order root if needed, but items carry it
                     allocationLevel1Id: wo.allocationLevel1Id,
                     allocationLevel1Name: wo.allocationLevel1Name,
                     allocationLevel2Id: wo.allocationLevel2Id,
                     allocationLevel2Name: wo.allocationLevel2Name,
                     allocationLevel3Id: wo.allocationLevel3Id,
                     allocationLevel3Name: wo.allocationLevel3Name,
                     allocationLevel4Id: wo.allocationLevel4Id,
                     allocationLevel4Name: wo.allocationLevel4Name,
                     allocationLevel5Id: wo.allocationLevel5Id,
                     allocationLevel5Name: wo.allocationLevel5Name,
                 };

                 const newDocRef = salesOrdersRef.doc();
                 transaction.set(newDocRef, newSalesOrder);
                 transaction.set(counterRef, { salesOrderCounter: newCount }, { merge: true });

                 // Update associated reservations to 'ORDERED'
                 resIdsToUpdate.forEach(resDocId => {
                     const resRef = db.collection(`organisations/${organisation.domain}/modules/IN/Reservations`).doc(resDocId);
                     transaction.update(resRef, { status: 'ORDERED' });
                 });
             });

             alert("Sales Order created successfully.");

         } catch (e: any) {
             console.error("Failed to create sales order:", e);
             alert(`Error creating Sales Order: ${e.message}`);
         } finally {
             setIsSaving(false);
         }
    }

    const handleOpenOrderModal = (wo: WorkOrder) => {
         setCreateOrderModal({ isOpen: true, workOrder: wo });
    }

    return (
        <div className="w-full relative">
             {isCommitting && (
                 <div className="absolute inset-0 z-50 bg-white/80 flex items-center justify-center">
                     <div className="bg-white p-8 rounded-lg shadow-xl border border-slate-200 text-center">
                         <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                         <h3 className="text-xl font-bold text-slate-800">Committing Plan...</h3>
                         <p className="text-slate-500 mt-2">Scheduling work orders and reserving spares.</p>
                     </div>
                 </div>
             )}

            <div className="sticky top-0 z-30 bg-slate-50 px-4 md:px-8 pt-4 md:pt-8 pb-0 shadow-sm">
                <button onClick={onBack} className="text-sm hover:underline mb-2" style={{ color: theme.colorPrimary }}>&larr; Back to Plans</button>
                <h1 className="text-3xl font-bold text-slate-800">{currentPlan.planName} ({currentPlan.planId})</h1>
                <div className="border-b border-slate-200 mt-4 bg-slate-50"><nav className="-mb-px flex space-x-6 overflow-x-auto">{tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} active={activeTab} onClick={setActiveTab} />)}</nav></div>
            </div>

            <div className="mt-6 px-4 md:px-8 pb-8">
                {activeTab === 'config' && (
                    <PlanConfigurationTab 
                        currentPlan={currentPlan}
                        editablePlan={editablePlan}
                        setEditablePlan={setEditablePlan}
                        breaks={breaks}
                        setBreaks={setBreaks}
                        isPlanCommitted={isPlanCommitted}
                        handleUpdatePlanDetails={handleUpdatePlanDetails}
                        handleInitiateCommit={handleInitiateCommit}
                        handleDeletePlan={handleDeletePlan}
                        handleApprovePlan={handleApprovePlan}
                        onActuallySchedule={handleActuallySchedule}
                        onClosePlan={() => setIsClosureModalOpen(true)}
                        isSaving={isSaving}
                        isCommitting={isCommitting}
                        canCommit={!!validations?.canCommit}
                        workOrdersCount={workOrders.length}
                        validationStatus={validations || {}}
                        workOrders={workOrders}
                        salesOrders={salesOrders}
                        planReservations={planReservations}
                        sparesStock={sparesStock}
                        handlePrintWorkTicket={handlePrintWorkTicket}
                        handleOpenOrderModal={handleOpenOrderModal}
                        setPreviewSalesOrder={setPreviewSalesOrder}
                        setSelectedReservation={setSelectedReservation as any}
                        allTasks={allTasks}
                        sparesMetadata={sparesMetadata}
                        scheduledTasks={scheduledTasks}
                        organisation={organisation}
                        theme={theme}
                    />
                )}
                {activeTab === 'tasks' && (
                    <PlanTasksTab 
                        allTasks={allTasks}
                        loading={loading}
                        workOrders={workOrders}
                        onViewWorkOrder={onViewWorkOrder}
                        onUpdateTask={handleTaskUpdate}
                        onRemoveWorkOrder={handleRemoveWorkOrder}
                        criticalPathTasks={criticalPathTasks}
                        isPlanCommitted={isPlanCommitted}
                        theme={theme}
                        sparesStock={sparesStock}
                        setViewingSparesFor={setViewingSparesFor}
                        setViewingRisksFor={setViewingRisksFor}
                        onLinkWorkOrder={() => setIsLinkModalOpen(true)}
                    />
                )}
                {activeTab === 'gantt' && (
                    <PlanGanttTab 
                        scheduledTasks={scheduledTasks} 
                        plan={currentPlan} 
                        effectivePlan={{...currentPlan, ...editablePlan, breaks}} 
                        criticalPathTasks={criticalPathTasks} 
                        theme={theme} 
                    />
                )}
                {activeTab === 'resources' && (
                    <PlanResourcesTab 
                        scheduledTasks={scheduledTasks} 
                        plan={currentPlan}
                        effectivePlan={{...currentPlan, ...editablePlan, breaks}} 
                        criticalPathTasks={criticalPathTasks} 
                        theme={theme} 
                    />
                )}
            </div>

            <Modal isOpen={!!viewingSparesFor} onClose={() => setViewingSparesFor(null)} title={`Required Spares for ${viewingSparesFor?.taskId}`}>
                {(!viewingSparesFor?.requiredSpares || viewingSparesFor.requiredSpares.length === 0) ? (<p>No spares required.</p>) : (
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50"><tr><th className="px-4 py-2 text-left">Material</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Stock</th></tr></thead>
                        <tbody className="divide-y divide-slate-200">
                        {viewingSparesFor.requiredSpares.map(spare => (
                            <tr key={spare.materialId}>
                                <td className="px-4 py-2">{spare.name} <br/><span className="text-xs text-slate-500">{spare.materialCode}</span></td>
                                <td className="px-4 py-2 text-right font-bold">{spare.quantity} {spare.uom}</td>
                                <td className="px-4 py-2 text-right">{sparesStock[spare.materialId] || 0}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                     {isPlanCommitted && <p className="text-xs text-center text-red-500 mt-2">Editing disabled (Plan Committed)</p>}
                    </div>
                )}
            </Modal>
            
            <ConfirmationModal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={confirmDelete} title="Confirm Plan Deletion" message="Delete this plan?" isLoading={isSaving} />
            
            {/* Impact Analysis Modal */}
            <Modal isOpen={isImpactModalOpen} onClose={() => setIsImpactModalOpen(false)} title="Plan Commit Impact Analysis" size="4xl">
                <div className="space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="text-lg font-bold text-blue-800 mb-2">Commit Summary</h3>
                        <p className="text-sm text-blue-700">Committing this plan will finalize the schedule, lock all task details, generate spare part reservations, and update work order statuses. This action cannot be reversed.</p>
                    </div>
                    {/* ... Metrics Grid would go here if impactMetrics prop is passed ... */}
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <Button variant="secondary" onClick={() => setIsImpactModalOpen(false)}>Cancel</Button>
                        <Button onClick={executeCommitPlan} isLoading={isCommitting} className="!bg-green-600 hover:!bg-green-700">Confirm & Commit</Button>
                    </div>
                </div>
            </Modal>

            {/* Actually Schedule Confirmation Modal */}
            <ConfirmationModal 
                isOpen={scheduleConfirmOpen}
                onClose={() => setScheduleConfirmOpen(false)}
                onConfirm={confirmActuallySchedule}
                title="Confirm Schedule Lock"
                message="Are you sure you want to mark this plan and all associated Work Orders as fully Scheduled? This action will lock in dates for execution and cannot be reversed."
                confirmButtonText="Confirm Schedule"
                confirmButtonClass="bg-blue-600 hover:bg-blue-700"
                isLoading={isSaving}
            />

            <LinkWorkOrderModal 
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                organisationDomain={organisation.domain}
                planId={currentPlan.planId}
                planDates={{ start: currentPlan.scheduledStartDate, end: currentPlan.scheduledEndDate }}
            />
            
            {createOrderModal.isOpen && createOrderModal.workOrder && (
                <CreateOrderConfigModal
                    isOpen={createOrderModal.isOpen}
                    onClose={() => setCreateOrderModal({ isOpen: false, workOrder: null })}
                    onConfirm={(config) => handleCreateSalesOrder(createOrderModal.workOrder!, config)}
                    items={allTasks.filter(t => t.workOrderId === createOrderModal.workOrder!.id).flatMap(t => t.requiredSpares || [])}
                    totalCost={allTasks.filter(t => t.workOrderId === createOrderModal.workOrder!.id).flatMap(t => t.requiredSpares || []).reduce((sum, s) => sum + (s.quantity * (sparesMetadata[s.materialId]?.price || 0)), 0)}
                />
            )}

             {previewSalesOrder && (
                <SalesOrderPreviewModal 
                    isOpen={!!previewSalesOrder} 
                    onClose={() => setPreviewSalesOrder(null)} 
                    salesOrder={previewSalesOrder} 
                    plan={currentPlan}
                />
            )}
            
            {selectedReservation && (
                <ReservationDetailModal 
                    isOpen={!!selectedReservation}
                    onClose={() => setSelectedReservation(null)}
                    reservation={selectedReservation}
                />
            )}
            
            {isClosureModalOpen && (
                <PlanClosureModal
                    isOpen={isClosureModalOpen}
                    onClose={() => setIsClosureModalOpen(false)}
                    planId={plan.id}
                    workOrders={workOrders}
                    allTasks={allTasks}
                    reservations={planReservations}
                    organisationDomain={organisation.domain}
                    onCloseComplete={() => { onBack(); }}
                    currentUser={currentUser}
                />
            )}

        </div>
    );
};

export default MaintenancePlanDetail;
