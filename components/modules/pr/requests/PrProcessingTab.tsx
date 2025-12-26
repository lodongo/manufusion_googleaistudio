import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction, orderBy, Timestamp } from 'firebase/firestore';
import type { Organisation, AppUser, MaterialMasterData } from '../../../../types';
import type { Vendor, PurchaseRequisition, PRLineItem, ProcurementQuote, PurchaseOrder, POItem } from '../../../../types/pr_types';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import Input from '../../../Input';

interface MrpPolicy {
    annualUsageQuantity: number;
    availableNetQuantity: number;
    dailyUsage: number;
    desiredMaxEffective: number;
    dueNowReservations: string[];
    expiredQuantity: number;
    freeToIssueNow: number;
    grossNeeded: number;
    grossPolicyShort: number;
    maxStockLevel: number;
    onHandUsableNow: number;
    onHandUsableNowRaw: number;
    pipelineAllPR: number;
    pipelineOtherPR: number;
    policyTriggered: boolean;
    qtyToOrder: number;
    quarantinedQuantity: number;
    reorderPointEffective: number;
    reorderPointQty: number;
    reservationOrderNowQty: number;
    reservedAllocatedNow: number;
    safetyStockQty: number;
    targetDaysQty: number;
    targetDaysSupply: number;
    receivedQuantity: number;
    requestedQuantity: number;
    uom: string;
    updatedAt: any;
    warehouseId: string;
    warehousePath: string;
}

interface MrpExecutionData {
    execId: string;
    policyComponentQty: number;
    reason: string;
    reservationComponentQty: number;
    reservationNumbersDueNow: string[];
    triggerSource: string;
    updatedAt: any;
}

interface ExtendedPRLine extends PRLineItem {
    policy?: MrpPolicy;
    mrp?: MrpExecutionData;
}

interface PrProcessingTabProps {
    pr: PurchaseRequisition & { warehousePath?: string };
    organisation: Organisation;
    currentUser: AppUser;
    onUpdate?: () => void;
    theme: Organisation['theme'];
}

const sanitize = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (typeof obj === 'object' && !(obj instanceof Timestamp)) {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                newObj[key] = sanitize(obj[key]);
            }
        });
        return newObj;
    }
    return obj;
};

const KeyValueRow: React.FC<{ label: string; value: any; colorClass?: string; mono?: boolean }> = ({ label, value, colorClass = "text-slate-800", mono }) => (
    <div className="flex justify-between py-1 border-b border-slate-100 last:border-0 gap-4">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight whitespace-nowrap">{label}</span>
        <span className={`text-xs font-bold text-right truncate ${mono ? 'font-mono' : ''} ${colorClass}`}>{value || '-'}</span>
    </div>
);

const DetailBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-1">
        <h5 className="text-[10px] font-black text-indigo-600 uppercase mb-2 border-b border-indigo-100 pb-1">{title}</h5>
        {children}
    </div>
);

