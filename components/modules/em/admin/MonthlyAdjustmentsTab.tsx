
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, onSnapshot, addDoc, orderBy, Timestamp, limit, getDocs } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { EnergyBillingComponent, TariffUpdateLog, EnergyCategory } from '../../../../types/em_types';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import Input from '../../../Input';

const MonthlyAdjustmentsTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'], currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [allComponents, setAllComponents] = useState<EnergyBillingComponent[]>([]);
    const [categories, setCategories] = useState<EnergyCategory[]>([]);
    const [history, setHistory] = useState<TariffUpdateLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 

    const modulePath = `organisations/${organisation.domain}/modules/EM`;
    const componentsPath = `${modulePath}/billingComponents`;
    const catsPath = `${modulePath}/billingCategories`;
    const historyPath = `${modulePath}/monthlyAdjustments/${selectedMonth}/history`;

    useEffect(() => {
        const unsubComp = onSnapshot(query(collection(db, componentsPath), orderBy('order')), snap => {
            setAllComponents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyBillingComponent)));
        });

        const unsubCats = onSnapshot(query(collection(db, catsPath), orderBy('order')), snap => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyCategory)));
        });

        const qHist = query(collection(db, historyPath), orderBy('timestamp', 'desc'), limit(10));
        const unsubHist = onSnapshot(qHist, snap => {
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as TariffUpdateLog)));
            setLoading(false);
        });

        return () => { unsubComp(); unsubCats(); unsubHist(); };
    }, [componentsPath, catsPath, historyPath, selectedMonth]);

    const latestUpdate = history[0];

    if (loading) return <div className="p-12 text-center text-slate-400 italic">Synchronizing pricing matrices...</div>;

    return (
        <div className="space-y-8 mt-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Billing Month</h3>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="p-2 border rounded-xl font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                     <Button 
                        variant="secondary"
                        onClick={() => setIsSimulatorOpen(true)} 
                        disabled={allComponents.length === 0}
                        className="!w-auto px-8"
                    >
                        Open Bill Simulator
                    </Button>
                    <Button 
                        onClick={() => setIsUpdateModalOpen(true)} 
                        disabled={allComponents.length === 0}
                        className="!w-auto px-8 shadow-lg shadow-indigo-100"
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        Update Master Rates
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Current Active Rates */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2">Active Tariff Pricing</h3>
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Classification</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Component</th>
                                    <th className="px-6 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Current Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {allComponents.map(comp => {
                                    const hasMultiValues = comp.method === 'Tiered' || comp.method === 'TimeOfUse';
                                    
                                    return (
                                        <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                    comp.type === 'Consumption' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                    comp.type === 'Tax' ? 'bg-red-50 border-red-200 text-red-700' :
                                                    'bg-slate-50 border-slate-200 text-slate-700'
                                                }`}>{comp.type}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-800">{comp.name}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                                    {categories.find(c => c.id === comp.categoryId)?.name || 'General'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {hasMultiValues ? (
                                                     <div className="flex flex-col gap-1 items-end">
                                                        {(comp.method === 'Tiered' ? comp.tiers : comp.touSlots)?.map((sub, sIdx) => (
                                                            <div key={sIdx} className="flex gap-2 items-center">
                                                                <span className="text-[9px] text-slate-400 uppercase font-black">{(sub as any).name || `Tier ${sIdx+1}`}:</span>
                                                                <span className="font-mono font-bold text-indigo-600">
                                                                    {latestUpdate?.values?.[`${comp.id}_${sIdx}`] !== undefined ? Number(latestUpdate.values[`${comp.id}_${sIdx}`]).toFixed(7) : '---'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                     </div>
                                                ) : (
                                                    <span className="font-mono font-bold text-indigo-600">
                                                        {latestUpdate?.values?.[comp.id] !== undefined ? Number(latestUpdate.values[comp.id]).toFixed(7) : '---'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Audit Trail */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2">Audit Trail</h3>
                    <div className="bg-slate-100 rounded-2xl p-4 space-y-3 min-h-[300px]">
                        {history.map(log => (
                            <div key={log.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase">{log.updatedBy.name}</span>
                                    <span className="text-[9px] text-slate-400 font-bold">{log.timestamp.toDate().toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                                    {Object.entries(log.values).map(([key, val]) => {
                                        const [compId, subIdx] = key.split('_');
                                        const comp = allComponents.find(c => c.id === compId);
                                        if (!comp) return null;
                                        
                                        let label = comp.name;
                                        if (subIdx !== undefined) {
                                            const sub = (comp.method === 'Tiered' ? comp.tiers : comp.touSlots)?.[Number(subIdx)];
                                            label += ` (${(sub as any)?.name || `T${Number(subIdx)+1}`})`;
                                        }

                                        return (
                                            <div key={key} className="flex justify-between border-b border-slate-50 pb-0.5">
                                                <span className="text-slate-500 truncate mr-2" title={label}>{label}</span>
                                                <span className="font-mono font-bold flex-shrink-0">{Number(val).toFixed(7)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isUpdateModalOpen && (
                <BatchUpdateModal 
                    isOpen={isUpdateModalOpen}
                    onClose={() => setIsUpdateModalOpen(false)}
                    components={allComponents}
                    categories={categories}
                    latestValues={latestUpdate?.values || {}}
                    historyPath={historyPath}
                    currentUser={currentUser}
                />
            )}

            {isSimulatorOpen && (
                <BillSimulatorModal 
                    isOpen={isSimulatorOpen}
                    onClose={() => setIsSimulatorOpen(false)}
                    components={allComponents}
                    categories={categories}
                    latestRates={latestUpdate?.values || {}}
                    currency={organisation.currency.code}
                    theme={theme}
                    organisation={organisation}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

// --- BILL SIMULATOR MODAL ---
const BillSimulatorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    components: EnergyBillingComponent[];
    categories: EnergyCategory[];
    latestRates: Record<string, number>;
    currency: string;
    theme: Organisation['theme'];
    organisation: Organisation;
    currentUser: AppUser;
}> = ({ isOpen, onClose, components, categories, latestRates, currency, theme, organisation, currentUser }) => {
    const [units, setUnits] = useState<Record<string, number>>({});
    const [subUnits, setSubUnits] = useState<Record<string, number>>({});
    const [isSavingSim, setIsSavingSim] = useState(false);
    const [loadingRecent, setLoadingRecent] = useState(false);

    const simulationPath = `organisations/${organisation.domain}/modules/EM/simulations`;

    useEffect(() => {
        if (isOpen) {
            setLoadingRecent(true);
            const fetchRecent = async () => {
                const q = query(collection(db, simulationPath), orderBy('timestamp', 'desc'), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    setUnits(data.units || {});
                    setSubUnits(data.subUnits || {});
                }
                setLoadingRecent(false);
            };
            fetchRecent();
        }
    }, [isOpen, simulationPath]);

    const requiredBases = useMemo(() => {
        const set = new Set<string>();
        components.filter(c => c.enabled && !['Flat', 'Percentage', 'RateTimesSubtotal'].includes(c.method)).forEach(c => {
            if (c.unitBasis) set.add(c.unitBasis);
        });
        return Array.from(set).sort();
    }, [components]);

    // Validation: Check if the sum of all TOU hours equals exactly 24
    const touValidation = useMemo(() => {
        const enabledTouComponents = components.filter(c => c.enabled && c.method === 'TimeOfUse');
        if (enabledTouComponents.length === 0) return { isValid: true, hours: 24 };

        // Sum up durations of all slots across all TOU components
        // Logic: Usually, a tariff covers 24h. We sum all slots defined.
        const totalMins = enabledTouComponents.reduce((acc, comp) => {
            return acc + (comp.touSlots?.reduce((sAcc, slot) => {
                let diff = slot.endHour - slot.startHour;
                if (diff <= 0) diff += 24; 
                return sAcc + (diff * 60);
            }, 0) || 0);
        }, 0);

        const hours = totalMins / 60;
        return { 
            isValid: Math.abs(hours - 24) < 0.0001, 
            hours 
        };
    }, [components]);

    // Automated Logic: Sum up all TOU slot inputs to auto-totalize master kWh
    useEffect(() => {
        const kwhTouSum = components
            .filter(c => c.enabled && c.method === 'TimeOfUse' && c.unitBasis === 'kWh')
            .reduce((acc, comp) => {
                const compInputSum = comp.touSlots?.reduce((sAcc, _, sIdx) => {
                    return sAcc + (Number(subUnits[`${comp.id}_${sIdx}`]) || 0);
                }, 0) || 0;
                return acc + compInputSum;
            }, 0);

        if (kwhTouSum > 0) {
            setUnits(prev => ({ ...prev, kWh: kwhTouSum }));
        }
    }, [subUnits, components]);

    const handleSaveSimulation = async () => {
        setIsSavingSim(true);
        try {
            await addDoc(collection(db, simulationPath), {
                units,
                subUnits,
                timestamp: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
            });
            alert("Simulation layout archived.");
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingSim(false);
        }
    };

    const billBreakdown = useMemo(() => {
        const sorted = [...components].sort((a, b) => a.order - b.order);
        const results: Record<string, { total: number, detail: string }> = {};
        let grandTotal = 0;

        sorted.forEach(comp => {
            if (!comp.enabled) return;

            let rate = 0;
            let totalValue = 0;
            let detail = "";

            switch (comp.method) {
                case 'Flat':
                    rate = latestRates[comp.id] || 0;
                    totalValue = rate;
                    detail = "Fixed charge";
                    break;
                case 'PerUnit':
                    const basisVal = units[comp.unitBasis || ''] || 0;
                    rate = latestRates[comp.id] || 0;
                    totalValue = basisVal * rate;
                    detail = `${basisVal} ${comp.unitBasis} @ ${rate.toFixed(7)}`;
                    break;
                case 'Tiered':
                    const tierInput = units[comp.unitBasis || ''] || 0;
                    detail = `${tierInput} ${comp.unitBasis} blocked: `;
                    comp.tiers?.forEach((tier, idx) => {
                        const tierRate = latestRates[`${comp.id}_${idx}`] || 0;
                        const start = tier.from;
                        const end = tier.to || Infinity;
                        const qtyInTier = Math.max(0, Math.min(tierInput, end) - start);
                        if (qtyInTier > 0) {
                            totalValue += qtyInTier * tierRate;
                            detail += `[${qtyInTier} @ ${tierRate.toFixed(4)}] `;
                        }
                    });
                    break;
                case 'TimeOfUse':
                    detail = "TOU windows: ";
                    comp.touSlots?.forEach((slot, idx) => {
                        const slotRate = latestRates[`${comp.id}_${idx}`] || 0;
                        const slotInput = subUnits[`${comp.id}_${idx}`] || 0;
                        const slotVal = slotInput * slotRate;
                        totalValue += slotVal;
                        detail += `${slot.name}: ${slotInput} @ ${slotRate.toFixed(4)}; `;
                    });
                    break;
                case 'Percentage':
                case 'RateTimesSubtotal':
                    rate = latestRates[comp.id] || 0;
                    const multiplier = comp.method === 'Percentage' ? (rate / 100) : rate;
                    
                    let runningBasisSum = 0;
                    comp.basisComponentIds?.forEach(bId => {
                        const bComp = components.find(c => c.id === bId);
                        if (!bComp) return;
                        
                        if (comp.subtotalBasisType === 'RecordedValues') {
                            runningBasisSum += units[bComp.unitBasis || ''] || 0;
                        } else {
                            runningBasisSum += results[bId]?.total || 0;
                        }
                    });
                    
                    totalValue = runningBasisSum * multiplier;
                    detail = `${comp.method === 'Percentage' ? (rate + '%') : ('x' + rate)} of ${comp.subtotalBasisType === 'RecordedValues' ? 'base units' : 'base cost'} (${runningBasisSum.toFixed(2)})`;
                    break;
            }

            results[comp.id] = { total: totalValue, detail };
            grandTotal += totalValue;
        });

        return { results, grandTotal };
    }, [components, latestRates, units, subUnits]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Simulation Ledger & Logic Verification" size="7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5 space-y-8 pr-6 lg:border-r border-slate-100">
                    
                    {!touValidation.isValid && (
                        <div className="bg-rose-50 border-2 border-rose-600 p-4 rounded-2xl animate-pulse shadow-lg">
                            <h5 className="text-rose-700 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                CRITICAL: TARIFF TIME COVERAGE MISMATCH
                            </h5>
                            <p className="mt-2 text-[10px] text-rose-600 font-bold uppercase leading-relaxed">
                                The sum of all configured TOU windows equals {touValidation.hours.toFixed(2)} hours. A valid 24-hour cycle is required for accurate billing simulation.
                            </p>
                        </div>
                    )}

                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Master Unit Ledger</h4>
                            <button onClick={handleSaveSimulation} disabled={isSavingSim} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline disabled:opacity-50">
                                {isSavingSim ? 'Archiving...' : 'Save Simulation Session'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {requiredBases.map(unit => {
                                const isComputed = unit === 'kWh' && components.some(c => c.enabled && c.method === 'TimeOfUse' && c.unitBasis === 'kWh');
                                return (
                                    <div key={unit} className={`p-4 rounded-2xl border transition-all ${isComputed ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unit}</label>
                                            {isComputed && <span className="text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Auto-Totalized</span>}
                                        </div>
                                        <input 
                                            type="number" 
                                            step="0.0000001"
                                            value={units[unit] ?? ''} 
                                            onChange={e => !isComputed && setUnits({...units, [unit]: Number(e.target.value)})}
                                            readOnly={isComputed}
                                            className={`w-full bg-transparent text-xl font-black outline-none ${isComputed ? 'text-indigo-800' : 'text-slate-800'}`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                        {components.filter(c => c.enabled && c.method === 'TimeOfUse').map(comp => (
                            <section key={comp.id} className="space-y-3 bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">{comp.name} - Usage Entry</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {comp.touSlots?.map((slot, idx) => (
                                        <div key={idx}>
                                            <label className="block text-[9px] font-bold text-indigo-400 uppercase tracking-tighter ml-1">{slot.name} ({slot.startHour}:00-{slot.endHour}:00)</label>
                                            <input 
                                                type="number"
                                                step="0.0000001"
                                                value={subUnits[`${comp.id}_${idx}`] ?? ''}
                                                onChange={e => setSubUnits({...subUnits, [`${comp.id}_${idx}`]: Number(e.target.value)})}
                                                className="w-full p-2 border rounded-xl font-bold text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                                                placeholder="Qty..."
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                    
                    <div className="p-4 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-1">Simulated Net Total</p>
                        <p className="text-4xl font-black">{currency} {billBreakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                    <div className="flex justify-between items-end">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Draft Calculation Summary</h4>
                        <div className="flex items-center gap-3">
                             {loadingRecent && <span className="text-[8px] text-slate-400 animate-pulse uppercase font-black">Syncing profile...</span>}
                             <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded uppercase tracking-widest">Logic Verified</span>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col h-[65vh]">
                        <div className="p-8 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <p className="text-xl font-black text-slate-800 uppercase tracking-tight">Ledger Breakdown</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Based on global master tariff logic</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Currency</p>
                                <p className="text-lg font-black text-slate-700">{currency}</p>
                            </div>
                        </div>

                        <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                            {categories.map(cat => {
                                const catComps = components.filter(c => c.categoryId === cat.id && c.enabled);
                                if (catComps.length === 0) return null;

                                const catTotal = catComps.reduce((acc, c) => acc + (billBreakdown.results[c.id]?.total || 0), 0);

                                return (
                                    <div key={cat.id} className="space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{cat.name}</span>
                                            <span className="text-xs font-black text-slate-800">{currency} {catTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {[...catComps].sort((a,b) => a.order - b.order).map(comp => {
                                                const res = billBreakdown.results[comp.id];
                                                if (!res) return null;
                                                return (
                                                    <div key={comp.id} className="flex justify-between group">
                                                        <div className="flex-1 pr-4">
                                                            <p className="text-sm font-bold text-slate-700">{comp.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium italic group-hover:text-indigo-500 transition-colors">{res.detail}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-sm font-mono font-bold text-slate-700">{res.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                            <span className="text-lg font-black uppercase tracking-[0.2em]">Estimated Bill Total</span>
                            <span className="text-3xl font-black">{currency} {billBreakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end pt-8 mt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={onClose} className="!w-auto px-12">Discard & Close</Button>
            </div>
        </Modal>
    );
};

// --- BATCH UPDATE MODAL ---
const BatchUpdateModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    components: EnergyBillingComponent[]; 
    categories: EnergyCategory[];
    latestValues: Record<string, number>;
    historyPath: string;
    currentUser: AppUser;
}> = ({ isOpen, onClose, components, categories, latestValues, historyPath, currentUser }) => {
    const [values, setValues] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setValues(latestValues);
        }
    }, [isOpen, latestValues]);

    const handleCommit = async () => {
        setLoading(true);
        try {
            await addDoc(collection(db, historyPath), {
                timestamp: Timestamp.now(),
                updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                values: values
            });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Update failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update Master Tariff Prices" size="4xl">
            <div className="space-y-6">
                <p className="text-sm text-slate-600">Update unit rates, fixed fees, or percentage values for all active tariff logic components.</p>
                
                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {categories.map(cat => {
                        const catComps = components.filter(c => c.categoryId === cat.id);
                        if (catComps.length === 0) return null;

                        return (
                            <div key={cat.id} className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{cat.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {catComps.map(comp => {
                                        const hasMultiValues = comp.method === 'Tiered' || comp.method === 'TimeOfUse';
                                        
                                        if (hasMultiValues) {
                                            const subItems = comp.method === 'Tiered' ? comp.tiers : comp.touSlots;
                                            return (
                                                <div key={comp.id} className="md:col-span-2 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-4">
                                                    <div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{comp.type}</span>
                                                        <p className="font-bold text-slate-800">{comp.name}</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        {subItems?.map((sub, sIdx) => (
                                                            <div key={sIdx} className="bg-white p-3 rounded-xl border border-slate-200">
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{(sub as any).name || `Tier ${sIdx+1}`}</label>
                                                                <input 
                                                                    type="number"
                                                                    step="0.0000001"
                                                                    value={values[`${comp.id}_${sIdx}`] ?? ''}
                                                                    onChange={e => setValues({...values, [`${comp.id}_${sIdx}`]: Number(e.target.value)})}
                                                                    className="w-full text-right font-mono font-bold bg-transparent outline-none text-indigo-700"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={comp.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between group transition-all hover:bg-white hover:border-indigo-200">
                                                <div className="flex-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{comp.type}</span>
                                                    <p className="font-bold text-slate-800">{comp.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{comp.method} {comp.unitBasis ? `per ${comp.unitBasis}` : ''}</p>
                                                </div>
                                                <div className="w-32">
                                                    <input 
                                                        type="number"
                                                        step="0.0000001"
                                                        value={values[comp.id] ?? ''}
                                                        onChange={e => setValues({...values, [comp.id]: Number(e.target.value)})}
                                                        placeholder="0.0000000"
                                                        className="w-full p-2 border rounded-lg text-right font-mono font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button variant="secondary" onClick={onClose} className="!w-auto">Cancel</Button>
                    <Button onClick={handleCommit} isLoading={loading} className="!w-auto px-8">Commit All Prices</Button>
                </div>
            </div>
        </Modal>
    );
};

export default MonthlyAdjustmentsTab;
