
import React, { useState } from 'react';
import type { MaintenancePlan, WorkOrder, Reservation, EnrichedTask, SpareMetadata, ServiceItem } from '../../../../../types/am_types';
import type { SalesOrder, JournalLineConfig } from '../../../../../types/in_types';
import Button from '../../../../Button';
import Modal from '../../../../common/Modal';
import ConfirmationModal from '../../../../common/ConfirmationModal';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Tab Imports
import PlanConfigurationTab from './detail/PlanConfigurationTab'; // Circular dependency if imported, handled in parent
import LinkWorkOrderModal from '../LinkWorkOrderModal';
import { WorkOrderTicket } from '../../work_orders/WorkOrderTicket';
import Input from '../../../../Input'; // Added missing import

const { Timestamp } = firebase.firestore;

interface PlanSetupTabProps {
    plan: MaintenancePlan;
    editablePlan: {
        startDate: string;
        endDate: string;
        workStartTime: string;
        workEndTime: string;
    };
    onEditablePlanChange: (updates: Partial<{ startDate: string; endDate: string; workStartTime: string; workEndTime: string }>) => void;
    breaks: any[];
    onBreakChange: (index: number, field: string, value: string) => void;
    onAddBreak: () => void;
    onRemoveBreak: (index: number) => void;
    isPlanCommitted: boolean;
    onUpdatePlanDetails: () => void;
    onInitiateCommit: () => void;
    onDeletePlan: () => void;
    onApprovePlan: (stage: 1 | 2) => void;
    onActuallySchedule: () => void;
    onClosePlan: () => void;
    approvals?: {
        stage1?: { uid: string; name: string; date: string };
        stage2?: { uid: string; name: string; date: string };
    };
    isSaving: boolean;
    isCommitting: boolean;
    canCommit: boolean;
    workOrdersCount: number;
    validationStatus?: {
        datesValid: boolean;
        sparesStockValid: boolean;
        sparesDelayValid: boolean;
        resourceOverlap: boolean;
        resourceOverloaded: boolean;
        servicesValid: boolean;
        hasWorkOrders: boolean;
        safetyValid: boolean;
    };
    // Operational Props
    workOrders: WorkOrder[];
    salesOrders: SalesOrder[];
    planReservations: Reservation[];
    sparesStock: Record<string, number>;
    onPrintWorkTicket: (wo: WorkOrder) => void;
    onCreateSalesOrder: (wo: WorkOrder) => void;
    onViewSalesOrder: (so: SalesOrder) => void;
    setSelectedReservation: (res: Reservation) => void;
}

// Minimal components for this tab to function independently
const CreateOrderConfigModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: JournalLineConfig[]) => void;
    items: any[];
    totalCost: number;
}> = ({ isOpen, onClose, onConfirm, items, totalCost }) => {
    
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Sales Order" size="lg">
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded border">
                    <h4 className="font-bold text-slate-700 mb-2">Order Summary</h4>
                    <p className="text-sm">Items: {items.length}</p>
                    <p className="text-sm font-bold">Total Estimated Cost: ${totalCost.toFixed(2)}</p>
                </div>

                <div className="p-4 bg-blue-50 text-blue-800 rounded text-sm">
                    <p>This will generate a Sales Order for the required materials. Inventory will be issued against this order.</p>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onConfirm([])}>Confirm Creation</Button>
                </div>
            </div>
        </Modal>
    );
};

