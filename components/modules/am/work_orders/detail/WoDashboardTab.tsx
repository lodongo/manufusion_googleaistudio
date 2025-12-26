
import React from 'react';
import type { WorkOrder } from '../../../../../types/am_types';

interface WoDashboardTabProps {
    workOrder: WorkOrder;
    metrics: {
        totalTasks: number;
        completedTasks: number;
        progress: number;
        totalCost: number;
    };
}

const DetailRow: React.FC<{ label: string, value: string | undefined | null }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <span className="text-sm text-slate-800 font-semibold text-right">{value || '-'}</span>
    </div>
);

const StatCard: React.FC<{ label: string; value: string | number; subValue?: string; colorClass?: string }> = ({ label, value, subValue, colorClass = "text-slate-800" }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
        <span className={`text-2xl font-extrabold ${colorClass}`}>{value}</span>
        {subValue && <span className="text-xs text-slate-500 mt-1">{subValue}</span>}
    </div>
);

const WoDashboardTab: React.FC<WoDashboardTabProps> = ({ workOrder, metrics }) => {
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <StatCard label="Execution" value={`${metrics.progress}%`} subValue={`${metrics.completedTasks} / ${metrics.totalTasks} Tasks`} colorClass={metrics.progress === 100 ? "text-green-600" : "text-blue-600"} />
                 <StatCard label="Est. Cost" value={`$${metrics.totalCost}`} subValue="Spares & Services" />
                 <StatCard label="Asset" value={workOrder.allocationLevel6Name || 'Unknown'} subValue={workOrder.allocationLevel6Id} />
                 <StatCard label="Work Type" value={workOrder.maintenanceType || 'Corrective'} subValue={workOrder.tagSource} colorClass="text-purple-700" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Schedule & Status
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Created Date" value={workOrder.createdAt?.toDate ? workOrder.createdAt.toDate().toLocaleDateString() : 'N/A'} />
                        <DetailRow label="Scheduled Start" value={workOrder.scheduledStartDate} />
                        <DetailRow label="Scheduled End" value={workOrder.scheduledEndDate} />
                        <DetailRow label="Assigned To" value={workOrder.assignedTo?.name} />
                        <DetailRow label="Created By" value={workOrder.createdBy?.name} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Location Details
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Site" value={workOrder.allocationLevel3Name} />
                        <DetailRow label="Department" value={workOrder.allocationLevel4Name} />
                        <DetailRow label="Section" value={workOrder.allocationLevel5Name} />
                        <DetailRow label="Asset Name" value={workOrder.allocationLevel6Name} />
                        <DetailRow label="Assembly" value={workOrder.allocationLevel7Name} />
                    </div>
                </div>
            </div>

            {workOrder.description && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2">Scope of Work</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{workOrder.description}</p>
                </div>
            )}
        </div>
    );
};

export default WoDashboardTab;
