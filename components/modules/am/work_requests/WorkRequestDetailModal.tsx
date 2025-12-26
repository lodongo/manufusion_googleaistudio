
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkRequest, WorkOrder } from '../../../../types/am_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import ConvertWorkRequestModal from './ConvertWorkRequestModal';
import 'firebase/compat/firestore';
import { doc, getDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { Timestamp } = firebase.firestore;

interface WorkRequestDetailModalProps {
  request: WorkRequest;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (request: WorkRequest) => void;
  currentUser: AppUser;
  organisation: Organisation;
  theme: Organisation['theme'];
  onViewWorkOrder?: (workOrder: WorkOrder) => void;
}

const DetailItem: React.FC<{ label: string; value?: string | null; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
    <div className={`${fullWidth ? 'col-span-full' : ''} mb-2`}>
        <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</dt>
        <dd className="mt-1 text-sm font-medium text-slate-800 break-words">{value || '-'}</dd>
    </div>
);

const WorkRequestDetailModal: React.FC<WorkRequestDetailModalProps> = ({ request, isOpen, onClose, onEdit, currentUser, organisation, theme, onViewWorkOrder }) => {
    const [loadingAction, setLoadingAction] = useState(false);
    const [error, setError] = useState('');
    const [confirmState, setConfirmState] = useState({ isOpen: false, action: '', title: '', message: '' });
    
    // Conversion Modal State
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

    // Cancellation State
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('No longer Required');
    
    // State to hold the linked Work Order details if converted
    const [linkedWorkOrder, setLinkedWorkOrder] = useState<WorkOrder | null>(null);

    // Fetch linked Work Order if status is CONVERTED
    useEffect(() => {
        if (request.status === 'CONVERTED' && request.workOrderId) {
            const fetchWO = async () => {
                try {
                    const woRef = doc(db, 'organisations', organisation.domain, 'modules', 'AM', 'workOrders', request.workOrderId!);
                    const woSnap = await getDoc(woRef);
                    if (woSnap.exists()) {
                        setLinkedWorkOrder({ id: woSnap.id, ...woSnap.data() } as WorkOrder);
                    }
                } catch (err) {
                    console.error("Error fetching linked WO:", err);
                }
            };
            fetchWO();
        } else {
            setLinkedWorkOrder(null);
        }
        setIsCancelling(false); // Reset UI state on open
    }, [request.status, request.workOrderId, organisation.domain, isOpen]);

    const executeConversion = async (locationData: {
        allocationLevel3Id: string; allocationLevel3Name: string;
        allocationLevel4Id: string; allocationLevel4Name: string;
        allocationLevel5Id: string; allocationLevel5Name: string;
    }) => {
        setLoadingAction(true);
        setError('');
        try {
            const workRequestRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests').doc(request.id);
            const counterRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('settings').doc('counters');
            const workOrdersCollectionRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workOrders');
            
            await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const newCount = (counterDoc.data()?.workOrderCounter || 0) + 1;
                const newWoId = `WO${newCount.toString(16).toUpperCase().padStart(8, '0')}`;

                const newWorkOrderRef = workOrdersCollectionRef.doc();

                // Transfer all levels and details to the new Work Order
                // Override L3, L4, L5 with confirmed data
                const newWorkOrderPayload: Omit<WorkOrder, 'id'> = {
                    woId: newWoId,
                    workRequestRef: workRequestRef.path,
                    wrId: request.wrId,
                    title: request.title,
                    description: request.description,
                    assemblyPath: request.assemblyPath,
                    assemblyName: request.assemblyName,
                    assemblyCode: request.assemblyCode,
                    
                    // Location overrides
                    allocationLevel1Id: request.allocationLevel1Id || '',
                    allocationLevel1Name: request.allocationLevel1Name || '',
                    allocationLevel2Id: request.allocationLevel2Id || '',
                    allocationLevel2Name: request.allocationLevel2Name || '',
                    allocationLevel3Id: locationData.allocationLevel3Id,
                    allocationLevel3Name: locationData.allocationLevel3Name,
                    allocationLevel4Id: locationData.allocationLevel4Id,
                    allocationLevel4Name: locationData.allocationLevel4Name,
                    allocationLevel5Id: locationData.allocationLevel5Id,
                    allocationLevel5Name: locationData.allocationLevel5Name,
                    
                    // L6/L7 derived from request/asset
                    allocationLevel6Id: request.allocationLevel6Id || '',
                    allocationLevel6Name: request.allocationLevel6Name || '',
                    allocationLevel7Id: request.allocationLevel7Id || '',
                    allocationLevel7Name: request.allocationLevel7Name || '',
                    
                    createdAt: Timestamp.now(),
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    status: 'OPEN',
                    raisedBy: request.raisedBy,
                    tagSource: request.tagSource,
                    impactCategoryName: request.impactCategoryName,
                    impactSubcategoryName: request.impactSubcategoryName,
                    impactSubcategoryDescription: request.impactSubcategoryDescription,
                };
                transaction.set(newWorkOrderRef, newWorkOrderPayload);

                // Update WR with status AND WO reference details for easy listing
                // Also update the WR location to match the WO for consistency
                const updateDataWR: Partial<WorkRequest> & { workOrderDisplayId: string, workOrderStatus: string } = {
                    status: 'CONVERTED',
                    convertedAt: Timestamp.now(),
                    convertedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    workOrderId: newWorkOrderRef.id,
                    workOrderDisplayId: newWoId,
                    workOrderStatus: 'OPEN',
                    
                    allocationLevel3Id: locationData.allocationLevel3Id,
                    allocationLevel3Name: locationData.allocationLevel3Name,
                    allocationLevel4Id: locationData.allocationLevel4Id,
                    allocationLevel4Name: locationData.allocationLevel4Name,
                    allocationLevel5Id: locationData.allocationLevel5Id,
                    allocationLevel5Name: locationData.allocationLevel5Name,
                };
                transaction.update(workRequestRef, updateDataWR as any);
                
                transaction.set(counterRef, { workOrderCounter: newCount }, { merge: true });
            });
            
            setIsConvertModalOpen(false);
            onClose();

        } catch (err: any) {
            setError(err.message || `Failed to convert request.`);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleAction = async (action: 'close') => {
        setLoadingAction(true);
        setError('');
        try {
            const workRequestRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests').doc(request.id);
            
            if (action === 'close') {
                const updateData: Partial<WorkRequest> = {
                    status: 'CANCELLED',
                    closedAt: Timestamp.now(),
                    closedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    cancellationReason: cancellationReason
                };
                await workRequestRef.update(updateData as any);
            }
            
            onClose();

        } catch (err: any) {
            setError(err.message || `Failed to ${action} request.`);
        } finally {
            setLoadingAction(false);
            setConfirmState({ isOpen: false, action: '', title: '', message: '' });
        }
    };
    
    const initiateAction = (action: 'convert' | 'close') => {
        if (action === 'convert') {
            setIsConvertModalOpen(true);
        } else if (action === 'close') {
            setIsCancelling(true);
        }
    };
    
    const handleDownloadPDF = async () => {
        const input = document.getElementById('printable-card-container');
        if (!input) return;

        // Create a clone to render full height without scrollbars and apply specific print styling
        const clone = input.cloneNode(true) as HTMLElement;
        clone.style.width = '794px'; // A4 width approx at 96DPI
        clone.style.height = 'auto'; // Ensure it grows
        clone.style.position = 'absolute';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.background = 'white';
        clone.style.border = '2px solid #334155'; // Professional dark border
        clone.style.borderRadius = '8px';
        clone.style.padding = '20px';
        clone.classList.remove('shadow-sm'); // Remove shadow for cleaner print
        
        // Ensure any scrollable areas in clone are expanded
        const scrollables = clone.querySelectorAll('.overflow-y-auto');
        scrollables.forEach(el => {
            (el as HTMLElement).style.overflow = 'visible';
            (el as HTMLElement).style.height = 'auto';
        });

        // Add a timestamp footer to the clone
        const footer = document.createElement('div');
        footer.style.marginTop = '20px';
        footer.style.paddingTop = '10px';
        footer.style.borderTop = '1px solid #e2e8f0';
        footer.style.color = '#94a3b8';
        footer.style.fontSize = '10px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.innerHTML = `<span>Generated by MEMS</span><span>${new Date().toLocaleString()}</span>`;
        clone.appendChild(footer);

        document.body.appendChild(clone);
        
        try {
            const canvas = await html2canvas(clone, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`WorkRequest_${request.wrId}.pdf`);
        } catch (err) {
            console.error("Error generating PDF:", err);
            alert("Failed to generate PDF.");
        } finally {
            document.body.removeChild(clone);
        }
    };

    const handleWorkOrderClick = () => {
        if (linkedWorkOrder && onViewWorkOrder) {
            onViewWorkOrder(linkedWorkOrder);
            onClose(); // Optional: close modal when navigating
        }
    };

    const canTakeAction = request.status === 'CREATED';

    // Styling based on Impact
    const getImpactStyle = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('safety')) return { border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' };
        if (cat.includes('asset integrity')) return { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' };
        if (cat.includes('compliance')) return { border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' };
        if (cat.includes('cost')) return { border: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' };
        if (cat.includes('delivery')) return { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' };
        if (cat.includes('morale')) return { border: 'border-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' };
        if (cat.includes('quality')) return { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' };
        
        return { border: 'border-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-800' };
    };

    const impactStyle = getImpactStyle(request.impactCategoryName || '');

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Work Request Details" size="xl">
                {/* Printable Card Area */}
                <div id="printable-card-container" className={`bg-white border rounded-lg overflow-hidden border-slate-200 shadow-sm flex flex-col relative`}>
                    
                    {/* Colored Top Boundary */}
                    <div className={`h-3 w-full ${impactStyle.border.replace('border-', 'bg-')}`}></div>

                    <div className="p-6 md:p-8 space-y-6">
                        {/* Header */}
                        <div className="text-center border-b border-slate-100 pb-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Work Request</h4>
                            <div className="flex flex-col justify-center items-center gap-2">
                                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{request.wrId}</h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${impactStyle.badge}`}>
                                    {request.status}
                                </span>
                            </div>
                            
                             {/* Hierarchy Context Bar */}
                             <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-flex">
                                 <span className="font-medium text-slate-700">{request.allocationLevel3Name || 'Site'}</span>
                                 <span className="text-slate-300">/</span>
                                 <span className="font-medium text-slate-700">{request.allocationLevel4Name || 'Dept'}</span>
                                 <span className="text-slate-300">/</span>
                                 <span className="font-medium text-slate-700">{request.allocationLevel5Name || 'Section'}</span>
                             </div>

                            <div className="mt-2 text-xs text-slate-500">
                                Requested: {new Date(request.requestDate).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Linked Work Order Banner */}
                        {request.status === 'CONVERTED' && linkedWorkOrder && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-2" data-html2canvas-ignore="true">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm text-blue-900 font-medium">Converted to Work Order</span>
                                </div>
                                <button 
                                    onClick={handleWorkOrderClick}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded text-sm font-bold text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                    {linkedWorkOrder.woId}
                                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${linkedWorkOrder.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {linkedWorkOrder.status}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Title & Description */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">{request.title}</h3>
                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100 italic">
                                "{request.description}"
                            </p>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            <DetailItem label="Asset" value={request.allocationLevel6Name} />
                            <DetailItem label="Assembly" value={request.allocationLevel7Name} />
                            <DetailItem label="Raised By" value={request.raisedBy.name} />
                            <DetailItem label="Tag Source" value={request.tagSource} />
                            {request.cancellationReason && (
                                <DetailItem label="Cancellation Reason" value={request.cancellationReason} fullWidth />
                            )}
                        </div>

                        {/* Impact Section */}
                        <div className={`mt-6 p-4 rounded-lg border ${impactStyle.border} ${impactStyle.bg}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${impactStyle.text}`} viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <h4 className={`text-sm font-bold uppercase ${impactStyle.text}`}>Impact Assessment</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs font-semibold opacity-70 block">Category</span>
                                    <span className="text-sm font-bold">{request.impactCategoryName}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold opacity-70 block">Subcategory</span>
                                    <span className="text-sm font-bold">{request.impactSubcategoryName}</span>
                                </div>
                                {request.impactSubcategoryDescription && (
                                    <div className="col-span-full mt-2 pt-2 border-t border-black/10">
                                        <p className="text-xs italic opacity-90">{request.impactSubcategoryDescription}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-600" data-html2canvas-ignore="true">{error}</p>}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-4">
                     <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleDownloadPDF} 
                        className="!w-full sm:!w-auto flex items-center justify-center gap-2"
                        disabled={isCancelling}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF
                    </Button>
                    
                    {isCancelling ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-4 items-center justify-end bg-red-50 p-2 rounded border border-red-100 w-full">
                            <div className="w-full sm:w-auto">
                                <label className="block text-xs font-bold text-red-700 uppercase mb-1">Reason for Cancellation</label>
                                <select 
                                    className="block w-full p-2 text-sm border-red-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                    value={cancellationReason}
                                    onChange={(e) => setCancellationReason(e.target.value)}
                                >
                                    <option value="No longer Required">No longer Required</option>
                                    <option value="Duplicate">Duplicate Request</option>
                                    <option value="Budget Constraints">Budget Constraints</option>
                                    <option value="Completed Elsewhere">Completed Elsewhere</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button type="button" variant="secondary" onClick={() => setIsCancelling(false)} className="!bg-white">Cancel</Button>
                                <Button type="button" onClick={() => handleAction('close')} isLoading={loadingAction} className="!bg-red-600 hover:!bg-red-700 text-white">Confirm Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {canTakeAction && (
                                <>
                                    <Button type="button" variant="secondary" onClick={() => onEdit(request)} disabled={loadingAction} className="!w-full sm:!w-auto">Edit</Button>
                                    <Button type="button" onClick={() => initiateAction('close')} disabled={loadingAction} variant="secondary" className="!w-full sm:!w-auto !bg-red-50 !text-red-700 hover:!bg-red-100 border-red-200">Cancel Request</Button>
                                    <Button type="button" onClick={() => initiateAction('convert')} disabled={loadingAction} style={{ backgroundColor: theme.colorPrimary }} className="!w-full sm:!w-auto">Convert to WO</Button>
                                </>
                            )}
                            <Button type="button" variant="secondary" onClick={onClose} className="!w-full sm:!w-auto">Close</Button>
                        </div>
                    )}
                </div>
            </Modal>
            
            <ConvertWorkRequestModal
                isOpen={isConvertModalOpen}
                onClose={() => setIsConvertModalOpen(false)}
                onConfirm={executeConversion}
                organisationDomain={organisation.domain}
                currentData={{
                    l1Id: request.allocationLevel1Id || '',
                    l2Id: request.allocationLevel2Id || '',
                    l3Id: request.allocationLevel3Id || '',
                    l4Id: request.allocationLevel4Id || '',
                    l5Id: request.allocationLevel5Id || ''
                }}
                isLoading={loadingAction}
            />

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(p => ({...p, isOpen: false}))}
                onConfirm={() => handleAction(confirmState.action as 'close')}
                title={confirmState.title}
                message={confirmState.message}
                isLoading={loadingAction}
            />
        </>
    );
};

export default WorkRequestDetailModal;
