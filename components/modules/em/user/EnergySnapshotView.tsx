import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { TopographyNode, EnergyBillingComponent, EnergyCategory, TariffUpdateLog } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import LineChart from '../../../common/LineChart';

const { Timestamp } = firebase.firestore;

interface EnergySnapshotViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    startDate: string;
    endDate: string;
}

interface NodeAggregate {
    unitBasis: Record<string, number>;
    touUnits: Record<string, number>;
    avgMetrics: {
        currentSum: number;
        voltageSum: number;
        count: number;
        minPf: number;
    };
    telemetryPoints: any[];
}

const SnapshotCard: React.FC<{ 
    label: string; 
    value: string | number; 
    unit?: string; 
    colorClass?: string; 
    onClick?: () => void;
    warning?: string;
}> = ({ label, value, unit, colorClass = "text-slate-800", onClick, warning }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center transition-all duration-300 relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 active:scale-95' : ''} ${warning ? 'border-amber-200 bg-amber-50/10' : ''}`}
    >
        {warning && (
            <div className="absolute top-0 right-0 p-3 text-amber-500" title={warning}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            </div>
        )}
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</span>
        <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tabular-nums ${colorClass} ${warning ? 'opacity-50' : ''}`}>
                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : value}
            </span>
            {unit && <span className="text-xs font-black text-slate-400 uppercase">{unit}</span>}
        </div>
        {onClick && (
            <div className="mt-4 flex items-center gap-1 text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                <span>{warning ? 'View Maturity Details' : 'View Details'}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </div>
        )}
    </div>
);

const EnergySnapshotView: React.FC<EnergySnapshotViewProps> = ({ node, organisation, theme, startDate, endDate }) => {
    const [loading, setLoading] = useState(false);
    
    // Results from Aggregation
    const [aggregatedUnits, setAggregatedUnits] = useState<Record<string, number>>({});
    const [touUnits, setTouUnits] = useState<Record<string, number>>({});
    const [summaryMetrics, setSummaryMetrics] = useState({ current: 0, voltage: 0, pf: 1 });
    const [telemetryPoints, setTelemetryPoints] = useState<any[]>([]);
    
    const [billingComponents, setBillingComponents] = useState<EnergyBillingComponent[]>([]);
    const [categories, setCategories] = useState<EnergyCategory[]>([]);
    const [latestRates, setLatestRates] = useState<Record<string, number>>({});

    // Modal States
    const [drillDown, setDrillDown] = useState<{ type: 'kWh' | 'Current' | 'Voltage' | 'PF' | 'Bill' } | null>(null);

    const modulePath = `organisations/${organisation.domain}/modules/EM`;

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
                const mapSnap = await db.doc(`${modulePath}/settings/meterInputs`).get();
                const globalMappings = mapSnap.exists ? mapSnap.data()?.mappings || {} : {};

                const [compSnap, catSnap] = await Promise.all([
                    db.collection(`${modulePath}/billingComponents`).where('enabled', '==', true).orderBy('order').get(),
                    db.collection(`${modulePath}/billingCategories`).orderBy('order').get()
                ]);

                if (isMounted) {
                    setBillingComponents(compSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyBillingComponent)));
                    setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyCategory)));
                }

                const monthStr = startDate.slice(0, 7);
                const rateSnap = await db.collection(`${modulePath}/monthlyAdjustments/${monthStr}/history`).orderBy('timestamp', 'desc').limit(1).get();
                if (isMounted && !rateSnap.empty) setLatestRates((rateSnap.docs[0].data() as TariffUpdateLog).values);

                const now = new Date();
                const sDate = new Date(startDate);
                let eDate = new Date(endDate);
                
                if (startDate.length <= 10) sDate.setHours(0,0,0,0);
                if (endDate.length <= 10) eDate.setHours(23,59,59,999);
                if (eDate > now) eDate = now;

                const comps = compSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnergyBillingComponent));

                const getAggregateForNode = async (targetNode: TopographyNode): Promise<NodeAggregate> => {
                    const nodeUnits: Record<string, number> = {};
                    const nodeTouUnits: Record<string, number> = {};
                    const intervalBuckets = new Map<number, Record<string, { sum: number, count: number }>>();
                    
                    let minPf = 1;

                    const processDataSnap = (dataSnap: firebase.firestore.QuerySnapshot, multiplier: number) => {
                        dataSnap.docs.forEach(pDoc => {
                            const p = pDoc.data();
                            const ts = p.created_at?.toMillis ? p.created_at.toMillis() : (p.created_at?.seconds * 1000 || 0);
                            const bucketKey = Math.floor(ts / (5 * 60 * 1000)) * (5 * 60 * 1000);
                            
                            if (!intervalBuckets.has(bucketKey)) intervalBuckets.set(bucketKey, {});
                            const bucket = intervalBuckets.get(bucketKey)!;

                            Object.entries(p).forEach(([key, val]) => {
                                if (typeof val === 'number') {
                                    if (!bucket[key]) bucket[key] = { sum: 0, count: 0 };
                                    bucket[key].sum += (val * multiplier);
                                    bucket[key].count += 1;
                                }
                            });

                            if (p.power_factor && p.power_factor < minPf) minPf = p.power_factor;
                        });
                    };

                    if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                        for (const link of targetNode.linkedMeters) {
                            const mSnap = await db.doc(`${modulePath}/meters/${link.meterId}`).get();
                            const ip = mSnap.data()?.ipAddress;
                            if (ip) {
                                const snap = await db.collection('energyManagement').doc(ip).collection('data')
                                    .where('created_at', '>=', Timestamp.fromDate(sDate))
                                    .where('created_at', '<=', Timestamp.fromDate(eDate))
                                    .get();
                                processDataSnap(snap, link.operation === 'subtract' ? -1 : 1);
                            }
                        }
                    } else if (targetNode.meteringType === 'Summation') {
                        const childrenSnap = await db.collection(`${targetNode.path}/nodes`).get();
                        for (const childDoc of childrenSnap.docs) {
                            const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                            const childAgg = await getAggregateForNode(child);
                            childAgg.telemetryPoints.forEach(p => {
                                const ts = p.created_at.toMillis ? p.created_at.toMillis() : p.created_at.seconds * 1000;
                                const bucketKey = Math.floor(ts / (5 * 60 * 1000)) * (5 * 60 * 1000);
                                if (!intervalBuckets.has(bucketKey)) intervalBuckets.set(bucketKey, {});
                                const bucket = intervalBuckets.get(bucketKey)!;
                                Object.entries(p).forEach(([key, val]) => {
                                    if (typeof val === 'number' && key !== 'multiplier') {
                                        if (!bucket[key]) bucket[key] = { sum: 0, count: 0 };
                                        bucket[key].sum += val;
                                        bucket[key].count += 1;
                                    }
                                });
                            });
                            if (childAgg.avgMetrics.minPf < minPf) minPf = childAgg.avgMetrics.minPf;
                        }
                    } else if (targetNode.meteringType === 'Manual') {
                        const qManual = db.collection(`${modulePath}/manualEntries/${targetNode.id}/dates`)
                            .where('submittedAt', '>=', Timestamp.fromDate(sDate))
                            .where('submittedAt', '<=', Timestamp.fromDate(eDate));
                        const mSnap = await qManual.get();
                        
                        mSnap.docs.forEach(d => {
                            const readings = d.data().readings || {};
                            const ts = d.data().submittedAt.toMillis ? d.data().submittedAt.toMillis() : d.data().submittedAt.seconds * 1000;
                            const bucketKey = Math.floor(ts / (5 * 60 * 1000)) * (5 * 60 * 1000);
                            if (!intervalBuckets.has(bucketKey)) intervalBuckets.set(bucketKey, {});
                            const bucket = intervalBuckets.get(bucketKey)!;
                            Object.entries(readings).forEach(([key, val]) => {
                                if (typeof val === 'number') {
                                    if (!bucket[key]) bucket[key] = { sum: 0, count: 0 };
                                    bucket[key].sum += val;
                                    bucket[key].count += 1;
                                }
                            });
                        });
                    }

                    const flattenedPoints = Array.from(intervalBuckets.entries()).map(([ts, metrics]) => {
                        const p: any = { created_at: Timestamp.fromMillis(ts) };
                        Object.entries(metrics).forEach(([key, stats]) => {
                            if (key.includes('energy_delta')) p[key] = stats.sum;
                            else p[key] = stats.count > 0 ? stats.sum / stats.count : 0;
                        });
                        return p;
                    }).sort((a,b) => a.created_at.seconds - b.created_at.seconds);

                    flattenedPoints.forEach(p => {
                        const hour = p.created_at.toDate().getHours();
                        Object.entries(globalMappings).forEach(([unitKey, mapping]: [string, any]) => {
                            const val = p[mapping.parameterId];
                            if (typeof val === 'number') {
                                let method = mapping.method || 'Sum';
                                if (unitKey === 'kVA') {
                                    if (!isBillingMaturityReached) { nodeUnits[unitKey] = 0; return; }
                                    method = 'Max';
                                }
                                if (unitKey === 'kWh') method = 'Sum';

                                if (method === 'Sum') nodeUnits[unitKey] = (nodeUnits[unitKey] || 0) + val;
                                else if (method === 'Max') nodeUnits[unitKey] = Math.max(nodeUnits[unitKey] || 0, val);

                                comps.filter(c => c.method === 'TimeOfUse' && c.unitBasis === unitKey).forEach(c => {
                                    c.touSlots?.forEach((slot, sIdx) => {
                                        let inWindow = (slot.startHour < slot.endHour) 
                                            ? (hour >= slot.startHour && hour < slot.endHour)
                                            : (hour >= slot.startHour || hour < slot.endHour);
                                        if (inWindow) {
                                            const key = `${c.id}_${sIdx}`;
                                            if (unitKey === 'kVA' && !isBillingMaturityReached) { nodeTouUnits[key] = 0; return; }
                                            if (method === 'Sum') nodeTouUnits[key] = (nodeTouUnits[key] || 0) + val;
                                            else if (method === 'Max') nodeTouUnits[key] = Math.max(nodeTouUnits[key] || 0, val);
                                        }
                                    });
                                });
                            }
                        });
                    });

                    return { 
                        unitBasis: nodeUnits, 
                        touUnits: nodeTouUnits, 
                        avgMetrics: { 
                            currentSum: flattenedPoints.reduce((acc, p) => acc + (p.current_avg || 0), 0), 
                            voltageSum: flattenedPoints.reduce((acc, p) => acc + (p.voltage_avg_ln || 0), 0), 
                            count: flattenedPoints.length, 
                            minPf 
                        }, 
                        telemetryPoints: flattenedPoints 
                    };
                };

                const result = await getAggregateForNode(node);

                if (isMounted) {
                    setAggregatedUnits(result.unitBasis);
                    setTouUnits(result.touUnits);
                    setSummaryMetrics({
                        current: result.avgMetrics.count > 0 ? result.avgMetrics.currentSum / result.avgMetrics.count : 0,
                        voltage: result.avgMetrics.count > 0 ? result.avgMetrics.voltageSum / result.avgMetrics.count : 0,
                        pf: result.avgMetrics.minPf
                    });
                    setTelemetryPoints(result.telemetryPoints);
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
        const results: Record<string, { total: number, detail: string }> = {};
        let grandTotal = 0;

        billingComponents.forEach(comp => {
            let rate = 0; let totalValue = 0; let detail = "";
            switch (comp.method) {
                case 'Flat':
                    rate = latestRates[comp.id] || 0;
                    totalValue = rate;
                    detail = `Fixed: ${organisation.currency.code} ${rate.toFixed(2)}`;
                    break;
                case 'PerUnit':
                    const basisVal = aggregatedUnits[comp.unitBasis || ''] || 0;
                    rate = latestRates[comp.id] || 0;
                    totalValue = basisVal * rate;
                    detail = `${basisVal.toLocaleString()} ${comp.unitBasis} @ ${rate.toFixed(4)}`;
                    break;
                case 'Tiered':
                    const tierInput = aggregatedUnits[comp.unitBasis || ''] || 0;
                    detail = `${tierInput.toLocaleString()} ${comp.unitBasis} tiers: `;
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
                    detail = "TOU slices: ";
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
                    detail = `${comp.method === 'Percentage' ? (rate + '%') : ('x' + rate)} of base (${runningBasisSum.toFixed(2)})`;
                    break;
            }
            results[comp.id] = { total: totalValue, detail };
            grandTotal += totalValue;
        });
        return { results, grandTotal };
    }, [billingComponents, latestRates, aggregatedUnits, touUnits, organisation.currency.code]);

    const getChartData = (id: string) => {
        return telemetryPoints.map(p => ({
            date: p.created_at.toDate(),
            rate: p[id] || 0
        }));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <SnapshotCard label="Consumption" value={aggregatedUnits['kWh'] || 0} unit="kWh" onClick={() => setDrillDown({ type: 'kWh' })} />
                <SnapshotCard label="Mean Current" value={summaryMetrics.current} unit="Amps" onClick={() => setDrillDown({ type: 'Current' })} />
                <SnapshotCard label="Mean Voltage" value={summaryMetrics.voltage} unit="Volts" onClick={() => setDrillDown({ type: 'Voltage' })} />
                <SnapshotCard label="Min Power Factor" value={summaryMetrics.pf} colorClass={(summaryMetrics.pf < 0.9) ? 'text-rose-600' : 'text-emerald-600'} onClick={() => setDrillDown({ type: 'PF' })} />
                <SnapshotCard 
                    label="Est. Expenditure" 
                    value={billBreakdown.grandTotal} 
                    unit={organisation.currency.code} 
                    colorClass="text-indigo-600" 
                    onClick={() => setDrillDown({ type: 'Bill' })} 
                    warning={!isBillingMaturityReached ? "kVA charges excluded due to short period" : undefined}
                />
            </div>

            <div className="p-10 bg-slate-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19 20 15.19 20 10.5 16.19 2 11.5 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zM12 7h-1v4l3 3 .7-.7-2.7-2.7V7z"/></svg>
                </div>
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Period Executive Summary</h3>
                    <p className="text-sm text-indigo-300 mt-2 max-w-lg leading-relaxed font-medium">
                        Calculated from <strong>{telemetryPoints.length}</strong> aggregated data windows. Summary logic is aligned with billing standards: kVA is reported as peak demand observed only if period exceeds 27 days.
                    </p>
                </div>
                <div className="flex gap-4">
                     <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-center min-w-[140px]">
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest block mb-1">Peak Load</span>
                        <span className="text-xl font-black">{(Math.max(...telemetryPoints.map(p => p.active_power_kw || 0)) || 0).toFixed(1)} <span className="text-[10px]">kW</span></span>
                     </div>
                     <div className={`p-5 rounded-3xl border text-center min-w-[140px] transition-all ${isBillingMaturityReached ? 'bg-white/10 border-white/10' : 'bg-amber-500/10 border-amber-500/20'}`}>
                        <div className="flex flex-col h-full justify-center">
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest block mb-1">Peak Demand</span>
                            {isBillingMaturityReached ? (
                                <span className="text-xl font-black text-white">{(aggregatedUnits['kVA'] || 0).toFixed(1)} <span className="text-[10px]">kVA</span></span>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-xl font-black text-amber-500">BLOCKED</span>
                                    <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter mt-1">Immature Window</span>
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            </div>

            <Modal isOpen={!!drillDown} onClose={() => setDrillDown(null)} title={drillDown?.type === 'Bill' ? 'Financial Ledger Drill-down' : `Trend Analysis: ${drillDown?.type}`} size="5xl">
                {drillDown?.type === 'Bill' ? (
                    <div className="space-y-8 p-2">
                        <div className="p-8 bg-slate-900 rounded-3xl text-white shadow-xl flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest">Aggregate Expenditure</p>
                                <p className="text-4xl font-black mt-1">{organisation.currency.code} {billBreakdown.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 uppercase font-black">Target Node</p>
                                <p className="text-sm font-bold">{node.name}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-4">
                            {categories.map(cat => {
                                const catComps = billingComponents.filter(c => c.categoryId === cat.id);
                                if (catComps.length === 0) return null;
                                const catTotal = catComps.reduce((acc, c) => acc + (billBreakdown.results[c.id]?.total || 0), 0);
                                return (
                                    <div key={cat.id} className="space-y-4">
                                        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
                                            <span className="text-xs font-black text-indigo-700 uppercase tracking-[0.2em]">{cat.name}</span>
                                            <span className="text-sm font-black text-slate-900">{organisation.currency.code} {catTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {catComps.map(comp => {
                                                const res = billBreakdown.results[comp.id];
                                                if (!res) return null;
                                                const isBlocked = comp.unitBasis === 'kVA' && !isBillingMaturityReached;
                                                return (
                                                    <div key={comp.id} className={`flex justify-between items-start group ${isBlocked ? 'opacity-30' : ''}`}>
                                                        <div className="flex-1 pr-8">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">{comp.name}</p>
                                                                {isBlocked && <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded uppercase">Blocked</span>}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-medium italic mt-1 group-hover:text-indigo-500 transition-colors">{isBlocked ? 'Insufficient time maturity for demand calculation' : res.detail}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-sm font-mono font-bold text-slate-700">{res.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-[450px] p-2 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Period Distribution: {drillDown?.type}</h4>
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 uppercase">Snapshot View</span>
                        </div>
                        <div className="flex-1 min-h-[300px]">
                             <LineChart 
                                data={getChartData(
                                    drillDown?.type === 'kWh' ? 'active_energy_delta_kwh' :
                                    drillDown?.type === 'Current' ? 'current_avg' :
                                    drillDown?.type === 'Voltage' ? 'voltage_avg_ln' :
                                    'power_factor'
                                )} 
                                themeColor={theme.colorPrimary} 
                                showAverage={true}
                                showTrendline={true}
                                minDateOverride={new Date(startDate)}
                                maxDateOverride={new Date(endDate)}
                            />
                        </div>
                    </div>
                )}
                <div className="flex justify-end pt-6 border-t border-slate-100 mt-6">
                    <Button onClick={() => setDrillDown(null)} variant="secondary" className="!w-auto px-12 rounded-full font-black uppercase text-[10px] tracking-widest">Close View</Button>
                </div>
            </Modal>
        </div>
    );
};

export default EnergySnapshotView;