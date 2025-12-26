
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { MaterialMasterData, Organisation, InventoryData, ProcurementData } from '../../../../types';
import { MaterialMovement } from '../../../../types/in_types';
import Button from '../../../Button';
import { FormField, ConfigurationProgress, CriticalitySettings, defaultSettings, yesNoOptions } from './Shared';
import { collectionGroup, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';

const CriticalityAnalysisTab: React.FC<{ material: MaterialMasterData; warehouseMaterialPath: string | null; organisation: Organisation }> = ({ material, warehouseMaterialPath, organisation }) => {
    const [data, setData] = useState<InventoryData>(material.inventoryData || {});
    const [procData, setProcData] = useState<ProcurementData>(material.procurementData || {});
    
    const [settings, setSettings] = useState<CriticalitySettings>(defaultSettings);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [calculatedParams, setCalculatedParams] = useState<{ min: number, max: number, rop: number, safety: number, safetyFactor: string, targetDays: number } | null>(null);
    const [missingLeadTime, setMissingLeadTime] = useState(false);
    const [totalLeadTime, setTotalLeadTime] = useState(0);

    // Analytics State
    const [movements, setMovements] = useState<MaterialMovement[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);

    // Fetch Settings
    useEffect(() => {
        const settingsRef = db.doc(`organisations/${organisation.domain}/modules/IN/settings/criticality`);
        settingsRef.get().then(snap => {
            if (snap.exists) {
                setSettings(snap.data() as CriticalitySettings);
            }
            setLoadingSettings(false);
        });
    }, [organisation.domain]);

    // Fetch Movements for Analytics (to calculate Avg & CV)
    useEffect(() => {
        const constraints = [
             where('materialId', '==', material.id),
             where('type', '==', 'ISSUE'), // Only consider issues (consumption)
             orderBy('date', 'desc'),
             limit(200)
        ];

        // Ensure warehouse specific data if available
        if (warehouseMaterialPath) {
             const parts = warehouseMaterialPath.split('/');
             // warehouseMaterialPath is .../materials/{docId}. Warehouse path is parent of parent.
             const warehousePath = parts.slice(0, -2).join('/');
             constraints.push(where('warehousePath', '==', warehousePath));
        }

        const movementsRef = collectionGroup(db, 'materialMovements');
        const q = query(movementsRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialMovement));
            setMovements(fetchedMovements);
            setLoadingAnalytics(false);
        }, (err) => {
            console.error("Error fetching movements for analysis:", err);
            setLoadingAnalytics(false);
        });

        return () => unsubscribe();
    }, [material.id, warehouseMaterialPath]);

    // Calculate Consumption Stats
    const consumptionStats = useMemo(() => {
        const monthly: Record<string, number> = {};
        const now = new Date();
        // Look back 12 months
        for(let i=11; i>=0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthly[key] = 0;
        }

        movements.forEach(m => {
            const date = m.date.toDate();
            // Only consider movements within the last 12 months for calculation
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays <= 365) {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthly[key] !== undefined) {
                    monthly[key] += m.quantity;
                }
            }
        });

        const values = Object.values(monthly);
        const count = values.length; // Should be 12
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / count;

        if (mean === 0) return { mean: 0, cv: 0 };

        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean;

        return { mean, cv };
    }, [movements]);

    // Update local procData if props change
    useEffect(() => {
        if (material.procurementData) {
            setProcData(material.procurementData);
        }
    }, [material.procurementData]);

    useEffect(() => {
        if (loadingSettings) return;
        
        const score =
            (settings.riskHSEPoints[(data.criticalityRiskHSE || 1) - 1] || 0) +
            (settings.impactProductionPoints[(data.criticalityProductionImpact || 1) - 1] || 0) +
            (settings.impactQualityPoints[(data.criticalityImpactQuality || 1) - 1] || 0) +
            (data.criticalityStandbyAvailable === 'No' ? settings.standbyPoints.no : settings.standbyPoints.yes) +
            (settings.failureFrequencyPoints[(data.criticalityFailureFrequency || 1) - 1] || 0) +
            (settings.repairTimePoints[(data.criticalityRepairTime || 1) - 1] || 0);

        let classification: 'A'|'B'|'C'|'D' = 'D';
        if (score >= settings.cutoffs.classA) classification = 'A';
        else if (score >= settings.cutoffs.classB) classification = 'B';
        else if (score >= settings.cutoffs.classC) classification = 'C';

        if (score !== data.criticalityScore || classification !== data.criticalityClass) {
             setData(prev => ({ ...prev, criticalityScore: score, criticalityClass: classification }));
        }
    }, [data.criticalityRiskHSE, data.criticalityProductionImpact, data.criticalityImpactQuality, data.criticalityStandbyAvailable, data.criticalityFailureFrequency, data.criticalityRepairTime, settings, loadingSettings]);

    // Calculation Effect for Inventory Parameters
    useEffect(() => {
        // Calculate Total Lead Time from Procurement Data
        const pDays = (Number(procData.purchasingProcessingDays) || 0) + 
                      (Number(procData.plannedDeliveryDays) || 0) + 
                      (Number(procData.grProcessingDays) || 0);
        
        setTotalLeadTime(pDays);

        if (!data.criticalityClass || !data.annualUsageQuantity || data.annualUsageQuantity <= 0) {
            setCalculatedParams(null);
            // Only check missing lead time if we actually have usage to calculate with
            if (data.annualUsageQuantity && data.annualUsageQuantity > 0 && pDays <= 0) {
                setMissingLeadTime(true);
            } else {
                setMissingLeadTime(false);
            }
            return;
        }

        if (pDays <= 0) {
            setCalculatedParams(null);
            setMissingLeadTime(true);
            return;
        }
        setMissingLeadTime(false);

        const annualUsage = Number(data.annualUsageQuantity);
        const dailyUsage = annualUsage / 365;
        const leadTimeDemand = dailyUsage * pDays;
        
        let baseSafetyFactor = 0;
        let targetDays = 14;

        // Determine Base factors based on Criticality Class
        switch (data.criticalityClass) {
            case 'A': 
                baseSafetyFactor = 0.75; // 75%
                targetDays = 90;
                break;
            case 'B':
                baseSafetyFactor = 0.50; // 50%
                targetDays = 60;
                break;
            case 'C':
                baseSafetyFactor = 0.25; // 25%
                targetDays = 30;
                break;
            case 'D':
            default:
                baseSafetyFactor = 0.10; // 10%
                targetDays = 14;
                break;
        }

        // Apply Demand Variability (CV) to Safety Factor
        // Logic: If demand is highly variable (CV is high), we need more safety stock.
        // Total Factor = Base (from Class) + CV (from History)
        const variabilityFactor = consumptionStats.cv;
        const totalSafetyFactor = baseSafetyFactor + variabilityFactor;

        // Apply user override for target supply days if set
        if (data.targetDaysSupply && data.targetDaysSupply > 0) {
            targetDays = data.targetDaysSupply;
        }

        const safetyStock = Math.ceil(leadTimeDemand * totalSafetyFactor);
        const reorderPoint = Math.ceil(leadTimeDemand + safetyStock);
        const maxStock = Math.ceil(reorderPoint + (dailyUsage * targetDays));
        const minStock = safetyStock; // Basic definition: Min = Safety Stock

        setCalculatedParams({
            min: minStock,
            max: maxStock,
            rop: reorderPoint,
            safety: safetyStock,
            safetyFactor: `${(baseSafetyFactor * 100).toFixed(0)}% (Class) + ${(variabilityFactor * 100).toFixed(0)}% (Var)`,
            targetDays
        });

    }, [data.criticalityClass, data.annualUsageQuantity, data.targetDaysSupply, procData, consumptionStats.cv]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
         const name = e.target.name || e.target.id;
         const { value, type } = e.target;
         
         let finalValue: string | number = value;
         if (type === 'number') {
             finalValue = Number(value);
         }

         setData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleAutoFillUsage = () => {
        const annualCalc = Math.round(consumptionStats.mean * 12);
        if (annualCalc > 0) {
            setData(prev => ({ ...prev, annualUsageQuantity: annualCalc }));
        } else {
            alert("Insufficient history to calculate annual usage.");
        }
    };

    const handleApplyCalculations = () => {
        if (!calculatedParams) return;
        setData(prev => ({
            ...prev,
            minStockLevel: calculatedParams.min,
            maxStockLevel: calculatedParams.max,
            reorderPointQty: calculatedParams.rop,
            safetyStockQty: calculatedParams.safety
        }));
    };

    const handleSave = async () => {
         if (!warehouseMaterialPath) {
             alert("Missing warehouse context. Cannot save.");
             return;
         }
         setIsSaving(true);
         try {
             const ref = db.doc(warehouseMaterialPath);
             // Ensure we update the stock level determination method to 'Criticality'
             await ref.update({ 
                 inventoryData: {
                     ...data,
                     stockLevelDetermination: 'Criticality'
                 } 
             });
             alert(`Analysis Saved. Class: ${data.criticalityClass}. Levels Updated.`);
         } catch (err) {
             console.error(err);
             alert("Failed to save.");
         } finally {
             setIsSaving(false);
         }
    };

    if (loadingSettings) return <div className="p-6 text-center">Loading settings...</div>;
    
    const mandatoryFields = ['criticalityRiskHSE', 'criticalityProductionImpact', 'criticalityImpactQuality', 'criticalityStandbyAvailable', 'criticalityFailureFrequency', 'criticalityRepairTime'];
    const completedCount = mandatoryFields.filter(f => (data as any)[f] !== undefined && (data as any)[f] !== '').length;
    const totalCount = mandatoryFields.length;
    
    return (
        <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                <ConfigurationProgress 
                    total={totalCount} 
                    completed={completedCount} 
                    label="Criticality Analysis Closure" 
                    color="#d97706" 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700">Impact Assessment (1-5)</h4>
                    <FormField id="criticalityRiskHSE" label="HSE Risk" as="select" value={data.criticalityRiskHSE || ''} onChange={handleChange}>
                        {[1,2,3,4,5].map(i => <option key={i} value={i}>{i}</option>)}
                    </FormField>
                    <FormField id="criticalityProductionImpact" label="Production Impact" as="select" value={data.criticalityProductionImpact || ''} onChange={handleChange}>
                        {[1,2,3,4,5].map(i => <option key={i} value={i}>{i}</option>)}
                    </FormField>
                    <FormField id="criticalityImpactQuality" label="Quality Impact" as="select" value={data.criticalityImpactQuality || ''} onChange={handleChange}>
                        {[1,2,3,4,5].map(i => <option key={i} value={i}>{i}</option>)}
                    </FormField>
                </div>
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700">Supply & Operations</h4>
                    <FormField id="criticalityStandbyAvailable" label="Standby Available?" as="select" value={data.criticalityStandbyAvailable || ''} onChange={handleChange}>{yesNoOptions}</FormField>
                    <FormField id="criticalityFailureFrequency" label="Failure Frequency (1=Rare, 5=Frequent)" as="select" value={data.criticalityFailureFrequency || ''} onChange={handleChange}>
                         {[1,2,3,4,5].map(i => <option key={i} value={i}>{i}</option>)}
                    </FormField>
                    <FormField id="criticalityRepairTime" label="Repair Time (1=Short, 5=Long)" as="select" value={data.criticalityRepairTime || ''} onChange={handleChange}>
                         {[1,2,3,4,5].map(i => <option key={i} value={i}>{i}</option>)}
                    </FormField>
                </div>
            </div>

            <div className="p-6 bg-slate-100 rounded-lg flex justify-between items-center border border-slate-200 shadow-sm">
                <div>
                    <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Calculated Score</p>
                    <p className="text-4xl font-extrabold text-slate-800 mt-1">{data.criticalityScore || 0}</p>
                </div>
                <div>
                     <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Criticality Class</p>
                    <div className={`text-4xl font-extrabold px-4 py-1 rounded ${data.criticalityClass === 'A' ? 'text-red-700' : data.criticalityClass === 'B' ? 'text-orange-700' : 'text-green-700'}`}>
                        {data.criticalityClass || 'N/A'}
                    </div>
                </div>
            </div>

            {/* Calculation & Parameters Section */}
            <div className="border-t pt-6 space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Inventory Parameter Calculation</h4>
                <p className="text-sm text-slate-500">Enter annual usage to auto-calculate optimal stock levels based on the criticality class, variability, and procurement lead time.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 border rounded-lg items-end">
                     <div className="relative">
                         <FormField 
                            id="annualUsageQuantity" 
                            label="Annual Consumption (Qty)" 
                            type="number" 
                            value={data.annualUsageQuantity ?? ''} 
                            onChange={handleChange} 
                            helpId="annualUsageQuantity"
                            placeholder="Total yearly usage"
                         />
                         {/* Auto-calculate button */}
                         <button 
                            type="button"
                            onClick={handleAutoFillUsage}
                            disabled={loadingAnalytics || consumptionStats.mean === 0}
                            className="absolute right-0 top-0 text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                            title={`Auto-fill based on history (Avg Monthly: ${consumptionStats.mean.toFixed(1)})`}
                        >
                            Auto-Calc
                        </button>
                     </div>
                     
                     {/* Read-Only Lead Time Field */}
                     <div className="flex flex-col">
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Time (Days)</span>
                        <div className="w-full p-2 bg-slate-100 border border-slate-300 rounded-md text-slate-700 text-sm h-10 flex items-center">
                            {totalLeadTime > 0 ? totalLeadTime : 'Not Configured'}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">Sourced from Procurement Data</span>
                     </div>

                     <FormField 
                        id="targetDaysSupply" 
                        label="Target Supply Days (Max)" 
                        type="number" 
                        value={data.targetDaysSupply ?? ''} 
                        onChange={handleChange} 
                        helpId="targetDaysSupply"
                        placeholder="Optional override"
                     />
                </div>
                
                {/* Stats Display */}
                <div className="flex gap-4 text-xs text-slate-500 px-4">
                     <span className="flex items-center gap-1">
                         <strong>Avg Monthly:</strong> {consumptionStats.mean.toFixed(1)}
                     </span>
                     <span className="flex items-center gap-1">
                         <strong>Demand Variability (CV):</strong> <span className={consumptionStats.cv > 0.5 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{consumptionStats.cv.toFixed(2)}</span>
                     </span>
                </div>
                
                {missingLeadTime && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        <div>
                            <strong>Lead Time Required</strong>
                            <p className="mt-1">To calculate stock levels, a valid Lead Time is required. Please configure <strong>Purchase Processing</strong>, <strong>Planned Delivery</strong>, and <strong>GR Processing</strong> days in the <strong className="font-semibold">Procurement Data</strong> tab first.</p>
                        </div>
                    </div>
                )}

                {calculatedParams && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex justify-between items-start border-b border-blue-200 pb-2 mb-3">
                                <h5 className="text-sm font-bold text-blue-800 uppercase tracking-wider">Calculated Recommendations</h5>
                                <div className="text-xs text-blue-600 text-right">
                                    <p>Safety Factor: <strong>{calculatedParams.safetyFactor}</strong></p>
                                    <p>Target Days: <strong>{calculatedParams.targetDays}</strong></p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <span className="text-slate-600">Safety Stock:</span>
                                <span className="font-bold text-slate-900 text-right">{calculatedParams.safety}</span>
                                
                                <span className="text-slate-600">Reorder Point (ROP):</span>
                                <span className="font-bold text-slate-900 text-right">{calculatedParams.rop}</span>
                                
                                <span className="text-slate-600">Min Level:</span>
                                <span className="font-bold text-slate-900 text-right">{calculatedParams.min}</span>
                                
                                <span className="text-slate-600">Max Level:</span>
                                <span className="font-bold text-slate-900 text-right">{calculatedParams.max}</span>
                            </div>
                            <div className="mt-4 text-center">
                                <Button 
                                    onClick={handleApplyCalculations} 
                                    className="!w-auto !bg-blue-600 hover:!bg-blue-700 !text-xs !py-1.5"
                                >
                                    Apply to Configuration
                                </Button>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                             <h5 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Current Configuration</h5>
                             <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <span className="text-slate-600">Safety Stock:</span>
                                <span className="font-mono text-slate-900 text-right">{data.safetyStockQty ?? '-'}</span>
                                
                                <span className="text-slate-600">Reorder Point:</span>
                                <span className="font-mono text-slate-900 text-right">{data.reorderPointQty ?? '-'}</span>
                                
                                <span className="text-slate-600">Min Level:</span>
                                <span className="font-mono text-slate-900 text-right">{data.minStockLevel ?? '-'}</span>
                                
                                <span className="text-slate-600">Max Level:</span>
                                <span className="font-mono text-slate-900 text-right">{data.maxStockLevel ?? '-'}</span>
                            </div>
                            <div className="mt-4 text-center">
                                <span className="text-xs text-slate-400 italic">Values saved on "Save Analysis"</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} isLoading={isSaving} className="!w-auto">Save Analysis</Button>
            </div>
        </div>
    );
};

export default CriticalityAnalysisTab;