const ProcessingRow: React.FC<{ 
    line: PRLineItem & { sourcingMethod?: string; sourcingRef?: string; currency?: string; policy?: any; discountPercent?: number; poId?: string; poNumber?: string }; 
    index: number; 
    organisation: Organisation;
    warehousePath?: string;
    onProcess: () => void;
    onUnlink: () => void;
}> = ({ line, index, organisation, warehousePath, onProcess, onUnlink }) => {
    const [material, setMaterial] = useState<MaterialMasterData | null>(null);
    const [agreement, setAgreement] = useState<any | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
             try {
                 const matRef = doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}`);
                 const matSnap = await getDoc(matRef);
                 if (matSnap.exists() && isMounted) {
                     const matData = matSnap.data() as MaterialMasterData;
                     setMaterial(matData);
                     
                     const vendorsPath = warehousePath 
                        ? `${warehousePath}/materials/${line.materialId}/vendors`
                        : `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}/vendors`;
                        
                     const vendorsRef = collection(db, vendorsPath);
                     const vSnap = await getDocs(query(vendorsRef, orderBy('priority', 'asc')));
                     
                     if (!vSnap.empty && isMounted) {
                         const vendors = vSnap.docs.map(d => d.data());
                         const now = new Date().toISOString().split('T')[0];
                         
                         const bestAgreement = vendors.find(v => {
                             if (!v.hasAgreement || v.agreementStatus !== 'Active') return false;
                             return v.validFrom <= now && v.validTo >= now;
                         });

                         const p1 = bestAgreement || vendors.find(v => v.priority === 1);
                         setAgreement(bestAgreement || p1 || null);
                     }
                 }
             } catch(e) { console.error(e); }
        };
        loadData();
        return () => { isMounted = false; };
    }, [line.materialId, organisation.domain, warehousePath]);

    const isProcessed = line.reviewStatus === 'PROCESSED';
    const isLinked = !!line.poId;
    const vendorName = isProcessed || isLinked ? line.assignedVendorName : (agreement ? agreement.vendorName : 'Pending');
    const hasAgreement = isProcessed || isLinked ? (line.sourcingMethod === 'Agreement') : (agreement?.hasAgreement && agreement?.agreementStatus === 'Active');
    const unitPrice = isProcessed || isLinked ? line.agreedPrice : (agreement ? agreement.price : 0);
    const discount = isProcessed || isLinked ? (line.discountPercent || 0) : (agreement ? agreement.discountPercent : 0);
    const currency = isProcessed || isLinked ? (line.currency || organisation.currency.code) : (agreement ? agreement.currency : organisation.currency.code);
    
    const qty = line.policy?.requestedQuantity ?? line.requestedQuantity ?? line.quantity ?? 0;
    const grossTotal = (unitPrice || 0) * qty;
    const netTotal = grossTotal * (1 - (discount / 100));

    return (
        <tr className={`hover:bg-slate-50 transition-colors border-b last:border-0 ${isLinked ? 'bg-teal-50/40' : isProcessed ? 'bg-green-50/40' : ''}`}>
            <td className="px-4 py-3 text-slate-500 text-xs font-mono text-center">{(index + 1) * 10}</td>
            <td className="px-4 py-3">
                <p className="font-bold text-slate-800 text-sm">{line.description}</p>
                <p className="text-xs text-slate-500 font-mono">{line.materialCode}</p>
            </td>
            <td className="px-4 py-3 text-sm text-slate-600">
                {material ? (
                    <>
                        <p className="font-medium">{material.procurementCategoryName}</p>
                        <p className="text-xs text-slate-400">{material.procurementSubcategoryName}</p>
                    </>
                ) : '-'}
            </td>
            <td className="px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{vendorName}</span>
            </td>
            <td className="px-4 py-3 text-center">
                 {hasAgreement ? (
                    <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-green-200">Agreement</span>
                 ) : (
                    <span className="text-slate-300 text-xs font-bold uppercase">No Agreement</span>
                 )}
            </td>
            <td className="px-4 py-3 text-center text-sm font-bold text-slate-700 font-mono">
                {qty}
            </td>
            <td className="px-4 py-3 text-right text-sm font-mono">
                {unitPrice ? unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
            </td>
            <td className="px-4 py-3 text-center text-xs font-bold text-green-600 font-mono">
                {discount > 0 ? `${discount}%` : '-'}
            </td>
             <td className="px-4 py-3 text-right text-sm font-bold text-slate-800 font-mono">
                {netTotal ? netTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
            </td>
             <td className="px-4 py-3 text-center text-xs font-bold text-slate-500">
                {currency}
            </td>
            <td className="px-4 py-3 text-center">
                {isLinked ? (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-[10px] text-teal-700 font-bold bg-teal-100 rounded px-2 py-1 border border-teal-200">
                            PO: {line.poNumber}
                        </div>
                        <button 
                            onClick={onUnlink}
                            className="text-[10px] font-bold text-red-600 hover:underline uppercase"
                        >
                            Unlink
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={onProcess}
                        className={`px-4 py-1.5 border text-xs font-bold rounded shadow-sm transition-all ${isProcessed ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}`}
                    >
                        {isProcessed ? 'LINK PO' : 'PROCESS'}
                    </button>
                )}
            </td>
        </tr>
    );
};

const PrProcessingTab: React.FC<PrProcessingTabProps> = ({ pr, organisation, currentUser, onUpdate, theme }) => {
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [materialData, setMaterialData] = useState<MaterialMasterData | null>(null);
    const [linkedVendors, setLinkedVendors] = useState<any[]>([]);
    const [allSystemVendors, setAllSystemVendors] = useState<Vendor[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [activeAgreement, setActiveAgreement] = useState<any | null>(null);
    const [matchingQuotes, setMatchingQuotes] = useState<ProcurementQuote[]>([]);
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualDiscount, setManualDiscount] = useState<number>(0);
    const [manualCurrency, setManualCurrency] = useState(organisation.currency.code);

    const [isLinkPoModalOpen, setIsLinkPoModalOpen] = useState(false);
    const [availablePos, setAvailablePos] = useState<PurchaseOrder[]>([]);
    const [selectedPoId, setSelectedPoId] = useState('');
    const [linkingPo, setLinkingPo] = useState(false);
    const [linkTarget, setLinkTarget] = useState<'line' | 'pr'>('line');

    const activeLine = processingIndex !== null ? pr.lines[processingIndex] : null;
    const isLineProcessed = activeLine?.reviewStatus === 'PROCESSED';

    const handleOpenProcessModal = async (index: number) => {
        setProcessingIndex(index);
        setMaterialData(null);
        setLinkedVendors([]);
        setAllSystemVendors([]);
        setSelectedVendorId('');
        setActiveAgreement(null);
        setMatchingQuotes([]);
        setSelectedQuoteId('');
        
        const line = pr.lines[index];

        try {
            const matRef = doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}`);
            const matSnap = await getDoc(matRef);
            if (!matSnap.exists()) return;
            const mat = { id: matSnap.id, ...matSnap.data() } as MaterialMasterData;
            setMaterialData(mat);

            const vendorsPath = pr.warehousePath 
                ? `${pr.warehousePath}/materials/${line.materialId}/vendors`
                : `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}/vendors`;
            
            const linkedRef = collection(db, vendorsPath);
            const linkedSnap = await getDocs(query(linkedRef, orderBy('priority', 'asc')));
            const linked = linkedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLinkedVendors(linked);

            let initialVendorId = '';

            if (line.reviewStatus === 'PROCESSED') {
                initialVendorId = line.assignedVendorId || '';
                setManualPrice((line as any).agreedPrice || 0);
                setManualDiscount((line as any).discountPercent || 0);
                setManualCurrency(line.currency || organisation.currency.code);
                if (line.quoteId) setSelectedQuoteId(line.quoteId);

                const savedAgreement = linked.find(v => v.vendorId === initialVendorId);
                if (savedAgreement) setActiveAgreement(savedAgreement);
                
                fetchAvailablePos(initialVendorId, mat.procurementCategoryCode);
            } else {
                const now = new Date().toISOString().split('T')[0];
                const bestAgreement = linked.find(v => {
                    if (!v.hasAgreement || v.agreementStatus !== 'Active') return false;
                    return v.validFrom <= now && v.validTo >= now;
                });

                const p1 = bestAgreement || linked.find(v => v.priority === 1);

                if (p1) {
                    setActiveAgreement(p1);
                    initialVendorId = p1.vendorId;
                    setManualPrice(p1.price || 0);
                    setManualDiscount(p1.discountPercent || 0);
                    setManualCurrency(p1.currency || organisation.currency.code);
                } else if (linked.length > 0) {
                    initialVendorId = linked[0].vendorId;
                }
            }

            const allVendorsRef = collection(db, `organisations/${organisation.domain}/modules/PR/vendors`);
            const allSnap = await getDocs(query(allVendorsRef, where('status', 'in', ['Active', 'Approved'])));
            setAllSystemVendors(allSnap.docs.map(d => ({id: d.id, ...d.data()} as Vendor)));

            setSelectedVendorId(initialVendorId);
            if (initialVendorId && line.reviewStatus !== 'PROCESSED') {
                await fetchQuotes(initialVendorId, mat.procurementCategoryCode);
            }
        } catch (e) { console.error(e); }
    };

    const fetchQuotes = async (vendorId: string, categoryCode: string) => {
        try {
            const quotesRef = collection(db, `organisations/${organisation.domain}/modules/PR/quotes`);
            const q = query(
                quotesRef, 
                where('supplierId', '==', vendorId),
                where('categoryId', '==', categoryCode),
                where('status', 'in', ['RECEIVED', 'AWARDED'])
            );
            const qSnap = await getDocs(q);
            setMatchingQuotes(qSnap.docs.map(d => ({id: d.id, ...d.data()} as ProcurementQuote)));
        } catch (e) { console.error("Quote fetch error", e); }
    };

    const fetchAvailablePos = async (vendorId: string, categoryCode: string) => {
        const poRef = collection(db, `organisations/${organisation.domain}/modules/PR/orders`);
        const q = query(
            poRef, 
            where('status', '==', 'CREATED'), 
            where('vendorId', '==', vendorId),
            where('categoryId', '==', categoryCode)
        );
        const snap = await getDocs(q);
        setAvailablePos(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    };

    // Fix: Defined handleVendorChange to handle supplier selection in the processing modal.
    const handleVendorChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const vendorId = e.target.value;
        setSelectedVendorId(vendorId);
        
        // Update Active Agreement from AVL if exists for this vendor
        const now = new Date().toISOString().split('T')[0];
        const vObj = linkedVendors.find(v => v.vendorId === vendorId);
        if (vObj && vObj.hasAgreement && vObj.agreementStatus === 'Active' && vObj.validFrom <= now && vObj.validTo >= now) {
            setActiveAgreement(vObj);
            setManualPrice(vObj.price || 0);
            setManualDiscount(vObj.discountPercent || 0);
            setManualCurrency(vObj.currency || organisation.currency.code);
        } else {
            setActiveAgreement(null);
        }

        if (vendorId && materialData) {
            await fetchQuotes(vendorId, materialData.procurementCategoryCode);
            fetchAvailablePos(vendorId, materialData.procurementCategoryCode);
        }
    };

    const handleAccept = async () => {
        if (!selectedVendorId || processingIndex === null) return;
        setActionLoading(true);
        try {
            let vendorName = '';
            let vObj = linkedVendors.find(v => v.vendorId === selectedVendorId);
            if (vObj) vendorName = vObj.vendorName;
            else {
                const vSys = allSystemVendors.find(v => v.id === selectedVendorId);
                vendorName = vSys?.legalName || 'Unknown';
            }
            
            let sourcingMethod = 'Manual';
            let sourcingRef = '';
            let finalPrice = manualPrice;
            let finalDiscount = manualDiscount;
            let finalCurrency = manualCurrency;

            if (activeAgreement) {
                 sourcingMethod = activeAgreement.hasAgreement ? 'Agreement' : 'Preferred Supplier';
                 sourcingRef = activeAgreement.agreementRef || '';
                 finalPrice = activeAgreement.price || manualPrice;
                 finalDiscount = activeAgreement.discountPercent || manualDiscount;
                 finalCurrency = activeAgreement.currency || manualCurrency;
            } else if (selectedQuoteId) {
                const quote = matchingQuotes.find(q => q.id === selectedQuoteId);
                if (quote) {
                    sourcingMethod = 'RFQ';
                    sourcingRef = quote.quoteNumber;
                    const quoteItem = quote.items.find(i => i.materialId === activeLine?.materialId);
                    if (quoteItem && quoteItem.quotedUnitPrice) finalPrice = quoteItem.quotedUnitPrice;
                    if (quoteItem && quoteItem.quotedDiscount) finalDiscount = quoteItem.quotedDiscount;
                }
            }

            const updatedLines = [...pr.lines];
            updatedLines[processingIndex] = {
                ...updatedLines[processingIndex],
                reviewStatus: 'PROCESSED',
                assignedVendorId: selectedVendorId,
                assignedVendorName: vendorName,
                agreedPrice: finalPrice,
                discountPercent: finalDiscount,
                currency: finalCurrency,
                sourcingMethod,
                sourcingRef,
                quoteId: selectedQuoteId || undefined
            } as any;

            const sanitizedLines = updatedLines.map(l => sanitize(l));
            const allProcessed = sanitizedLines.every(l => l.reviewStatus === 'PROCESSED');
            const mainStatus = allProcessed ? 'PROCESSED' : 'IN_PROCESS';

            await updateDoc(doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`), {
                lines: sanitizedLines,
                status: mainStatus,
                convertedAt: Timestamp.now(),
                convertedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
            });
            
            if (onUpdate) onUpdate();
            setProcessingIndex(null);
        } catch (e: any) { alert("Failed: " + e.message); } finally { setActionLoading(false); }
    };

    const handleConfirmLinkPo = async () => {
        if (!selectedPoId) return;
        setLinkingPo(true);
        try {
            await runTransaction(db, async (transaction) => {
                const poRef = doc(db, `organisations/${organisation.domain}/modules/PR/orders/${selectedPoId}`);
                const poSnap = await transaction.get(poRef);
                if (!poSnap.exists()) throw new Error("PO not found");
                const poData = poSnap.data() as PurchaseOrder;

                const newItems: any[] = [...(poData.items || [])];
                const updatedPrLines = [...pr.lines];

                const processLineToPoItem = async (line: ExtendedPRLine): Promise<POItem> => {
                    const quantity = line.policy?.requestedQuantity ?? line.requestedQuantity ?? line.quantity ?? 0;
                    const agreedPrice = (line as any).agreedPrice || 0;
                    const disc = (line as any).discountPercent || 0;
                    
                    const matSnap = await transaction.get(doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}`));
                    const matData = matSnap.exists() ? matSnap.data() as MaterialMasterData : null;
                    const itemNo = matData?.oemPartNumber || matData?.ocmPartNumber || 'N/A';
                    const pUnit = matData?.procurementData?.priceUnit || 1;
                    
                    const grossVal = (agreedPrice * quantity) / pUnit;
                    const discAmt = grossVal * (disc / 100);
                    const netVal = grossVal - discAmt;

                    const leadTime = matData?.procurementData?.totalLeadTimeDays || 30;
                    const dDate = new Date();
                    dDate.setDate(dDate.getDate() + leadTime + 7);

                    return {
                        lineNo: (newItems.length + 1) * 10,
                        description: line.description || '',
                        itemNumber: itemNo,
                        quantity: quantity,
                        uom: line.uom || 'EA',
                        unitPrice: agreedPrice,
                        priceUnit: pUnit,
                        currency: line.currency || organisation.currency.code,
                        discountPercent: disc,
                        discountAmount: discAmt,
                        taxPercent: 0,
                        netAmount: netVal,
                        taxAmount: 0,
                        totalAmount: netVal,
                        deliveryDate: dDate.toISOString().split('T')[0],
                        materialId: line.materialId || '',
                        warehousePath: pr.warehousePath || '', 
                        prId: pr.id,
                        prNumber: pr.prNumber
                    };
                };

                if (linkTarget === 'line' && processingIndex !== null) {
                    const line = updatedPrLines[processingIndex];
                    const poItem = await processLineToPoItem(line as any);
                    newItems.push(poItem);

                    updatedPrLines[processingIndex] = {
                        ...line,
                        poId: selectedPoId,
                        poNumber: poData.poNumber
                    };
                } else if (linkTarget === 'pr') {
                    for (let i = 0; i < updatedPrLines.length; i++) {
                        const line = updatedPrLines[i];
                        if (line.reviewStatus === 'PROCESSED' && !line.poId && line.assignedVendorId === poData.vendorId) {
                            const poItem = await processLineToPoItem(line as any);
                            newItems.push(poItem);
                            updatedPrLines[i] = {
                                ...line,
                                poId: selectedPoId,
                                poNumber: poData.poNumber
                            };
                        }
                    }
                }

                const subTotal = newItems.reduce((acc, i) => acc + Number(i.netAmount), 0);
                const totalTax = newItems.reduce((acc, i) => acc + Number(i.taxAmount), 0);
                const grandTotal = subTotal + totalTax;

                transaction.update(poRef, sanitize({ 
                    items: newItems,
                    subTotal,
                    totalTax,
                    grandTotal
                }));

                const prRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`);
                const allLinked = updatedPrLines.every(l => !!l.poId);
                
                transaction.update(prRef, {
                    lines: updatedPrLines.map(l => sanitize(l)),
                    status: allLinked ? 'LINKED' : pr.status,
                    poId: allLinked ? selectedPoId : (pr.poId || null),
                    poNumber: allLinked ? poData.poNumber : (pr.poNumber || null)
                });
            });

            setIsLinkPoModalOpen(false);
            setProcessingIndex(null);
            if (onUpdate) onUpdate();
        } catch (e: any) { alert("Link failed: " + e.message); } finally { setLinkingPo(false); }
    };

    const handleUnlinkLine = async (lineIndex: number) => {
        const line = pr.lines[lineIndex];
        if (!line.poId) return;
        if (!confirm(`Are you sure you want to unlink this item from PO ${line.poNumber}?`)) return;

        setLinkingPo(true);
        try {
            await runTransaction(db, async (transaction) => {
                const poRef = doc(db, `organisations/${organisation.domain}/modules/PR/orders/${line.poId}`);
                const poSnap = await transaction.get(poRef);
                
                if (poSnap.exists()) {
                    const poData = poSnap.data() as PurchaseOrder;
                    const remainingItems = (poData.items || []).filter(item => 
                        !(item.prId === pr.id && item.materialId === line.materialId)
                    );
                    
                    const reindexedItems = remainingItems.map((item, index) => ({
                        ...item,
                        lineNo: (index + 1) * 10
                    }));

                    const subTotal = reindexedItems.reduce((acc, i) => acc + (Number(i.netAmount) || 0), 0);
                    const totalTax = reindexedItems.reduce((acc, i) => acc + (Number(i.taxAmount) || 0), 0);
                    const grandTotal = subTotal + totalTax;
                    
                    transaction.update(poRef, sanitize({ 
                        items: reindexedItems,
                        subTotal,
                        totalTax,
                        grandTotal
                    }));
                }

                const prRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${pr.id}`);
                const updatedLines = [...pr.lines];
                const updatedLine = { ...updatedLines[lineIndex] } as any;
                delete updatedLine.poId;
                delete updatedLine.poNumber;
                updatedLines[lineIndex] = updatedLine;

                const allLinked = updatedLines.every(l => !!(l as any).poId);
                const allProcessed = updatedLines.every(l => l.reviewStatus === 'PROCESSED');
                
                transaction.update(prRef, {
                    lines: updatedLines.map(l => sanitize(l)),
                    status: allLinked ? 'LINKED' : (allProcessed ? 'PROCESSED' : 'IN_PROCESS'),
                    poId: allLinked ? pr.poId : firebase.firestore.FieldValue.delete(),
                    poNumber: allLinked ? pr.poNumber : firebase.firestore.FieldValue.delete()
                });
            });
            
            if (onUpdate) onUpdate();
        } catch (e: any) { alert("Unlink failed: " + e.message); } finally { setLinkingPo(false); }
    };

    const allLinesProcessed = pr.lines.every(l => l.reviewStatus === 'PROCESSED' || !!l.poId);

    return (
        <div className="w-full space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                <div>
                    <h3 className="font-bold text-slate-700">Requisition Processing</h3>
                    <p className="text-xs text-slate-500">Status: <span className="font-bold">{pr.status}</span></p>
                </div>
                {allLinesProcessed && pr.status !== 'LINKED' && (
                    <Button onClick={() => { setLinkTarget('pr'); setIsLinkPoModalOpen(true); }} isLoading={linkingPo} className="!w-auto bg-green-600 hover:bg-green-700 text-white">Link whole PR to PO</Button>
                )}
            </div>

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                 <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-center font-bold text-slate-500 w-12">Item</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-500">Material</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-500">Vendor</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-500">Qty</th>
                            <th className="px-4 py-3 text-right font-bold text-slate-500">Net Total</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {pr.lines.map((line, idx) => (
                            <ProcessingRow 
                                key={idx} 
                                line={line as any} 
                                index={idx} 
                                organisation={organisation}
                                warehousePath={pr.warehousePath}
                                onProcess={() => handleOpenProcessModal(idx)} 
                                onUnlink={() => handleUnlinkLine(idx)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {processingIndex !== null && activeLine && (
                <Modal isOpen={true} onClose={() => setProcessingIndex(null)} title={`${isLineProcessed ? 'Link' : 'Process'} Item: ${activeLine.materialCode}`} size="4xl">
                    <div className="space-y-6">
                        {!isLineProcessed ? (
                            <div className="space-y-4">
                                <Input as="select" id="vendor" label="Select Sourcing Vendor" value={selectedVendorId} onChange={handleVendorChange}>
                                    <option value="">Choose...</option>
                                    {linkedVendors.map(v => <option key={v.vendorId} value={v.vendorId}>{v.vendorName}</option>)}
                                    {allSystemVendors.map(v => <option key={v.id} value={v.id}>{v.legalName}</option>)}
                                </Input>
                                
                                {activeAgreement && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                                        <p className="font-bold text-green-800">Agreement Price Available: {activeAgreement.currency} {activeAgreement.price}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <Input id="p" label="Unit Price" type="number" value={manualPrice} onChange={e => setManualPrice(Number(e.target.value))} />
                                    <Input id="d" label="Discount %" type="number" value={manualDiscount} onChange={e => setManualDiscount(Number(e.target.value))} />
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button variant="secondary" onClick={() => setProcessingIndex(null)}>Cancel</Button>
                                    <Button onClick={handleAccept} isLoading={actionLoading} disabled={!selectedVendorId}>Accept Sourcing</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                                    <p className="font-bold text-blue-800">Sourcing finalized: {activeLine.assignedVendorName}</p>
                                    <p className="text-sm text-blue-600">Link this item to an active draft Purchase Order to proceed.</p>
                                </div>
                                
                                {availablePos.length > 0 ? (
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium">Link to Existing Draft PO</label>
                                        <select value={selectedPoId} onChange={e => setSelectedPoId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                            <option value="">Select PO...</option>
                                            {availablePos.map(po => <option key={po.id} value={po.id}>{po.poNumber}</option>)}
                                        </select>
                                        <div className="flex justify-end pt-4 gap-2">
                                            <Button onClick={() => handleConfirmLinkPo()} isLoading={linkingPo} disabled={!selectedPoId}>Link to PO</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-500 italic p-4">No matching draft POs found. Create a PO first in the Purchase Orders tab.</p>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {isLinkPoModalOpen && (
                <Modal isOpen={isLinkPoModalOpen} onClose={() => setIsLinkPoModalOpen(false)} title="Link Requisition to PO">
                     <div className="space-y-4">
                        <div className="p-3 bg-slate-50 border rounded text-sm text-slate-600">
                            Linking the entire requisition will search for items with processed sourcing matching a specific vendor's draft POs.
                        </div>
                        {availablePos.length > 0 ? (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium">Select Target PO</label>
                                <select value={selectedPoId} onChange={e => setSelectedPoId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                    <option value="">Select PO...</option>
                                    {availablePos.map(po => <option key={po.id} value={po.id}>{po.poNumber} ({po.vendorName})</option>)}
                                </select>
                                <div className="flex justify-end pt-4 gap-2">
                                    <Button onClick={handleConfirmLinkPo} isLoading={linkingPo} disabled={!selectedPoId}>Confirm Link</Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-slate-500 italic p-4">No available draft POs found matching items in this requisition.</p>
                        )}
                     </div>
                </Modal>
            )}
        </div>
    );
};

export default PrProcessingTab;