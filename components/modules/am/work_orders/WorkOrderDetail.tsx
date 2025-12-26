
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder, WorkOrderTask } from '../../../../types/am_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { doc, deleteDoc } from 'firebase/firestore';
import LinkPlanModal from './LinkPlanModal';

import WoDashboardTab from './detail/WoDashboardTab';
import WoRequestTab from './detail/WoRequestTab';
import WoTasksTab from './detail/WoTasksTab';
import WoFinancialsTab from './detail/WoFinancialsTab';

interface WorkOrderDetailProps {
    workOrder: WorkOrder;
    onBack: () => void;
    onSelectTask: (task: WorkOrderTask | 'new') => void;
    onViewPlan: (planId: string) => void;
    currentUser: AppUser;
    organisation: Organisation;
    theme: Organisation['theme'];
}

export const WorkOrderDetail: React.FC<WorkOrderDetailProps> = ({
    workOrder: initialWorkOrder,
    onBack,
    onSelectTask,
    onViewPlan,
    currentUser,
    organisation,
    theme
}) => {
    const [workOrder, setWorkOrder] = useState<WorkOrder>(initialWorkOrder);
    const [loadingWO, setLoadingWO] = useState(!initialWorkOrder.createdAt);

    const [tasks, setTasks] = useState<WorkOrderTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<WorkOrderTask | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isLinkPlanModalOpen, setIsLinkPlanModalOpen] = useState(false);
    
    // Fetch Full Work Order if needed
    useEffect(() => {
        if (!initialWorkOrder.createdAt && initialWorkOrder.id) {
            setLoadingWO(true);
            const fetchFullDetails = async () => {
                try {
                    const docRef = db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${initialWorkOrder.id}`);
                    const snap = await docRef.get();
                    if (snap.exists) {
                        setWorkOrder({ id: snap.id, ...snap.data() } as WorkOrder);
                    } else {
                        console.error("Work Order not found");
                    }
                } catch (e) {
                    console.error("Error fetching Work Order:", e);
                } finally {
                    setLoadingWO(false);
                }
            };
            fetchFullDetails();
        } else {
            setWorkOrder(initialWorkOrder);
            setLoadingWO(false);
        }
    }, [initialWorkOrder, organisation.domain]);

    // Fetch Tasks
    useEffect(() => {
        if (!workOrder.id) return;
        
        const tasksRef = db.collection(`organisations/${organisation.domain}/modules/AM/workOrders/${workOrder.id}/tasks`);
        const unsubscribe = tasksRef.onSnapshot(snapshot => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrderTask)));
            setLoadingTasks(false);
        });
        return () => unsubscribe();
    }, [workOrder.id, organisation.domain]);

    const handleDeleteTask = async () => {
        if (!confirmDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/AM/workOrders/${workOrder.id}/tasks/${confirmDelete.id}`));
            setConfirmDelete(null);
        } catch (error) {
            console.error("Error deleting task:", error);
            alert("Failed to delete task.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDelinkPlan = async () => {
        if (!window.confirm("Are you sure you want to delink this Work Order from the plan? It will be reset to OPEN.")) return;
        try {
            await db.doc(`organisations/${organisation.domain}/modules/AM/workOrders/${workOrder.id}`).update({
                pmNumber: null,
                scheduledStartDate: null,
                scheduledEndDate: null,
                status: 'OPEN'
            });
        } catch (e) {
            console.error(e);
            alert("Failed to delink plan.");
        }
    };

    const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tabId
                    ? '' // Active color handled by style
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    const metrics = useMemo(() => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        let totalCost = 0;
        tasks.forEach(t => {
            const sparesCount = t.requiredSpares?.length || 0;
            totalCost += (sparesCount * 50); // Mock
        });

        return { totalTasks, completedTasks, progress, totalCost };
    }, [tasks]);

    if (loadingWO) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p>Loading Work Order Details...</p>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-white z-10">
                <div>
                    <button onClick={onBack} className="text-sm hover:underline mb-2" style={{ color: theme.colorPrimary }}>&larr; Back to List</button>
                    <h1 className="text-2xl font-bold text-slate-800">{workOrder.woId}</h1>
                    <p className="text-slate-600 font-medium">{workOrder.title}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${workOrder.status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                        {workOrder.status}
                    </span>
                    <div className="flex gap-2 items-center">
                        {workOrder.pmNumber ? (
                            <div className="flex items-center gap-2 bg-slate-100 rounded px-2 py-1">
                                <button onClick={() => onViewPlan(workOrder.pmNumber!)} className="text-xs font-bold hover:underline text-blue-600">
                                    Plan: {workOrder.pmNumber}
                                </button>
                                <button onClick={handleDelinkPlan} className="text-xs text-red-500 hover:text-red-700" title="Delink from Plan">×</button>
                            </div>
                        ) : (
                            <Button onClick={() => setIsLinkPlanModalOpen(true)} className="!w-auto !py-1 !px-3 !text-xs bg-indigo-600 hover:bg-indigo-700 text-white">Link to Plan</Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 bg-slate-50 px-6">
                <div className="flex space-x-4">
                    <TabButton tabId="dashboard" label="Dashboard" />
                    <TabButton tabId="request" label="Work Request" />
                    <TabButton tabId="tasks" label="Tasks" />
                    <TabButton tabId="financials" label="Financials" />
                </div>
            </div>

            <div className="p-6 flex-grow bg-slate-50">
                {activeTab === 'dashboard' && <WoDashboardTab workOrder={workOrder} metrics={metrics} />}
                {activeTab === 'request' && <WoRequestTab workOrder={workOrder} />}
                {activeTab === 'tasks' && (
                    <WoTasksTab 
                        tasks={tasks} 
                        loadingTasks={loadingTasks} 
                        onSelectTask={onSelectTask} 
                        setConfirmDelete={setConfirmDelete} 
                    />
                )}
                {activeTab === 'financials' && <WoFinancialsTab tasks={tasks} />}
            </div>

            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDeleteTask} 
                title="Delete Task" 
                message={`Are you sure you want to delete task "${confirmDelete?.taskName}"?`}
                isLoading={isDeleting}
            />

            <LinkPlanModal 
                isOpen={isLinkPlanModalOpen}
                onClose={() => setIsLinkPlanModalOpen(false)}
                organisationDomain={organisation.domain}
                workOrderId={workOrder.id}
                workOrderLocation={{
                    l3Id: workOrder.allocationLevel3Id || '',
                    l4Id: workOrder.allocationLevel4Id || '',
                    l5Id: workOrder.allocationLevel5Id || ''
                }}
                onLinkComplete={() => {}}
            />
        </div>
    );
};

export default WorkOrderDetail;
