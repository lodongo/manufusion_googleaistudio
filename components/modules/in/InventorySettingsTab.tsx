import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../types';
import Input from '../../Input';
import Button from '../../Button';

interface CriticalitySettings {
    riskHSEPoints: number[];
    impactProductionPoints: number[];
    impactQualityPoints: number[];
    standbyPoints: { yes: number; no: number };
    failureFrequencyPoints: number[];
    repairTimePoints: number[];
    cutoffs: { classA: number; classB: number; classC: number; };
    costRanges: number[]; 
    matrixServiceLevels: Record<string, number>;
}

const calculateLinearDefaults = () => {
    const levels: Record<string, number> = {};
    const start = 99.6; // A1
    const end = 65.0;   // D4
    const totalSteps = 6; 
    const stepValue = (start - end) / totalSteps;

    const rowOrder = ['A', 'B', 'C', 'D'];
    rowOrder.forEach((rLabel, rIdx) => {
        [1, 2, 3, 4].forEach((cLabel, cIdx) => {
            const stepsFromA1 = rIdx + cIdx;
            levels[`${rLabel}${cLabel}`] = Number((start - (stepsFromA1 * stepValue)).toFixed(1));
        });
    });
    return levels;
};

const defaultSettings: CriticalitySettings = {
    riskHSEPoints: [1, 2, 3, 4, 5],
    impactProductionPoints: [1, 2, 3, 4, 5],
    impactQualityPoints: [1, 2, 3, 4, 5],
    standbyPoints: { yes: 1, no: 2 },
    failureFrequencyPoints: [1, 2, 3, 4, 5],
    repairTimePoints: [1, 2, 3, 4, 5],
    cutoffs: { classA: 22, classB: 16, classC: 10 },
    costRanges: [100, 1000, 5000],
    matrixServiceLevels: calculateLinearDefaults(),
};

