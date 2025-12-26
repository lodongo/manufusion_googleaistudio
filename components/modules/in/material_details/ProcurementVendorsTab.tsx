import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import type { MaterialMasterData, Organisation, TaxRegime, ProcurementListEntry } from '../../../../types';
import type { Vendor } from '../../../../types/pr_types';
import Button from '../../../Button';
import Input from '../../../Input';
import Modal from '../../../common/Modal';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { useAuth } from '../../../../context/AuthContext';

interface ProcurementVendorsTabProps {
    material: MaterialMasterData;
    warehouseMaterialPath: string | null;
    organisation: Organisation;
    currencyConfig: { local: string; base: string; rate: number };
}

// Interface for the link between Material and Vendor
interface MaterialVendorRecord {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    
    // Priority (1 = Primary, 2 = Secondary, etc.)
    priority: number;
    
    // Agreement Switch
    hasAgreement: boolean;
    agreementStatus: 'Active' | 'Inactive' | 'Draft';

    // Agreement / Record Details
    agreementRef?: string;
    price?: number;
    currency?: string;
    leadTimeDays?: number;
    minOrderQty?: number;
    
    // Agreement Validity
    validFrom?: string;
    validTo?: string;
    
    // Terms
    taxRegimeId?: string; 
    taxPercent?: number; 
    discountPercent?: number;
    paymentTerms?: string;
    incoterm?: string;
    returnPolicy?: string;
    notes?: string;
    
    updatedAt: any;
}

