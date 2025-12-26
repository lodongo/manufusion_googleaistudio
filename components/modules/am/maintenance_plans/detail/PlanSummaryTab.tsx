
import React from 'react';
import type { WorkOrder, WorkOrderTask } from '../../../../../types/am_types';

interface PlanSummaryTabProps {
    workOrders: WorkOrder[];
    tasks: WorkOrderTask[];
    ganttData: any[]; // Using derived data for critical path count
}

const PlanSummaryTab: React.FC<PlanSummaryTabProps> = ({ workOrders, tasks, ganttData }) => {
    // Filter out safety tasks for KPI counts
    const mainTasks = tasks.filter(t => !(t as any).isSafetyTask);
    
    const totalWOs = workOrders.length;
    const totalTasks = mainTasks.length;
    const totalHours = mainTasks.reduce((acc, t) => acc + (t.estimatedDurationHours || 0), 0);
    const criticalTasks = ganttData.filter(t => t.isCritical).length;
    const completedTasks = mainTasks.filter(t => t.status === 'COMPLETED').length;
    const completion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const StatCard = ({ label, value, colorClass }: { label: string, value: string | number, colorClass?: string }) => (
        <div className="p-6 bg-white rounded-lg border shadow-sm text-center flex flex-col justify-center h-32">
             <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-2">{label}</p>
             <p className={`text-4xl font-extrabold ${colorClass || 'text-slate-800'}`}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800">Plan Summary KPI</h3>
            
            <div className="bg-white p-6 rounded-lg border shadow-sm mb-6">
                <div className="flex justify-between items-end mb-2">
                    <h4 className="font-bold text-slate-700">Execution Progress</h4>
                    <span className="text-2xl font-bold text-green-600">{completion}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div className="bg-green-500 h-4 rounded-full transition-all duration-1000 ease-out" style={{width: `${completion}%`}}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>0%</span>
                    <span>{completedTasks} of {totalTasks} Tasks Completed</span>
                    <span>100%</span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <StatCard label="Total Work Orders" value={totalWOs} />
                 <StatCard label="Total Tasks" value={totalTasks} />
                 <StatCard label="Estimated Effort" value={`${totalHours} hrs`} colorClass="text-blue-600" />
                 <StatCard label="Critical Path Tasks" value={criticalTasks} colorClass="text-red-500" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Work Order Status</h4>
                    <div className="space-y-2">
                        {['OPEN', 'IN_PROGRESS', 'COMPLETED'].map(status => {
                            const count = workOrders.filter(w => w.status === status).length;
                            return (
                                <div key={status} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">{status}</span>
                                    <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded">{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Task Disciplines</h4>
                     <div className="space-y-2">
                        {['Mechanical', 'Electrical', 'Instrumentation', 'Civil', 'Operations'].map(disc => {
                            const count = mainTasks.filter(t => t.discipline === disc).length;
                             if (count === 0) return null;
                            return (
                                <div key={disc} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">{disc}</span>
                                    <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded">{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanSummaryTab;
