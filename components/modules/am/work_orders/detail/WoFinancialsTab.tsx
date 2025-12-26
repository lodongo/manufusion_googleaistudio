
import React from 'react';
import type { WorkOrderTask } from '../../../../../types/am_types';

interface WoFinancialsTabProps {
    tasks: WorkOrderTask[];
}

const WoFinancialsTab: React.FC<WoFinancialsTabProps> = ({ tasks }) => {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
             <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                 <h3 className="font-bold text-lg text-slate-800 mb-4">Estimated Cost Summary</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Task</th>
                                <th className="px-4 py-2 text-left">Type</th>
                                <th className="px-4 py-2 text-left">Item / Service</th>
                                <th className="px-4 py-2 text-right">Qty / Hrs</th>
                                <th className="px-4 py-2 text-right">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {tasks.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">No tasks found.</td></tr>}
                            {tasks.flatMap(t => {
                                const rows: any[] = [];
                                // Spares rows
                                if (t.requiredSpares) {
                                    t.requiredSpares.forEach(s => {
                                        rows.push(
                                            <tr key={`${t.id}-spare-${s.materialId}`}>
                                                <td className="px-4 py-2">{t.taskId}</td>
                                                <td className="px-4 py-2">Spare</td>
                                                <td className="px-4 py-2">{s.name}</td>
                                                <td className="px-4 py-2 text-right">{s.quantity}</td>
                                                <td className="px-4 py-2 text-right text-slate-400 italic">View Plan</td>
                                            </tr>
                                        );
                                    });
                                }
                                // Services rows
                                if (t.requiredServices) {
                                    t.requiredServices.forEach(s => {
                                        const cost = (s.hours || 0) * (s.hourlyRate || 0) + (s.overtimeHours || 0) * (s.overtimeRate || 0);
                                        rows.push(
                                            <tr key={`${t.id}-service-${s.id}`}>
                                                <td className="px-4 py-2">{t.taskId}</td>
                                                <td className="px-4 py-2">Service</td>
                                                <td className="px-4 py-2">{s.subcategoryName}</td>
                                                <td className="px-4 py-2 text-right">{s.hours}h</td>
                                                <td className="px-4 py-2 text-right">${cost.toFixed(2)}</td>
                                            </tr>
                                        );
                                    });
                                }
                                return rows;
                            })}
                        </tbody>
                    </table>
                 </div>
                 <p className="mt-4 text-xs text-slate-500 italic">* Spare parts costs are calculated based on current standard price in the Maintenance Plan view.</p>
             </div>
        </div>
    );
};

export default WoFinancialsTab;
