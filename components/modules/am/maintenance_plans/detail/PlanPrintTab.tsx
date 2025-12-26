
import React, { useState, useRef } from 'react';
import type { MaintenancePlan, EnrichedTask, WorkOrder } from '../../../../../types/am_types';
import type { Organisation } from '../../../../types';
import Button from '../../../../Button';
import { WorkOrderTicket } from '../../work_orders/WorkOrderTicket';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PlanPrintTabProps {
    plan: MaintenancePlan;
    workOrders: WorkOrder[];
    scheduledTasks: EnrichedTask[];
    organisationName: string;
    organisation: Organisation; // Need full org for logos
    theme: Organisation['theme'];
}

const PlanPrintTab: React.FC<PlanPrintTabProps> = ({ plan, workOrders, scheduledTasks, organisationName, organisation, theme }) => {
    const [viewMode, setViewMode] = useState<'summary' | 'tickets'>('tickets');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // We use a list of refs to capture each ticket individually
    const ticketRefs = useRef<(HTMLDivElement | null)[]>([]);
    const summaryPrintRef = useRef<HTMLDivElement>(null);

    const handleDownloadTickets = async () => {
        setIsGenerating(true);

        try {
            const pdf = new jsPDF('p', 'mm', 'a5');
            const pdfWidth = 148;
            const pdfHeight = 210; // A5 Height
            
            let isFirstTicket = true;

            for (let i = 0; i < workOrders.length; i++) {
                const element = ticketRefs.current[i];
                if (!element) continue;

                // Scale 2 is usually sufficient for print quality text
                const canvas = await html2canvas(element, {
                    scale: 2, 
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;

                // Add a new page for every ticket except the very first one (which uses the default page)
                if (!isFirstTicket) {
                    pdf.addPage();
                }
                isFirstTicket = false;

                let heightLeft = imgHeight;
                let position = 0;

                // First page of current ticket
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;

                // Spill over to subsequent pages if ticket is long
                while (heightLeft > 0) {
                    position -= pdfHeight; // Move image up by one page height
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
            }

            pdf.save(`Work_Tickets_${plan.planId}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadSummary = async () => {
        if (!summaryPrintRef.current) return;
        setIsGenerating(true);

        try {
            const element = summaryPrintRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Plan_Summary_${plan.planId}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate summary PDF.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    // ... PrintableSummary Component ...
    const PrintableSummary: React.FC = () => {
        return (
            <div className="bg-white shadow-lg mx-auto border border-gray-200 text-sm text-slate-900" style={{ maxWidth: '210mm', minHeight: '297mm', padding: '20mm' }}>
                {/* --- HEADER --- */}
                <div className="border-b-2 border-slate-800 pb-4 mb-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold uppercase tracking-wide">Maintenance Plan Summary</h1>
                        <span className="text-xs text-slate-500 font-mono">{plan.planId}</span>
                    </div>
                    <p className="text-lg font-medium mt-1">{organisationName}</p>
                    <div className="flex justify-between mt-4 text-xs text-slate-600">
                         <div>
                             <p><strong>Plan Name:</strong> {plan.planName}</p>
                             <p><strong>Period:</strong> {plan.scheduledStartDate} to {plan.scheduledEndDate}</p>
                         </div>
                         <div className="text-right">
                             <p><strong>Status:</strong> {plan.status}</p>
                             <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
                         </div>
                    </div>
                </div>

                {/* --- WORK ORDERS --- */}
                {workOrders.map((wo, woIndex) => {
                     // Filter only main tasks, exclude exploded safety tasks for the summary view
                     // Safety controls will be displayed NESTED within the main task
                     const woTasks = scheduledTasks.filter(t => t.workOrderId === wo.id && !t.isSafetyTask);
                     
                     return (
                        <div key={wo.id} className={`mb-8 ${woIndex > 0 ? 'pt-8 border-t-4 border-slate-100' : ''}`}>
                            <div className="bg-slate-100 p-3 rounded-sm mb-4 border-l-4 border-slate-800">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-bold">{wo.woId}: {wo.title}</h2>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">
                                    Asset: <strong>{wo.allocationLevel6Name || 'N/A'}</strong> | 
                                    Location: {wo.allocationLevel3Name} &gt; {wo.allocationLevel4Name} &gt; {wo.allocationLevel5Name}
                                </p>
                            </div>

                            {/* --- TASKS FOR THIS WO --- */}
                            <div className="space-y-6">
                                {woTasks.map((task) => {
                                     // Extract safety/pre-task controls from the task object directly
                                     const safetyControls: any[] = [];
                                     if (task.riskAssessments) {
                                         task.riskAssessments.forEach(ra => {
                                             if (ra.controls) {
                                                 ra.controls.forEach(c => {
                                                     if (c.isPreTask) safetyControls.push(c);
                                                 });
                                             }
                                         });
                                     }
                                     
                                     return (
                                        <div key={task.id} className="border border-slate-300 rounded-sm p-0 break-inside-avoid">
                                            <div className="bg-slate-50 p-2 border-b border-slate-300 flex justify-between items-center">
                                                <span className="font-bold">{task.taskId} - {task.taskName}</span>
                                                <span className="text-xs bg-white px-2 py-0.5 border rounded">Est: {task.estimatedDurationHours}h</span>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                
                                                {/* Safety Section - Nested */}
                                                {safetyControls.length > 0 && (
                                                    <div className="mb-2 p-1.5 bg-red-50 border border-red-100 rounded-sm">
                                                        <p className="text-[10px] font-bold text-red-700 uppercase mb-1 flex items-center gap-1">
                                                            ⚠️ Safety Controls (Pre-Task)
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-1">
                                                            {safetyControls.map((c, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-700 pl-2 border-l-2 border-red-200">
                                                                    <span>• {c.controlName} ({c.durationMinutes}m)</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <p className="text-xs italic text-slate-600">{task.description || 'No description.'}</p>
                                            </div>
                                        </div>
                                     );
                                })}
                                {woTasks.length === 0 && <p className="text-sm italic text-slate-500">No tasks scheduled.</p>}
                            </div>
                        </div>
                     );
                })}

                {/* --- APPROVALS SECTION --- */}
                <div className="mt-12 pt-8 border-t-2 border-slate-800 break-inside-avoid">
                    <h3 className="text-sm font-bold uppercase mb-6">Plan Approvals</h3>
                    <div className="flex justify-between gap-8">
                        <div className="flex-1 p-4 border border-slate-300 rounded-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Stage 1: Review</p>
                            {plan.approvals?.stage1 ? (
                                <div className="text-xs">
                                    <p className="font-bold">{plan.approvals.stage1.name}</p>
                                    <p className="text-slate-500">{new Date(plan.approvals.stage1.date).toLocaleString()}</p>
                                    <p className="text-green-600 font-bold mt-1">APPROVED</p>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Pending...</p>
                            )}
                        </div>
                        <div className="flex-1 p-4 border border-slate-300 rounded-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Stage 2: Final Approval</p>
                            {plan.approvals?.stage2 ? (
                                <div className="text-xs">
                                    <p className="font-bold">{plan.approvals.stage2.name}</p>
                                    <p className="text-slate-500">{new Date(plan.approvals.stage2.date).toLocaleString()}</p>
                                    <p className="text-green-600 font-bold mt-1">APPROVED</p>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Pending...</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 uppercase font-medium">
                    <span>Printed: {new Date().toLocaleString()}</span>
                    <span>MEMS Generated Report</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-4">
             {/* Toggle Controls */}
             <div className="flex justify-center bg-slate-100 p-1 rounded-lg self-center mb-6">
                 <button 
                    onClick={() => setViewMode('tickets')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'tickets' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    Download Tickets
                 </button>
                 <button 
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'summary' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    Plan Summary
                 </button>
             </div>

             {viewMode === 'summary' ? (
                 <div className="flex flex-col items-center gap-4">
                     <Button onClick={handleDownloadSummary} disabled={isGenerating} isLoading={isGenerating} className="!w-auto flex items-center gap-2 bg-slate-800 hover:bg-slate-900">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Download Summary PDF
                     </Button>
                     <div className="w-full bg-slate-200 p-4 rounded flex justify-center overflow-x-auto">
                        <div ref={summaryPrintRef}>
                             <PrintableSummary />
                        </div>
                     </div>
                 </div>
             ) : (
                 <div className="flex flex-col items-center gap-4">
                     <Button onClick={handleDownloadTickets} disabled={isGenerating} isLoading={isGenerating} className="!w-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Download All Tickets (PDF)
                     </Button>
                     
                     {/* Preview Area showing Individual Tickets */}
                     <div className="w-full bg-slate-200 p-8 rounded overflow-y-auto max-h-[800px] flex flex-col items-center gap-8">
                         {workOrders.map((wo, i) => (
                             <div key={wo.id} ref={el => { ticketRefs.current[i] = el; }} className="shadow-lg">
                                <WorkOrderTicket 
                                    workOrder={wo} 
                                    tasks={scheduledTasks.filter(t => t.workOrderId === wo.id)} 
                                    organisation={organisation} 
                                    theme={theme}
                                />
                             </div>
                         ))}
                     </div>
                 </div>
             )}
        </div>
    );
};

export default PlanPrintTab;
