
import React from 'react';
import type { EnrichedTask, SpareMetadata } from '../../../../../types/am_types';

interface PlanSparesTabProps {
    allTasks: EnrichedTask[];
    sparesStock: Record<string, number>;
    sparesMetadata: Record<string, SpareMetadata>;
    endDate: string;
}

const PlanSparesTab: React.FC<PlanSparesTabProps> = ({ allTasks, sparesStock, sparesMetadata, endDate }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">WO / Task</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Spare Name (Code)</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500">Required</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500">Available</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500">Lead Time</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Expected Arrival</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {allTasks.flatMap(t => (t.requiredSpares || []).map((s, i) => {
                            const stock = sparesStock[s.materialId] || 0;
                            const meta = sparesMetadata[s.materialId];
                            const leadTime = meta?.leadTimeDays || 0;
                            
                            const arrivalDate = new Date();
                            arrivalDate.setDate(arrivalDate.getDate() + leadTime);
                            
                            const planEnd = new Date(endDate);
                            const criticalDate = new Date(planEnd);
                            criticalDate.setDate(criticalDate.getDate() + 7);
                            
                            const isLate = arrivalDate > criticalDate;
                            
                            return (
                                <tr key={`${t.id}-${s.materialId}-${i}`} className={isLate ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                    <td className="px-4 py-3">
                                        <div className="font-mono text-xs text-slate-500">{t.woId}</div>
                                        <div className="font-medium text-slate-800">{t.taskId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-slate-800">{s.name}</div>
                                        <div className="font-mono text-xs text-slate-500">{s.materialCode}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">{s.quantity}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stock >= s.quantity ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{stock}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">{leadTime} days</td>
                                    <td className="px-4 py-3">
                                        <div className={`text-sm ${isLate ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                            {arrivalDate.toLocaleDateString()}
                                        </div>
                                        {isLate && <div className="text-xs text-red-500">⚠️ Exceeds Schedule + 7d</div>}
                                    </td>
                                </tr>
                            );
                        }))}
                        {allTasks.every(t => !t.requiredSpares || t.requiredSpares.length === 0) && 
                            <tr><td colSpan={6} className="p-4 text-center text-slate-500">No spare parts required.</td></tr>
                        }
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export default PlanSparesTab;
