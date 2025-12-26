import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, storage } from '../../../../services/firebase';
import { collection, query, where, getDocs, doc, runTransaction, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser, MaterialMasterData, TaxRegime } from '../../../../types';
import type { PurchaseOrder, POItem, Vendor, ProcurementCategory, PurchaseRequisition } from '../../../../types/pr_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import Input from '../../../Input';
import PurchaseRequestDetailView from '../requests/PurchaseRequestDetailView';

interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
    poToEdit?: PurchaseOrder | null;
    initialPr?: PurchaseRequisition | null; 
    onSave?: () => void;
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

// Helper to add working days (skipping weekends)
const addWorkingDays = (startDate: Date, days: number): Date => {
    let date = new Date(startDate);
    let count = 0;
    while (count < days) {
        date.setDate(date.getDate() + 1);
        // 0 = Sunday, 6 = Saturday
        if (date.getDay() !== 0 && date.getDay() !== 6) count++;
    }
    return date;
};

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ isOpen, onClose, organisation, currentUser, theme, poToEdit, initialPr, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // --- Header State ---
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [taxRegimes, setTaxRegimes] = useState<TaxRegime[]>([]);
    const [categories, setCategories] = useState<ProcurementCategory[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [notes, setNotes] = useState('');

    // --- Items State ---
    const [items, setItems] = useState<POItem[]>([]);
    const [availablePrs, setAvailablePrs] = useState<PurchaseRequisition[]>([]);
    const [linkedPrIds, setLinkedPrIds] = useState<Set<string>>(new Set());

    // --- PR Drilldown State ---
    const [viewingPrId, setViewingPrId] = useState<string | null>(null);

    const isEditing = !!poToEdit;
    const poStatus = poToEdit?.status || 'CREATED';
    const canEdit = !isEditing || ['CREATED', 'REJECTED'].includes(poStatus);

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [vSnap, tSnap, cSnap] = await Promise.all([
                        getDocs(query(collection(db, `organisations/${organisation.domain}/modules/PR/vendors`), where('status', 'in', ['Active', 'Approved']))),
                        getDocs(query(collection(db, `organisations/${organisation.domain}/modules/FI/taxRegimes`), where('enabled', '==', true))),
                        getDocs(query(collection(db, 'modules/PR/Classifications/GS/Categories'), orderBy('name')))
                    ]);
                    
                    setVendors(vSnap.docs.map(d => ({id: d.id, ...d.data()} as Vendor)).sort((a,b) => a.legalName.localeCompare(b.legalName)));
                    setTaxRegimes(tSnap.docs.map(d => ({id: d.id, ...d.data()} as TaxRegime)));
                    setCategories(cSnap.docs.map(d => ({ code: d.id, ...d.data() } as ProcurementCategory)));

                    if (isEditing && poToEdit) {
                        setSelectedVendorId(poToEdit.vendorId);
                        setSelectedCategoryId(poToEdit.categoryId);
                        setItems(poToEdit.items || []);
                        setNotes(poToEdit.notes || '');
                        
                        const prIds = new Set<string>();
                        (poToEdit.items || []).forEach(i => { if (i.prId) prIds.add(i.prId); });
                        setLinkedPrIds(prIds);
                    } else if (initialPr) {
                        const firstLine = initialPr.lines[0] as any;
                        if (firstLine?.assignedVendorId) {
                            setSelectedVendorId(firstLine.assignedVendorId);
                            handleLinkPR(initialPr);
                        }
                    } else {
                        resetForm();
                    }
                } catch (e) { console.error(e); }
            };
            fetchData();
        }
    }, [isOpen, organisation.domain, isEditing, poToEdit, initialPr]);

    const filteredCategories = useMemo(() => categories.filter(c => c.enabled !== false), [categories]);

    const resetForm = () => {
        setSelectedVendorId('');
        setSelectedCategoryId('');
        setItems([]);
        setLinkedPrIds(new Set());
        setNotes('');
    };

    const getSourcingData = useCallback(async (materialId: string, warehousePath: string, vendorId: string) => {
        if (!warehousePath) return null;
        const vendorsRef = collection(db, `${warehousePath}/materials/${materialId}/vendors`);
        const vSnap = await getDocs(vendorsRef);
        const vendorsData = vSnap.docs.map(d => d.data());

        const now = new Date().toISOString().split('T')[0];
        const selectedVendorRecord = vendorsData.find(v => v.vendorId === vendorId);
        
        let agreement = null;
        if (selectedVendorRecord?.hasAgreement && selectedVendorRecord?.agreementStatus === 'Active') {
             if (selectedVendorRecord.validFrom <= now && selectedVendorRecord.validTo >= now) {
                 agreement = selectedVendorRecord;
             }
        }

        const priority1 = vendorsData.find(v => v.priority === 1);
        const sourcingRecord = agreement || priority1 || selectedVendorRecord;
        
        if (sourcingRecord) {
             let taxPercent = 0;
             if (sourcingRecord.taxRegimeId) {
                  const regime = taxRegimes.find(r => r.id === sourcingRecord.taxRegimeId);
                  if (regime?.type === 'Constant') taxPercent = regime.value || 0;
             }
             
             return {
                 price: sourcingRecord.price || 0,
                 discount: sourcingRecord.discountPercent || 0,
                 tax: taxPercent,
                 leadTime: sourcingRecord.leadTimeDays || 0,
                 currency: sourcingRecord.currency,
                 paymentTerms: sourcingRecord.paymentTerms,
                 incoterm: sourcingRecord.incoterm,
                 returnPolicy: sourcingRecord.returnPolicy,
                 agreementRef: sourcingRecord.agreementRef
             };
        }
        return null;
    }, [taxRegimes]);

    useEffect(() => {
        if (selectedVendorId && canEdit) {
            const fetchPRs = async () => {
                const prRef = collection(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions`);
                const q = query(prRef, where('status', 'in', ['APPROVED', 'IN_PROCESS', 'PROCESSED']));
                const snap = await getDocs(q);
                const candidates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequisition));
                
                setAvailablePrs(candidates.filter(pr => {
                    if (linkedPrIds.has(pr.id)) return false;
                    return pr.lines.some(l => l.assignedVendorId === selectedVendorId && l.reviewStatus === 'PROCESSED' && !l.poId);
                }));
            };
            fetchPRs();
        }
    }, [selectedVendorId, organisation.domain, canEdit, linkedPrIds]);

    const handleLinkPR = async (pr: PurchaseRequisition) => {
        setLoading(true);
        const matchingLines = pr.lines.filter(l => l.assignedVendorId === selectedVendorId && l.reviewStatus === 'PROCESSED' && !l.poId);
        
        try {
            const newItems: POItem[] = await Promise.all(matchingLines.map(async (line, idx) => {
                let description = line.description;
                let oemPartNumber = '';
                let ocmPartNumber = '';
                let priceUnit = 1;

                const matSnap = await getDoc(doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${line.materialId}`));
                if (matSnap.exists()) {
                    const md = matSnap.data() as MaterialMasterData;
                    oemPartNumber = md.oemPartNumber || '';
                    ocmPartNumber = md.ocmPartNumber || '';
                    description = md.procurementComponentName || line.description;
                    priceUnit = md.procurementData?.priceUnit || 1;
                }

                let itemPrice = line.agreedPrice || 0;
                let itemDiscount = (line as any).discountPercent || 0;
                let itemTaxPercent = 0;
                let itemLeadTime = 0;
                let itemReturnPolicy = '';
                let itemAgreementRef = line.agreementRef || '';
                let itemCurrency = line.currency || organisation.currency.code;

                const whPath = (pr as any).warehousePath;
                if (whPath) {
                    const sourcing = await getSourcingData(line.materialId, whPath, selectedVendorId);
                    if (sourcing) {
                        itemTaxPercent = sourcing.tax;
                        itemLeadTime = sourcing.leadTime;
                        itemReturnPolicy = sourcing.returnPolicy || '';
                        itemAgreementRef = sourcing.agreementRef || itemAgreementRef;
                        itemCurrency = sourcing.currency || itemCurrency;
                    }
                }

                // Delivery Date Logic: Today + Lead Time + 7 working days
                const dDate = new Date();
                dDate.setDate(dDate.getDate() + itemLeadTime);
                const finalDDate = addWorkingDays(dDate, 7);

                const quantity = line.requestedQuantity ?? line.quantity ?? 0;
                const grossAmount = (quantity * itemPrice) / priceUnit;
                const discountAmount = grossAmount * (itemDiscount / 100);
                const netAmount = grossAmount - discountAmount;

                return {
                    lineNo: (items.length + idx + 1) * 10,
                    description,
                    itemNumber: ocmPartNumber || oemPartNumber || 'N/A',
                    partNumber: line.materialCode,
                    oemPartNumber,
                    quantity: quantity,
                    uom: line.uom || 'EA',
                    unitPrice: itemPrice,
                    priceUnit: priceUnit,
                    currency: itemCurrency,
                    discountPercent: itemDiscount,
                    discountAmount: discountAmount,
                    taxPercent: itemTaxPercent,
                    deliveryDate: finalDDate.toISOString().split('T')[0],
                    materialId: line.materialId,
                    warehousePath: whPath || '',
                    prId: pr.id,
                    prNumber: pr.prNumber,
                    returnPolicy: itemReturnPolicy,
                    agreementRef: itemAgreementRef,
                    netAmount: netAmount,
                    taxAmount: netAmount * (itemTaxPercent / 100),
                    totalAmount: netAmount * (1 + (itemTaxPercent / 100))
                } as any;
            }));

            setItems(prev => {
                const combined = [...prev, ...newItems];
                // Recalculate line numbers just in case
                return combined.map((item, i) => ({ ...item, lineNo: (i + 1) * 10 }));
            });
            setLinkedPrIds(prev => new Set(prev).add(pr.id));
            
            if (!selectedCategoryId && matchingLines.length > 0) {
                 const matSnap = await getDoc(doc(db, `organisations/${organisation.domain}/modules/IN/masterData/${matchingLines[0].materialId}`));
                 if (matSnap.exists()) {
                     setSelectedCategoryId(matSnap.data().procurementCategoryCode);
                 }
            }

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleDelinkItem = (index: number) => {
        const item = items[index];
        const newItems = items.filter((_, i) => i !== index).map((it, i) => ({ ...it, lineNo: (i + 1) * 10 }));
        setItems(newItems);
        if (item.prId && !newItems.some(i => i.prId === item.prId)) {
            setLinkedPrIds(prev => {
                const next = new Set(prev);
                next.delete(item.prId!);
                return next;
            });
        }
    };

    const calculated = useMemo(() => {
        const totals = items.reduce((acc, i) => ({
            sub: acc.sub + Number(i.netAmount),
            tax: acc.tax + i.taxAmount,
            grand: acc.grand + i.totalAmount
        }), { sub: 0, tax: 0, grand: 0 });

        return { processed: items, totals };
    }, [items]);

    const handleSave = async () => {
        if (!selectedVendorId) {
            setError("Supplier selection is required.");
            return;
        }
        setLoading(true);
        try {
            const vendor = vendors.find(v => v.id === selectedVendorId);
            
            await runTransaction(db, async (t) => {
                // --- 1. COLLECT ALL REFS FOR READS ---
                const counterRef = doc(db, `organisations/${organisation.domain}/modules/PR/pr_settings/counters`);
                const prRefs = Array.from(linkedPrIds).map(id => 
                    doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${id}`)
                );

                // --- 2. EXECUTE ALL READS FIRST ---
                const counterSnap = await t.get(counterRef);
                const prSnaps = await Promise.all(prRefs.map(ref => t.get(ref)));

                // --- 3. PREPARE VALUES ---
                let poNumber = poToEdit?.poNumber;
                let nextPoCounter = (counterSnap.data()?.poCounter || 0);

                if (!isEditing) {
                    nextPoCounter++;
                    poNumber = `PO${String(nextPoCounter).padStart(8, '0')}`;
                }

                const poRef = isEditing 
                    ? doc(db, `organisations/${organisation.domain}/modules/PR/orders/${poToEdit.id}`) 
                    : doc(collection(db, `organisations/${organisation.domain}/modules/PR/orders`));
                
                const poData = sanitize({
                    poNumber,
                    status: poStatus,
                    vendorId: selectedVendorId,
                    vendorName: vendor?.legalName,
                    vendorCode: vendor?.vendorCode,
                    categoryId: selectedCategoryId,
                    categoryName: filteredCategories.find(c => c.code === selectedCategoryId)?.name,
                    currency: organisation.currency.code,
                    issueDate: new Date().toISOString().split('T')[0],
                    expectedDeliveryDate: calculated.processed.reduce((max, i) => (i.deliveryDate && i.deliveryDate > max) ? i.deliveryDate : max, ''),
                    items: calculated.processed,
                    subTotal: calculated.totals.sub,
                    totalTax: calculated.totals.tax,
                    grandTotal: calculated.totals.grand,
                    notes,
                    updatedAt: Timestamp.now(),
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
                });

                if (!isEditing) poData.createdAt = Timestamp.now();

                // --- 4. EXECUTE ALL WRITES ---
                if (!isEditing) {
                    t.set(counterRef, { poCounter: nextPoCounter }, { merge: true });
                }

                t.set(poRef, poData, { merge: true });

                prSnaps.forEach((prSnap, index) => {
                    if (prSnap.exists()) {
                         const prData = prSnap.data() as PurchaseRequisition;
                         const updatedLines = prData.lines.map(line => {
                             if (line.assignedVendorId === selectedVendorId && line.reviewStatus === 'PROCESSED') {
                                 return { ...line, poId: poRef.id, poNumber };
                             }
                             return line;
                         });
                         const allLinked = updatedLines.every(l => !!l.poId);
                         t.update(prRefs[index], {
                             status: allLinked ? 'LINKED' : prData.status,
                             lines: updatedLines.map(l => sanitize(l)),
                             poId: allLinked ? poRef.id : (prData.poId || null),
                             poNumber: allLinked ? poNumber : (prData.poNumber || null),
                             linkedAt: Timestamp.now()
                         });
                    }
                });
            });

            onClose();
            if (onSave) onSave();
        } catch (e: any) { 
            console.error("Transaction Error:", e);
            setError(e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    if (viewingPrId) {
        return (
            <PurchaseRequestDetailView 
                prId={viewingPrId} 
                onBack={() => setViewingPrId(null)} 
                organisation={organisation} 
                currentUser={currentUser} 
                theme={theme} 
            />
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `PO ${poToEdit?.poNumber}` : "New Purchase Order"} size="7xl">
            <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
                    <Input as="select" id="supplier" label="Supplier" value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} disabled={isEditing}>
                        <option value="">Select Vendor...</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.legalName}</option>)}
                    </Input>
                    <Input as="select" id="category" label="Category" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} disabled={isEditing && !!items.length}>
                        <option value="">Select Category...</option>
                        {filteredCategories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </Input>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Purchase Order Lines</h4>
                        <div className="flex gap-2">
                            {canEdit && selectedVendorId && (
                                <div className="relative group">
                                    <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                                        {items.length > 0 ? '+ Link Additional Requisition' : 'Link Requisition'} ({availablePrs.length})
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 shadow-2xl rounded-xl hidden group-hover:block z-50 overflow-hidden">
                                        <div className="p-2 bg-slate-50 border-b font-bold text-[10px] text-slate-400 uppercase">Qualifying Processed PRs</div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {availablePrs.map(pr => (
                                                <div key={pr.id} onClick={() => handleLinkPR(pr)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors">
                                                    <div className="flex justify-between items-center">
                                                        <p className="font-bold text-sm text-slate-800">{pr.prNumber}</p>
                                                        <span className="text-[10px] bg-slate-100 px-1 rounded font-bold text-slate-500">{pr.status}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{pr.warehouseName}</p>
                                                </div>
                                            ))}
                                            {availablePrs.length === 0 && <p className="p-4 text-center text-xs text-slate-400 italic">No additional PRs available.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-[10px]">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase">Line</th>
                                    <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase">Item Number</th>
                                    <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase">Product & Description</th>
                                    <th className="px-2 py-3 text-right font-bold text-slate-500 uppercase">Qty</th>
                                    <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase">Unit</th>
                                    <th className="px-2 py-3 text-right font-bold text-slate-500 uppercase">Unit Price</th>
                                    <th className="px-2 py-3 text-center font-bold text-slate-500 uppercase">Curr</th>
                                    <th className="px-2 py-3 text-center font-bold text-slate-500 uppercase">Price Unit</th>
                                    <th className="px-2 py-3 text-left font-bold text-slate-500 uppercase">Delivery Date</th>
                                    <th className="px-2 py-3 text-right font-bold text-slate-500 uppercase">Disc. Amt</th>
                                    <th className="px-2 py-3 text-right font-bold text-slate-500 uppercase">VAT%</th>
                                    <th className="px-2 py-3 text-right font-bold text-slate-500 uppercase">Net Amount</th>
                                    {canEdit && <th className="px-2 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {calculated.processed.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-2 py-2 font-bold text-slate-600">{item.lineNo}</td>
                                        <td className="px-2 py-2 font-mono text-slate-500 uppercase">{item.itemNumber}</td>
                                        <td className="px-2 py-2">
                                            <p className="text-slate-800 font-bold">{item.description}</p>
                                            {item.prNumber && (
                                                <button 
                                                    onClick={() => setViewingPrId(item.prId || null)}
                                                    className="text-[8px] text-indigo-500 font-bold uppercase hover:underline"
                                                >
                                                    PR Ref: {item.prNumber}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold">{item.quantity}</td>
                                        <td className="px-2 py-2 uppercase">{item.uom}</td>
                                        <td className="px-2 py-2 text-right font-mono">{item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                        <td className="px-2 py-2 text-center uppercase">{item.currency}</td>
                                        <td className="px-2 py-2 text-center">{item.priceUnit}</td>
                                        <td className="px-2 py-2 text-slate-600 font-mono">{item.deliveryDate}</td>
                                        <td className="px-2 py-2 text-right text-red-500">{item.discountAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                        <td className="px-2 py-2 text-right text-purple-600 font-bold">{item.taxPercent}%</td>
                                        <td className="px-2 py-2 text-right font-bold text-slate-900 bg-slate-50/50">
                                            {item.netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        {canEdit && <td className="px-2 py-2 text-center">
                                            <button onClick={() => handleDelinkItem(idx)} className="text-red-300 hover:text-red-600 font-bold" title="Delink PR Item">×</button>
                                        </td>}
                                    </tr>
                                ))}
                                {items.length === 0 && <tr><td colSpan={13} className="p-10 text-center text-slate-400 italic text-sm">No items linked. Link a Requisition above to add order lines.</td></tr>}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-700 text-xs">
                                <tr>
                                    <td colSpan={11} className="text-right px-4 py-2 border-t">Net (Excl. VAT) ({organisation.currency.code})</td>
                                    <td className="text-right px-2 py-2 border-t font-mono">{calculated.totals.sub.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    {canEdit && <td className="border-t"></td>}
                                </tr>
                                <tr>
                                    <td colSpan={11} className="text-right px-4 py-2 text-purple-700">Total VAT ({organisation.currency.code})</td>
                                    <td className="text-right px-2 py-2 text-purple-700 font-mono">+{calculated.totals.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    {canEdit && <td></td>}
                                </tr>
                                <tr className="bg-slate-200">
                                    <td colSpan={11} className="text-right px-4 py-3 font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-800">Total Price ({organisation.currency.code})</td>
                                    <td className="text-right px-2 py-3 font-black text-slate-900 border-b-2 border-slate-800 font-mono">{calculated.totals.grand.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    {canEdit && <td className="border-b-2 border-slate-800"></td>}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <Input id="notes" as="textarea" label="Internal Notes / Shipping Instructions" value={notes} onChange={e => setNotes(e.target.value.toUpperCase())} rows={2} disabled={!canEdit} placeholder="SPECIFY SHIPPING OR LOADING REQUIREMENTS..."/>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 font-medium">{error}</p>}

                <div className="flex justify-end gap-3 pt-6 border-t">
                    <button 
                        onClick={onClose} 
                        disabled={loading} 
                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    {canEdit && (
                        <Button onClick={handleSave} isLoading={loading} className="!w-auto px-8 shadow-lg shadow-indigo-100" style={{backgroundColor: theme.colorPrimary}}>
                            {isEditing ? 'Update Purchase Order' : 'Generate Purchase Order'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseOrderModal;