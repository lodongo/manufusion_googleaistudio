
import React, { useState, useEffect, useMemo } from 'react';
import type { EnergyBillingComponent, EnergyCalcMethod, EnergyComponentType, EnergyUnitBasis, BillingTier, TOUSlot, EnergyCategory } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';
import { v4 as uuidv4 } from 'uuid';

interface BillingComponentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<EnergyBillingComponent>) => Promise<void>;
    componentToEdit?: EnergyBillingComponent | null;
    allComponents: EnergyBillingComponent[];
    categories: EnergyCategory[];
    currency: string;
    theme: Organisation['theme'];
}

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-1 align-middle">
        <span className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold border border-slate-200">?</span>
        <div className="absolute z-50 invisible group-hover:visible bg-slate-800 text-white text-[10px] p-2 rounded-lg w-48 bottom-full left-1/2 -translate-x-1/2 mb-2 shadow-xl border border-white/10 leading-tight font-normal italic">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const BillingComponentModal: React.FC<BillingComponentModalProps> = ({ isOpen, onClose, onSave, componentToEdit, allComponents, categories, currency, theme }) => {
    const [formData, setFormData] = useState<Partial<EnergyBillingComponent>>({
        name: '', categoryId: '', type: 'Consumption', method: 'PerUnit', unitBasis: 'kWh', enabled: true, isMonthlyAdjustment: false,
        basisComponentIds: [], tiers: [], touSlots: [], subtotalBasisType: 'CalculatedCost'
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(componentToEdit ? { ...componentToEdit } : {
                name: '', categoryId: '', type: 'Consumption', method: 'PerUnit', unitBasis: 'kWh', enabled: true, isMonthlyAdjustment: false,
                basisComponentIds: [], tiers: [], touSlots: [], subtotalBasisType: 'CalculatedCost'
            });
        }
    }, [isOpen, componentToEdit]);

    // Grouping components by Category for the basis selection list
    const groupedComponents = useMemo(() => {
        const map: Record<string, EnergyBillingComponent[]> = {};
        allComponents.filter(c => c.id !== formData.id).forEach(comp => {
            if (!map[comp.categoryId]) map[comp.categoryId] = [];
            map[comp.categoryId].push(comp);
        });
        return map;
    }, [allComponents, formData.id]);

    // Tier Handlers
    const addTier = () => setFormData(p => ({ ...p, tiers: [...(p.tiers || []), { from: 0, to: null }] }));
    const removeTier = (idx: number) => setFormData(p => ({ ...p, tiers: p.tiers?.filter((_, i) => i !== idx) }));
    const updateTier = (idx: number, field: keyof BillingTier, val: any) => {
        const next = [...(formData.tiers || [])];
        next[idx] = { ...next[idx], [field]: val === '' ? null : Number(val) };
        setFormData(p => ({ ...p, tiers: next }));
    };

    // TOU Handlers
    const addSlot = () => setFormData(p => ({ ...p, touSlots: [...(p.touSlots || []), { id: uuidv4(), name: 'Window', startHour: 0, endHour: 23 }] }));
    const removeSlot = (id: string) => setFormData(p => ({ ...p, touSlots: p.touSlots?.filter(s => s.id !== id) }));
    const updateSlot = (id: string, field: keyof TOUSlot, val: any) => {
        setFormData(p => ({ ...p, touSlots: p.touSlots?.map(s => s.id === id ? { ...s, [field]: field === 'name' ? val : Number(val) } : s) }));
    };

    const handleSave = async () => {
        if (!formData.name || !formData.categoryId) return;
        setIsLoading(true);
        // Clear unitBasis if the method doesn't use it
        const finalData = { ...formData };
        if (formData.method === 'Percentage' || formData.method === 'RateTimesSubtotal') {
            delete finalData.unitBasis;
        }
        await onSave(finalData);
        setIsLoading(false);
        onClose();
    };

    const isDependentMethod = formData.method === 'Percentage' || formData.method === 'RateTimesSubtotal';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={componentToEdit ? "Refine Tariff Logic" : "Architect New Tariff Component"} size="4xl">
            <div className="space-y-8">
                {/* Identity & Basic Specs */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-8">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Item Designation</label>
                        <Input id="name" label="" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Peak Demand Surcharge" className="text-lg font-bold" />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Classification</label>
                        <Input id="type" as="select" label="" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as EnergyComponentType})}>
                            <option value="Consumption">Consumption (Energy)</option>
                            <option value="Demand">Demand (Capacity)</option>
                            <option value="Fixed">Fixed Standing Charge</option>
                            <option value="Levy">Govt / Regulatory Levy</option>
                            <option value="Tax">VAT / Sales Tax</option>
                        </Input>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Category Assignment</label>
                        <Input id="cat" as="select" label="" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} required>
                            <option value="">Choose Billing Category...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Input>
                    </div>
                    <div className="flex gap-4 items-end pb-1">
                        <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-2xl flex-1 transition-all group ${formData.isMonthlyAdjustment ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                            <input type="checkbox" checked={formData.isMonthlyAdjustment} onChange={e => setFormData({...formData, isMonthlyAdjustment: e.target.checked})} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500" />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700">Dynamic Rate</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Rate varies monthly</span>
                            </div>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-2xl flex-1 transition-all group ${formData.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                            <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500" />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700">Live Status</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Include in calculations</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Calculation Methodology</label>
                        <Input id="method" as="select" label="" value={formData.method} onChange={e => setFormData({...formData, method: e.target.value as EnergyCalcMethod})}>
                            <option value="PerUnit">Unit Multiplication (Qty x Rate)</option>
                            <option value="Tiered">Step-Tiers / Block Rates</option>
                            <option value="TimeOfUse">Time-of-Use (Windows)</option>
                            <option value="Percentage">Percentage of Subtotal (%)</option>
                            <option value="RateTimesSubtotal">Rate Multiplier of Subtotal (Multiplier x Σ)</option>
                            <option value="Flat">Fixed Periodic Sum</option>
                        </Input>
                    </div>
                    <div>
                        {!isDependentMethod && (
                            <>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Primary Unit Basis</label>
                                <Input id="basis" as="select" label="" value={formData.unitBasis} onChange={e => setFormData({...formData, unitBasis: e.target.value as EnergyUnitBasis})}>
                                    <option value="kWh">Active Energy (kWh)</option>
                                    <option value="kVA">Apparent Power (kVA)</option>
                                    <option value="kVARh">Reactive Power (kVARh)</option>
                                    <option value="Manual">Static Value (Manual)</option>
                                </Input>
                            </>
                        )}
                        {isDependentMethod && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Method Logic</p>
                                <p className="text-xs text-amber-700 italic">This calculation ignores Primary Units. It operates solely on the sub-total of other selected bill components.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detailed Logic Configuration */}
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 shadow-inner overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                         <svg className="w-24 h-24 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </div>

                    <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6">Logic Parameters Configuration</h5>
                    
                    {formData.method === 'PerUnit' && (
                        <div className="bg-white/60 p-6 rounded-2xl border border-white shadow-sm italic text-slate-600 text-sm">
                            System will multiply the monthly defined rate by the absolute recorded units of <strong className="text-slate-900">{formData.unitBasis}</strong>.
                        </div>
                    )}

                    {formData.method === 'Tiered' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex justify-between items-center mb-2 px-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consumption Brackets (Units)</span>
                                <button onClick={addTier} className="text-xs text-indigo-600 font-black uppercase hover:underline">+ New Bracket</button>
                            </div>
                            <div className="space-y-3">
                                {formData.tiers?.map((t, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-4 bg-white/80 p-3 rounded-2xl border border-white shadow-sm items-center transition-all hover:shadow-md">
                                        <div className="col-span-5"><Input id={`f-${i}`} label="Start Value" type="number" step="0.0000001" value={t.from} onChange={e => updateTier(i, 'from', e.target.value)} /></div>
                                        <div className="col-span-5"><Input id={`t-${i}`} label="End Value (Blank for ∞)" type="number" step="0.0000001" value={t.to ?? ''} onChange={e => updateTier(i, 'to', e.target.value)} /></div>
                                        <div className="col-span-2 flex justify-center pt-5">
                                             <button onClick={() => removeTier(i)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors">
                                                 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                             </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {formData.method === 'TimeOfUse' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex justify-between items-center mb-2 px-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chronological Windows</span>
                                <button onClick={addSlot} className="text-xs text-indigo-600 font-black uppercase hover:underline">+ New Window</button>
                            </div>
                            <div className="space-y-3">
                                {formData.touSlots?.map((s) => (
                                    <div key={s.id} className="grid grid-cols-12 gap-4 bg-white/80 p-3 rounded-2xl border border-white shadow-sm items-center transition-all hover:shadow-md">
                                        <div className="col-span-6"><Input id={`sn-${s.id}`} label="Reference Label" value={s.name} onChange={e => updateSlot(s.id, 'name', e.target.value)} placeholder="e.g. Peak" /></div>
                                        <div className="col-span-2"><Input id={`sh-${s.id}`} label="Start" type="number" min={0} max={23} value={s.startHour} onChange={e => updateSlot(s.id, 'startHour', e.target.value)} /></div>
                                        <div className="col-span-2"><Input id={`eh-${s.id}`} label="End" type="number" min={0} max={23} value={s.endHour} onChange={e => updateSlot(s.id, 'endHour', e.target.value)} /></div>
                                        <div className="col-span-2 flex justify-center pt-5">
                                            <button onClick={() => removeSlot(s.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors">
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isDependentMethod && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Subtotal Basis Selection */}
                            <div className="bg-white/80 p-6 rounded-[2rem] border border-white shadow-sm">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Calculation Basis Source <InfoTooltip text="Recorded Values: Sum of raw units (e.g. Total kWh). Calculated Cost: Sum of final monetary values (e.g. Total $)." /></label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-3 cursor-pointer flex-1 p-4 border rounded-2xl transition-all shadow-sm ${formData.subtotalBasisType === 'RecordedValues' ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input type="radio" checked={formData.subtotalBasisType === 'RecordedValues'} onChange={() => setFormData({...formData, subtotalBasisType: 'RecordedValues'})} className="sr-only" />
                                        <div className={`w-6 h-6 rounded-full border-4 flex-shrink-0 flex items-center justify-center ${formData.subtotalBasisType === 'RecordedValues' ? 'border-white' : 'border-slate-200'}`}>
                                            {formData.subtotalBasisType === 'RecordedValues' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black uppercase tracking-tight">Recorded Units</span>
                                            <span className={`text-[9px] font-bold uppercase ${formData.subtotalBasisType === 'RecordedValues' ? 'text-indigo-100' : 'text-slate-400'}`}>Cumulative {formData.unitBasis || 'kWh'}</span>
                                        </div>
                                    </label>
                                    <label className={`flex items-center gap-3 cursor-pointer flex-1 p-4 border rounded-2xl transition-all shadow-sm ${formData.subtotalBasisType === 'CalculatedCost' ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input type="radio" checked={formData.subtotalBasisType === 'CalculatedCost'} onChange={() => setFormData({...formData, subtotalBasisType: 'CalculatedCost'})} className="sr-only" />
                                        <div className={`w-6 h-6 rounded-full border-4 flex-shrink-0 flex items-center justify-center ${formData.subtotalBasisType === 'CalculatedCost' ? 'border-white' : 'border-slate-200'}`}>
                                            {formData.subtotalBasisType === 'CalculatedCost' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black uppercase tracking-tight">Financial Value</span>
                                            <span className={`text-[9px] font-bold uppercase ${formData.subtotalBasisType === 'CalculatedCost' ? 'text-indigo-100' : 'text-slate-400'}`}>Cumulative {currency}</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Grouped Component Checklist */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Selected Basis Components <InfoTooltip text="Select the bill items that contribute to the subtotal for this calculation." /></label>
                                <div className="bg-white/80 rounded-[2rem] border border-white shadow-sm overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                                    {categories.map(cat => {
                                        const catComps = groupedComponents[cat.id] || [];
                                        if (catComps.length === 0) return null;
                                        
                                        return (
                                            <div key={cat.id} className="border-b last:border-0 border-slate-100">
                                                <div className="bg-slate-50/50 px-6 py-2 border-b border-slate-100">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{cat.name}</span>
                                                </div>
                                                <div className="p-3 space-y-1">
                                                    {catComps.map(c => (
                                                        <label key={c.id} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-indigo-50/50 group">
                                                            <div className="ml-4 flex-shrink-0">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={formData.basisComponentIds?.includes(c.id)} 
                                                                    onChange={() => {
                                                                        const current = formData.basisComponentIds || [];
                                                                        const updated = current.includes(c.id) ? current.filter(i => i !== c.id) : [...current, c.id];
                                                                        setFormData({...formData, basisComponentIds: updated});
                                                                    }}
                                                                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                                                />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">{c.name}</span>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{c.method} {c.unitBasis ? `• ${c.unitBasis}` : ''}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.method === 'Flat' && (
                        <div className="bg-white/60 p-6 rounded-2xl border border-white shadow-sm italic text-slate-600 text-sm">
                            This component represents a fixed periodic amount (Standing Charge) that does not depend on usage units or other bill items.
                        </div>
                    )}
                </div>

                {/* Constraint Boundaries */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Financial Safeguards</h5>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Floor: Minimum Per Bill ({currency})</label>
                            <Input id="min" label="" type="number" step="0.0000001" value={formData.minCharge || ''} onChange={e => setFormData({...formData, minCharge: e.target.value === '' ? undefined : Number(e.target.value)})} placeholder="No Minimum Limit" className="border-slate-200 focus:border-indigo-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Ceiling: Maximum Per Bill ({currency})</label>
                            <Input id="max" label="" type="number" step="0.0000001" value={formData.maxCharge || ''} onChange={e => setFormData({...formData, maxCharge: e.target.value === '' ? undefined : Number(e.target.value)})} placeholder="No Maximum Limit" className="border-slate-200 focus:border-indigo-500" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto px-10">Discard Changes</Button>
                    <Button onClick={handleSave} isLoading={isLoading} className="!w-auto px-12 shadow-xl shadow-indigo-100 font-bold" style={{ backgroundColor: theme.colorPrimary }}>Commit Configuration</Button>
                </div>
            </div>
        </Modal>
    );
};

export default BillingComponentModal;
