
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { ParameterAggregationMethod } from '../../../../types/em_types';
import Button from '../../../Button';

const TELEMETRY_PARAMETERS = [
    { id: 'active_energy_delta_kwh', label: 'Energy Delta (kWh)' },
    { id: 'active_power_kw', label: 'Active Power (kW)' },
    { id: 'apparent_power_kva', label: 'Apparent Power (kVA)' },
    { id: 'reactive_power_kvar', label: 'Reactive Power (kVAR)' },
    { id: 'current_avg', label: 'Avg Current (A)' },
    { id: 'voltage_avg_ln', label: 'Avg Voltage (V)' },
];

const BILLING_UNITS = [
    { id: 'kWh', label: 'Active Energy Basis', defaultMethod: 'Sum' as ParameterAggregationMethod, desc: 'Accumulated consumption over period' },
    { id: 'kVA', label: 'Apparent Power / Demand Basis', defaultMethod: 'Max' as ParameterAggregationMethod, desc: 'Highest peak observed in window (Peak Demand)' },
    { id: 'kVARh', label: 'Reactive Power Basis', defaultMethod: 'Sum' as ParameterAggregationMethod, desc: 'Accumulated reactive load' },
];

const AGGREGATION_METHODS: { id: ParameterAggregationMethod; label: string, color: string }[] = [
    { id: 'Sum', label: 'Totalised (Sum)', color: 'text-indigo-600' },
    { id: 'Avg', label: 'Average', color: 'text-slate-600' },
    { id: 'Min', label: 'Minimum', color: 'text-slate-600' },
    { id: 'Max', label: 'Peak (Maximum)', color: 'text-rose-600' },
];

interface InputMapping {
    parameterId: string;
    method: ParameterAggregationMethod;
}

const GeneralSetupTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'], currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [mappings, setMappings] = useState<Record<string, InputMapping>>({
        kWh: { parameterId: 'active_energy_delta_kwh', method: 'Sum' },
        kVA: { parameterId: 'apparent_power_kva', method: 'Max' },
        kVARh: { parameterId: 'reactive_power_kvar', method: 'Sum' }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const settingsPath = `organisations/${organisation.domain}/modules/EM/settings/meterInputs`;

    useEffect(() => {
        const unsub = onSnapshot(doc(db, settingsPath), (snap) => {
            if (snap.exists()) {
                setMappings(snap.data().mappings || {});
            }
            setLoading(false);
        });
        return () => unsub();
    }, [settingsPath]);

    const handleUpdateMapping = (unitId: string, field: keyof InputMapping, value: string) => {
        setMappings(prev => ({
            ...prev,
            [unitId]: {
                ...prev[unitId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, settingsPath), {
                mappings,
                updatedAt: Timestamp.now(),
                updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
            });
            alert("Meter input matrix synchronized.");
        } catch (e) {
            console.error(e);
            alert("Failed to save mappings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400 italic">Synchronizing signal matrix...</div>;

    return (
        <div className="mt-8 space-y-8 animate-fade-in max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Billing Input Matrix</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                        Map tariff units to telemetry signals and define the calculation operator.
                    </p>
                </div>

                <div className="space-y-4">
                    {BILLING_UNITS.map(unit => (
                        <div key={unit.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-4">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">{unit.id} BASIS</span>
                                <h4 className="text-sm font-bold text-slate-700">{unit.label}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic">{unit.desc}</p>
                            </div>
                            
                            <div className="md:col-span-5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Telemetry Signal</label>
                                <select 
                                    value={mappings[unit.id]?.parameterId || ''}
                                    onChange={e => handleUpdateMapping(unit.id, 'parameterId', e.target.value)}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                >
                                    <option value="">-- No Signal --</option>
                                    {TELEMETRY_PARAMETERS.map(p => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Calculation Operator</label>
                                <select 
                                    value={mappings[unit.id]?.method || unit.defaultMethod}
                                    onChange={e => handleUpdateMapping(unit.id, 'method', e.target.value)}
                                    className={`w-full p-3 bg-white border border-slate-200 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm ${
                                        (mappings[unit.id]?.method || unit.defaultMethod) === 'Max' ? 'text-rose-600' : 'text-indigo-600'
                                    }`}
                                >
                                    {AGGREGATION_METHODS.map(m => (
                                        <option key={m.id} value={m.id} className={m.color}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Aggregation Strategy Note</h4>
                    <p className="text-sm leading-relaxed opacity-90">
                        <span className="font-bold text-indigo-300">Totalised (Sum)</span> is used for volumetric parameters (kWh). 
                        <span className="font-bold text-indigo-300"> Peak (Maximum)</span> is mandatory for demand parameters (kVA) to determine the highest network capacity utilized within the billing period.
                    </p>
                </div>

                <div className="flex justify-end pt-4">
                    <Button 
                        onClick={handleSave} 
                        isLoading={saving} 
                        className="!w-auto px-12 shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest rounded-full h-12"
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        Save Matrix Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GeneralSetupTab;