const InventorySettingsTab: React.FC<{ organisation: Organisation; currentUser: AppUser; theme: Organisation['theme'] }> = ({ organisation, theme }) => {
    const [settings, setSettings] = useState<CriticalitySettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');
    const [currencyConfig, setCurrencyConfig] = useState({ local: organisation.currency.code, base: 'USD', rate: 1 });

    useEffect(() => {
        const docRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/currency`);
        const unsubscribe = onSnapshot(docRef, snap => {
            if (snap.exists) {
                const d = snap.data();
                setCurrencyConfig({
                    local: d?.localCurrency || organisation.currency.code,
                    base: d?.baseCurrency || 'USD',
                    rate: d?.constantRateConfig?.calculatedRate || 1
                });
            }
        });
        return () => unsubscribe();
    }, [organisation.domain, organisation.currency.code]);

    useEffect(() => {
        const settingsDocRef = doc(db, `organisations/${organisation.domain}/modules/IN/settings/criticality`);
        const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as CriticalitySettings;
                setSettings({
                    ...defaultSettings,
                    ...data,
                    matrixServiceLevels: data.matrixServiceLevels || calculateLinearDefaults()
                });
            } else {
                setSettings(defaultSettings);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [organisation.domain]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const settingsDocRef = doc(db, `organisations/${organisation.domain}/modules/IN/settings/criticality`);
            await setDoc(settingsDocRef, settings);
            alert("Classification setup saved.");
        } catch (e) {
            console.error(e);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleArrayChange = (key: keyof CriticalitySettings, index: number, value: number) => {
        const arr = [...(settings[key] as number[])];
        arr[index] = value;
        setSettings({ ...settings, [key]: arr });
    };

    const handleMatrixChange = (key: string, value: number) => {
        setSettings({
            ...settings,
            matrixServiceLevels: { ...settings.matrixServiceLevels, [key]: value }
        });
    };

    const handleCostRangeChange = (index: number, displayValue: string) => {
        const val = parseFloat(displayValue);
        if (isNaN(val)) return;
        const localVal = viewCurrency === 'local' ? val : (val * currencyConfig.rate);
        const newRanges = [...settings.costRanges];
        newRanges[index] = localVal;
        setSettings({ ...settings, costRanges: newRanges });
    };

    const getCostDisplayValue = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        return amount.toFixed(2);
    };

    const symbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    if (loading) return <div className="p-12 text-center text-slate-500 italic animate-pulse">Loading classification parameters...</div>;
    
    return (
        <div className="space-y-12 pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-0 z-10 gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Classification Setup</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Configure strategic parameters (Max Score: 27, Min Score: 6)</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Display Currency</span>
                        <div className="flex gap-1">
                            <button onClick={() => setViewCurrency('local')} className={`px-4 py-1.5 text-xs font-black rounded-xl transition-all ${viewCurrency === 'local' ? 'bg-white text-indigo-700 shadow-md border border-slate-200' : 'text-slate-500'}`}>{currencyConfig.local}</button>
                            <button onClick={() => setViewCurrency('base')} className={`px-4 py-1.5 text-xs font-black rounded-xl transition-all ${viewCurrency === 'base' ? 'bg-white text-indigo-700 shadow-md border border-slate-200' : 'text-slate-500'}`}>{currencyConfig.base}</button>
                        </div>
                    </div>
                    <Button onClick={handleSave} isLoading={saving} style={{ backgroundColor: theme.colorPrimary }} className="!w-auto px-8">Save Configuration</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-3">Weighting Distribution</h4>
                    <div className="space-y-6">
                        {[
                            { key: 'riskHSEPoints', label: 'HSE Risk' },
                            { key: 'impactProductionPoints', label: 'Production Impact' },
                            { key: 'impactQualityPoints', label: 'Quality Impact' },
                            { key: 'failureFrequencyPoints', label: 'Failure Frequency' },
                            { key: 'repairTimePoints', label: 'Repair Time' },
                        ].map(({key, label}) => (
                            <div key={key}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{label} POINT VALUES (L1-L5)</label>
                                <div className="grid grid-cols-5 gap-3">
                                    {(settings[key as keyof CriticalitySettings] as number[]).map((val, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <input 
                                                type="number" 
                                                value={val} 
                                                onChange={e => handleArrayChange(key as any, i, Number(e.target.value))}
                                                className="w-full text-center p-3 bg-slate-50 rounded-2xl border border-slate-200 font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">L{i+1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        
                        <div className="pt-4 border-t border-slate-100">
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Standby Availability Points</label>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <span className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Yes (Available)</span>
                                     <input type="number" value={settings.standbyPoints.yes} onChange={e => setSettings({...settings, standbyPoints: {...settings.standbyPoints, yes: Number(e.target.value)}})} className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-200 font-black text-center" />
                                 </div>
                                 <div>
                                     <span className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">No (Critical)</span>
                                     <input type="number" value={settings.standbyPoints.no} onChange={e => setSettings({...settings, standbyPoints: {...settings.standbyPoints, no: Number(e.target.value)}})} className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-200 font-black text-center" />
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Strategic Impact Cutoffs (A=Highest Impact)</label>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <span className="block text-[10px] font-black text-red-500 uppercase tracking-widest text-center">Class A (Critical)</span>
                                <input type="number" value={settings.cutoffs.classA} onChange={e => setSettings({...settings, cutoffs: {...settings.cutoffs, classA: Number(e.target.value)}})} className="w-full p-4 bg-red-50 rounded-3xl border border-red-200 text-center text-2xl font-black text-red-700 outline-none focus:ring-2 focus:ring-red-500" />
                            </div>
                            <div className="space-y-2">
                                <span className="block text-[10px] font-black text-orange-500 uppercase tracking-widest text-center">Class B</span>
                                <input type="number" value={settings.cutoffs.classB} onChange={e => setSettings({...settings, cutoffs: {...settings.cutoffs, classB: Number(e.target.value)}})} className="w-full p-4 bg-orange-50 rounded-3xl border border-orange-200 text-center text-2xl font-black text-orange-700 outline-none focus:ring-2 focus:ring-orange-500" />
                            </div>
                            <div className="space-y-2">
                                <span className="block text-[10px] font-black text-yellow-500 uppercase tracking-widest text-center">Class C</span>
                                <input type="number" value={settings.cutoffs.classC} onChange={e => setSettings({...settings, cutoffs: {...settings.cutoffs, classC: Number(e.target.value)}})} className="w-full p-4 bg-yellow-50 rounded-3xl border border-yellow-200 text-center text-2xl font-black text-yellow-700 outline-none focus:ring-2 focus:ring-yellow-500" />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mt-4 text-center uppercase">Scores below Class C threshold are categorized as Class D (Lowest Impact).</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-3">Cost Strategy & Service Matrix</h4>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cost Class Boundaries ({symbol})</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[0, 1, 2].map(idx => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-3xl border border-slate-200">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Class {idx + 1} / Class {idx + 2}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold text-slate-400">{symbol}</span>
                                        <input 
                                            type="number" step="0.01" value={getCostDisplayValue(settings.costRanges[idx])}
                                            onChange={e => handleCostRangeChange(idx, e.target.value)}
                                            className="w-full bg-transparent font-black text-slate-800 outline-none border-b border-transparent focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Service Level Target (SCL) Matrix</h4>
                        <button onClick={() => setSettings({...settings, matrixServiceLevels: calculateLinearDefaults()})} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest">Apply Linear Defaults</button>
                    </div>
                    
                    <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-inner bg-slate-50/30">
                        <table className="min-w-full text-center divide-y divide-slate-100">
                            <thead className="bg-slate-50 font-black text-[9px] text-slate-400 uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-6 py-4 text-left">Impact \ Cost</th>
                                    {[1, 2, 3, 4].map(c => <th key={c} className="px-6 py-4">Cost {c}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {['A', 'B', 'C', 'D'].map(crit => (
                                    <tr key={crit}>
                                        <td className="px-6 py-5 bg-slate-50/50 font-black text-sm text-slate-600 border-r border-slate-100">{crit}</td>
                                        {[1, 2, 3, 4].map(cost => {
                                            const key = `${crit}${cost}`;
                                            return (
                                                <td key={cost} className="px-2 py-2">
                                                    <input 
                                                        type="number" step="0.1" value={settings.matrixServiceLevels[key]}
                                                        onChange={e => handleMatrixChange(key, Number(e.target.value))}
                                                        className="w-16 p-2 text-center text-sm font-black text-slate-800 rounded-lg border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 bg-transparent"
                                                    />
                                                    <span className="text-[10px] text-slate-400">%</span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventorySettingsTab;