const ProcurementVendorsTab: React.FC<ProcurementVendorsTabProps> = ({ material, warehouseMaterialPath, organisation, currencyConfig }) => {
    const { currentUserProfile } = useAuth();
    const [materialVendors, setMaterialVendors] = useState<MaterialVendorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<MaterialVendorRecord | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Vendor Selection State
    const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [loadingVendors, setLoadingVendors] = useState(false);

    // Global Lists State
    const [incotermsList, setIncotermsList] = useState<ProcurementListEntry[]>([]);
    const [paymentTermsList, setPaymentTermsList] = useState<ProcurementListEntry[]>([]);
    const [returnPoliciesList, setReturnPoliciesList] = useState<ProcurementListEntry[]>([]);

    // Tax Regimes
    const [taxRegimes, setTaxRegimes] = useState<TaxRegime[]>([]);

    // Form State
    const initialFormState = {
        vendorId: '',
        priority: 1,
        hasAgreement: false,
        agreementStatus: 'Active',
        agreementRef: '',
        price: 0,
        currency: organisation.currency.code,
        leadTimeDays: material.procurementData?.totalLeadTimeDays || 0,
        minOrderQty: material.procurementData?.minimumOrderQuantity || 1,
        validFrom: new Date().toISOString().split('T')[0],
        validTo: '',
        taxRegimeId: '',
        discountPercent: 0,
        paymentTerms: '',
        incoterm: '',
        returnPolicy: '',
        notes: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // Fetch Global Lists from database
    useEffect(() => {
        const fetchLists = async () => {
            const lists = [
                { type: 'Incoterms', setter: setIncotermsList },
                { type: 'PaymentTerms', setter: setPaymentTermsList },
                { type: 'ReturnPolicies', setter: setReturnPoliciesList }
            ];

            lists.forEach(listInfo => {
                const ref = collection(db, `modules/PR/Lists/${listInfo.type}/Entries`);
                const q = query(ref, orderBy('acronym'));
                onSnapshot(q, (snapshot) => {
                    listInfo.setter(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementListEntry)));
                });
            });
        };
        fetchLists();
    }, []);

    // 1. Fetch Existing AVL Records for this Material at the WAREHOUSE level
    useEffect(() => {
        if (!warehouseMaterialPath) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = collection(db, `${warehouseMaterialPath}/vendors`);
        const q = query(ref, orderBy('priority', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialVendorRecord));
            setMaterialVendors(records);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [warehouseMaterialPath]);

    // 2. Fetch Available Vendors & Tax Regimes
    useEffect(() => {
        if (isModalOpen) {
            const fetchDependencies = async () => {
                try {
                    // Fetch Vendors
                    if (!recordToEdit) {
                        setLoadingVendors(true);
                        const vRef = collection(db, `organisations/${organisation.domain}/modules/PR/vendors`);
                        const q = query(vRef, where('status', 'in', ['Active', 'Approved']));
                        const snap = await getDocs(q);
                        
                        const allVendors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
                        
                        const existingVendorIds = new Set(materialVendors.map(mv => mv.vendorId));
                        const relevantVendors = allVendors.filter(v => {
                            if (existingVendorIds.has(v.id || '')) return false;
                            return true; 
                        });

                        setAvailableVendors(relevantVendors.sort((a,b) => a.legalName.localeCompare(b.legalName)));
                        setLoadingVendors(false);
                    }

                    // Fetch Tax Regimes
                    const trRef = collection(db, `organisations/${organisation.domain}/modules/FI/taxRegimes`);
                    const trQ = query(trRef, where('enabled', '==', true));
                    const trSnap = await getDocs(trQ);
                    setTaxRegimes(trSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaxRegime)));

                } catch (e) {
                    console.error("Error fetching dependencies", e);
                    setLoadingVendors(false);
                }
            };
            fetchDependencies();
        }
    }, [isModalOpen, recordToEdit, materialVendors, organisation.domain]);

    // Handle Form Opening
    const handleOpenModal = (record?: MaterialVendorRecord) => {
        if (!warehouseMaterialPath) {
            alert("Agreements can only be added to materials extended to a warehouse.");
            return;
        }
        if (record) {
            setRecordToEdit(record);
            setFormData({
                vendorId: record.vendorId,
                priority: record.priority,
                hasAgreement: record.hasAgreement || false,
                agreementStatus: record.agreementStatus || 'Active',
                agreementRef: record.agreementRef || '',
                price: record.price || 0,
                currency: record.currency || organisation.currency.code,
                leadTimeDays: record.leadTimeDays || 0,
                minOrderQty: record.minOrderQty || 1,
                validFrom: record.validFrom || '',
                validTo: record.validTo || '',
                taxRegimeId: record.taxRegimeId || '',
                discountPercent: record.discountPercent || 0,
                paymentTerms: record.paymentTerms || '',
                incoterm: record.incoterm || '',
                returnPolicy: record.returnPolicy || '',
                notes: record.notes || ''
            });
        } else {
            setRecordToEdit(null);
            // Suggest next priority
            const nextPriority = materialVendors.length > 0 ? Math.max(...materialVendors.map(m => m.priority)) + 1 : 1;
            setFormData({ ...initialFormState, priority: nextPriority });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.vendorId || !warehouseMaterialPath) {
            alert("Please select a vendor.");
            return;
        }
        
        if (formData.hasAgreement) {
            if (formData.price < 0) {
                alert("Price cannot be negative.");
                return;
            }
            if (!formData.validFrom || !formData.validTo) {
                 alert("Valid From and To dates are required for an agreement.");
                 return;
            }
        }

        setIsSaving(true);
        try {
            const vendor = availableVendors.find(v => v.id === formData.vendorId) 
                           || (recordToEdit ? { legalName: recordToEdit.vendorName, vendorCode: recordToEdit.vendorCode } : null);
            
            const payload = {
                ...formData,
                agreementStatus: formData.hasAgreement ? formData.agreementStatus : 'Inactive',
                vendorName: vendor?.legalName || 'Unknown',
                vendorCode: vendor?.vendorCode || '',
                updatedAt: Timestamp.now()
            };

            const vendorsCollectionRef = collection(db, `${warehouseMaterialPath}/vendors`);
            const userFullName = `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`;
            const orgDomain = warehouseMaterialPath.split('/')[1];
            const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);

            if (recordToEdit) {
                await updateDoc(doc(vendorsCollectionRef, recordToEdit.id), payload);
                await addDoc(activityRef, {
                    timestamp: Timestamp.now(),
                    userName: userFullName,
                    tab: 'Procurement',
                    action: 'Vendor Sourcing Updated',
                    details: `Updated details for ${vendor?.legalName}. Agreement: ${formData.hasAgreement ? 'Active' : 'No'}.`
                });
            } else {
                await addDoc(vendorsCollectionRef, payload);
                await addDoc(activityRef, {
                    timestamp: Timestamp.now(),
                    userName: userFullName,
                    tab: 'Procurement',
                    action: 'Vendor Sourcing Added',
                    details: `Assigned ${vendor?.legalName} as Rank ${formData.priority} source.`
                });
            }
            
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Failed to save vendor record.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm || !warehouseMaterialPath) return;
        try {
            const record = materialVendors.find(v => v.id === deleteConfirm);
            await deleteDoc(doc(db, `${warehouseMaterialPath}/vendors/${deleteConfirm}`));
            
            const orgDomain = warehouseMaterialPath.split('/')[1];
            const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);
            await addDoc(activityRef, {
                timestamp: Timestamp.now(),
                userName: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`,
                tab: 'Procurement',
                action: 'Vendor Sourcing Removed',
                details: `Removed ${record?.vendorName} from sourcing list.`
            });

            setDeleteConfirm(null);
        } catch (e) {
            console.error(e);
            alert("Failed to remove vendor.");
        }
    };

    // Helper: Is Active Agreement?
    const isActiveAgreement = (rec: MaterialVendorRecord) => {
        if (!rec.hasAgreement || rec.agreementStatus !== 'Active') return false;
        if (!rec.validFrom || !rec.validTo) return false;
        
        const now = new Date();
        const start = new Date(rec.validFrom);
        const end = new Date(rec.validTo);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
    };

    const filteredAvailableVendors = useMemo(() => {
        if (!vendorSearch) return availableVendors;
        return availableVendors.filter(v => v.legalName.toLowerCase().includes(vendorSearch.toLowerCase()) || v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase()));
    }, [availableVendors, vendorSearch]);
    
    // Formatting helper
    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || val === null) return '-';
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const symbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    // Derived Selection Objects for descriptive displays
    const selectedIncotermObj = useMemo(() => incotermsList.find(i => i.acronym === formData.incoterm), [incotermsList, formData.incoterm]);
    const selectedPaymentTermObj = useMemo(() => paymentTermsList.find(i => i.acronym === formData.paymentTerms), [paymentTermsList, formData.paymentTerms]);
    const selectedReturnPolicyObj = useMemo(() => returnPoliciesList.find(i => i.acronym === formData.returnPolicy), [returnPoliciesList, formData.returnPolicy]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Approved Vendor List (AVL)</h3>
                    <p className="text-sm text-slate-500">Manage sources and agreements for <strong>{material.materialCode}</strong> at this location.</p>
                </div>
                
                 <div className="flex items-center gap-4">
                     <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex">
                        <button 
                            onClick={() => setViewCurrency('local')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewCurrency === 'local' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {currencyConfig.local}
                        </button>
                        <button 
                            onClick={() => setViewCurrency('base')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewCurrency === 'base' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {currencyConfig.base}
                        </button>
                    </div>

                    <button 
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                        disabled={!warehouseMaterialPath}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Add Vendor
                    </button>
                </div>
            </div>
            
            {!warehouseMaterialPath ? (
                <div className="p-12 text-center text-slate-500 bg-amber-50 rounded-lg border border-dashed border-amber-200">
                    <p className="font-bold text-amber-800">Warehouse Context Missing</p>
                    <p className="text-sm mt-1">Vendor agreements must be managed from a warehouse-specific material view.</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading AVL...</div>
                    ) : materialVendors.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a3.001 3.001 0 015.658 0M12 6a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <p className="font-medium">No vendors assigned.</p>
                            <p className="text-xs mt-1">Add vendors to start tracking sources and agreements.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left w-12">Pri</th>
                                    <th className="px-4 py-3 text-left">Vendor Name</th>
                                    <th className="px-4 py-3 text-left">Agreement</th>
                                    <th className="px-4 py-3 text-right">Price ({symbol})</th>
                                    <th className="px-4 py-3 text-right">Lead Time</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {materialVendors.map(record => {
                                    const isActive = isActiveAgreement(record);
                                    return (
                                        <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${isActive ? 'bg-green-50/50' : ''}`}>
                                            <td className="px-4 py-3 font-bold text-center">
                                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${record.priority === 1 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {record.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{record.vendorName}</div>
                                                <div className="text-xs text-slate-500 font-mono">{record.vendorCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{record.hasAgreement ? record.agreementRef || 'Unspecified' : <span className="text-slate-400 italic">No Agreement</span>}</td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {record.hasAgreement ? formatCurrency(record.price) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">{record.hasAgreement ? `${record.leadTimeDays} days` : '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {isActive ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 uppercase tracking-wide border border-green-200">
                                                        Active
                                                    </span>
                                                ) : record.hasAgreement ? (
                                                     <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wide border border-gray-200">
                                                        {record.agreementStatus === 'Active' ? 'Expired' : record.agreementStatus}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                                {isActive && (
                                                    <div className="text-[10px] text-green-700 mt-1">
                                                        Expires: {new Date(record.validTo!).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleOpenModal(record)} className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded">Edit</button>
                                                    <button onClick={() => setDeleteConfirm(record.id)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">Remove</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={recordToEdit ? "Edit Vendor Details" : "Add Vendor to AVL"} size="5xl">
                <div className="space-y-6">
                    {/* Top Row: Vendor Selection & Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Select Vendor <span className="text-red-500">*</span></label>
                            {recordToEdit ? (
                                <div className="p-2 bg-slate-100 rounded border text-slate-700 font-medium">
                                    {recordToEdit.vendorName} ({recordToEdit.vendorCode})
                                </div>
                            ) : (
                                <>
                                    <Input 
                                        id="vendorSearch" 
                                        label="" 
                                        placeholder="Search available vendors..." 
                                        value={vendorSearch} 
                                        onChange={e => setVendorSearch(e.target.value)} 
                                        containerClassName="mb-2"
                                    />
                                    <select 
                                        className="w-full p-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.vendorId}
                                        onChange={e => setFormData({...formData, vendorId: e.target.value})}
                                    >
                                        <option value="">-- Select Vendor --</option>
                                        {loadingVendors ? <option>Loading...</option> : 
                                            filteredAvailableVendors.length === 0 ? <option disabled>No active vendors found.</option> :
                                            filteredAvailableVendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.legalName} ({v.vendorCode})</option>
                                            ))
                                        }
                                    </select>
                                </>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Priority / Rank</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="1" 
                                    className="w-24 p-2 border rounded-md"
                                    value={formData.priority}
                                    onChange={e => setFormData({...formData, priority: Number(e.target.value)})}
                                />
                                <span className="text-xs text-slate-500">(1 = Preferred Source)</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Agreement Toggle */}
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded border border-slate-200">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.hasAgreement} 
                                onChange={e => setFormData({...formData, hasAgreement: e.target.checked})} 
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm font-bold text-slate-700">Enable Agreement / Contract</span>
                    </div>

                    {/* Agreement Details (Conditional) */}
                    {formData.hasAgreement && (
                        <div className="animate-fade-in space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                     <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        Agreement Details
                                    </h4>
                                    <select 
                                        value={formData.agreementStatus}
                                        onChange={e => setFormData({...formData, agreementStatus: e.target.value as any})}
                                        className="text-xs p-1 border rounded bg-white font-medium"
                                    >
                                        <option value="Active">Status: Active</option>
                                        <option value="Draft">Status: Draft</option>
                                        <option value="Inactive">Status: Inactive</option>
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                     <Input 
                                        id="agreementRef" 
                                        label="Agreement Ref #" 
                                        value={formData.agreementRef} 
                                        onChange={e => setFormData({...formData, agreementRef: e.target.value})} 
                                        placeholder="e.g. CTR-2024-001"
                                     />
                                     <Input 
                                        id="validFrom" 
                                        label="Valid From" 
                                        type="date"
                                        value={formData.validFrom} 
                                        onChange={e => setFormData({...formData, validFrom: e.target.value})} 
                                        required
                                     />
                                     <Input 
                                        id="validTo" 
                                        label="Valid To" 
                                        type="date"
                                        value={formData.validTo} 
                                        onChange={e => setFormData({...formData, validTo: e.target.value})} 
                                        required
                                     />
                                     
                                     <div className="col-span-1 md:col-span-3 h-px bg-slate-200 my-2"></div>
                                     
                                     <div className="relative">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Price <span className="text-red-500">*</span></label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-gray-500 text-sm font-bold">
                                                {formData.currency}
                                            </span>
                                            <input 
                                                type="number" 
                                                min="0"
                                                step="0.01"
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-slate-300 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={formData.price}
                                                onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                                            />
                                        </div>
                                     </div>

                                     <Input 
                                        id="leadTime" 
                                        label="Lead Time (Days)" 
                                        type="number" 
                                        value={formData.leadTimeDays} 
                                        onChange={e => setFormData({...formData, leadTimeDays: Number(e.target.value)})} 
                                     />
                                     
                                     <Input 
                                        id="minOrder" 
                                        label="MOQ" 
                                        type="number" 
                                        value={formData.minOrderQty} 
                                        onChange={e => setFormData({...formData, minOrderQty: Number(e.target.value)})} 
                                     />
                                </div>
                            </div>
                            
                            {/* Financial Terms */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 border-b pb-1">Financial & Return Terms</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tax Regime</label>
                                        <select 
                                            value={formData.taxRegimeId} 
                                            onChange={e => setFormData({...formData, taxRegimeId: e.target.value})}
                                            className="w-full p-2 border rounded-md text-sm bg-white"
                                        >
                                            <option value="">Select Tax Regime...</option>
                                            {taxRegimes.map(tr => (
                                                <option key={tr.id} value={tr.id}>
                                                    {tr.name} ({tr.type === 'Constant' ? `${tr.value}%` : 'Dynamic'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <Input id="disc" label="Discount (%)" type="number" value={formData.discountPercent} onChange={e => setFormData({...formData, discountPercent: Number(e.target.value)})} />
                                    
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                                        <select 
                                            value={formData.paymentTerms} 
                                            onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                                            className="w-full p-2 border rounded-md text-sm bg-white"
                                        >
                                            <option value="">Select...</option>
                                            {paymentTermsList.map(opt => <option key={opt.id} value={opt.acronym}>{opt.acronym} - {opt.fullAcronym}</option>)}
                                        </select>
                                        {selectedPaymentTermObj && (
                                            <div className="p-2 bg-slate-50 border rounded text-[10px] text-slate-600 mt-1">
                                                <p className="font-bold text-slate-700">{selectedPaymentTermObj.fullAcronym}</p>
                                                <p className="mt-0.5">{selectedPaymentTermObj.description}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Incoterm</label>
                                        <select 
                                            value={formData.incoterm} 
                                            onChange={e => setFormData({...formData, incoterm: e.target.value})}
                                            className="w-full p-2 border rounded-md text-sm bg-white"
                                        >
                                            <option value="">Select...</option>
                                            {incotermsList.map(opt => <option key={opt.id} value={opt.acronym}>{opt.acronym} - {opt.fullAcronym}</option>)}
                                        </select>
                                        {selectedIncotermObj && (
                                            <div className="p-2 bg-slate-50 border rounded text-[10px] text-slate-600 mt-1">
                                                <p className="font-bold text-slate-700">{selectedIncotermObj.fullAcronym}</p>
                                                <p className="mt-0.5">{selectedIncotermObj.description}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 md:col-span-4 space-y-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Return Policy</label>
                                        <select 
                                            value={formData.returnPolicy} 
                                            onChange={e => setFormData({...formData, returnPolicy: e.target.value})}
                                            className="w-full p-2 border rounded-md text-sm bg-white"
                                        >
                                            <option value="">Select...</option>
                                            {returnPoliciesList.map(opt => <option key={opt.id} value={opt.acronym}>{opt.acronym} - {opt.fullAcronym}</option>)}
                                        </select>
                                        {selectedReturnPolicyObj && (
                                            <div className="p-2 bg-slate-50 border rounded text-[10px] text-slate-600 mt-1">
                                                <p className="font-bold text-slate-700">{selectedReturnPolicyObj.fullAcronym}</p>
                                                <p className="mt-0.5">{selectedReturnPolicyObj.description}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2 md:col-span-4">
                                        <Input as="textarea" id="notes" label="Internal Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t gap-2">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} isLoading={isSaving}>Save Record</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleDelete}
                title="Remove Vendor"
                message="Are you sure you want to remove this vendor from the approved list for this material?"
                confirmButtonText="Remove"
            />
        </div>
    );
};

export default ProcurementVendorsTab;