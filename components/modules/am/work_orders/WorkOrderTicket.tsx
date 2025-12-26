
import React, { useMemo } from 'react';
import type { WorkOrder, EnrichedTask, SparePart } from '../../../../types/am_types';
import type { Organisation } from '../../../../types';

interface WorkOrderTicketProps {
    workOrder: WorkOrder;
    tasks: EnrichedTask[];
    organisation: Organisation;
    theme: Organisation['theme'];
}

export const WorkOrderTicket: React.FC<WorkOrderTicketProps> = ({ workOrder, tasks, organisation, theme }) => {
    
    // Filter out the "exploded" safety tasks used for scheduling.
    // We only want the main tasks, which contain the riskAssessment data nested inside them.
    const mainTasks = useMemo(() => {
        return tasks.filter(t => !t.isSafetyTask);
    }, [tasks]);

    // Consolidate Spares Logic (Only from main tasks to avoid double counting)
    const consolidatedSpares: SparePart[] = [];
    mainTasks.forEach(t => {
        if (t.requiredSpares) {
            t.requiredSpares.forEach(spare => {
                const existingIndex = consolidatedSpares.findIndex(s => s.materialId === spare.materialId);
                if (existingIndex > -1) {
                    consolidatedSpares[existingIndex].quantity += spare.quantity;
                } else {
                    consolidatedSpares.push({ ...spare });
                }
            });
        }
    });

    // Extract all unique assigned artisans from Main Tasks
    const uniqueArtisans = useMemo(() => {
        const artisanMap = new Map<string, string>();
        mainTasks.forEach(t => {
            t.assignedTo?.forEach(a => {
                artisanMap.set(a.uid, a.name);
            });
        });
        return Array.from(artisanMap.entries()).map(([uid, name]) => ({ uid, name }));
    }, [mainTasks]);

    return (
        <div className="bg-white text-slate-900 font-sans text-sm p-4 w-[148mm] min-h-[210mm] mx-auto border border-gray-200 print:border-0 print:w-full print:max-w-none print:p-0 page-break-after-always">
            {/* --- HEADER --- */}
            <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-start">
                <div className="flex items-center gap-2">
                    {organisation.theme.logoURL && (
                        <img src={organisation.theme.logoURL} alt="Logo" className="h-10 w-auto object-contain" />
                    )}
                    <div>
                        <h1 className="text-xl font-extrabold uppercase tracking-wider text-slate-800">Work Ticket</h1>
                        <p className="text-slate-600 text-xs font-bold">{organisation.name}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black text-slate-800 font-mono">{workOrder.woId}</div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Status: {workOrder.status}</p>
                </div>
            </div>

            {/* --- ASSET & LOCATION INFO --- */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-2 bg-slate-50 border rounded-sm border-slate-200 text-xs">
                <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Asset Description</p>
                    <p className="font-bold text-sm">{workOrder.allocationLevel6Name}</p>
                    <p className="text-xs text-slate-600">{workOrder.allocationLevel7Name ? `Assy: ${workOrder.allocationLevel7Name}` : ''}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Location</p>
                    <p className="font-medium">{workOrder.allocationLevel3Name}</p>
                    <p className="text-xs text-slate-600">{workOrder.allocationLevel4Name} / {workOrder.allocationLevel5Name}</p>
                </div>
                <div className="col-span-2 border-t pt-1 mt-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Work Description</p>
                    <p className="italic text-slate-700">{workOrder.title} - {workOrder.description}</p>
                </div>
            </div>

            {/* --- TASKS SECTION --- */}
            <div className="mb-4">
                <h3 className="text-xs font-bold uppercase border-b-2 border-slate-300 mb-2 pb-1">Scheduled Tasks</h3>
                
                <div className="space-y-4">
                    {mainTasks.map((task, idx) => {
                         // Extract safety/pre-task controls specifically
                         const safetyControls: any[] = [];
                         if (task.riskAssessments) {
                             task.riskAssessments.forEach(ra => {
                                 if (ra.controls) {
                                     ra.controls.forEach(c => {
                                         // Filter specifically for Pre-Task controls to show before the work
                                         if (c.isPreTask) {
                                            safetyControls.push(c);
                                         }
                                     });
                                 }
                             });
                         }

                        return (
                            <div key={task.id} className="border border-slate-300 rounded-sm break-inside-avoid text-xs">
                                {/* Task Header */}
                                <div className="bg-slate-100 p-1.5 border-b border-slate-300 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold bg-white border border-slate-300 px-1 rounded text-[10px]">{idx + 1}</span>
                                        <span className="font-bold">{task.taskName}</span>
                                    </div>
                                    <span className="text-[10px] font-mono">Est: {task.estimatedDurationHours}h</span>
                                </div>

                                <div className="p-2">
                                    {/* Safety Section (Nested and First) */}
                                    {safetyControls.length > 0 && (
                                        <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-sm">
                                            <p className="text-[10px] font-bold text-red-700 uppercase mb-1 flex items-center gap-1">
                                                ⚠️ Safety Pre-Requisites
                                            </p>
                                            <ul className="list-none space-y-1">
                                                {safetyControls.map((c, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-[10px] text-slate-700">
                                                        <div className="w-3 h-3 border border-slate-400 bg-white flex-shrink-0 mt-0.5"></div>
                                                        <span className="font-semibold">{c.controlName}:</span>
                                                        <span className="italic">{c.controlDescription}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Description */}
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Instructions</p>
                                        <p className="text-[11px] text-slate-800 leading-relaxed">{task.description}</p>
                                    </div>
                                    
                                    {/* Services Section */}
                                    {task.requiredServices && task.requiredServices.length > 0 && (
                                         <div className="text-[10px] mb-2 p-1 bg-slate-50 border border-slate-100">
                                             <p className="font-bold mb-0.5">External Services Required:</p>
                                             <ul className="list-disc list-inside text-slate-600">
                                                 {task.requiredServices.map((s, i) => (
                                                     <li key={i}>{s.subcategoryName} ({s.supplier})</li>
                                                 ))}
                                             </ul>
                                         </div>
                                    )}
                                    
                                    {/* Task Completion Tick Box */}
                                    <div className="flex justify-end pt-2 border-t border-slate-100 mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Task Completed:</span>
                                            <div className="w-8 h-8 border border-slate-300 rounded-sm"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CONSOLIDATED SPARES --- */}
            <div className="mb-4 break-inside-avoid">
                 <h3 className="text-xs font-bold uppercase border-b-2 border-slate-300 mb-2 pb-1">Bill of Materials</h3>
                 {consolidatedSpares.length > 0 ? (
                    <table className="w-full text-[10px] border-collapse border border-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="border p-1 text-left">Code</th>
                                <th className="border p-1 text-left">Description</th>
                                <th className="border p-1 text-center">Unit</th>
                                <th className="border p-1 text-right">Req.</th>
                                <th className="border p-1 text-right w-16">Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            {consolidatedSpares.map((spare, idx) => (
                                <tr key={idx}>
                                    <td className="border p-1 font-mono">{spare.materialCode}</td>
                                    <td className="border p-1">{spare.name}</td>
                                    <td className="border p-1 text-center">{spare.uom}</td>
                                    <td className="border p-1 text-right font-bold">{spare.quantity}</td>
                                    <td className="border p-1"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 ) : (
                     <p className="text-[10px] text-slate-500 italic border p-2 rounded-sm text-center">No spare parts planned.</p>
                 )}
            </div>
            
            {/* --- BREAK-IN JOBS SECTION --- */}
            <div className="mb-4 break-inside-avoid">
                 <h3 className="text-xs font-bold uppercase border-b-2 border-slate-300 mb-2 pb-1">Unplanned / Break-in Work</h3>
                 <table className="w-full text-[10px] border-collapse border border-slate-200">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="border p-1 text-left w-1/2">Description of Additional Work</th>
                            <th className="border p-1 text-left">Materials Used</th>
                            <th className="border p-1 text-center w-16">Hrs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3].map((_, i) => (
                            <tr key={i} className="h-8">
                                <td className="border p-1"></td>
                                <td className="border p-1"></td>
                                <td className="border p-1"></td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>

            {/* --- COMPLETION & COMMENTS --- */}
            <div className="mb-4 break-inside-avoid grid grid-cols-3 gap-4">
                 <div className="col-span-1 border border-slate-300 p-2 rounded-sm">
                     <p className="text-[10px] font-bold uppercase mb-2">Job Status</p>
                     <div className="space-y-2">
                         <div className="flex items-center gap-2">
                             <div className="w-4 h-4 border border-slate-400 rounded-sm"></div>
                             <span className="text-xs">Job Completed</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="w-4 h-4 border border-slate-400 rounded-sm"></div>
                             <span className="text-xs">Follow-up Required</span>
                         </div>
                     </div>
                 </div>
                 <div className="col-span-2 border border-slate-300 p-2 rounded-sm">
                     <p className="text-[10px] font-bold uppercase mb-1">Comments / Handover Notes</p>
                     <div className="w-full h-12 border-b border-dotted border-slate-300"></div>
                     <div className="w-full h-8 border-b border-dotted border-slate-300"></div>
                 </div>
            </div>

            {/* --- FINAL SIGN-OFF --- */}
            <div className="break-inside-avoid mt-auto border-t-2 border-slate-800 pt-2">
                <h3 className="text-xs font-bold uppercase mb-2">Team Sign-off</h3>
                <table className="w-full text-[10px] border-collapse border border-slate-300 mb-4">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="border border-slate-300 p-1 text-left w-1/3">Assigned Artisan Name</th>
                            <th className="border border-slate-300 p-1 text-left">Signature</th>
                            <th className="border border-slate-300 p-1 text-left w-16">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {uniqueArtisans.map((artisan) => (
                            <tr key={artisan.uid} className="h-8">
                                <td className="border border-slate-300 p-1 align-middle">{artisan.name}</td>
                                <td className="border border-slate-300 p-1"></td>
                                <td className="border border-slate-300 p-1"></td>
                            </tr>
                        ))}
                        {/* Extra blank rows for helpers */}
                        {[1, 2].map((i) => (
                            <tr key={`blank-${i}`} className="h-8">
                                <td className="border border-slate-300 p-1 text-slate-300 italic">Name:</td>
                                <td className="border border-slate-300 p-1"></td>
                                <td className="border border-slate-300 p-1"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                <div className="flex justify-end mt-4">
                    <div className="w-1/2">
                        <p className="text-[10px] font-bold text-slate-800 uppercase mb-6 border-b border-slate-400 pb-1">Team Leader / Supervisor Sign-off</p>
                        <div className="flex justify-between text-xs">
                            <div className="flex flex-col w-1/2 mr-4">
                                <div className="border-b border-slate-800 h-8 mb-1"></div>
                                <span className="text-[9px] text-slate-500 uppercase">Signature</span>
                            </div>
                            <div className="flex flex-col w-1/3">
                                <div className="border-b border-slate-800 h-8 mb-1"></div>
                                <span className="text-[9px] text-slate-500 uppercase">Date</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* CSS to ensure page breaks work in print mode */}
            <style>{`
                @media print {
                    .page-break-after-always {
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
};
