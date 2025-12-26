
import React from 'react';
import type { EnrichedTask } from '../../../../../types/am_types';

interface PlanSafetyTabProps {
    allTasks: EnrichedTask[];
}

const PlanSafetyTab: React.FC<PlanSafetyTabProps> = ({ allTasks }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 w-24">WO</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 w-48">Task</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 w-32">Risk Category</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-500 w-48">Hazard</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500 w-24">Initial Score</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-500 w-24">Residual Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {allTasks.flatMap(t => (t.riskAssessments || []).map((ra, i) => (
                            <React.Fragment key={`${t.id}-${i}`}>
                                {/* Parent Row: Main Risk Assessment */}
                                <tr className="hover:bg-slate-50 bg-slate-50/50">
                                    <td className="px-4 py-3 font-mono text-slate-600 align-top border-r">{t.woId}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800 align-top border-r">{t.taskName}</td>
                                    <td className="px-4 py-3 text-slate-600 align-top">{ra.hazardCategoryName}</td>
                                    <td className="px-4 py-3 text-slate-600 align-top font-medium">{ra.hazardName}</td>
                                    <td className="px-4 py-3 text-center align-top">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ra.isIntolerable ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{ra.initialScore}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center align-top">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ra.residualScore > 10 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{ra.residualScore}</span>
                                    </td>
                                </tr>
                                {/* Child Row: Controls Detail */}
                                <tr className="bg-white">
                                    <td colSpan={6} className="p-0">
                                        <div className="pl-8 pr-4 py-3 border-b border-slate-100">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Risk Controls</p>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-slate-500 border-b border-slate-100">
                                                        <th className="text-left pb-1 w-32">Category</th>
                                                        <th className="text-left pb-1 w-48">Control Name</th>
                                                        <th className="text-left pb-1">Description</th>
                                                        <th className="text-center pb-1 w-20">Pre-Task?</th>
                                                        <th className="text-left pb-1 w-32">Assignee</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 text-slate-700">
                                                    {ra.controls.map((c, cIdx) => (
                                                        <tr key={`${t.id}-${i}-c-${cIdx}`}>
                                                            <td className="py-1.5 pr-2 font-medium text-slate-600">{c.controlCategoryName}</td>
                                                            <td className="py-1.5 pr-2 font-semibold">{c.controlName}</td>
                                                            <td className="py-1.5 pr-2 text-slate-500 italic">{c.controlDescription}</td>
                                                            <td className="py-1.5 text-center">
                                                                {c.isPreTask ? 
                                                                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Yes ({c.durationMinutes}m)</span> 
                                                                    : <span className="text-slate-400">-</span>
                                                                }
                                                            </td>
                                                            <td className="py-1.5 pl-2">{c.assignedToName || '-'}</td>
                                                        </tr>
                                                    ))}
                                                    {ra.controls.length === 0 && <tr><td colSpan={5} className="py-2 text-center text-slate-400 italic">No controls defined.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            </React.Fragment>
                        )))}
                        {allTasks.every(t => !t.riskAssessments || t.riskAssessments.length === 0) && <tr><td colSpan={6} className="p-4 text-center text-slate-500">No risk assessments found.</td></tr>}
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export default PlanSafetyTab;
