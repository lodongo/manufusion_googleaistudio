import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, storage } from '../../../../services/firebase';
import { collection, query, where, getDocs, doc, runTransaction, getDoc, Timestamp, orderBy, updateDoc, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser, MaterialMasterData } from '../../../../types';
import type { ProcurementRFQ, ProcurementQuote, Vendor, ProcurementCategory, PurchaseRequisition, PRLineItem } from '../../../../types/pr_types';
import type { TaxRegime } from '../../../../types/fi_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import Input from '../../../Input';

interface QuoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    rfq?: ProcurementRFQ | null; // If null, create mode for RFQ
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
    readOnly?: boolean; 
    quote?: ProcurementQuote | null;
}

interface PRItemSelection {
    prId: string;
    prNumber: string;
    lineIndex: number;
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    description: string;
    uom?: string;
    isSelected: boolean;
}

interface CompetitorData extends ProcurementQuote {
    srmScore?: number;
    isCurrent?: boolean;
}

// Award Reason Options
const AWARD_REASONS = [
    "Competitive Cost",
    "Best Lead Time",
    "Best Supplier Relations",
    "Quality of Service",
    "Sole Source / OEM",
    "Emergency Requirement",
    "Other"
];

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

const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({ isOpen, onClose, rfq: initialRfq, organisation, currentUser, theme, readOnly = false, quote: initialQuote }) => {
    // Current RFQ State
    const [currentRfq, setCurrentRfq] = useState<ProcurementRFQ | null>(initialRfq || null);
    const isEditingRfq = !!currentRfq;

    // Loading States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // --- CREATE MODE STATES ---
    const [categories, setCategories] = useState<ProcurementCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [validUntilDate, setValidUntilDate] = useState('');
    
    // --- EDIT MODE STATES ---
    const [suppliers, setSuppliers] = useState<ProcurementQuote[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    
    // Link PR Items State
    const [availablePRItems, setAvailablePRItems] = useState<PRItemSelection[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // --- SUPPLIER MANAGEMENT ---
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState('');

    // --- RESPONSE ENTRY ---
    const [isResponseMode, setIsResponseMode] = useState(false);
    const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
    const [activeQuote, setActiveQuote] = useState<ProcurementQuote | null>(null);
    
    // Validation for Response
    const [validationRfqId, setValidationRfqId] = useState('');

    const [responseForm, setResponseForm] = useState<Partial<ProcurementQuote['supplierResponse']> & { validUntil?: string }>({});
    const [itemsResponse, setItemsResponse] = useState<any[]>([]);
    const [responseFile, setResponseFile] = useState<File | null>(null);
    
    // Currency/Tax for Response
    const [conversionInfo, setConversionInfo] = useState<{ rate: number, supplierCurr: string, localCurr: string, msg: string } | null>(null);
    const [taxRegimes, setTaxRegimes] = useState<TaxRegime[]>([]);
    const [selectedTaxRegimeId, setSelectedTaxRegimeId] = useState('');

    // --- AWARDING ---
    const [competitorQuotes, setCompetitorQuotes] = useState<CompetitorData[]>([]);
    const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
    const [awardReason, setAwardReason] = useState(AWARD_REASONS[0]);
    const [thresholdSettings, setThresholdSettings] = useState<{ threeQuoteThreshold: number, tenderThreshold: number } | null>(null);
    const [isExceptionRequired, setIsExceptionRequired] = useState(false);
    const [exceptionJustification, setExceptionJustification] = useState('');
    
    // --- TABS ---
    const [activeTab, setActiveTab] = useState<'details' | 'suppliers' | 'compare'>('details');

    useEffect(() => {
        if (isOpen && initialQuote) {
             handleOpenResponse(initialQuote);
        }
    }, [isOpen, initialQuote]);

    // Load Initial Data (Categories, Thresholds, Tax)
    useEffect(() => {
        const fetchInitial = async () => {
             // 1. Categories
            const classRef = collection(db, 'modules/PR/Classifications'); 
            // Simplified: Fetch GS Categories. Ideally fetch all.
            const catRef = collection(db, 'modules/PR/Classifications/GS/Categories'); 
            const catSnap = await getDocs(query(catRef, orderBy('name')));
            setCategories(catSnap.docs.map(d => ({ code: d.id, ...d.data() } as ProcurementCategory)));

            // 2. Thresholds
             const docRef = doc(db, `organisations/${organisation.domain}/modules/PR/settings/thresholds`);
             const snap = await getDoc(docRef);
             setThresholdSettings(snap.exists() ? snap.data() as any : { threeQuoteThreshold: 0, tenderThreshold: 0 });

             // 3. Tax Regimes
             const regimesSnap = await getDocs(collection(db, `organisations/${organisation.domain}/modules/FI/taxRegimes`));
             setTaxRegimes(regimesSnap.docs.map(d => ({id: d.id, ...d.data()} as TaxRegime)).filter(r => r.enabled));
        };
        if (isOpen) fetchInitial();
    }, [isOpen, organisation.domain]);

    // Load Vendors if adding supplier
    useEffect(() => {
        if (isAddSupplierOpen) {
            const fetchVendors = async () => {
                const vRef = collection(db, `organisations/${organisation.domain}/modules/PR/vendors`);
                const q = query(vRef, where('status', 'in', ['Active', 'Approved']));
                const snap = await getDocs(q);
                // Filter vendors by category match if possible, or show all
                const allVendors = snap.docs.map(d => ({id: d.id, ...d.data()} as Vendor));
                
                // Optional: Filter by category if RFQ category is set
                const currentCat = currentRfq?.categoryId;
                const filtered = currentCat 
                    ? allVendors.filter(v => v.industries?.some(ind => ind.categoryId === currentCat))
                    : allVendors;
                
                setVendors(filtered.sort((a,b) => a.legalName.localeCompare(b.legalName)));
            };
            fetchVendors();
        }
    }, [isAddSupplierOpen, organisation.domain, currentRfq]);

    // Load Suppliers (Quotes) for this RFQ
    useEffect(() => {
        if (currentRfq) {
            const qRef = collection(db, `organisations/${organisation.domain}/modules/PR/quotes`);
            const q = query(qRef, where('rfqId', '==', currentRfq.id));
            const unsub = onSnapshot(q, (snap) => {
                setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProcurementQuote)));
            });
            return () => unsub();
        }
    }, [currentRfq, organisation.domain]);


    // --- ACTION: CREATE RFQ HEADER ---
    const handleCreateRFQ = async () => {
        if (!selectedCategoryId) { setError("Category is required."); return; }
        setLoading(true);
        try {
            const category = categories.find(c => c.code === selectedCategoryId);
            
            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, `organisations/${organisation.domain}/modules/PR/pr_settings/counters`);
                const counterDoc = await transaction.get(counterRef);
                const newCount = (counterDoc.data()?.rfqCounter || 0) + 1;
                transaction.set(counterRef, { rfqCounter: newCount }, { merge: true });
                
                const rfqNumber = `RFQ${String(newCount).padStart(9, '0')}`;
                const newRfqRef = doc(collection(db, `organisations/${organisation.domain}/modules/PR/rfqs`));
                
                const newRfqData: Omit<ProcurementRFQ, 'id'> = {
                    rfqNumber,
                    status: 'DRAFT',
                    categoryId: selectedCategoryId,
                    categoryName: category?.name || '',
                    items: [],
                    validUntil: validUntilDate,
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                    createdAt: Timestamp.now()
                };
                
                transaction.set(newRfqRef, newRfqData);
                setCurrentRfq({ id: newRfqRef.id, ...newRfqData });
            });
            setError('');
        } catch (e: any) {
            console.error(e);
            setError("Failed to create RFQ: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTION: ADD SUPPLIER TO BID LIST ---
    const handleAddSupplier = async () => {
        if (!selectedVendorId || !currentRfq) return;
        setLoading(true);
        try {
            const vendor = vendors.find(v => v.id === selectedVendorId);
            
            // Generate Quote ID
            // NOTE: We associate the quote with the RFQ items immediately
            const newQuoteData: Omit<ProcurementQuote, 'id'> = {
                rfqId: currentRfq.id,
                rfqNumber: currentRfq.rfqNumber,
                quoteNumber: `${currentRfq.rfqNumber}-${vendor?.vendorCode}`, // e.g. RFQ001-V001
                status: 'DRAFT',
                supplierId: vendor?.id || '',
                supplierName: vendor?.legalName || '',
                supplierContactName: vendor?.primaryContact?.name || null,
                supplierEmail: vendor?.primaryContact?.email || null,
                categoryId: currentRfq.categoryId,
                categoryName: currentRfq.categoryName,
                items: currentRfq.items.map(item => ({...item})), // Copy items from RFQ
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now()
            };
            
            await addDoc(collection(db, `organisations/${organisation.domain}/modules/PR/quotes`), newQuoteData);
            setIsAddSupplierOpen(false);
            setSelectedVendorId('');
            alert("Supplier added to bid list.");
        } catch (e: any) {
            console.error(e);
            alert("Failed to add supplier: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTION: FETCH PR ITEMS FOR LINKING ---
    const fetchLinkableItems = async () => {
        setIsLoadingItems(true);
        try {
            const prRef = collection(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions`);
            // Only fetch PRs in 'CREATED' status as per requirements
            const q = query(prRef, where('status', '==', 'CREATED'));
            const snap = await getDocs(q);

            // 1. Gather all potential PR items and their material IDs
            const potentialItems: any[] = [];
            const materialIdsToCheck = new Set<string>();

            snap.docs.forEach(doc => {
                const prData = doc.data();
                if (prData.lines) {
                    prData.lines.forEach((line: any, idx: number) => {
                        // Only show unlinked items
                        if (!line.quoteId) { 
                            potentialItems.push({ docId: doc.id, prData, line, idx });
                            if (line.materialId) materialIdsToCheck.add(line.materialId);
                        }
                    });
                }
            });

            // 2. Batch Fetch Master Data to verify Category match
            const matIds = Array.from(materialIdsToCheck);
            const masterDataMap = new Map();
            const mdRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);

            // Firestore 'in' query limit is 10
            for (let i = 0; i < matIds.length; i += 10) {
                const chunk = matIds.slice(i, i + 10);
                if (chunk.length === 0) continue;
                const mdQ = query(mdRef, where(firebase.firestore.FieldPath.documentId(), 'in', chunk));
                const mdSnap = await getDocs(mdQ);
                mdSnap.forEach(d => masterDataMap.set(d.id, d.data()));
            }

            // 3. Filter items by Category match and construct display list
            const items: PRItemSelection[] = [];
            const targetCategoryId = currentRfq?.categoryId;

            potentialItems.forEach(({ docId, prData, line, idx }) => {
                const master = masterDataMap.get(line.materialId);
                // If material master exists and category matches RFQ category
                if (master && master.procurementCategoryCode === targetCategoryId) {
                    
                    // Logic to retrieve quantity from line or nested policy
                    const qty = line.quantity || (line.policy ? line.policy.requestedQuantity : 0) || 0;
                    const uom = line.uom || (line.policy ? line.policy.uom : '') || 'Unit';

                    items.push({
                        prId: docId,
                        prNumber: prData.prNumber || '',
                        lineIndex: idx,
                        materialId: line.materialId || '',
                        materialCode: line.materialCode || '',
                        materialName: line.description || (master.procurementComponentName || ''), 
                        quantity: qty,
                        description: line.description || (master.procurementComponentName || ''),
                        uom: uom,
                        isSelected: false
                    });
                }
            });

            setAvailablePRItems(items);
        } catch (e) { 
            console.error("Error fetching linkable items:", e); 
        } finally { 
            setIsLoadingItems(false); 
        }
    };

    const handleLinkItems = async () => {
        if (!currentRfq) return;
        const selected = availablePRItems.filter(i => i.isSelected);
        if (selected.length === 0) return;

        setLoading(true);
        try {
            const newItems = selected.map(item => ({
                 prId: item.prId || '',
                 prNumber: item.prNumber || '',
                 lineId: String(item.lineIndex),
                 materialId: item.materialId || '',
                 materialCode: item.materialCode || '',
                 materialName: item.materialName || item.description,
                 quantity: item.quantity || 0,
                 uom: item.uom || 'Unit'
            }));

            // Update RFQ
            const rfqRef = doc(db, `organisations/${organisation.domain}/modules/PR/rfqs/${currentRfq.id}`);
            await updateDoc(rfqRef, {
                items: [...currentRfq.items, ...newItems]
            });
            
            // Note: In a real flow, you might also update the status of the PR lines here to indicate they are "RFQ Process"
            // For now, we update the RFQ container.
            
            setCurrentRfq(prev => prev ? { ...prev, items: [...prev.items, ...newItems] } : null);
            setAvailablePRItems(prev => prev.filter(i => !i.isSelected));

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // --- ACTION: OPEN RESPONSE FORM ---
    const handleOpenResponse = (quote: ProcurementQuote) => {
        setActiveQuote(quote);
        setActiveQuoteId(quote.id);
        
        // Init form
        setValidationRfqId('');
        // FIX: Added missing paymentTerms and incoterm properties to the initial responseForm state.
        setResponseForm({
             referenceNumber: quote.supplierResponse?.referenceNumber || '',
             quoteDate: quote.supplierResponse?.quoteDate || new Date().toISOString().split('T')[0],
             validUntil: quote.validUntil || '',
             taxPercentage: quote.supplierResponse?.taxPercentage || 0,
             overallDiscount: quote.supplierResponse?.overallDiscount || 0,
             paymentTerms: quote.supplierResponse?.paymentTerms || '',
             incoterm: quote.supplierResponse?.incoterm || '',
             currency: 'USD' // Should fetch vendor currency ideally
        });
        setItemsResponse(quote.items.map(i => ({
            ...i,
            quotedUnitPrice: i.quotedUnitPrice || 0,
            quotedDiscount: i.quotedDiscount || 0,
            leadTimeValue: i.leadTimeValue || 0,
            // FIX: Changed leadTimeUnit to leadTimeUnits to match the interface definition and resolve TypeScript error.
            leadTimeUnits: i.leadTimeUnits || 'Days'
        })));
        
        setIsResponseMode(true);
    };

    const handleSubmitResponse = async () => {
        if (!activeQuote || !currentRfq) return;
        
        // VALIDATION CHECK
        if (validationRfqId.trim() !== currentRfq.rfqNumber) {
            alert(`Validation Failed: The entered RFQ ID "${validationRfqId}" does not match this RFQ "${currentRfq.rfqNumber}". Please verify the supplier document.`);
            return;
        }

        setLoading(true);
        try {
             let attachmentUrl = activeQuote.supplierResponse?.attachmentUrl;
             if (responseFile) {
                const storagePath = `organisations/${organisation.domain}/modules/PR/quotes/${activeQuote.id}/${responseFile.name}`;
                const fileRef = storageRef(storage, storagePath);
                const snapshot = await uploadBytes(fileRef, responseFile);
                attachmentUrl = await getDownloadURL(snapshot.ref);
             }

             const updatedItems = activeQuote.items.map((item, idx) => {
                 const res = itemsResponse[idx];
                 const unitPrice = Number(res.quotedUnitPrice) || 0;
                 const discount = (unitPrice * item.quantity) * ((Number(res.quotedDiscount)||0) / 100);
                 const total = (unitPrice * item.quantity) - discount;
                 
                 return {
                     ...item,
                     quotedUnitPrice: unitPrice,
                     quotedDiscount: res.quotedDiscount,
                     quotedTotalPrice: total,
                     leadTimeValue: res.leadTimeValue,
                     // FIX: Changed leadTimeUnit to leadTimeUnits to align with the type definition and prevent property access errors.
                     leadTimeUnits: res.leadTimeUnits
                 };
             });
             
             const totalValue = updatedItems.reduce((acc, i) => acc + (i.quotedTotalPrice || 0), 0);

             await updateDoc(doc(db, `organisations/${organisation.domain}/modules/PR/quotes/${activeQuote.id}`), {
                 status: 'RECEIVED',
                 supplierResponse: {
                     ...responseForm,
                     receivedAt: Timestamp.now(),
                     attachmentUrl: attachmentUrl || null
                 },
                 validUntil: responseForm.validUntil || null,
                 items: updatedItems,
                 totalValue
             });

             alert("Response saved.");
             setIsResponseMode(false);
             setActiveQuote(null);
        } catch (e: any) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={isResponseMode ? `Enter Response: ${activeQuote?.supplierName}` : (isEditingRfq ? `Manage RFQ: ${currentRfq?.rfqNumber}` : "Create Request for Quotation")} size="7xl">
            {isResponseMode ? (
                // --- RESPONSE ENTRY MODE ---
                <div className="space-y-6">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 font-medium">
                        <label className="block mb-2">Security Check: Confirm RFQ Number from Vendor Document</label>
                        <Input 
                            id="valRfqId" 
                            value={validationRfqId} 
                            onChange={e => setValidationRfqId(e.target.value)} 
                            placeholder={`Enter ${currentRfq?.rfqNumber || 'RFQ Number'}`} 
                            className="max-w-xs border-yellow-400 focus:border-yellow-600"
                            label=""
                        />
                        <p className="text-xs mt-1">You must input the ID exactly to prove validation.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input id="respRef" label="Supplier Quote Ref" value={responseForm.referenceNumber} onChange={e => setResponseForm({...responseForm, referenceNumber: e.target.value})} />
                        <Input id="respDate" label="Quote Date" type="date" value={responseForm.quoteDate} onChange={e => setResponseForm({...responseForm, quoteDate: e.target.value})} />
                        <Input id="respValid" label="Valid Until" type="date" value={responseForm.validUntil} onChange={e => setResponseForm({...responseForm, validUntil: e.target.value})} />
                        
                        {/* FIX: Added Payment Terms and Incoterm selection inputs to the response entry form. */}
                        <Input as="select" id="respPaymentTerms" label="Payment Terms" value={responseForm.paymentTerms || ''} onChange={e => setResponseForm({...responseForm, paymentTerms: e.target.value})}>
                            <option value="">Select...</option>
                            {['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', '90 Days', '50% Advance', '100% Advance', 'COD'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Input>
                        
                        <Input as="select" id="respIncoterm" label="Incoterm" value={responseForm.incoterm || ''} onChange={e => setResponseForm({...responseForm, incoterm: e.target.value})}>
                            <option value="">Select...</option>
                            {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Input>

                        <Input id="respDisc" label="Global Discount %" type="number" value={responseForm.overallDiscount} onChange={e => setResponseForm({...responseForm, overallDiscount: Number(e.target.value)})} />
                        
                        <div className="col-span-3">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Upload Quote Document</label>
                             <input type="file" onChange={e => setResponseFile(e.target.files?.[0] || null)} className="text-sm text-slate-500"/>
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                         <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-left">Item</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-right w-32">Unit Price</th>
                                    <th className="px-4 py-2 text-right w-24">Disc %</th>
                                    <th className="px-4 py-2 text-right w-24">Lead Time</th>
                                    <th className="px-4 py-2 text-right w-24">Unit</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {itemsResponse.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2">{item.materialName}</td>
                                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                                        <td className="px-4 py-2"><Input id={`up-${idx}`} label="" type="number" value={item.quotedUnitPrice} onChange={e => {
                                            const newI = [...itemsResponse]; newI[idx].quotedUnitPrice = Number(e.target.value); setItemsResponse(newI);
                                        }} containerClassName="!mb-0"/></td>
                                        <td className="px-4 py-2"><Input id={`dc-${idx}`} label="" type="number" value={item.quotedDiscount} onChange={e => {
                                             const newI = [...itemsResponse]; newI[idx].quotedDiscount = Number(e.target.value); setItemsResponse(newI);
                                        }} containerClassName="!mb-0"/></td>
                                        <td className="px-4 py-2"><Input id={`lt-${idx}`} label="" type="number" value={item.leadTimeValue} onChange={e => {
                                             const newI = [...itemsResponse]; newI[idx].leadTimeValue = Number(e.target.value); setItemsResponse(newI);
                                        }} containerClassName="!mb-0"/></td>
                                        <td className="px-4 py-2">
                                            {/* FIX: Changed leadTimeUnit to leadTimeUnits in the selector component. */}
                                            <select value={item.leadTimeUnits} onChange={e => {
                                                 const newI = [...itemsResponse]; newI[idx].leadTimeUnits = e.target.value; setItemsResponse(newI);
                                            }} className="w-full p-2 border rounded">
                                                <option value="Days">Days</option><option value="Weeks">Weeks</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="secondary" onClick={() => setIsResponseMode(false)}>Cancel</Button>
                        <Button onClick={handleSubmitResponse} isLoading={loading}>Save Response</Button>
                    </div>
                </div>
            ) : !isEditingRfq ? (
                // --- CREATE RFQ MODE ---
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Procurement Category</label>
                             <select 
                                className="w-full p-2 border border-slate-300 rounded-md"
                                value={selectedCategoryId} 
                                onChange={e => setSelectedCategoryId(e.target.value)}
                            >
                                <option value="">Select Category...</option>
                                {categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                        </div>
                        <Input type="date" id="validUntil" label="Valid Until" value={validUntilDate} onChange={e => setValidUntilDate(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleCreateRFQ} isLoading={loading} disabled={!selectedCategoryId}>Create RFQ Header</Button>
                    </div>
                </div>
            ) : (
                // --- MANAGE RFQ MODE ---
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">{currentRfq?.rfqNumber}</h3>
                            <p className="text-sm text-slate-500">{currentRfq?.categoryName} • Created by {currentUser.firstName}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{currentRfq?.status}</span>
                    </div>

                    {/* TABS */}
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex space-x-6">
                            <button onClick={() => setActiveTab('details')} className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Quote Details / Items</button>
                            <button onClick={() => setActiveTab('suppliers')} className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'suppliers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Invited Suppliers ({suppliers.length})</button>
                            <button onClick={() => setActiveTab('compare')} className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'compare' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Compare Bids</button>
                        </nav>
                    </div>

                    {activeTab === 'details' && (
                        <div>
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-slate-700">Line Items</h4>
                                <Button onClick={fetchLinkableItems} variant="secondary" isLoading={isLoadingItems} className="!w-auto !py-1 !text-xs">Refresh PR Items</Button>
                            </div>
                            
                            {/* Available PR Items */}
                            {availablePRItems.length > 0 && (
                                <div className="mb-4 border rounded p-2 bg-blue-50">
                                    <p className="text-xs font-bold text-blue-800 mb-2">Available Items from Purchase Requests:</p>
                                    <div className="max-h-40 overflow-y-auto">
                                        <table className="min-w-full text-xs bg-white">
                                            <tbody>
                                                {availablePRItems.map((item, idx) => (
                                                    <tr key={`${item.prId}-${idx}`}>
                                                        <td className="p-1"><input type="checkbox" checked={item.isSelected} onChange={e => { const n = [...availablePRItems]; n[idx].isSelected = e.target.checked; setAvailablePRItems(n); }} /></td>
                                                        <td className="p-1">{item.prNumber}</td>
                                                        <td className="p-1">{item.materialName}</td>
                                                        <td className="p-1 text-right">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Button onClick={handleLinkItems} className="mt-2 !w-auto !py-1 !text-xs">Add Selected</Button>
                                </div>
                            )}

                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Item</th>
                                            <th className="px-4 py-2 text-left">PR Ref</th>
                                            <th className="px-4 py-2 text-right">Qty</th>
                                            <th className="px-4 py-2 text-right">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {currentRfq?.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-2">{item.materialName}<br/><span className="text-xs text-slate-500">{item.materialCode}</span></td>
                                                <td className="px-4 py-2 text-slate-600">{item.prNumber}</td>
                                                <td className="px-4 py-2 text-right">{item.quantity}</td>
                                                <td className="px-4 py-2 text-right">{item.uom}</td>
                                            </tr>
                                        ))}
                                        {currentRfq?.items.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No items added.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'suppliers' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700">Suppliers</h4>
                                <Button onClick={() => setIsAddSupplierOpen(true)} className="!w-auto !py-1.5 !px-3 !text-xs">+ Add Supplier</Button>
                            </div>
                            <div className="space-y-2">
                                {suppliers.map(sup => (
                                    <div key={sup.id} className="p-3 border rounded-md bg-white flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800">{sup.supplierName}</p>
                                            <p className="text-xs text-slate-500">{sup.quoteNumber} • Status: <span className={sup.status === 'RECEIVED' ? 'text-green-600 font-bold' : ''}>{sup.status}</span></p>
                                        </div>
                                        <div className="flex gap-2">
                                            {sup.status !== 'RECEIVED' && <Button onClick={() => handleOpenResponse(sup)} className="!w-auto !py-1 !px-2 !text-xs bg-green-600 hover:bg-green-700">Enter Response</Button>}
                                            {sup.status === 'RECEIVED' && <span className="text-sm font-bold text-slate-700">${(sup.totalValue || 0).toFixed(2)}</span>}
                                        </div>
                                    </div>
                                ))}
                                {suppliers.length === 0 && <p className="text-center text-slate-400 py-4">No suppliers invited yet.</p>}
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'compare' && (
                         <div className="p-8 text-center text-slate-500">Comparison view coming soon...</div>
                    )}
                </div>
            )}
        </Modal>

        {/* Add Supplier Modal */}
        <Modal isOpen={isAddSupplierOpen} onClose={() => setIsAddSupplierOpen(false)} title="Add Supplier to RFQ">
             <div className="space-y-4">
                 <Input as="select" id="selVendor" label="Select Vendor" value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}>
                     <option value="">Select...</option>
                     {vendors.map(v => <option key={v.id} value={v.id}>{v.legalName}</option>)}
                 </Input>
                 <div className="flex justify-end pt-4"><Button onClick={handleAddSupplier} disabled={!selectedVendorId} isLoading={loading}>Add</Button></div>
             </div>
        </Modal>
        </>
    );
};

export default QuoteDetailModal;
