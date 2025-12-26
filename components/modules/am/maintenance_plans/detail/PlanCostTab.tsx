
import React from 'react';
import type { EnrichedTask, SpareMetadata } from '../../../../../types/am_types';

interface PlanCostTabProps {
    allTasks: EnrichedTask[];
    sparesMetadata: Record<string, SpareMetadata>;
}

const PlanCostTab: React.FC<PlanCostTabProps> = ({ allTasks, sparesMetadata }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex justify-between items-center">
                 <h3 className="text-lg font-bold text-slate-800">Estimated Spares Cost</h3>
                 <div className="text-right">
                     <p className="text-sm text-slate-500">Budget Status</p>
                     <p className="text-xs italic text-slate-400">Budget integration unavailable</p>
                 </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-slate-500">Spare Part</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-500">Qty</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-500">Unit Price</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-500">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {allTasks.flatMap(t => (t.requiredSpares || []).map((s, i) => {
                            const meta = sparesMetadata[s.materialId];
                            const price = meta?.price || 0;
                            const total = price * s.quantity;
                            return (
                                <tr key={`${t.id}-${s.materialId}-${i}`}>
                                    <td className="px-4 py-2 text-slate-700">{s.name} <span className="text-xs text-slate-400">({s.materialCode})</span></td>
                                    <td className="px-4 py-2 text-right">{s.quantity}</td>
                                    <td className="px-4 py-2 text-right">${price.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right font-medium text-slate-900">${total.toFixed(2)}</td>
                                </tr>
                            );
                        }))}
                        <tr className="bg-slate-50 font-bold">
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-800">Grand Total</td>
                            <td className="px-4 py-3 text-right text-indigo-700">
                                ${allTasks.reduce((acc, t) => acc + (t.requiredSpares || []).reduce((sAcc, s) => sAcc + (s.quantity * (sparesMetadata[s.materialId]?.price || 0)), 0), 0).toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PlanCostTab;
