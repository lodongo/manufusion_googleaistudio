
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import type { Organisation, AppUser, MaterialMasterData } from '../../../../types';
import type { Vendor, PurchaseRequisition, PRLineItem, ProcurementQuote } from '../../../../types/pr_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import Input from '../../../Input';

interface PurchaseRequestDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    pr: PurchaseRequisition;
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
    onUpdate?: () => void;
}

type SourcingState = 'IDLE' | 'LOADING' | 'AGREEMENT_FOUND' | 'NEEDS_RFQ' | 'NO_SUPPLIER';

const DetailItem: React.FC<{ label: string; value?: string | number | null; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
    <div className={fullWidth ? 'col-span-full' : ''}>
        <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</dt>
        <dd className="mt-1 text-sm font-medium text-slate-800 break-words">{value || '-'}</dd>
    </div>
);

const PurchaseRequestDetailModal: React.FC<PurchaseRequestDetailModalProps> = ({ isOpen, onClose, pr, organisation, theme, currentUser, onUpdate }) => {
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
    const [materialData, setMaterialData] = useState<MaterialMasterData | null>(null);
    const [supplierData, setSupplierData] = useState<Vendor | null>(null);
    const [sourcingState, setSourcingState] = useState<SourcingState>('IDLE');
    const [actionLoading, setActionLoading] = useState(false);
    
    // For assigning a supplier manually
    const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
    const [manualVendorId, setManualVendorId] = useState('');
    const [matchingQuotes, setMatchingQuotes] = useState<ProcurementQuote[]>([]);
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    
    // Linked Quote Details
    const [linkedQuoteDetails, setLinkedQuoteDetails] = useState<ProcurementQuote | null>(null);

    const activeLine = selectedLineIndex !== null ? pr.lines[selectedLineIndex] : null;

    // Helper to sanitize object for Firestore (remove undefined)
    const sanitize = (obj: any) => {
        const newObj: any = { ...obj };
        Object.keys(newObj).forEach(key => {
            if (newObj[key] === undefined) delete newObj[key];
        });
        return newObj;
    };

    const fetchMatchingQuotes = async (supplierId: string, categoryCode: string) => {
        try {
            const quotesRef = collection(db, `organisations/${organisation.domain}/modules/PR/quotes`);
            const q = query(
                quotesRef, 
                where('supplierId', '==', supplierId),
                where('categoryId', '==', categoryCode),
                where('status', '==', 'DRAFT') // Only link to open draft quotes
            );
            const snap = await getDocs(q);
            setMatchingQuotes(snap.docs.map(d => ({id: d.id, ...d.data()} as ProcurementQuote)));
        } catch (e) {
            console.error("Error fetching matching quotes", e);
        }
    };

    const handleAnalyzeLine = async (index: number) => {
        setSelectedLineIndex(index);
        setSourcingState('LOADING');
        setMaterialData(null);
        setSupplierData(null);
        setAvailableVendors([]);
        setManualVendorId('');
        setMatchingQuotes([]);
        setSelectedQuoteId('');
        setLinkedQuoteDetails(null);

        const line = pr.lines[index];
        
        // If already linked, fetch the quote details
        if (line.quoteId) {
             try {
                const quoteDoc = await getDoc(doc(db, `organisations/${organisation.domain}/modules/PR/quotes/${line.quoteId}`));
                if (quoteDoc.exists()) {
                    setLinkedQuoteDetails({ id: quoteDoc.id, ...quoteDoc.data() } as ProcurementQuote);
                }
             } catch (e) {
                 console.error("Error fetching linked quote", e);
             }
        }

        try {
            // 1. Fetch Material Master
            const materialRef = doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}`);
            const materialSnap = await getDoc(materialRef);
            
            if (!materialSnap.exists()) {
                alert("Material Master record not found.");
                setSourcingState('IDLE');
                return;
            }

            const matData = { id: materialSnap.id, ...materialSnap.data() } as MaterialMasterData;
            setMaterialData(matData);
            
            // 2. Fetch Vendors relevant to this material's category
            const vendorsRef = collection(db, `organisations/${organisation.domain}/modules/PR/vendors`);
            const vendorsSnap = await getDocs(query(vendorsRef, where('status', 'in', ['Active', 'Approved'])));
            
            const relevantVendors = vendorsSnap.docs.map(d => ({id: d.id, ...d.data()} as Vendor)).filter(v => {
                return v.industries?.some(ind => ind.categoryId === matData.procurementCategoryCode);
            });
            setAvailableVendors(relevantVendors.sort((a,b) => a.legalName.localeCompare(b.legalName)));

            // 3. Determine Supplier (Preferred or Pre-assigned)
            let vendorIdToLoad = matData.procurementData?.preferredVendorId;
            if (line.assignedVendorId) {
                vendorIdToLoad = line.assignedVendorId; // Override with line-level selection
            }

            if (vendorIdToLoad) {
                const vendorRef = doc(db, `organisations/${organisation.domain}/modules/PR/vendors/${vendorIdToLoad}`);
                const vendorSnap = await getDoc(vendorRef);
                const vendor = vendorSnap.exists() ? ({ id: vendorSnap.id, ...vendorSnap.data() } as Vendor) : null;
                setSupplierData(vendor);
                setManualVendorId(vendor?.id || ''); // Pre-fill dropdown if manual

                // Fetch matching quotes immediately
                if (vendor) {
                    await fetchMatchingQuotes(vendor.id!, matData.procurementCategoryCode);
                }

                // Check for Active Agreement
                if (matData.procurementData?.contractReference && matData.procurementData?.standardPrice && matData.procurementData?.priceControl === 'Based on Contract' && matData.procurementData.preferredVendorId === vendorIdToLoad) {
                    setSourcingState('AGREEMENT_FOUND');
                } else {
                    setSourcingState('NEEDS_RFQ');
                }
            } else {
                setSourcingState('NO_SUPPLIER');
            }

        } catch (error) {
            console.error("Error analyzing material:", error);
            alert("Failed to retrieve technical details.");
            setSourcingState('IDLE');
        }
    };

    const updateLineStatus = async (status: 'Reviewed' | 'RFQ Sent' | 'Supplier Assigned', additionalData: Partial<PRLineItem> = {}) => {
        if (selectedLineIndex === null) return;
        setActionLoading(true);

        try {
            const updatedLines = [...pr.lines];
            updatedLines[selectedLineIndex] = {
                ...updatedLines[selectedLineIndex],
                reviewStatus: status,
                ...additionalData
            };
            
            // Sanitize lines to remove any undefined fields before saving
            const sanitizedLines = updatedLines.map(l => sanitize(l));

            const prRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`);
            
            const allReviewed = sanitizedLines.every(l => l.reviewStatus && l.reviewStatus !== 'Pending');
            const mainStatus = allReviewed ? 'IN_PROCESS' : pr.status;

            await updateDoc(prRef, {
                lines: sanitizedLines,
                status: mainStatus
            });

            if (onUpdate) onUpdate();
            pr.lines = sanitizedLines;
            setSourcingState('IDLE');
            setSelectedLineIndex(null);
            
        } catch (e) {
            console.error(e);
            alert("Failed to update PR.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleVendorSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setManualVendorId(id);
        
        if (id && materialData) {
            // Immediately fetch quotes when vendor changes
            await fetchMatchingQuotes(id, materialData.procurementCategoryCode);
        } else {
            setMatchingQuotes([]);
        }
    };

    const handleLinkToQuote = async () => {
        if (!selectedQuoteId || !activeLine || !manualVendorId || !materialData) return;
        setActionLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                const quoteRef = doc(db, `organisations/${organisation.domain}/modules/PR/quotes/${selectedQuoteId}`);
                const quoteDoc = await transaction.get(quoteRef);
                if (!quoteDoc.exists()) throw new Error("Quote not found");
                
                const quoteData = quoteDoc.data() as ProcurementQuote;
                
                const qty = activeLine.quantity || activeLine.requestedQuantity || 0;

                const newItems = [...quoteData.items, {
                    prId: pr.id,
                    prNumber: pr.prNumber,
                    lineId: String(selectedLineIndex),
                    materialId: activeLine.materialId,
                    materialCode: activeLine.materialCode,
                    materialName: activeLine.description,
                    quantity: qty,
                    uom: activeLine.uom || 'Unit'
                }];
                
                transaction.update(quoteRef, { items: newItems });

                // Update PR Line
                const prRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`);
                const updatedLines = [...pr.lines];
                if (selectedLineIndex !== null) {
                    updatedLines[selectedLineIndex] = {
                        ...updatedLines[selectedLineIndex],
                        reviewStatus: 'RFQ Process',
                        quoteId: selectedQuoteId,
                        assignedVendorId: manualVendorId,
                        assignedVendorName: availableVendors.find(v => v.id === manualVendorId)?.legalName
                    };
                }
                const sanitizedLines = updatedLines.map(l => sanitize(l));
                transaction.update(prRef, { lines: sanitizedLines });
            });
            
            if (onUpdate) onUpdate();
            setSourcingState('IDLE');
            setSelectedLineIndex(null);
            
        } catch (e: any) {
            console.error("Link failed", e);
            alert("Failed to link quote: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };
    
    const handleDelinkQuote = async () => {
         if (!linkedQuoteDetails || selectedLineIndex === null || !activeLine) return;
         if (linkedQuoteDetails.status !== 'DRAFT') {
             alert("Cannot delink from a Quote that has already been Sent or Processed.");
             return;
         }

         setActionLoading(true);
         try {
            await runTransaction(db, async (transaction) => {
                const quoteRef = doc(db, `organisations/${organisation.domain}/modules/PR/quotes/${linkedQuoteDetails.id}`);
                const quoteDoc = await transaction.get(quoteRef);
                if (!quoteDoc.exists()) throw new Error("Quote not found");
                
                const quoteData = quoteDoc.data() as ProcurementQuote;
                // Remove item from quote
                const newItems = quoteData.items.filter(item => 
                    !(item.prId === pr.id && item.lineId === String(selectedLineIndex))
                );
                
                transaction.update(quoteRef, { items: newItems });

                // Update PR Line
                const prRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`);
                const updatedLines = [...pr.lines];
                
                // Revert status. Keep vendor assigned if it was manual, but remove quote link.
                // We set quoteId to undefined to mark for removal in sanitize step.
                updatedLines[selectedLineIndex] = {
                    ...updatedLines[selectedLineIndex],
                    reviewStatus: 'Reviewed',
                    quoteId: undefined
                };
                
                // Sanitize all lines to ensure no undefined values are passed
                const sanitizedLines = updatedLines.map(l => sanitize(l));
                
                transaction.update(prRef, { lines: sanitizedLines });
            });

            if (onUpdate) onUpdate();
            setSourcingState('IDLE');
            setSelectedLineIndex(null);
            setLinkedQuoteDetails(null);

         } catch (e: any) {
             console.error("Delink failed", e);
             alert("Failed to delink quote: " + e.message);
         } finally {
             setActionLoading(false);
         }
    };

    const handleSendRFQ = () => {
        if (!supplierData || !materialData) return;
        const qty = activeLine?.quantity || activeLine?.requestedQuantity || 0;
        const subject = `RFQ: ${materialData.procurementComponentName} (${materialData.materialCode})`;
        const body = `Dear ${supplierData.primaryContact.name},\n\nPlease provide a quotation for the following item:\n\nItem: ${materialData.procurementComponentName}\nPart No: ${materialData.oemPartNumber || 'N/A'}\nQuantity: ${qty}\n\nThank you.`;
        window.open(`mailto:${supplierData.primaryContact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        
        updateLineStatus('RFQ Sent', {
             assignedVendorId: supplierData.id,
             assignedVendorName: supplierData.legalName
        });
    };

    const handleMarkReviewed = () => {
        updateLineStatus('Reviewed', {
            assignedVendorName: supplierData?.legalName,
            assignedVendorId: supplierData?.id,
            agreedPrice: materialData?.procurementData?.standardPrice,
            agreementRef: materialData?.procurementData?.contractReference
        });
    };

    const handleAssignSupplier = () => {
        if (!manualVendorId) { alert("Please select a supplier."); return; }
        const vendorName = availableVendors.find(v => v.id === manualVendorId)?.legalName || 'Unknown';
        
        updateLineStatus('Supplier Assigned', {
            assignedVendorId: manualVendorId,
            assignedVendorName: vendorName
        });
    };

    const getStatusBadge = (status?: string) => {
        switch(status) {
            case 'Reviewed': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Reviewed (Agreement)</span>;
            case 'RFQ Sent': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">RFQ Sent</span>;
            case 'RFQ Process': return <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2 py-1 rounded-full">In Quote</span>;
            case 'Supplier Assigned': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Manual Assign</span>;
            default: return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">Pending Review</span>;
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Purchase Request: ${pr.prNumber}`} size="6xl">
            <div className="flex flex-col h-full space-y-6">
                
                {/* Header Info */}
                <div className="bg-slate-50 p-4 rounded-lg border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Warehouse</p>
                        <p className="font-medium text-slate-800">{pr.warehouseName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Source</p>
                        <p className="font-medium text-slate-800">{pr.source?.kind || 'Manual'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Date</p>
                        <p className="font-medium text-slate-800">{pr.createdAt?.toDate ? pr.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Status</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${pr.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{pr.status}</span>
                    </div>
                    {pr.notes && (
                        <div className="col-span-full border-t pt-2 mt-1">
                             <p className="text-xs text-slate-500 font-bold uppercase">Notes</p>
                             <p className="text-slate-600 italic">{pr.notes}</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Lines List */}
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 mb-2">Request Items</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Material</th>
                                        <th className="px-3 py-2 text-right">Qty</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {pr.lines.map((line, idx) => (
                                        <tr key={idx} className={selectedLineIndex === idx ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-slate-900">{line.description}</div>
                                                <div className="text-xs text-slate-500 font-mono">{line.materialCode}</div>
                                                {line.assignedVendorName && <div className="text-xs text-indigo-600 mt-1">Supplier: {line.assignedVendorName}</div>}
                                                {line.quoteId && <div className="text-xs text-green-600 font-bold">Quote Linked</div>}
                                            </td>
                                            <td className="px-3 py-2 text-right">{line.requestedQuantity || line.quantity} {line.uom}</td>
                                            <td className="px-3 py-2 text-center">{getStatusBadge(line.reviewStatus)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <Button 
                                                    onClick={() => handleAnalyzeLine(idx)} 
                                                    variant={selectedLineIndex === idx ? 'primary' : 'secondary'}
                                                    className="!py-1 !px-2 !text-xs !w-auto"
                                                >
                                                    {selectedLineIndex === idx ? 'Analyzing...' : 'Details'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Analysis Panel */}
                    <div className="w-full lg:w-1/2 bg-slate-50 border rounded-lg p-4 flex flex-col h-full">
                        <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Material Sourcing Analysis</h4>
                        
                        {selectedLineIndex === null ? (
                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic min-h-[200px]">
                                Select an item to pull master data and supplier details.
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                {sourcingState === 'LOADING' ? (
                                    <div className="text-center py-8"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div><p className="text-xs mt-2">Fetching Master Data...</p></div>
                                ) : materialData ? (
                                    <>
                                        {/* Technical Specs */}
                                        <div className="bg-white p-3 rounded border shadow-sm space-y-3">
                                            <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Technical Specifications</h5>
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                                                <DetailItem label="Source" value={materialData.source} />
                                                <DetailItem label="Part No" value={materialData.oemPartNumber || materialData.ocmPartNumber} />
                                                <DetailItem label="Category" value={materialData.procurementCategoryName} />
                                                <DetailItem label="Lead Time" value={materialData.procurementData?.totalLeadTimeDays ? `${materialData.procurementData.totalLeadTimeDays} days` : 'N/A'} />
                                            </div>
                                        </div>
                                        
                                        {/* Linked Quote Display */}
                                        {linkedQuoteDetails && (
                                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h5 className="font-bold text-blue-800 text-sm">Linked to RFQ</h5>
                                                        <p className="text-sm font-mono text-blue-600">{linkedQuoteDetails.quoteNumber}</p>
                                                        <p className="text-xs text-blue-500 mt-1">Status: {linkedQuoteDetails.status}</p>
                                                    </div>
                                                    {linkedQuoteDetails.status === 'DRAFT' && (
                                                        <Button onClick={handleDelinkQuote} variant="secondary" className="!w-auto !py-1 !px-2 !text-xs !bg-white !text-red-600 !border-red-200 hover:!bg-red-50" isLoading={actionLoading}>Delink</Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Sourcing Result */}
                                        {!linkedQuoteDetails && (
                                        <div className={`p-4 rounded border-l-4 ${
                                            sourcingState === 'AGREEMENT_FOUND' ? 'bg-green-50 border-green-500' :
                                            sourcingState === 'NEEDS_RFQ' ? 'bg-amber-50 border-amber-500' :
                                            'bg-red-50 border-red-500'
                                        }`}>
                                            {sourcingState === 'AGREEMENT_FOUND' && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <span className="font-bold text-green-800">Active Agreement Found</span>
                                                    </div>
                                                    <p className="text-sm"><strong>Vendor:</strong> {supplierData?.legalName}</p>
                                                    <p className="text-sm"><strong>Contract:</strong> {materialData.procurementData?.contractReference}</p>
                                                    <Button onClick={handleMarkReviewed} isLoading={actionLoading} className="mt-3 !w-full !bg-green-600 hover:!bg-green-700">Confirm & Mark Reviewed</Button>
                                                </div>
                                            )}

                                            {/* NEEDS RFQ or NO SUPPLIER (Manual Selection) */}
                                            {(sourcingState === 'NEEDS_RFQ' || sourcingState === 'NO_SUPPLIER') && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        <span className="font-bold text-amber-800">{sourcingState === 'NEEDS_RFQ' ? 'Preferred Supplier (No Agreement)' : 'No Preferred Supplier'}</span>
                                                    </div>
                                                    
                                                    {/* Manual Vendor Selection / Display */}
                                                    <div className="bg-white p-3 rounded border border-amber-200 space-y-3">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Supplier</label>
                                                            <select 
                                                                className="w-full p-2 border rounded-md text-sm"
                                                                value={manualVendorId}
                                                                onChange={handleVendorSelect}
                                                            >
                                                                <option value="">Select Vendor...</option>
                                                                {availableVendors.map(v => (
                                                                    <option key={v.id} value={v.id}>{v.legalName}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Quote Linking Option */}
                                                        {manualVendorId && matchingQuotes.length > 0 && (
                                                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                                                <p className="text-xs text-blue-800 font-bold mb-1">Open Quotes Found ({matchingQuotes.length})</p>
                                                                <select 
                                                                    className="w-full p-1 border rounded text-xs mb-2"
                                                                    value={selectedQuoteId}
                                                                    onChange={e => setSelectedQuoteId(e.target.value)}
                                                                >
                                                                    <option value="">Select Quote to Append...</option>
                                                                    {matchingQuotes.map(q => <option key={q.id} value={q.id}>{q.quoteNumber} ({q.status})</option>)}
                                                                </select>
                                                                <Button onClick={handleLinkToQuote} disabled={!selectedQuoteId} isLoading={actionLoading} className="!w-full !py-1 !text-xs bg-blue-600 hover:bg-blue-700">Link to Selected Quote</Button>
                                                            </div>
                                                        )}

                                                        <div className="flex gap-2">
                                                            {sourcingState === 'NEEDS_RFQ' && (
                                                                <Button onClick={() => alert("Please create an RFQ first via the Quote Manager.")} isLoading={actionLoading} className="!w-full !bg-amber-500 hover:!bg-amber-600 text-white">Send RFQ Email (Direct)</Button>
                                                            )}
                                                            <Button onClick={handleAssignSupplier} isLoading={actionLoading} variant="secondary" className="!w-full" disabled={!manualVendorId}>Set Supplier Only</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-red-500 text-sm text-center">Error loading material data.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t pt-4 flex justify-end">
                    <Button onClick={onClose} variant="secondary">Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseRequestDetailModal;
