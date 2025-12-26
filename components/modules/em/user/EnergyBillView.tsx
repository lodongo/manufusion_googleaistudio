import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { TopographyNode, EnergyBillingComponent, EnergyCategory, TariffUpdateLog } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';

const { Timestamp } = firebase.firestore;

interface EnergyBillViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    startDate: string;
    endDate: string;
}

interface NodeAggregate {
    unitBasis: Record<string, number>;
    touUnits: Record<string, number>;
    log: string[];
}

const EnergyBillView: React.FC<EnergyBillViewProps> = ({ node, organisation, theme, startDate, endDate }) => {
    const [loading, setLoading] = useState(true);
    
    const [billingComponents, setBillingComponents] = useState<EnergyBillingComponent[]>([]);
    const [categories, setCategories] = useState<EnergyCategory[]>([]);
    const [latestRates, setLatestRates] = useState<Record<string, number>>({});
    
    const [aggregatedUnits, setAggregatedUnits] = useState<Record<string, number>>({});
    const [touUnits, setTouUnits] = useState<Record<string, number>>({});
    const [calcLog, setCalcLog] = useState<string[]>([]);

    const modulePath = `organisations/${organisation.domain}/modules/EM`;

    // Calculate maturity for UI feedback
    const isBillingMaturityReached = useMemo(() => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const diffDays = (e.getTime() - s.getTime()) / (1000 * 3600 * 24);
        return diffDays > 27;
    }, [startDate, endDate]);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                // 1. Fetch Global Settings & Mappings
                const mapSnap = await db.doc(`${modulePath}/settings/meterInputs`).get();
                const globalMappings = mapSnap.exists ? mapSnap.data()?.mappings || {} : {};

                const [compSnap, catSnap] = await Promise.all([
                    db.collection(`${modulePath}/billingComponents`).where('enabled', '==', true).orderBy('order').get(),
                    db.collection(`${modulePath}/billingCategories`).orderBy('order').get()
                ]);
                
                const comps = compSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyBillingComponent));
                const cats = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyCategory));

                // 2. Fetch Active Rates for Period
                const dateObj = new Date(startDate);
                const monthStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
                
                const rateSnap = await db.collection(`${modulePath}/monthlyAdjustments/${monthStr}/history`).orderBy('timestamp', 'desc').limit(1).get();
                const currentRates = !rateSnap.empty ? (rateSnap.docs[0].data() as TariffUpdateLog).values : {};

                if (isMounted) {
                    setBillingComponents(comps);
                    setCategories(cats);
                    setLatestRates(currentRates);
                }

                // --- AGGREGATION ENGINE ---
                const now = new Date();
                const sDate = new Date(startDate); 
                if (startDate.length <= 10) sDate.setHours(0,0,0,0);
                
                let eDate = new Date(endDate); 
                if (endDate.length <= 10) eDate.setHours(23,59,59,999);
                
                // Cap at now for actual data querying
                if (eDate > now) eDate = now;

                const getAggregateForNode = async (targetNode: TopographyNode): Promise<NodeAggregate> => {
                    const nodeUnits: Record<string, number> = {};
                    const nodeTouUnits: Record<string, number> = {};
                    const nodeLog: string[] = [];

                    if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                        for (const link of targetNode.linkedMeters) {
                            const mSnap = await db.doc(`${modulePath}/meters/${link.meterId}`).get();
                            const ip = mSnap.data()?.ipAddress;
                            if (ip) {
                                const dataSnap = await db.collection('energyManagement').doc(ip).collection('data')
                                    .where('created_at', '>=', Timestamp.fromDate(sDate))
                                    .where('created_at', '<=', Timestamp.fromDate(eDate))
                                    .get();
                                
                                dataSnap.docs.forEach(pDoc => {
                                    const p = pDoc.data();
                                    const ts = p.created_at?.toDate();
                                    const hour = ts?.getHours();
                                    const m = link.operation === 'subtract' ? -1 : 1;

                                    Object.entries(globalMappings).forEach(([unitKey, mapping]: [string, any]) => {
                                        const paramId = mapping.parameterId;
                                        let method = mapping.method || 'Sum';
                                        
                                        if (unitKey === 'kVA') {
                                            if (!isBillingMaturityReached) {
                                                nodeUnits[unitKey] = 0;
                                                return;
                                            }
                                            method = 'Max';
                                        }
                                        if (unitKey === 'kWh') method = 'Sum';

                                        if (typeof p[paramId] === 'number') {
                                            const val = p[paramId] * m;
                                            
                                            // 1. Process Master Units
                                            if (method === 'Sum') {
                                                nodeUnits[unitKey] = (nodeUnits[unitKey] || 0) + val;
                                            } else if (method === 'Max') {
                                                nodeUnits[unitKey] = Math.max(nodeUnits[unitKey] || 0, val);
                                            }

                                            // 2. Process TOU Slices
                                            comps.filter(c => c.method === 'TimeOfUse' && c.unitBasis === unitKey).forEach(c => {
                                                c.touSlots?.forEach((slot, sIdx) => {
                                                    let inWindow = false;
                                                    if (slot.startHour < slot.endHour) {
                                                        if (hour >= slot.startHour && hour < slot.endHour) inWindow = true;
                                                    } else {
                                                        if (hour >= slot.startHour || hour < slot.endHour) inWindow = true;
                                                    }
                                                    if (inWindow) {
                                                        const key = `${c.id}_${sIdx}`;
                                                        
                                                        if (unitKey === 'kVA' && !isBillingMaturityReached) {
                                                            nodeTouUnits[key] = 0;
                                                            return;
                                                        }

                                                        if (method === 'Sum') nodeTouUnits[key] = (nodeTouUnits[key] || 0) + val;
                                                        else if (method === 'Max') nodeTouUnits[key] = Math.max(nodeTouUnits[key] || 0, val);
                                                    }
                                                });
                                            });
                                        }
                                    });
                                });
                            }
                        }
                    } else if (targetNode.meteringType === 'Summation') {
                        const childrenSnap = await db.collection(`${targetNode.path}/nodes`).get();
                        for (const childDoc of childrenSnap.docs) {
                            const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                            const childAgg = await getAggregateForNode(child);
                            
                            Object.entries(childAgg.unitBasis).forEach(([key, val]) => {
                                if (key === 'kVA') {
                                    if (!isBillingMaturityReached) nodeUnits[key] = 0;
                                    else nodeUnits[key] = Math.max(nodeUnits[key] || 0, val);
                                } else nodeUnits[key] = (nodeUnits[key] || 0) + val;
                            });

                            Object.entries(childAgg.touUnits).forEach(([key, val]) => {
                                const compId = key.split('_')[0];
                                const comp = comps.find(c => c.id === compId);
                                if (comp?.unitBasis === 'kVA') {
                                    if (!isBillingMaturityReached) nodeTouUnits[key] = 0;
                                    else nodeTouUnits[key] = Math.max(nodeTouUnits[key] || 0, val);
                                } else nodeTouUnits[key] = (nodeTouUnits[key] || 0) + val;
                            });
                        }
                    } else if (targetNode.meteringType === 'Manual') {
                        const qManual = db.collection(`${modulePath}/manualEntries/${targetNode.id}/dates`)
                            .where('submittedAt', '>=', Timestamp.fromDate(sDate))
                            .where('submittedAt', '<=', Timestamp.fromDate(eDate));
                        const mSnap = await qManual.get();
                        
                        mSnap.docs.forEach(d => {
                            const readings = d.data().readings || {};
                            Object.entries(globalMappings).forEach(([unitKey, mapping]: [string, any]) => {
                                const val = readings[mapping.parameterId];
                                if (typeof val === 'number') {
                                    if (unitKey === 'kVA') {
                                        if (!isBillingMaturityReached) nodeUnits[unitKey] = 0;
                                        else nodeUnits[unitKey] = Math.max(nodeUnits[unitKey] || 0, val);
                                    } else {
                                        nodeUnits[unitKey] = (nodeUnits[unitKey] || 0) + val;
                                    }
                                }
                            });
                        });
                    }

                    return { unitBasis: nodeUnits, touUnits: nodeTouUnits, log: nodeLog };
                };

                const finalAggregate = await getAggregateForNode(node);

                if (isMounted) {
                    setAggregatedUnits(finalAggregate.unitBasis);
                    setTouUnits(finalAggregate.touUnits);
                    setCalcLog(finalAggregate.log);
                    setLoading(false);
                }

            } catch (e) {
                console.error("Aggregation Error:", e);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [node.id, startDate, endDate, organisation.domain, modulePath, isBillingMaturityReached]);

    const billBreakdown = useMemo(() => {
        const results: Record<string, { total: number, detail: string, method: string }> = {};
        let grandTotal = 0;

        billingComponents.forEach(comp => {
            let rate = 0; let totalValue = 0; let detail = "";

            switch (comp.method) {
                case 'Flat':
                    rate = latestRates[comp.id] || 0;
                    totalValue = rate;
                    detail = `Fixed charge: ${organisation.currency.code} ${rate.toFixed(2)}`;
                    break;
                case 'PerUnit':
                    const basisVal = aggregatedUnits[comp.unitBasis || ''] || 0;
                    rate = latestRates[comp.id] || 0;
                    totalValue = basisVal * rate;
                    detail = `${basisVal.toLocaleString()} ${comp.unitBasis} @ ${rate.toFixed(4)}`;
                    break;
                case 'Tiered':
                    const tierInput = aggregatedUnits[comp.unitBasis || ''] || 0;
                    detail = `${tierInput.toLocaleString()} ${comp.unitBasis} across tiers: `;
                    comp.tiers?.forEach((tier, idx) => {
                        const tierRate = latestRates[`${comp.id}_${idx}`] || 0;
                        const qtyInTier = Math.max(0, Math.min(tierInput, tier.to || Infinity) - tier.from);
                        if (qtyInTier > 0) {
                            totalValue += qtyInTier * tierRate;
                            detail += `[${qtyInTier.toFixed(1)} @ ${tierRate.toFixed(4)}] `;
                        }
                    });
                    break;
                case 'TimeOfUse':
                    detail = "TOU usage: ";
                    comp.touSlots?.forEach((slot, idx) => {
                        const slotRate = latestRates[`${comp.id}_${idx}`] || 0;
                        const slotInput = touUnits[`${comp.id}_${idx}`] || 0;
                        const slotVal = slotInput * slotRate;
                        totalValue += slotVal;
                        if(slotInput > 0) detail += `${slot.name}: ${slotInput.toLocaleString()} @ ${slotRate.toFixed(4)}; `;
                    });
                    break;
                case 'Percentage':
                case 'RateTimesSubtotal':
                    rate = latestRates[comp.id] || 0;
                    const multiplier = comp.method === 'Percentage' ? (rate / 100) : rate;
                    let runningBasisSum = 0;
                    comp.basisComponentIds?.forEach(bId => {
                        const bComp = billingComponents.find(c => c.id === bId);
                        if (!bComp) return;
                        if (comp.subtotalBasisType === 'RecordedValues') runningBasisSum += aggregatedUnits[bComp.unitBasis || ''] || 0;
                        else runningBasisSum += results[bId]?.total || 0;
                    });
                    totalValue = runningBasisSum * multiplier;
                    detail = `${comp.method === 'Percentage' ? (rate + '%') : ('x' + rate)} of sub-total (${runningBasisSum.toFixed(2)})`;
                    break;
            }

            results[comp.id] = { total: totalValue, detail, method: comp.method };
            grandTotal += totalValue;
        });

        return { results, grandTotal };
    }, [billingComponents, latestRates, aggregatedUnits, touUnits, organisation.currency.code]);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="p-8 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
                    <div className="space-y-1">
                        <p className="text-2xl font-black uppercase tracking-tight">Period Financial Statement</p>
                        <div className="flex items-center gap-2">
                             <span className="bg-indigo-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-500">Peak Demand Optimized</span>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {node.name} • {startDate} to {endDate}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reporting Currency</p>
                        <p className="text-xl font-black">{organisation.currency.code}</p>
                    </div>
                </div>

                {!isBillingMaturityReached && !loading && (
                    <div className="mx-8 mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 flex items-center gap-4 animate-fade-in">
                        <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Maturity Alert: kVA Exclusion</p>
                            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tight mt-0.5">
                                Current selection is {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24))} days. Peak Demand (kVA) is only integrated for billing cycles exceeding 27 days.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex-1 p-8 space-y-10 overflow-y-auto custom-scrollbar bg-white">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center italic text-slate-400 gap-4">
                            <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Recalculating Volumetric Aggregates...</p>
                        </div>
                    ) : (
                        categories.map(cat => {
                            const catComps = billingComponents.filter(c => c.categoryId === cat.id);
                            if (catComps.length === 0) return null;
                            const catTotal = catComps.reduce((acc, c) => acc + (billBreakdown.results[c.id]?.total || 0), 0);

                            return (
                                <div key={cat.id} className="space-y-4">
                                    <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
                                        <span className="text-xs font-black text-indigo-700 uppercase tracking-[0.2em]">{cat.name}</span>
                                        <span className="text-sm font-black text-slate-900">{organisation.currency.code} {catTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="space-y-4">
                                        {catComps.map(comp => {
                                            const res = billBreakdown.results[comp.id];
                                            if (!res) return null;
                                            
                                            const isKvaBasis = comp.unitBasis === 'kVA';
                                            const isBlocked = isKvaBasis && !isBillingMaturityReached;

                                            return (
                                                <div key={comp.id} className={`flex justify-between group px-2 transition-opacity ${isBlocked ? 'opacity-40' : ''}`}>
                                                    <div className="flex-1 pr-6">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">{comp.name}</p>
                                                            {isBlocked && <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Immature</span>}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium italic mt-1 group-hover:text-indigo-500 transition-colors">
                                                            {isBlocked ? 'Peak demand logic excluded for short duration' : res.detail}
                                                        </p>
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
                        })
                    )}
                </div>

                <div className="p-10 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 bg-white px-5 py-2 rounded-2xl border border-slate-200 shadow-inner">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total kWh</span>
                            <span className="text-sm font-black text-slate-800">{(aggregatedUnits['kWh'] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                         </div>
                         <div className="w-px h-6 bg-slate-200"></div>
                         <div className="flex flex-col">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${isBillingMaturityReached ? 'text-slate-400' : 'text-amber-500'}`}>
                                Maximum kVA Demand {!isBillingMaturityReached && '(Blocked)'}
                            </span>
                            <span className={`text-sm font-black ${isBillingMaturityReached ? 'text-rose-600' : 'text-slate-300'}`}>
                                {(aggregatedUnits['kVA'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                         </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Total Bill Calculation</span>
                        <span className="text-4xl font-black text-slate-900">
                             {organisation.currency.code} {billBreakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnergyBillView;