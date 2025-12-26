import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { MaterialMasterData, Organisation, InventoryData } from '../../../../types';
import Button from '../../../Button';
import Input from '../../../Input';
import { FormField } from './Shared';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';

const defaultCriticalitySettings = {
    riskHSEPoints: [1, 2, 3, 4, 5],
    impactProductionPoints: [1, 2, 3, 4, 5],
    impactQualityPoints: [1, 2, 3, 4, 5],
    standbyPoints: { yes: 1, no: 2 },
    failureFrequencyPoints: [1, 2, 3, 4, 5],
    repairTimePoints: [1, 2, 3, 4, 5],
    cutoffs: { classA: 22, classB: 16, classC: 10 },
    costRanges: [100, 1000, 5000],
    matrixServiceLevels: {},
};

const getServiceLevelColor = (target: number) => {
    const p = Math.max(0, Math.min(1, (target - 65) / (99.6 - 65)));
    const r = Math.round(239 + (34 - 239) * p);
    const g = Math.round(68 + (197 - 68) * p);
    const b = Math.round(68 + (94 - 68) * p);
    return `rgb(${r}, ${g}, ${b})`;
};

const GaugeDial: React.FC<{ 
    value: number; 
    min: number; 
    max: number; 
    label: string; 
    sublabel: string;
    unit?: string;
    inverse?: boolean;
}> = ({ value, min, max, label, sublabel, unit, inverse = false }) => {
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    const clampedValue = Math.max(min, Math.min(max, value));
    const range = max - min || 1;
    const percentage = (clampedValue - min) / range;
    const needleRotation = (percentage * 180) - 90;
    const startColor = inverse ? "#22c55e" : "#ef4444";
    const midColor = "#eab308";
    const endColor = inverse ? "#ef4444" : "#22c55e";

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-[2rem] border border-slate-200 shadow-sm h-full w-full">
            <div className="relative w-full h-28 flex items-end justify-center overflow-visible">
                <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={`grad-${label.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={startColor} />
                            <stop offset="50%" stopColor={midColor} />
                            <stop offset="100%" stopColor={endColor} />
                        </linearGradient>
                    </defs>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={`url(#grad-${label.replace(/\s+/g, '-')})`} strokeWidth="12" strokeLinecap="round" strokeOpacity="0.9" />
                    <text x="15" y="115" textAnchor="middle" className="text-[8px] font-black fill-slate-400 uppercase tracking-tighter">{min}</text>
                    <text x="185" y="115" textAnchor="middle" className="text-[8px] font-black fill-slate-400 uppercase tracking-tighter">{Math.round(max)}</text>
                    <g transform={`translate(${centerX}, ${centerY}) rotate(${needleRotation})`}>
                        <path d="M -2 0 L 0 -75 L 2 0 Z" fill="#1e293b" />
                        <circle cx="0" cy="0" r="4" fill="#1e293b" />
                    </g>
                    <text x="100" y="95" textAnchor="middle" className="text-xl font-black fill-slate-900 tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: value > 100 ? 0 : 2 })}</text>
                    {unit && <text x="100" y="110" textAnchor="middle" className="text-[8px] font-black fill-slate-400 uppercase tracking-[0.2em]">{unit}</text>}
                </svg>
            </div>
            <div className="text-center mt-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{sublabel}</p>
            </div>
        </div>
    );
};

const MatrixCell: React.FC<{ crit: string, cost: number, isActive: boolean, target: number }> = ({ crit, cost, isActive, target }) => {
    const bgColor = getServiceLevelColor(target);
    const isLight = target > 85;
    return (
        <div style={{ backgroundColor: bgColor }} className={`relative flex flex-col items-center justify-center h-16 border border-white/10 transition-all duration-300 overflow-hidden ${isActive ? 'ring-4 ring-blue-600 shadow-[0_0_25px_rgba(37,99,235,0.5)] z-10 scale-[1.12] rounded-xl' : 'opacity-90 hover:opacity-100 hover:scale-[1.02] cursor-default'}`}>
            <span className={`text-[8px] font-black uppercase tracking-tighter mb-0.5 ${isLight ? 'text-black/30' : 'text-white/30'}`}>{crit}{cost}</span>
            <span className={`text-xs font-black drop-shadow-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{target.toFixed(1)}%</span>
            {isActive && <div className="absolute top-1 right-1"><span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span></div>}
        </div>
    );
};

const MaterialClassificationTab: React.FC<{ 
    material: MaterialMasterData; 
    warehouseMaterialPath: string | null; 
    organisation: Organisation;
    currencyConfig: { local: string; base: string; rate: number };
    theme: Organisation['theme'];
}> = ({ material, warehouseMaterialPath, organisation, currencyConfig, theme }) => {
    const { currentUserProfile } = useAuth();
    const [data, setData] = useState<InventoryData>(material.inventoryData || {});
    const [settings, setSettings] = useState<any>(defaultCriticalitySettings);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');
    const [isOverriding, setIsOverriding] = useState(false);
    const [localManualPrice, setLocalManualPrice] = useState<number | null>(material.inventoryData?.standardPrice || null);
    const [inputValue, setInputValue] = useState<string>(material.inventoryData?.standardPrice ? material.inventoryData.standardPrice.toString() : '');
    const [autoCost, setAutoCost] = useState(0);
    const [costSource, setCostSource] = useState('');

    useEffect(() => {
        const fetchSettingsAndCost = async () => {
            setLoading(true);
            try {
                const settingsRef = db.doc(`organisations/${organisation.domain}/modules/IN/settings/criticality`);
                const settingsSnap = await settingsRef.get();
                if (settingsSnap.exists) setSettings({ ...defaultCriticalitySettings, ...settingsSnap.data() });

                let resolvedCost = material.procurementData?.standardPrice || 0;
                let source = 'Master Data standard price';
                if (warehouseMaterialPath) {
                    const vendorsRef = collection(db, `${warehouseMaterialPath}/vendors`);
                    const vSnap = await getDocs(query(vendorsRef, where('hasAgreement', '==', true), where('agreementStatus', '==', 'Active'), limit(1)));
                    if (!vSnap.empty) {
                        const agreement = vSnap.docs[0].data();
                        resolvedCost = agreement.price || resolvedCost;
                        source = `Active Sourcing Agreement (${agreement.vendorName})`;
                    } else {
                        const ordersRef = collection(db, `organisations/${organisation.domain}/modules/PR/orders`);
                        const qPo = query(ordersRef, where('vendorId', '==', material.procurementData?.preferredVendorId || ''), orderBy('createdAt', 'desc'), limit(1));
                        const poSnap = await getDocs(qPo);
                        if (!poSnap.empty) {
                            const po = poSnap.docs[0].data();
                            const item = po.items?.find((i: any) => i.materialId === material.id);
                            if (item?.unitPrice) { resolvedCost = item.unitPrice; source = `Last Purchase Order (${po.poNumber})`; }
                        }
                    }
                }
                setAutoCost(resolvedCost); setCostSource(source); setLoading(false);
            } catch (e) { console.error(e); setLoading(false); }
        };
        fetchSettingsAndCost();
    }, [material, warehouseMaterialPath, organisation.domain]);

    useEffect(() => {
        if (localManualPrice !== null) {
            const displayVal = viewCurrency === 'local' ? localManualPrice : (localManualPrice / currencyConfig.rate);
            setInputValue(displayVal.toFixed(2));
        }
    }, [viewCurrency, localManualPrice, currencyConfig.rate]);

    const handleApplyManualPrice = () => {
        const val = parseFloat(inputValue);
        if (!isNaN(val)) {
            const localVal = viewCurrency === 'local' ? val : (val * currencyConfig.rate);
            setLocalManualPrice(localVal);
        } else setLocalManualPrice(null);
        setIsOverriding(false);
    };

    const effectivePriceLocal = localManualPrice !== null ? localManualPrice : autoCost;

    const classification = useMemo(() => {
        const costRanges = settings.costRanges || defaultCriticalitySettings.costRanges;
        const matrixServiceLevels = settings.matrixServiceLevels || {};
        const score = (settings.riskHSEPoints[(data.criticalityRiskHSE || 1) - 1] || 0) + (settings.impactProductionPoints[(data.criticalityProductionImpact || 1) - 1] || 0) + (settings.impactQualityPoints[(data.criticalityImpactQuality || 1) - 1] || 0) + (data.criticalityStandbyAvailable === 'No' ? settings.standbyPoints.no : settings.standbyPoints.yes) + (settings.failureFrequencyPoints[(data.criticalityFailureFrequency || 1) - 1] || 0) + (settings.repairTimePoints[(data.criticalityRepairTime || 1) - 1] || 0);
        let critClass: 'A'|'B'|'C'|'D' = 'D';
        if (score >= settings.cutoffs.classA) critClass = 'A'; else if (score >= settings.cutoffs.classB) critClass = 'B'; else if (score >= settings.cutoffs.classC) critClass = 'C';
        let costClass = 1; if (effectivePriceLocal >= costRanges[2]) costClass = 4; else if (effectivePriceLocal >= costRanges[1]) costClass = 3; else if (effectivePriceLocal >= costRanges[0]) costClass = 2;
        const targetKey = `${critClass}${costClass}`; const targetCSL = matrixServiceLevels[targetKey] || 95;
        return { score, critClass, costClass, targetCSL, targetKey };
    }, [data, settings, effectivePriceLocal]);

    const handleSave = async () => {
        if (!warehouseMaterialPath) return;
        setIsSaving(true);
        try {
            const updatePayload = {
                'inventoryData.criticalityRiskHSE': data.criticalityRiskHSE || 1,
                'inventoryData.criticalityProductionImpact': data.criticalityProductionImpact || 1,
                'inventoryData.criticalityImpactQuality': data.criticalityImpactQuality || 1,
                'inventoryData.criticalityStandbyAvailable': data.criticalityStandbyAvailable || 'No',
                'inventoryData.criticalityFailureFrequency': data.criticalityFailureFrequency || 1,
                'inventoryData.criticalityRepairTime': data.criticalityRepairTime || 1,
                'inventoryData.criticalityScore': classification.score,
                'inventoryData.criticalityClass': classification.critClass,
                'inventoryData.costClass': classification.costClass,
                'inventoryData.serviceLevelTarget': classification.targetCSL,
                'inventoryData.standardPrice': effectivePriceLocal 
            };
            
            await updateDoc(doc(db, warehouseMaterialPath), updatePayload);
            
            // Log Activity
            const orgDomain = warehouseMaterialPath.split('/')[1];
            const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);
            await addDoc(activityRef, {
                timestamp: Timestamp.now(),
                userName: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`,
                tab: 'Classification',
                action: 'Strategic Profile Synced',
                details: `Calculated Class: ${classification.critClass}${classification.costClass}, CSL: ${classification.targetCSL.toFixed(1)}%.`
            });

            alert("Strategic classification synchronized successfully.");
        } catch (e) { console.error(e); alert("Save failed."); } finally { setIsSaving(false); }
    };

    const formatCurrencyDisplay = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const displaySymbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;
    const costBoundaries = useMemo(() => {
        const ranges = settings.costRanges || defaultCriticalitySettings.costRanges;
        const conversionFactor = viewCurrency === 'local' ? 1 : (1 / (currencyConfig.rate || 1));
        const r0 = ranges[0] * conversionFactor; const r1 = ranges[1] * conversionFactor; const r2 = ranges[2] * conversionFactor;
        return [`< ${formatCurrencyDisplay(r0)}`, `${formatCurrencyDisplay(r0)} - ${formatCurrencyDisplay(r1)}`, `${formatCurrencyDisplay(r1)} - ${formatCurrencyDisplay(r2)}`, `> ${formatCurrencyDisplay(r2)}`];
    }, [settings.costRanges, viewCurrency, currencyConfig.rate]);
    const costMaxVal = useMemo(() => { const baseMax = settings.costRanges[2] || 5000; return viewCurrency === 'local' ? baseMax : (baseMax / (currencyConfig.rate || 1)); }, [settings.costRanges, viewCurrency, currencyConfig.rate]);

    if (loading) return <div className="p-12 text-center text-slate-500 italic">Analyzing material strategic position...</div>;

    return (
        <div className="p-6 space-y-8 bg-slate-50 min-h-full animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Impact Drivers</h4>
                        <FormField id="criticalityRiskHSE" label="HSE Risk" as="select" value={data.criticalityRiskHSE || ''} onChange={e => setData({...data, criticalityRiskHSE: Number(e.target.value)})}>
                            <option value="1">1 - Negligible</option><option value="2">2 - Minor</option><option value="3">3 - Moderate</option><option value="4">4 - Major</option><option value="5">5 - Critical</option>
                        </FormField>
                        <FormField id="criticalityProductionImpact" label="Production Impact" as="select" value={data.criticalityProductionImpact || ''} onChange={e => setData({...data, criticalityProductionImpact: Number(e.target.value)})}>
                            <option value="1">1 - None</option><option value="2">2 - Minor</option><option value="3">3 - Moderate</option><option value="4">4 - Major</option><option value="5">5 - Critical</option>
                        </FormField>
                        <FormField id="criticalityImpactQuality" label="Quality Impact" as="select" value={data.criticalityImpactQuality || ''} onChange={e => setData({...data, criticalityImpactQuality: Number(e.target.value)})}>
                            <option value="1">1 - None</option><option value="2">2 - Minor</option><option value="3">3 - Moderate</option><option value="4">4 - Major</option><option value="5">5 - Critical</option>
                        </FormField>
                        <FormField id="criticalityStandbyAvailable" label="Standby Availability" as="select" value={data.criticalityStandbyAvailable || ''} onChange={e => setData({...data, criticalityStandbyAvailable: e.target.value as any})}>
                            <option value="Yes">Yes (Mitigated - 1pt)</option><option value="No">No (Critical - 2pts)</option>
                        </FormField>
                        <FormField id="criticalityFailureFrequency" label="Failure Frequency" as="select" value={data.criticalityFailureFrequency || ''} onChange={e => setData({...data, criticalityFailureFrequency: Number(e.target.value)})}>
                            <option value="1">1 - Rare</option><option value="2">2 - Infrequent</option><option value="3">3 - Occasional</option><option value="4">4 - Periodic</option><option value="5">5 - Frequent</option>
                        </FormField>
                        <FormField id="criticalityRepairTime" label="Repair Time" as="select" value={data.criticalityRepairTime || ''} onChange={e => setData({...data, criticalityRepairTime: Number(e.target.value)})}>
                            <option value="1">1 - Instant</option><option value="2">2 - Short</option><option value="3">3 - Medium</option><option value="4">4 - Long</option><option value="5">5 - Critical Overhaul</option>
                        </FormField>
                    </div>
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center mb-2 px-2">
                             <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Cost Context</h4>
                             <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                                <button onClick={() => setViewCurrency('local')} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${viewCurrency === 'local' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>{currencyConfig.local}</button>
                                <button onClick={() => setViewCurrency('base')} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${viewCurrency === 'base' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>{currencyConfig.base}</button>
                             </div>
                        </div>
                        <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 relative group transition-all">
                            {!isOverriding ? (
                                <>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Effective Unit Price</p>
                                    <p className="text-3xl font-black text-slate-800 tabular-nums">{displaySymbol} {formatCurrencyDisplay(effectivePriceLocal * (viewCurrency === 'local' ? 1 : 1 / (currencyConfig.rate || 1)))}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold mt-2 uppercase tracking-tighter truncate italic">{localManualPrice !== null ? 'Manual Override' : `Sourced: ${costSource}`}</p>
                                    <button onClick={() => setIsOverriding(true)} className="absolute top-4 right-4 p-2 bg-indigo-600 text-white rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black uppercase tracking-widest">Override</button>
                                </>
                            ) : (
                                <div className="p-1 space-y-3">
                                    <Input id="manualPrice" label={`Manual Price (${displaySymbol})`} type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} className="!bg-white !rounded-xl" />
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsOverriding(false)} className="flex-1 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                                        <button onClick={handleApplyManualPrice} className="flex-1 py-2 text-[10px] font-black uppercase bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-colors">Apply</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <GaugeDial label="Strategic Impact" sublabel={`Level: ${classification.critClass}`} value={classification.score} min={6} max={90} unit="Points" />
                        <GaugeDial label="Cost Position" sublabel={`Category: ${classification.costClass}`} value={effectivePriceLocal * (viewCurrency === 'local' ? 1 : 1 / (currencyConfig.rate || 1))} min={0} max={costMaxVal} unit={displaySymbol} inverse={true} />
                        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-center text-white relative overflow-hidden border border-slate-700 flex flex-col items-center justify-center">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-black border-2 border-white shadow-xl animate-pulse" style={{ backgroundColor: getServiceLevelColor(classification.targetCSL) }}>{classification.targetKey}</div>
                            <span className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em] relative z-10 mb-2">Target CSL</span>
                            <p className="text-5xl font-black relative z-10 drop-shadow-xl" style={{ color: getServiceLevelColor(classification.targetCSL) }}>{classification.targetCSL.toFixed(1)}%</p>
                            <p className="text-[9px] font-bold text-white/40 uppercase mt-4 tracking-widest relative z-10">Calculated Service Level</p>
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden border border-slate-200">
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-10"><h4 className="text-slate-800 font-black text-sm uppercase tracking-[0.4em]">Strategic Performance Matrix</h4><div className="flex gap-4"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High Stock Affinity</span></div><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Stock Affinity</span></div></div></div>
                            <div className="flex h-[300px]"><div className="flex flex-col justify-between pr-6 text-slate-400 font-black text-sm uppercase py-8 border-r border-slate-100"><span className="text-slate-200 leading-none h-4 flex items-center">D</span><span className="text-slate-300 leading-none h-4 flex items-center">C</span><span className="text-slate-500 leading-none h-4 flex items-center">B</span><span className="text-rose-600 leading-none h-4 flex items-center">A</span></div><div className="flex-1 pl-4"><div className="grid grid-cols-4 gap-3">{['D', 'C', 'B', 'A'].map(crit => ([1, 2, 3, 4].map(cost => { const key = `${crit}${cost}`; return <MatrixCell key={key} crit={crit} cost={cost} isActive={classification.targetKey === key} target={settings.matrixServiceLevels?.[key] || 95} />; })))}</div><div className="grid grid-cols-4 gap-3 mt-8 pt-4 border-t border-slate-50">{costBoundaries.map((label, i) => (<div key={i} className="flex flex-col items-center"><span className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Class {i+1}</span><span className="text-slate-300 font-mono text-[8px] text-center whitespace-nowrap overflow-hidden max-w-[80px]">{label}</span></div>))}</div></div></div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4"><Button onClick={handleSave} isLoading={isSaving} className="!w-auto px-12 shadow-xl rounded-full text-xs font-black uppercase tracking-widest h-12" style={{ backgroundColor: theme.colorPrimary }}>Sync Strategic Profile</Button></div>
                </div>
            </div>
        </div>
    );
};

export default MaterialClassificationTab;