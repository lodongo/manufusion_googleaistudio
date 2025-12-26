
import React from 'react';
import type { EnrichedTask, WorkOrder } from '../../../../../types/am_types';
import type { Organisation } from '../../../../types';
import Button from '../../../../Button';
import Input from '../../../../Input';

interface PlanTasksTabProps {
    allTasks: EnrichedTask[];
    loading: boolean;
    workOrders: WorkOrder[];
    onViewWorkOrder: (workOrder: WorkOrder) => void;
    onUpdateTask: (taskId: string, workOrderId: string, field: string, value: any) => void;
    onRemoveWorkOrder: (workOrder: WorkOrder) => void;
    onLinkWorkOrder: () => void;
    criticalPathTasks: Set<string>;
    isPlanCommitted: boolean;
    theme: Organisation['theme'];
    sparesStock: Record<string, number>;
    setViewingSparesFor: (task: EnrichedTask | null) => void;
    setViewingRisksFor: (task: EnrichedTask | null) => void;
}

const PlanTasksTab: React.FC<PlanTasksTabProps> = ({ 
    allTasks, loading, workOrders, onViewWorkOrder, onUpdateTask, onRemoveWorkOrder, onLinkWorkOrder,
    criticalPathTasks, isPlanCommitted, theme, sparesStock,
    setViewingSparesFor, setViewingRisksFor 
}) => {

    const getTaskSpareStatus = (task: EnrichedTask) => {
        if (!task.requiredSpares || task.requiredSpares.length === 0) return { label: 'N/A', color: 'text-slate-400' };
        let missingCount = 0;
        task.requiredSpares.forEach(s => {
            const inStock = sparesStock[s.materialId] || 0;
            if (inStock < s.quantity) missingCount++;
        });
        if (missingCount === 0) return { label: 'Available', color: 'text-green-600 font-bold bg-green-100' };
        if (missingCount === task.requiredSpares.length) return { label: 'Unavailable', color: 'text-red-600 font-bold bg-red-100' };
        return { label: 'Partial', color: 'text-orange-600 font-bold bg-orange-100' };
    };

    return (
        <div className="space-y-4">
             {!isPlanCommitted && (
                <div className="flex justify-end">
                    <Button onClick={onLinkWorkOrder} className="!w-auto flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Link Work Order
                    </Button>
                </div>
            )}
            
            <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-md border border-slate-200">
                {loading ? <p className="text-center py-8">Loading tasks...</p> : allTasks.length === 0 ? <p className="text-center p-8 text-slate-500">No tasks found. Link a Work Order to begin.</p> :
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50"><tr>
                        <th className="px-2 py-2 text-left">WO</th>
                        <th className="px-2 py-2 text-left">Code</th>
                        <th className="px-2 py-2 text-left">Name</th>
                        <th className="px-2 py-2 text-left">Start Date</th>
                        <th className="px-2 py-2 text-left">Start Time</th>
                        <th className="px-2 py-2 text-right">Dur (Hrs)</th>
                        <th className="px-2 py-2 text-left">Preceding</th>
                        <th className="px-2 py-2 text-left">Spares</th>
                        <th className="px-2 py-2 text-center">Critical</th>
                        <th className="px-2 py-2"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-200">
                        {allTasks.map((task: EnrichedTask) => {
                            const spareStatus = getTaskSpareStatus(task);
                            const isCritical = criticalPathTasks.has(task.id) || !!task.isCritical;
                            return (
                            <tr key={task.id} className={isCritical ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                <td className="px-2 py-2"><button onClick={() => onViewWorkOrder(workOrders.find(wo => wo.id === task.workOrderId)!)} className="font-mono hover:underline" style={{color: theme.colorPrimary}}>{task.woId}</button></td>
                                <td className="px-2 py-2 font-mono">{task.taskId}</td>
                                <td className="px-2 py-2">{task.taskName}</td>
                                <td className="px-2 py-2"><Input id={`startDate-${task.id}`} containerClassName="w-32 !mb-0" className="!text-xs !py-1" label="" type="date" value={task.scheduledStartDate || ''} onChange={e => onUpdateTask(task.id, task.workOrderId, 'scheduledStartDate', e.target.value)} disabled={!!task.precedingTaskId || isPlanCommitted} /></td>
                                <td className="px-2 py-2"><Input id={`startTime-${task.id}`} containerClassName="w-24 !mb-0" className="!text-xs !py-1" label="" type="time" value={task.scheduledStartTime || ''} onChange={e => onUpdateTask(task.id, task.workOrderId, 'scheduledStartTime', e.target.value)} disabled={!!task.precedingTaskId || isPlanCommitted} /></td>
                                <td className="px-2 py-2 text-right font-mono">{task.estimatedDurationHours || 0}</td>
                                <td className="px-2 py-2">
                                    <select value={task.precedingTaskId || ''} onChange={e => onUpdateTask(task.id, task.workOrderId, 'precedingTaskId', e.target.value || null)} disabled={isPlanCommitted} className="w-full p-1 border rounded-md max-w-xs bg-white text-xs disabled:bg-slate-100">
                                        <option value="">None</option>
                                        {allTasks.filter((t: EnrichedTask) => t.id !== task.id).map((prec: EnrichedTask) => <option key={prec.id} value={prec.id}>{prec.taskId}</option>)}
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${spareStatus.color}`}>{spareStatus.label}</span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <input type="checkbox" checked={!!task.isCritical} onChange={e => onUpdateTask(task.id, task.workOrderId, 'isCritical', e.target.checked)} disabled={isPlanCommitted} />
                                </td>
                                <td className="px-2 py-2 text-center">
                                    {!isPlanCommitted && <button onClick={() => onRemoveWorkOrder(workOrders.find(wo => wo.id === task.workOrderId)!)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2">Delink</button>}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>}
            </div>
        </div>
    );
};

export default PlanTasksTab;
