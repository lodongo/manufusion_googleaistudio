
import React, { useState } from 'react';
import type { MaintenancePlan, WorkOrder, Reservation, EnrichedTask, SpareMetadata } from '../../../../../types/am_types';
import type { SalesOrder } from '../../../../../types/in_types';
import type { Organisation } from '../../../../types';

import PlanSetupTab from './PlanSetupTab';
import PlanSafetyTab from './PlanSafetyTab';
import PlanSparesTab from './PlanSparesTab';
import PlanServicesTab from './PlanServicesTab';
import PlanCostTab from './PlanCostTab';
import PlanPrintTab from './PlanPrintTab';

interface PlanConfigurationTabProps {
    currentPlan: MaintenancePlan;
    editablePlan: any;
    setEditablePlan: (plan: any) => void;
    breaks: any[];
    setBreaks: (breaks: any[]) => void;
    isPlanCommitted: boolean;
    handleUpdatePlanDetails: () => void;
    handleInitiateCommit: () => void;
    handleDeletePlan: () => void;
    handleApprovePlan: (stage: 1 | 2) => void;
    onActuallySchedule: () => void; // Added prop
    onClosePlan: () => void;
    isSaving: boolean;
    isCommitting: boolean;
    canCommit: boolean; // Explicit boolean prop
    validationStatus: any; // The validation object
    workOrdersCount: number;
    workOrders: WorkOrder[];
    salesOrders: SalesOrder[];
    planReservations: Reservation[];
    sparesStock: Record<string, number>;
    handlePrintWorkTicket: (wo: WorkOrder) => void;
    handleOpenOrderModal: (wo: WorkOrder) => void;
    setPreviewSalesOrder: (so: SalesOrder | null) => void;
    setSelectedReservation: (res: Reservation | null) => void;
    allTasks: EnrichedTask[];
    sparesMetadata: Record<string, SpareMetadata>;
    scheduledTasks: EnrichedTask[];
    organisation: Organisation;
    theme: Organisation['theme'];
}

const PlanConfigurationTab: React.FC<PlanConfigurationTabProps> = ({
    currentPlan, editablePlan, setEditablePlan, breaks, setBreaks, isPlanCommitted,
    handleUpdatePlanDetails, handleInitiateCommit, handleDeletePlan, handleApprovePlan,
    onActuallySchedule, onClosePlan,
    isSaving, isCommitting, canCommit, validationStatus, workOrdersCount, workOrders, salesOrders, planReservations, sparesStock,
    handlePrintWorkTicket, handleOpenOrderModal, setPreviewSalesOrder, setSelectedReservation,
    allTasks, sparesMetadata, scheduledTasks, organisation, theme
}) => {
    const [configSubTab, setConfigSubTab] = useState('setup');

    const configTabs = [
        { id: 'setup', label: 'Plan Setup' },
        { id: 'safety', label: 'Safety Analysis' },
        { id: 'spares', label: 'Spare Parts' },
        { id: 'services', label: 'Services' },
        { id: 'cost', label: 'Cost Estimation' },
        { id: 'summary', label: 'Print Summary' }
    ];

    const SubTabButton: React.FC<{ tabId: string, label: string, active: string, onClick: (id: string) => void }> = ({ tabId, label, active, onClick }) => (
        <button
            onClick={() => onClick(tabId)}
            className={`whitespace-nowrap py-1 px-3 text-xs font-medium rounded-md transition-colors duration-200 ${
                active === tabId
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-300'
            }`}
            style={active === tabId ? { backgroundColor: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
            <div className="sticky top-[130px] z-20 bg-slate-50 pt-2 pb-2 -mx-4 md:-mx-8 px-4 md:px-8 border-b border-slate-200">
                    <div className="flex bg-slate-200 p-1 rounded-lg gap-1 overflow-x-auto">
                    {configTabs.map(t => <SubTabButton key={t.id} tabId={t.id} label={t.label} active={configSubTab} onClick={setConfigSubTab} />)}
                </div>
            </div>

            {configSubTab === 'setup' && (
                <PlanSetupTab 
                    plan={currentPlan} 
                    editablePlan={editablePlan}
                    onEditablePlanChange={updates => setEditablePlan((prev: any) => ({...prev, ...updates}))}
                    breaks={breaks}
                    onBreakChange={(idx, f, v) => { const n = [...breaks]; (n[idx] as any)[f] = v; setBreaks(n); }}
                    onAddBreak={() => setBreaks([...breaks, { name: 'Break', startTime: '12:00', endTime: '13:00' }])}
                    onRemoveBreak={(idx) => setBreaks(breaks.filter((_, i) => i !== idx))}
                    isPlanCommitted={isPlanCommitted}
                    onUpdatePlanDetails={handleUpdatePlanDetails}
                    onInitiateCommit={handleInitiateCommit}
                    onDeletePlan={handleDeletePlan}
                    onApprovePlan={handleApprovePlan}
                    onActuallySchedule={onActuallySchedule} // Passed down
                    onClosePlan={onClosePlan}
                    approvals={currentPlan.approvals}
                    isSaving={isSaving}
                    isCommitting={isCommitting}
                    canCommit={canCommit} // Pass boolean directly
                    validationStatus={validationStatus} // Pass validation object
                    workOrdersCount={workOrdersCount}
                    workOrders={workOrders}
                    salesOrders={salesOrders}
                    planReservations={planReservations}
                    sparesStock={sparesStock}
                    onPrintWorkTicket={handlePrintWorkTicket}
                    onCreateSalesOrder={handleOpenOrderModal}
                    onViewSalesOrder={setPreviewSalesOrder}
                    setSelectedReservation={setSelectedReservation as any}
                />
            )}
            {configSubTab === 'safety' && <PlanSafetyTab allTasks={allTasks} />}
            {configSubTab === 'spares' && <PlanSparesTab allTasks={allTasks} sparesStock={sparesStock} sparesMetadata={sparesMetadata} endDate={editablePlan.endDate} />}
            {configSubTab === 'services' && <PlanServicesTab allTasks={allTasks} startDate={editablePlan.startDate} />}
            {configSubTab === 'cost' && <PlanCostTab allTasks={allTasks} sparesMetadata={sparesMetadata} />}
            {configSubTab === 'summary' && <PlanPrintTab plan={currentPlan} workOrders={workOrders} scheduledTasks={scheduledTasks} organisationName={organisation.name} organisation={organisation} theme={theme} />}
        </div>
    );
};

export default PlanConfigurationTab;
