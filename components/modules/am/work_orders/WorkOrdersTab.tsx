
import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder, WorkOrderTask } from '../../../../types/am_types';
import WorkOrderList from './WorkOrderList';
import WorkOrderDetail from './WorkOrderDetail';
import { WorkOrderTaskDetail } from './WorkOrderTaskDetail';
import WorkOrderDashboard from './WorkOrderDashboard';

interface WorkOrdersTabProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
    organisation: Organisation;
    activeWorkOrder: WorkOrder | null;
    setActiveWorkOrder: (wo: WorkOrder | null) => void;
    onViewPlan: (planId: string) => void;
}

type SubTab = 'dashboard' | 'open' | 'closed';

const WorkOrdersTab: React.FC<WorkOrdersTabProps> = ({ 
    currentUser, 
    theme, 
    organisation, 
    activeWorkOrder, 
    setActiveWorkOrder,
    onViewPlan 
}) => {
    const [subTab, setSubTab] = useState<SubTab>('dashboard');
    const [activeTask, setActiveTask] = useState<WorkOrderTask | 'new' | null>(null);

    const SubTabButton: React.FC<{ tabId: SubTab, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => {
                setSubTab(tabId);
                setActiveWorkOrder(null);
                setActiveTask(null);
            }}
            className={`whitespace-nowrap py-1.5 px-3 rounded-md font-medium text-xs transition-colors duration-200 ${
                subTab === tabId
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
            }`}
            style={subTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    // If viewing a specific Work Order (Detail View)
    if (activeWorkOrder) {
        if (activeTask) {
            return (
                <div className="bg-white rounded-b-lg shadow-md">
                    <WorkOrderTaskDetail
                        workOrder={activeWorkOrder}
                        task={activeTask === 'new' ? null : activeTask}
                        onBack={() => setActiveTask(null)}
                        currentUser={currentUser}
                        organisation={organisation}
                        theme={theme}
                    />
                </div>
            );
        }
        return (
            <div className="bg-white rounded-b-lg shadow-md">
                <WorkOrderDetail 
                    workOrder={activeWorkOrder}
                    onBack={() => setActiveWorkOrder(null)}
                    onSelectTask={(task) => setActiveTask(task)}
                    onViewPlan={onViewPlan}
                    theme={theme}
                    currentUser={currentUser}
                    organisation={organisation}
                />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-b-lg shadow-md min-h-[600px]">
             {/* Sub Navigation */}
             <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
                    <SubTabButton tabId="dashboard" label="Dashboard" />
                    <SubTabButton tabId="open" label="Open Orders" />
                    <SubTabButton tabId="closed" label="Closed Orders" />
                </div>
            </div>
            
            <div className="p-4 md:p-6">
                {subTab === 'dashboard' && (
                    <WorkOrderDashboard 
                        currentUser={currentUser} 
                        theme={theme} 
                        organisation={organisation} 
                    />
                )}
                {subTab === 'open' && (
                    <WorkOrderList 
                        currentUser={currentUser}
                        theme={theme}
                        organisation={organisation}
                        onSelectWorkOrder={setActiveWorkOrder}
                        viewMode="open"
                    />
                )}
                {subTab === 'closed' && (
                    <WorkOrderList 
                        currentUser={currentUser}
                        theme={theme}
                        organisation={organisation}
                        onSelectWorkOrder={setActiveWorkOrder}
                        viewMode="closed"
                    />
                )}
            </div>
        </div>
    );
};

export default WorkOrdersTab;
