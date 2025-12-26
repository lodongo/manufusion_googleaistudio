
import React from 'react';
import type { EnrichedTask } from '../../../../../types/am_types';

interface PlanServicesTabProps {
    allTasks: EnrichedTask[];
    startDate: string;
}

const PlanServicesTab: React.FC<PlanServicesTabProps> = ({ allTasks, startDate }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">WO / Task</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Category</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Subcategory</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Supplier</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500">Tentative Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {allTasks.flatMap(t => (t.requiredServices || []).map((s, i) => {
                            const statusColor = s.availabilityStatus === 'Available' ? 'text-green-600 bg-green-100' :
                                              s.availabilityStatus === 'Not Available' ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100';
                            
                            const isLate = s.tentativeDate && new Date(s.tentativeDate) > new Date(startDate);

                            return (
                                <tr key={`${t.id}-srv-${i}`} className={isLate ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                    <td className="px-4 py-3">
                                        <div className="font-mono text-xs text-slate-500">{t.woId}</div>
                                        <div className="font-medium text-slate-800">{t.taskId}</div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{s.categoryName}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{s.subcategoryName}</td>
                                    <td className="px-4 py-3 text-slate-600">{s.supplier}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor}`}>
                                            {s.availabilityStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {s.tentativeDate ? (
                                            <span className={`text-sm ${isLate ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                {new Date(s.tentativeDate).toLocaleDateString()}
                                            </span>
                                        ) : <span className="text-slate-400">-</span>}
                                        {isLate && <div className="text-xs text-red-500">⚠️ After Plan Start</div>}
                                    </td>
                                </tr>
                            );
                        }))}
                        {allTasks.every(t => !t.requiredServices || t.requiredServices.length === 0) && 
                            <tr><td colSpan={6} className="p-4 text-center text-slate-500">No services required.</td></tr>
                        }
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export default PlanServicesTab;
