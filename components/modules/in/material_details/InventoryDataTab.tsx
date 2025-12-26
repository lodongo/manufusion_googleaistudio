import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { doc, updateDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import type { MaterialMasterData, InventoryData, UnitOfMeasure } from '../../../../types';
import Button from '../../../Button';
import { FormField, ConfigurationProgress, yesNoOptions } from './Shared';
import { useAuth } from '../../../../context/AuthContext';

const InventoryDataTab: React.FC<{ 
    material: MaterialMasterData; 
    warehouseMaterialPath: string | null;
    onUpdate?: (newData: any) => void; 
}> = ({ material, warehouseMaterialPath, onUpdate }) => {
    const { currentUserProfile } = useAuth();
    const [formData, setFormData] = useState<InventoryData>(material.inventoryData || { 
        stockLevelDetermination: 'Manual',
        safetyStockQty: 0
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [units, setUnits] = useState<UnitOfMeasure[]>([]);

    useEffect(() => {
        const unsub = db.collection('settings/memsSetup/units')
            .where('enabled', '==', true)
            .orderBy('name')
            .onSnapshot(snap => {
                setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() } as UnitOfMeasure)));
            });
        return () => unsub();
    }, []);

    // Sync state with prop changes
    useEffect(() => {
        if (material.inventoryData) {
            setFormData(prev => ({
                ...prev, 
                ...material.inventoryData,
                safetyStockQty: material.inventoryData.safetyStockQty ?? 0
            }));
        }
    }, [material.inventoryData]);

    // Logic: minStockLevel = reorderPointQty + safetyStockQty
    useEffect(() => {
        const rop = Number(formData.reorderPointQty) || 0;
        const safety = Number(formData.safetyStockQty) || 0;
        const calculatedMin = rop + safety;
        
        if (formData.minStockLevel !== calculatedMin) {
            setFormData(prev => ({ ...prev, minStockLevel: calculatedMin }));
        }
    }, [formData.reorderPointQty, formData.safetyStockQty]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const name = e.target.name || e.target.id;
        const { value, type } = e.target;
        
        let finalValue: string | number | null = value;
        if (type === 'number') {
            finalValue = value === '' ? null : Number(value);
        }
        
        if (name === 'inventoryStrategyType') {
             if (value !== 'V1') {
                 setFormData(prev => ({ ...prev, [name]: value as any, stockLevelDetermination: 'Manual' }));
                 return;
             }
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const handleSave = async () => {
        if (!warehouseMaterialPath) {
            setError("Warehouse link not found. Cannot save inventory data.");
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const unitPrice = material.procurementData?.standardPrice || material.inventoryData?.standardPrice || 0;
            
            // Calculate Capital Impact
            const oldMax = material.inventoryData?.maxStockLevel || 0;
            const oldSafety = material.inventoryData?.safetyStockQty || 0;
            const newMax = formData.maxStockLevel || 0;
            const newSafety = formData.safetyStockQty || 0;

            const oldRop = material.inventoryData?.reorderPointQty || 0;
            const newRop = formData.reorderPointQty || 0;

            const oldOq = Math.max(0, oldMax - oldRop);
            const newOq = Math.max(0, newMax - newRop);

            const oldAvgInv = oldSafety + (oldOq / 2);
            const newAvgInv = newSafety + (newOq / 2);

            const capitalImpact = (newAvgInv - oldAvgInv) * unitPrice;

            const parts = warehouseMaterialPath.split('/');
            const orgDomain = parts[1];
            const masterMaterialId = material.id;
            
            const auditRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${masterMaterialId}/configAudit`);
            const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${masterMaterialId}/activityLogs`);

            await db.runTransaction(async (transaction) => {
                const ref = doc(db, warehouseMaterialPath);
                transaction.update(ref, { inventoryData: formData });

                const userFullName = `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`;

                // 1. Log to Capital Audit if parameters changed
                if (oldMax !== newMax || oldSafety !== newSafety || oldRop !== newRop) {
                    const newAuditRef = doc(auditRef);
                    transaction.set(newAuditRef, {
                        date: Timestamp.now(),
                        userName: userFullName,
                        source: 'Manual',
                        capitalImpact: capitalImpact,
                        details: `Manual update: Max ${oldMax}->${newMax}, Safety ${oldSafety}->${newSafety}, ROP ${oldRop}->${newRop}`
                    });
                }

                // 2. Log to General Activity
                const newActivityRef = doc(activityRef);
                transaction.set(newActivityRef, {
                    timestamp: Timestamp.now(),
                    userName: userFullName,
                    tab: 'Inventory',
                    action: 'Inventory Parameters Updated',
                    details: `Updated stocking strategy and levels.`
                });
            });

            if(onUpdate) onUpdate(formData); 
            alert("Inventory data saved and activity logged.");
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const isV1 = formData.inventoryStrategyType === 'V1';
    const isForecastBased = formData.stockLevelDetermination === 'Forecasting and Analytics';

    const mandatoryFields = ['inventoryUom', 'inventoryValuationMethod', 'inventoryStrategyType'];
    if (isV1) {
        mandatoryFields.push('stockLevelDetermination');
    }
    if (formData.stockLevelDetermination === 'Manual') {
        mandatoryFields.push('minStockLevel', 'maxStockLevel', 'reorderPointQty', 'safetyStockQty');
    }
    
    const completedCount = mandatoryFields.filter(f => {
        const val = (formData as any)[f];
        return val !== undefined && val !== '' && val !== null;
    }).length;
    const totalCount = mandatoryFields.length;

    return (
        <div className="p-6 space-y-8">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <ConfigurationProgress 
                    total={totalCount} 
                    completed={completedCount} 
                    label="Inventory Configuration Closure" 
                    color="#2563eb" 
                />
            </div>

            {/* A. Identification */}
            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    A. Identification & Classification
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="inventoryUom" label="Inventory UoM" as="select" value={formData.inventoryUom || ''} onChange={handleChange} required helpId="inventoryUom">
                        <option value="">Select Unit...</option>
                        {units.map(u => (
                            <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                        ))}
                    </FormField>
                     <FormField id="alternateUoms" label="Alternate UoMs" value={formData.alternateUoms || ''} onChange={handleChange} placeholder="e.g. Box=12EA" />
                    <FormField id="inventoryValuationMethod" label="Valuation Method" as="select" value={formData.inventoryValuationMethod || ''} onChange={handleChange} required helpId="inventoryValuationMethod">
                         <option value="">Select...</option><option value="Standard Cost">Standard Cost</option><option value="Moving Avg">Moving Avg</option><option value="FIFO">FIFO</option>
                    </FormField>
                     <FormField id="inventoryAccount" label="Inventory GL Account" value={formData.inventoryAccount || ''} onChange={handleChange} />
                </div>
            </fieldset>

            {/* B. Dimensions & Weight */}
            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">B. Dimensions & Weight</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FormField id="grossWeight" label="Gross Weight (kg)" type="number" value={formData.grossWeight ?? ''} onChange={handleChange} />
                    <FormField id="netWeight" label="Net Weight (kg)" type="number" value={formData.netWeight ?? ''} onChange={handleChange} />
                    <FormField id="volumePerUnit" label="Volume (m³)" type="number" value={formData.volumePerUnit ?? ''} onChange={handleChange} />
                    <div className="flex gap-2">
                         <FormField id="dimensionLength" label="L (cm)" type="number" value={formData.dimensionLength ?? ''} onChange={handleChange} containerClassName="flex-1"/>
                         <FormField id="dimensionWidth" label="W (cm)" type="number" value={formData.dimensionWidth ?? ''} onChange={handleChange} containerClassName="flex-1"/>
                         <FormField id="dimensionHeight" label="H (cm)" type="number" value={formData.dimensionHeight ?? ''} onChange={handleChange} containerClassName="flex-1"/>
                    </div>
                </div>
            </fieldset>

             {/* C. Storage Requirements */}
             <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">C. Storage Requirements & HazMat</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <FormField id="storageTemperatureRange" label="Temp Range" value={formData.storageTemperatureRange || ''} onChange={handleChange} placeholder="e.g. 15-25°C" />
                     <FormField id="storageHumidityRange" label="Humidity Range" value={formData.storageHumidityRange || ''} onChange={handleChange} placeholder="e.g. <60%" />
                     <FormField id="hazardousMaterialFlag" label="Hazardous?" as="select" value={formData.hazardousMaterialFlag || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                     <FormField id="hazardClass" label="Hazard Class" value={formData.hazardClass || ''} onChange={handleChange} disabled={formData.hazardousMaterialFlag !== 'Yes'} />
                     <FormField id="unNumber" label="UN Number" value={formData.unNumber || ''} onChange={handleChange} disabled={formData.hazardousMaterialFlag !== 'Yes'} />
                     <FormField id="msdsRequired" label="MSDS Required?" as="select" value={formData.msdsRequired || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                </div>
                <FormField id="handlingInstructions" label="Handling Instructions" as="textarea" value={formData.handlingInstructions || ''} onChange={handleChange} rows={2} />
            </fieldset>

            {/* D. Tracking & Shelf Life */}
            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">D. Tracking & Shelf Life</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="batchManaged" label="Batch Managed?" as="select" value={formData.batchManaged || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                    <FormField id="serialManaged" label="Serial Managed?" as="select" value={formData.serialManaged || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                    <FormField id="shelfLifeDays" label="Shelf Life (Days)" type="number" value={formData.shelfLifeDays ?? ''} onChange={handleChange} />
                    <FormField id="expirationControlMethod" label="Expiration Control" as="select" value={formData.expirationControlMethod || ''} onChange={handleChange}><option value="">None</option><option value="FIFO">FIFO</option><option value="FEFO">FEFO</option></FormField>
                </div>
            </fieldset>

            {/* E. Warehouse Operations */}
            <fieldset className="space-y-4 pb-6 border-b border-slate-200">
                <legend className="text-lg font-bold text-slate-800 mb-4">E. Warehouse Operations</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField id="putawayStrategy" label="Put-away Strategy" as="select" value={formData.putawayStrategy || ''} onChange={handleChange}>
                        <option value="">Select...</option><option value="Fixed">Fixed</option><option value="Random">Random</option><option value="Family">Family</option>
                    </FormField>
                    <FormField id="pickingStrategy" label="Picking Strategy" as="select" value={formData.pickingStrategy || ''} onChange={handleChange}>
                        <option value="">Select...</option><option value="FIFO">FIFO</option><option value="FEFO">FEFO</option><option value="LIFO">LIFO</option>
                    </FormField>
                     <FormField id="returnableContainerFlag" label="Returnable Container?" as="select" value={formData.returnableContainerFlag || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                     <FormField id="maxStackHeight" label="Max Stack Height" type="number" value={formData.maxStackHeight ?? ''} onChange={handleChange} />
                     <FormField id="cycleCountClass" label="Cycle Count Class" as="select" value={formData.cycleCountClass || ''} onChange={handleChange}><option value="">Select...</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></FormField>
                </div>
            </fieldset>

             {/* F. Stock Strategy */}
             <fieldset className="space-y-4">
                <legend className="text-lg font-bold text-slate-800 mb-4">F. Stocking Strategy & Levels</legend>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <FormField 
                        id="inventoryStrategyType" 
                        label="Inventory Strategy Type" 
                        as="select" 
                        value={formData.inventoryStrategyType || ''} 
                        onChange={handleChange} 
                        required
                        helpId="inventoryStrategyType"
                        className="font-medium text-slate-800 border-blue-300 focus:border-blue-500 focus:ring-blue-200"
                    >
                        <option value="">Select Type...</option>
                        <option value="V1">V1 (Vendor Managed/Critical)</option>
                        <option value="POD">POD (Purchase on Demand)</option>
                        <option value="CULLED">CULLED</option>
                        <option value="OBSOLETE">OBSOLETE</option>
                        <option value="KITTED">KITTED</option>
                        <option value="CONSIGNMENT">CONSIGNMENT</option>
                    </FormField>

                    <FormField 
                        id="stockLevelDetermination" 
                        label="Stock Level Determination" 
                        as="select" 
                        value={formData.stockLevelDetermination || 'Manual'} 
                        onChange={handleChange} 
                        required={isV1}
                        disabled={!isV1}
                        helpId="stockLevelDetermination"
                        className={`font-medium text-slate-800 ${!isV1 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-200'}`}
                    >
                        <option value="Manual">Manual Input</option>
                        <option value="Forecasting and Analytics">Forecasting and Analytics</option>
                    </FormField>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-lg border transition-colors duration-300 ${isForecastBased ? 'bg-gray-100 border-gray-200 opacity-75' : 'bg-indigo-50 border-indigo-100'}`}>
                    <FormField 
                        id="safetyStockQty" label="Safety Stock" type="number" 
                        value={formData.safetyStockQty ?? ''} onChange={handleChange} 
                        helpId="safetyStockQty" 
                        disabled={isForecastBased}
                        required={!isForecastBased && isV1}
                    />
                    <FormField 
                        id="reorderPointQty" label="Reorder Point" type="number" 
                        value={formData.reorderPointQty ?? ''} onChange={handleChange} 
                        helpId="reorderPointQty" disabled={isForecastBased} 
                        required={!isForecastBased && isV1}
                    />
                    <FormField 
                        id="minStockLevel" label="Minimum Quantity" type="number" 
                        value={formData.minStockLevel ?? ''} 
                        helpId="minStockLevel" 
                        disabled={true} 
                        className="bg-slate-100 font-bold text-indigo-700"
                        placeholder="ROP + Safety"
                    />
                    <FormField 
                        id="maxStockLevel" label="Max Stock Level" type="number" 
                        value={formData.maxStockLevel ?? ''} onChange={handleChange} 
                        helpId="maxStockLevel" disabled={isForecastBased} 
                        required={!isForecastBased && isV1}
                    />
                </div>
                <div className="p-3 bg-slate-50 border rounded-md text-xs text-slate-500 italic">
                    Note: Minimum Quantity is auto-derived as <strong>Reorder Point + Safety Stock</strong>.
                </div>
                {isForecastBased && (
                     <p className="text-sm text-purple-600 italic flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                        Stock levels are determined by the Forecasting and Analytics module.
                    </p>
                )}
                {!isV1 && (
                    <p className="text-sm text-slate-500 italic mt-2">
                        Stock level determination is only applicable for V1 inventory strategy type.
                    </p>
                )}
            </fieldset>

            <div className="flex justify-end pt-6 border-t">
                {error && <p className="text-red-600 mr-4 self-center text-sm">{error}</p>}
                <Button onClick={handleSave} isLoading={isSaving} className="!w-auto">Save Changes</Button>
            </div>
        </div>
    );
};

export default InventoryDataTab;