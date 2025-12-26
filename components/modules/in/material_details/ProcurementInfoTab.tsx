import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import type { MaterialMasterData, ProcurementData, Organisation, ProcurementListEntry } from '../../../../types';
import Button from '../../../Button';
import { FormField, ConfigurationProgress, yesNoOptions } from './Shared';
import { useAuth } from '../../../../context/AuthContext';

const ProcurementInfoTab: React.FC<{ 
    material: MaterialMasterData; 
    warehouseMaterialPath: string | null; 
    onUpdate?: (data: ProcurementData) => void;
    organisation: Organisation; 
}> = ({ material, warehouseMaterialPath, onUpdate, organisation }) => {
    const { currentUserProfile } = useAuth();
    const [formData, setFormData] = useState<ProcurementData>(material.procurementData || {});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeAgreement, setActiveAgreement] = useState<{vendorName: string, leadTimeDays: number, price: number} | null>(null);
    const [incotermsList, setIncotermsList] = useState<ProcurementListEntry[]>([]);

    // Fetch Incoterms from database
    useEffect(() => {
        const ref = collection(db, 'modules/PR/Lists/Incoterms/Entries');
        const q = query(ref, orderBy('acronym'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setIncotermsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementListEntry)));
        });
        return () => unsubscribe();
    }, []);

    // Fetch Active Vendor Agreement from the WAREHOUSE level
    useEffect(() => {
        if (!warehouseMaterialPath) return;

        const ref = collection(db, `${warehouseMaterialPath}/vendors`);
        const q = query(ref, orderBy('priority', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => doc.data());
            
            const agreementRecord = records.find((v: any) => {
                if (!v.hasAgreement || v.agreementStatus !== 'Active') return false;
                if (!v.validFrom || !v.validTo) return false;
                
                const now = new Date();
                const start = new Date(v.validFrom);
                const end = new Date(v.validTo);
                end.setHours(23, 59, 59, 999);
                
                return now >= start && now <= end;
            });

            const preferredRecord = records.find((v: any) => v.priority === 1);

            if (agreementRecord) {
                setActiveAgreement({
                    vendorName: agreementRecord.vendorName,
                    leadTimeDays: agreementRecord.leadTimeDays || 0,
                    price: agreementRecord.price || 0
                });
                
                setFormData(prev => ({
                    ...prev,
                    preferredVendorId: agreementRecord.vendorId,
                    preferredVendorName: agreementRecord.vendorName,
                    contractReference: agreementRecord.agreementRef,
                    standardPrice: agreementRecord.price,
                    plannedDeliveryDays: agreementRecord.leadTimeDays,
                    currency: agreementRecord.currency
                }));
            } else if (preferredRecord) {
                setActiveAgreement(null);
                setFormData(prev => ({
                    ...prev,
                    preferredVendorId: preferredRecord.vendorId,
                    preferredVendorName: preferredRecord.vendorName,
                    contractReference: preferredRecord.agreementRef || '',
                    standardPrice: preferredRecord.price || prev.standardPrice,
                    plannedDeliveryDays: preferredRecord.leadTimeDays || prev.plannedDeliveryDays,
                    currency: preferredRecord.currency || prev.currency
                }));
            } else {
                setActiveAgreement(null);
            }
        });
        
        return () => unsubscribe();
    }, [warehouseMaterialPath]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const name = e.target.name || e.target.id; 
        const { value, type } = e.target;
        
        let finalValue: string | number | null = value;
        if (type === 'number') {
            finalValue = value === '' ? null : Number(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const handleSave = async () => {
        if (!warehouseMaterialPath) {
            setError("Warehouse link not found. Cannot save procurement data.");
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const total = (Number(formData.purchasingProcessingDays) || 0) + 
                          (Number(formData.plannedDeliveryDays) || 0) + 
                          (Number(formData.grProcessingDays) || 0);
            
            const updatedData = { ...formData, totalLeadTimeDays: total };
            
            // 1. Update document
            // FIX: Cast db to any to avoid type issues with modular doc() function and compat db instance.
            const ref = doc(db as any, warehouseMaterialPath);
            await updateDoc(ref, { procurementData: updatedData });
            setFormData(updatedData);

            // 2. Log Activity
            const orgDomain = warehouseMaterialPath.split('/')[1];
            const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);
            await addDoc(activityRef, {
                timestamp: Timestamp.now(),
                userName: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`,
                tab: 'Procurement',
                action: 'Procurement Info Updated',
                details: `Standard price set to ${formData.standardPrice}, Total Lead Time: ${total} days.`
            });
            
            if (onUpdate) onUpdate(updatedData);
            
            alert("Procurement data saved and activity logged.");
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedIncoterm = useMemo(() => {
        return incotermsList.find(i => i.acronym === formData.incoterms);
    }, [incotermsList, formData.incoterms]);

    const mandatoryFields = ['procurementType', 'standardPrice', 'orderUnit', 'purchasingProcessingDays', 'plannedDeliveryDays', 'grProcessingDays'];
    const completedCount = mandatoryFields.filter(f => {
        const val = (formData as any)[f];
        return val !== undefined && val !== '' && val !== null;
    }).length;
    const totalCount = mandatoryFields.length;

    return (
        <div className="p-6 space-y-8">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                <ConfigurationProgress 
                    total={totalCount} 
                    completed={completedCount} 
                    label="Procurement Configuration Closure" 
                    color="#059669" 
                />
            </div>

            {activeAgreement && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm text-blue-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span>
                        <strong>Active Agreement Found:</strong> {activeAgreement.vendorName}. 
                        Price and Delivery times are locked to the agreement terms.
                    </span>
                </div>
            )}

            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">A. Sourcing & Pricing</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="procurementType" label="Procurement Type" as="select" value={formData.procurementType || ''} onChange={handleChange} helpId="procurementType" required>
                        <option value="">Select...</option><option value="Stock">Stock</option><option value="Consignment">Consignment</option><option value="Make-to-Order">Make-to-Order</option><option value="Subcontracting">Subcontracting</option>
                    </FormField>
                     <FormField id="sourcingStrategy" label="Sourcing Strategy" as="select" value={formData.sourcingStrategy || ''} onChange={handleChange}>
                        <option value="">Select...</option><option value="Single Source">Single Source</option><option value="Dual Source">Dual Source</option><option value="Multiple Source">Multiple Source</option>
                    </FormField>
                     
                     <div className="relative">
                        <FormField 
                            id="standardPrice" 
                            label="Standard Price" 
                            type="number" 
                            value={formData.standardPrice ?? ''} 
                            onChange={handleChange} 
                            helpId="standardPrice" 
                            required 
                            disabled={!!activeAgreement}
                            className={!!activeAgreement ? "bg-slate-100" : ""}
                        />
                        {activeAgreement && <span className="absolute top-0 right-0 text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">Locked</span>}
                     </div>

                     <FormField id="priceUnit" label="Price Unit" type="number" value={formData.priceUnit ?? ''} onChange={handleChange} helpId="priceUnit" />
                     <FormField id="priceControl" label="Price Control" as="select" value={formData.priceControl || ''} onChange={handleChange}>
                        <option value="">Select...</option><option value="Based on PO">Based on PO</option><option value="Based on Contract">Based on Contract</option>
                     </FormField>
                </div>
            </fieldset>

             <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">B. Order Modifiers</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="orderUnit" label="Order Unit" value={formData.orderUnit || ''} onChange={handleChange} helpId="orderUnit" required />
                    <FormField id="minimumOrderQuantity" label="Min Order Qty" type="number" value={formData.minimumOrderQuantity ?? ''} onChange={handleChange} helpId="minimumOrderQuantity" />
                    <FormField id="orderUnitConversion" label="Order Unit Conversion" value={formData.orderUnitConversion || ''} onChange={handleChange} placeholder="1 Box = 10 Each" />
                    <FormField id="roundingProfile" label="Rounding Profile" type="number" value={formData.roundingProfile ?? ''} onChange={handleChange} />
                    <FormField id="orderingCost" label="Ordering Cost" type="number" value={formData.orderingCost ?? ''} onChange={handleChange} />
                </div>
            </fieldset>

            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">C. Planning & Control</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="buyerPlannerName" label="Buyer/Planner" value={formData.buyerPlannerName || ''} onChange={handleChange} />
                    <FormField id="sourceListMaintained" label="Source List?" as="select" value={formData.sourceListMaintained || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                    <FormField id="quotaArrangement" label="Quota Arrangement" value={formData.quotaArrangement || ''} onChange={handleChange} />
                </div>
            </fieldset>

            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">D. Logistics & Compliance</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="countryOfOrigin" label="Country of Origin" value={formData.countryOfOrigin || ''} onChange={handleChange} maxLength={2} placeholder="ISO2" />
                    <FormField id="customsTariffNumber" label="HS Code" value={formData.customsTariffNumber || ''} onChange={handleChange} />
                    <div className="space-y-1">
                        <FormField id="incoterms" label="Incoterms" as="select" value={formData.incoterms || ''} onChange={handleChange}>
                            <option value="">Select...</option>
                            {incotermsList.map(item => (
                                <option key={item.id} value={item.acronym}>{item.acronym} - {item.fullAcronym}</option>
                            ))}
                        </FormField>
                        {selectedIncoterm && (
                            <div className="p-2 bg-slate-50 border rounded text-xs text-slate-600 mt-1">
                                <p className="font-bold text-slate-700">{selectedIncoterm.fullAcronym}</p>
                                <p className="mt-0.5">{selectedIncoterm.description}</p>
                            </div>
                        )}
                    </div>
                </div>
            </fieldset>

            <fieldset className="space-y-4">
                <legend className="text-lg font-bold text-slate-800 mb-4">E. Lead Times & Scheduling</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-indigo-50 p-6 rounded-lg border border-indigo-100 shadow-sm">
                    <FormField id="purchasingProcessingDays" label="Purchasing Proc. Time (Days)" type="number" value={formData.purchasingProcessingDays ?? ''} onChange={handleChange} helpId="purchasingProcessingDays" required />
                    
                    <div className="relative">
                        <FormField 
                            id="plannedDeliveryDays" 
                            label="Vendor Delivery Time (Days)" 
                            type="number" 
                            value={formData.plannedDeliveryDays ?? ''} 
                            onChange={handleChange} 
                            helpId="plannedDeliveryDays" 
                            required 
                            disabled={!!activeAgreement}
                            className={!!activeAgreement ? "bg-slate-100" : ""}
                        />
                         {activeAgreement && <span className="absolute top-0 right-0 text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">Locked by Agreement</span>}
                    </div>

                    <FormField id="grProcessingDays" label="GR Processing Time (Days)" type="number" value={formData.grProcessingDays ?? ''} onChange={handleChange} helpId="grProcessingDays" required />
                    
                    <div className="flex flex-col justify-center pl-6 border-l border-indigo-200">
                        <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Total Lead Time</label>
                        <span className="text-3xl font-extrabold text-indigo-900">
                            {(Number(formData.purchasingProcessingDays)||0) + (Number(formData.plannedDeliveryDays)||0) + (Number(formData.grProcessingDays)||0)} <span className="text-base font-normal">days</span>
                        </span>
                    </div>
                </div>
            </fieldset>

            <div className="flex justify-end pt-4">
                {error && <p className="text-red-600 mr-4 self-center text-sm">{error}</p>}
                <Button onClick={handleSave} isLoading={isSaving} className="!w-auto">Save Procurement Data</Button>
            </div>
        </div>
    );
};

export default ProcurementInfoTab;