import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { ParameterConfig, ParameterAggregationMethod } from '../../../../types/em_types';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import Input from '../../../Input';

const { Timestamp } = firebase.firestore;

const AGGREGATION_METHODS: { id: ParameterAggregationMethod; label: string; symbol: string }[] = [
    { id: 'Sum', label: 'Summation', symbol: 'Σ' },
    { id: 'Avg', label: 'Average', symbol: 'μ' },
    { id: 'Min', label: 'Minimum', symbol: '↓' },
    { id: 'Max', label: 'Maximum', symbol: '↑' },
    { id: 'Latest', label: 'Latest', symbol: '⏱' },
];

const ParameterProcessingTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'] }> = ({ organisation, theme }) => {
    const [paramConfigs, setParamConfigs] = useState<Record<string, ParameterConfig>>({});
    const [discoveredFields, setDiscoveredFields] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
    const [extraForm, setExtraForm] = useState({ sourceId: '', suffix: '' });

    // Path updated to 'parameterConfig' as requested
    const meterFieldsDocPath = `organisations/${organisation.domain}/modules/EM/settings/parameterConfig`;

    // 1. Discover fields from a sample meter telemetry
    useEffect(() => {
        const discoverFields = async () => {
            setLoading(true);
            try {
                // Find first available meter IP
                const metersSnap = await db.collection('energyManagement').limit(1).get();
                if (metersSnap.empty) {
                    setDiscoveredFields([]);
                    return;
                }

                const meterId = metersSnap.docs[0].id;
                // Get latest sample from subcollection 'data'
                const dataSnap = await db.collection('energyManagement').doc(meterId).collection('data')
                    .orderBy('created_at', 'desc').limit(1).get();

                if (!dataSnap.empty) {
                    const sample = dataSnap.docs[0].data();
                    const numericKeys = Object.keys(sample).filter(key => typeof sample[key] === 'number');
                    setDiscoveredFields(numericKeys.sort());
                }
            } catch (e) {
                console.error("Discovery failed:", e);
            } finally {
                setLoading(false);
            }
        };
        discoverFields();
    }, []);

    // 2. Fetch existing configuration
    useEffect(() => {
        const unsub = onSnapshot(doc(db as any, meterFieldsDocPath), (snap) => {
            if (snap.exists()) {
                setParamConfigs(snap.data().configs || {});
            }
        });
        return () => unsub();
    }, [meterFieldsDocPath]);

    const handleUpdateParam = (id: string, field: keyof ParameterConfig, value: any) => {
        setParamConfigs(prev => ({
            ...prev,
            [id]: { 
                ...(prev[id] || { parameterId: id, method: 'Avg', enabled: true, isCustom: false }),
                [field]: value 
            }
        }));
    };

    const handleAddExtra = () => {
        if (!extraForm.sourceId || !extraForm.suffix) return;
        
        const newId = `${extraForm.sourceId}_${extraForm.suffix.toLowerCase().replace(/\s+/g, '_')}`;
        const newLabel = `${extraForm.sourceId} - ${extraForm.suffix}`;

        setParamConfigs(prev => ({
            ...prev,
            [newId]: {
                parameterId: extraForm.sourceId,
                method: 'Latest',
                enabled: true,
                isCustom: true,
                customLabel: newLabel
            }
        }));

        setExtraForm({ sourceId: '', suffix: '' });
        setIsExtraModalOpen(false);
    };

    const handleRemoveExtra = (id: string) => {
        const newConfigs = { ...paramConfigs };
        delete newConfigs[id];
        setParamConfigs(newConfigs);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db as any, meterFieldsDocPath), {
                configs: paramConfigs,
                updatedAt: Timestamp.now()
            });
            alert("Signal processing matrix committed to vault.");
        } catch (e) {
            console.error(e);
            alert("Failed to save global configuration.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="mt-12 flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin" style={{ borderColor: theme.colorPrimary }}></div>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-8 animate-fade-in max-w-5xl mx-auto">
            {/* Header / Intro */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Signal Ingestion Matrix</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Foundational data mapping discovered from active network telemetry.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <Button 
                        variant="secondary"
                        onClick={() => setIsExtraModalOpen(true)} 
                        className="!w-auto px-6 font-black uppercase text-xs"
                    >
                        New Customization
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={saving} 
                        className="!w-auto px-10 shadow-xl shadow-indigo-100 font-black uppercase text-xs"
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        Commit Matrix
                    </Button>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-900 text-white">
                        <tr>
                            <th className="px-10 py-5 font-black uppercase text-[10px] tracking-widest">ID Context</th>
                            <th className="px-10 py-5 font-black uppercase text-[10px] tracking-widest">Parameter Designation</th>
                            <th className="px-10 py-5 text-center font-black uppercase text-[10px] tracking-widest">State</th>
                            <th className="px-10 py-5 text-center font-black uppercase text-[10px] tracking-widest">Aggregation Logic</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {/* 1. Original Parameters Discovered from Telemetry */}
                        {discoveredFields.map(fieldId => {
                            const cfg = paramConfigs[fieldId] || { parameterId: fieldId, method: 'Avg', enabled: true };
                            const isEnabled = cfg.enabled !== false;
                            return (
                                <tr key={fieldId} className={`transition-all duration-300 ${isEnabled ? 'bg-white' : 'bg-slate-50/50 grayscale opacity-40'}`}>
                                    <td className="px-10 py-5">
                                        <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-slate-200">Original</span>
                                    </td>
                                    <td className="px-10 py-5">
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-sm ${isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>{fieldId}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">System Telemetry Signal</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-5 text-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isEnabled} onChange={e => handleUpdateParam(fieldId, 'enabled', e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                        </label>
                                    </td>
                                    <td className="px-10 py-5">
                                        <div className="flex justify-center">
                                            <select 
                                                value={cfg.method} 
                                                onChange={e => handleUpdateParam(fieldId, 'method', e.target.value as ParameterAggregationMethod)}
                                                disabled={!isEnabled}
                                                className={`p-2 border rounded-xl text-xs font-bold outline-none transition-all ${isEnabled ? 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-500' : 'bg-transparent border-transparent text-slate-300 cursor-not-allowed'}`}
                                            >
                                                {AGGREGATION_METHODS.map(m => (
                                                    <option key={m.id} value={m.id}>{m.label} ({m.symbol})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {/* 2. Custom Variations */}
                        {(Object.entries(paramConfigs) as [string, ParameterConfig][]).filter(([id, cfg]) => cfg.isCustom).map(([id, cfg]) => {
                            const isEnabled = cfg.enabled !== false;
                            return (
                                <tr key={id} className={`transition-all duration-300 ${isEnabled ? 'bg-indigo-50/20' : 'bg-slate-50/50 grayscale opacity-40'}`}>
                                    <td className="px-10 py-5">
                                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-indigo-200">Customized</span>
                                    </td>
                                    <td className="px-10 py-5">
                                        <div className="flex flex-col group">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm ${isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>{cfg.customLabel}</span>
                                                <button onClick={() => handleRemoveExtra(id)} className="text-rose-500 hover:text-rose-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tight">Derived ID: {id}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-5 text-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isEnabled} onChange={e => handleUpdateParam(id, 'enabled', e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                        </label>
                                    </td>
                                    <td className="px-10 py-5">
                                        <div className="flex justify-center">
                                            <select 
                                                value={cfg.method} 
                                                onChange={e => handleUpdateParam(id, 'method', e.target.value as ParameterAggregationMethod)}
                                                disabled={!isEnabled}
                                                className={`p-2 border rounded-xl text-xs font-bold outline-none transition-all ${isEnabled ? 'bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-500' : 'bg-transparent border-transparent text-slate-300 cursor-not-allowed'}`}
                                            >
                                                {AGGREGATION_METHODS.map(m => (
                                                    <option key={m.id} value={m.id}>{m.label} ({m.symbol})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Helper Info */}
            <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white flex items-start gap-4 shadow-lg">
                <div className="p-2 bg-white/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60">Architectural Note</p>
                    <p className="text-xs mt-1 leading-relaxed opacity-80 italic">Changes committed here govern the mathematical processing of telemetry signals across all site topography nodes. 'Original' signals are verified from active network traffic. 'Customized' IDs can call out specific mathematical derivatives of the base telemetry.</p>
                </div>
            </div>

            {/* Extra Variation Modal */}
            <Modal isOpen={isExtraModalOpen} onClose={() => setIsExtraModalOpen(false)} title="Create Parameter Customization">
                <div className="space-y-6">
                    <p className="text-sm text-slate-500">Define a virtual variation of a telemetry signal for specialized analysis (e.g. Rolling Mean, Peak Capture).</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1.5 ml-1">Source Signal</label>
                            <select 
                                value={extraForm.sourceId} 
                                onChange={e => setExtraForm({...extraForm, sourceId: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select source signal...</option>
                                {discoveredFields.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                        </div>
                        
                        <Input 
                            id="extraSuffix"
                            label="Virtual Variation Label (Suffix)"
                            value={extraForm.suffix}
                            onChange={e => setExtraForm({...extraForm, suffix: e.target.value})}
                            placeholder="e.g. Live, Peak, Rolling Avg"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button variant="secondary" onClick={() => setIsExtraModalOpen(false)} className="!w-auto px-8">Discard</Button>
                        <Button onClick={handleAddExtra} disabled={!extraForm.sourceId || !extraForm.suffix} className="!w-auto px-10 shadow-lg shadow-indigo-100" style={{ backgroundColor: theme.colorPrimary }}>
                            Append Variation
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ParameterProcessingTab;