const PlanSetupTab: React.FC<PlanSetupTabProps> = ({ 
    plan, editablePlan, onEditablePlanChange, 
    breaks, onBreakChange, onAddBreak, onRemoveBreak,
    isPlanCommitted, onUpdatePlanDetails, onInitiateCommit, onDeletePlan, onApprovePlan,
    onActuallySchedule, onClosePlan, approvals,
    isSaving, isCommitting, canCommit, workOrdersCount, validationStatus,
    workOrders, salesOrders, planReservations, sparesStock,
    onPrintWorkTicket, onCreateSalesOrder, onViewSalesOrder, setSelectedReservation
}) => {
    
    // Approval Status Logic
    const isStage1Approved = !!approvals?.stage1;
    const isStage2Approved = !!approvals?.stage2;
    const allValid = canCommit; // Can commit implies all validations passed

    const isActuallyScheduled = plan.status === 'SCHEDULED';
    const isCompleted = plan.status === 'COMPLETED' || plan.status === 'CLOSED';

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm space-y-6 border border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Plan Config & Execution */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-lg text-slate-700 border-b pb-2">Schedule & Work Hours</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Input id="startDate" label="Scheduled Start Date" type="date" value={editablePlan.startDate} onChange={e => onEditablePlanChange({startDate: e.target.value})} disabled={isPlanCommitted}/>
                        <Input id="endDate" label="Scheduled End Date" type="date" value={editablePlan.endDate} onChange={e => onEditablePlanChange({endDate: e.target.value})} disabled={isPlanCommitted}/>
                        <Input id="workStartTime" label="Work Start Time" type="time" value={editablePlan.workStartTime} onChange={e => onEditablePlanChange({workStartTime: e.target.value})} disabled={isPlanCommitted}/>
                        <Input id="workEndTime" label="Work End Time" type="time" value={editablePlan.workEndTime} onChange={e => onEditablePlanChange({workEndTime: e.target.value})} disabled={isPlanCommitted}/>
                    </div>

                    <h3 className="font-semibold text-lg text-slate-700 border-b pb-2">Daily Breaks</h3>
                    <div className="space-y-2">
                        {breaks.map((brk, i) => (
                            <div key={i} className="flex items-end gap-2 p-2 bg-slate-50 rounded border">
                                <div className="flex-grow"><Input id={`breakName-${i}`} label="Name" value={brk.name} onChange={e => onBreakChange(i, 'name', e.target.value)} placeholder="Lunch" disabled={isPlanCommitted} /></div>
                                <div className="w-24"><Input id={`breakStart-${i}`} label="Start" type="time" value={brk.startTime} onChange={e => onBreakChange(i, 'startTime', e.target.value)} disabled={isPlanCommitted} /></div>
                                <div className="w-24"><Input id={`breakEnd-${i}`} label="End" type="time" value={brk.endTime} onChange={e => onBreakChange(i, 'endTime', e.target.value)} disabled={isPlanCommitted} /></div>
                                {!isPlanCommitted && <button onClick={() => onRemoveBreak(i)} className="text-red-500 hover:text-red-700 p-2 mb-1">✕</button>}
                            </div>
                        ))}
                        {!isPlanCommitted && breaks.length < 4 && <Button variant="secondary" onClick={onAddBreak} className="!w-auto !py-1 !text-xs">+ Add Break</Button>}
                    </div>

                    {/* Operational Actions (Visible only when Committed) */}
                    {isPlanCommitted && (
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="font-semibold text-lg text-slate-800 mb-4">Work Orders & Materials</h3>
                            <div className="space-y-4">
                                {workOrders.map(wo => {
                                    const woSalesOrder = salesOrders.find(so => so.workOrderId === wo.id);
                                    return (
                                        <div key={wo.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-sm">{wo.woId}</span>
                                                    <p className="text-sm font-semibold text-slate-700 mt-1">{wo.title}</p>
                                                    {woSalesOrder && (
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">Order: {woSalesOrder.code}</span>
                                                            <span className="text-xs text-slate-500">({woSalesOrder.status})</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded border ${wo.status === 'COMPLETED' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white border-slate-200'}`}>{wo.status}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                                                {!woSalesOrder ? (
                                                    <Button 
                                                        onClick={() => onCreateSalesOrder(wo)} 
                                                        isLoading={isSaving} 
                                                        className="!w-auto !py-1.5 !px-3 !text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                                        disabled={isSaving || isCompleted}
                                                    >
                                                        + Create Sales Order
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        onClick={() => onViewSalesOrder(woSalesOrder)} 
                                                        className="!w-auto !py-1.5 !px-3 !text-xs bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                                                        disabled={isSaving}
                                                    >
                                                        View Issue Slip
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {workOrders.length === 0 && <p className="text-sm text-slate-500 italic">No work orders linked to this plan.</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Validation / Reservations */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-lg text-slate-700 border-b pb-2">
                        {isPlanCommitted ? 'Plan Lifecycle' : 'Plan Validation'}
                    </h3>
                    
                    {isPlanCommitted ? (
                        <>
                             {/* Lifecycle Controls */}
                             <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
                                <div className={`p-3 rounded border ${isActuallyScheduled ? 'bg-blue-50 border-blue-200' : isCompleted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <p className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-1">Current State</p>
                                    <p className="text-lg font-bold">{plan.status}</p>
                                </div>
                                
                                {plan.status === 'IN_PROGRESS' && (
                                    <Button onClick={onActuallySchedule} isLoading={isSaving} className="w-full bg-blue-600 hover:bg-blue-700">
                                        Actually Schedule (Lock Dates)
                                    </Button>
                                )}

                                {plan.status === 'SCHEDULED' && (
                                    <Button onClick={onClosePlan} isLoading={isSaving} className="w-full bg-green-600 hover:bg-green-700">
                                        Close Plan / Complete WOs
                                    </Button>
                                )}
                                
                                {isCompleted && (
                                    <div className="text-center p-2 text-slate-500 italic text-sm">
                                        Plan is closed. No further actions allowed.
                                    </div>
                                )}
                             </div>

                             <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-6">
                                <div className="p-3 bg-slate-50 border-b border-slate-200">
                                    <p className="text-sm font-bold text-slate-700">Active Reservations</p>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {planReservations.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-slate-400 italic">No active material reservations.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                                <tr>
                                                    <th className="p-2 pl-4">Res ID</th>
                                                    <th className="p-2">Material</th>
                                                    <th className="p-2 text-right">Qty</th>
                                                    <th className="p-2 text-center">Stock</th>
                                                    <th className="p-2 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {planReservations.map(res => (
                                                    <tr 
                                                        key={res.reservationId} 
                                                        className="hover:bg-blue-50 cursor-pointer transition-colors" 
                                                        onClick={() => setSelectedReservation(res)}
                                                    >
                                                        <td className="p-2 pl-4 font-mono text-blue-600 font-medium">{res.reservationId}</td>
                                                        <td className="p-2">
                                                            <div className="font-medium text-slate-800 truncate max-w-[120px]" title={res.materialName}>{res.materialName}</div>
                                                            <div className="text-slate-400 font-mono text-[10px]">{res.materialCode}</div>
                                                        </td>
                                                        <td className="p-2 text-right font-bold">{res.quantity}</td>
                                                        <td className={`p-2 text-center font-bold ${ (sparesStock[res.materialId] || 0) < res.quantity ? 'text-red-600' : 'text-green-600' }`}>
                                                            {sparesStock[res.materialId] || 0}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                res.status === 'ISSUED' ? 'bg-green-100 text-green-800' : 
                                                                res.status === 'ORDERED' ? 'bg-blue-100 text-blue-800' : 
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {res.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {validationStatus && (
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-sm">
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{validationStatus.hasWorkOrders ? '✅' : '❌'}</span>
                                        <span className={validationStatus.hasWorkOrders ? 'text-slate-700 font-medium' : 'text-red-600 font-bold'}>
                                            Linked Work Orders ({workOrdersCount})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{validationStatus.safetyValid ? '✅' : '❌'}</span>
                                        <div className="flex flex-col">
                                            <span className={validationStatus.safetyValid ? 'text-slate-700' : 'text-red-600 font-bold'}>
                                                Safety Risk Assessment
                                            </span>
                                            <span className="text-xs text-slate-500">Evaluated, Reduced & Tolerable</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{validationStatus.datesValid ? '✅' : '❌'}</span>
                                        <span className={validationStatus.datesValid ? 'text-slate-700' : 'text-red-600'}>
                                            Valid Date Range
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{validationStatus.sparesStockValid ? '✅' : '⚠️'}</span>
                                        <span className={validationStatus.sparesStockValid ? 'text-slate-700' : 'text-amber-600 font-medium'}>
                                            Spare Parts Stock Availability
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{!validationStatus.resourceOverlap ? '✅' : '❌'}</span>
                                        <span className={!validationStatus.resourceOverlap ? 'text-slate-700' : 'text-red-600'}>
                                            No Resource Conflicts
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100">
                                        <span className="text-lg">{validationStatus.servicesValid ? '✅' : '⚠️'}</span>
                                        <span className={validationStatus.servicesValid ? 'text-slate-700' : 'text-amber-600'}>
                                            External Services Confirmed
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="pt-4 border-t border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-4">Approval Workflow</h4>
                                
                                <div className="space-y-4">
                                    {/* Stage 1 Approval */}
                                    <div className={`p-4 rounded-lg border flex justify-between items-center ${isStage1Approved ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                        <div>
                                            <p className="font-bold text-slate-800">Stage 1: Reviewer</p>
                                            {isStage1Approved ? (
                                                <p className="text-xs text-green-700">Approved by {approvals?.stage1?.name}</p>
                                            ) : (
                                                <p className="text-xs text-slate-500">Pending Review</p>
                                            )}
                                        </div>
                                        {!isStage1Approved && (
                                            <Button 
                                                onClick={() => onApprovePlan(1)} 
                                                disabled={!allValid || isSaving}
                                                className="!w-auto !py-1.5 !px-3 !text-xs"
                                            >
                                                Approve
                                            </Button>
                                        )}
                                        {isStage1Approved && <span className="text-green-600 font-bold">✓</span>}
                                    </div>

                                    {/* Stage 2 Approval */}
                                    <div className={`p-4 rounded-lg border flex justify-between items-center ${isStage2Approved ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'} ${!isStage1Approved ? 'opacity-50' : ''}`}>
                                        <div>
                                            <p className="font-bold text-slate-800">Stage 2: Final Approval</p>
                                            {isStage2Approved ? (
                                                <p className="text-xs text-green-700">Approved by {approvals?.stage2?.name}</p>
                                            ) : (
                                                <p className="text-xs text-slate-500">Pending Final Approval</p>
                                            )}
                                        </div>
                                        {!isStage2Approved && (
                                            <Button 
                                                onClick={() => onApprovePlan(2)} 
                                                disabled={!isStage1Approved || isSaving}
                                                className="!w-auto !py-1.5 !px-3 !text-xs"
                                            >
                                                Approve
                                            </Button>
                                        )}
                                        {isStage2Approved && <span className="text-green-600 font-bold">✓</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 mt-4">
                                <strong>Note:</strong> Committing this plan will lock all tasks, generate reservations for spares, and update the status of all linked Work Orders to 'Scheduled'.
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button 
                                    onClick={onInitiateCommit} 
                                    disabled={isSaving || !canCommit || !isStage2Approved} 
                                    isLoading={isCommitting}
                                    className={`w-full py-3 text-base ${(!canCommit || !isStage2Approved) ? '!bg-slate-300 cursor-not-allowed' : '!bg-green-600 hover:!bg-green-700'}`}
                                >
                                    {isCommitting ? 'Committing Plan...' : 'Commit & Schedule Plan'}
                                </Button>
                                
                                <div className="flex gap-2">
                                    <Button onClick={onUpdatePlanDetails} isLoading={isSaving} variant="secondary">Save Configuration</Button>
                                    {workOrdersCount === 0 && <Button onClick={onDeletePlan} variant="secondary" className="!bg-red-50 !text-red-700 !border-red-200 hover:!bg-red-100">Delete Plan</Button>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* Exposed CreateOrderConfigModal for use by parent */}
            <CreateOrderConfigModal
                 isOpen={false} // Managed by parent passing handler if needed
                 onClose={() => {}}
                 onConfirm={() => {}}
                 items={[]}
                 totalCost={0}
            />
        </div>
    );
};

// Export the modal separately if needed by MaintenancePlanDetail, or keep it internal to this file structure
export { CreateOrderConfigModal };
export default PlanSetupTab;
