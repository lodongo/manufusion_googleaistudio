import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import LineChart from '../../../common/LineChart';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import 'firebase/compat/firestore';

const { Timestamp } = firebase.firestore;

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4'];

const METER_METRICS = [
    { id: 'active_energy_delta_kwh', label: 'Energy Delta', unit: 'kWh' },
    { id: 'active_energy_kwh', label: 'Total Energy', unit: 'kWh' },
    { id: 'active_power_kw', label: 'Active Power', unit: 'kW' },
    { id: 'apparent_power_kva', label: 'Apparent Power', unit: 'kVA' },
    { id: 'current_avg', label: 'Avg Current', unit: 'A' },
    { id: 'current_l1', label: 'Current L1', unit: 'A' },
    { id: 'current_l2', label: 'Current L2', unit: 'A' },
    { id: 'current_l3', label: 'Current L3', unit: 'A' },
    { id: 'frequency', label: 'Frequency', unit: 'Hz' },
    { id: 'neutral_current', label: 'Neutral Current', unit: 'A' },
    { id: 'power_factor', label: 'Power Factor', unit: '' },
    { id: 'reactive_power_kvar', label: 'Reactive Power', unit: 'kVAR' },
    { id: 'thdi_l1', label: 'THDi L1', unit: '%' },
    { id: 'thdi_l2', label: 'THDi L2', unit: '%' },
    { id: 'thdi_l3', label: 'THDi L3', unit: '%' },
    { id: 'thdv_l1', label: 'THDv L1', unit: '%' },
    { id: 'thdv_l2', label: 'THDv L2', unit: '%' },
    { id: 'thdv_l3', label: 'THDv L3', unit: '%' },
    { id: 'voltage_avg_ln', label: 'Avg Voltage (L-N)', unit: 'V' },
    { id: 'voltage_imbalance_pct', label: 'Voltage Imbalance', unit: '%' },
    { id: 'voltage_l1n', label: 'Voltage L1-N', unit: 'V' },
    { id: 'voltage_l2n', label: 'Voltage L2-N', unit: 'V' },
    { id: 'voltage_l3n', label: 'Voltage L3-N', unit: 'V' },
];

interface EnergyTrendsViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
    startDate: string;
    endDate: string;
}

const EnergyTrendsView: React.FC<EnergyTrendsViewProps> = ({ node, organisation, theme, startDate, endDate }) => {
    const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>(['active_power_kw']);
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    // UI Toggles
    const [showAvg, setShowAvg] = useState(true);
    const [showTrend, setShowTrend] = useState(true);
    const chartRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Engine settings (defaults)
    const [historyHorizon, setHistoryHorizon] = useState(12);
    const [forecastHorizon, setForecastHorizon] = useState(12);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if(entries[0]) setContainerWidth(entries[0].contentRect.width);
        });
        if (chartRef.current) observer.observe(chartRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchData = async () => {
            const now = new Date();
            const start = new Date(startDate);
            let end = new Date(endDate);
            
            if (startDate.length <= 10) start.setHours(0,0,0,0);
            if (endDate.length <= 10) end.setHours(23,59,59,999);
            if (end > now) end = now;

            const intervalBuckets = new Map<number, Record<string, { sum: number, count: number }>>();

            const processPoints = (data: any[], multiplier: number) => {
                data.forEach(p => {
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
                });
            };

            const resolveNodeData = async (targetNode: TopographyNode) => {
                if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                    for (const link of targetNode.linkedMeters) {
                        const mSnap = await db.doc(`organisations/${organisation.domain}/modules/EM/meters/${link.meterId}`).get();
                        const ip = mSnap.data()?.ipAddress;
                        if (ip) {
                            const snap = await db.collection('energyManagement').doc(ip).collection('data')
                                .where('created_at', '>=', Timestamp.fromDate(start))
                                .where('created_at', '<=', Timestamp.fromDate(end))
                                .orderBy('created_at', 'asc');
                            const snapResult = await snap.get();
                            processPoints(snapResult.docs.map(d => d.data()), link.operation === 'subtract' ? -1 : 1);
                        }
                    }
                } else if (targetNode.meteringType === 'Summation') {
                    const childrenSnap = await db.collection(`${targetNode.path}/nodes`).get();
                    for (const childDoc of childrenSnap.docs) {
                        const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                        await resolveNodeData(child);
                    }
                } else if (targetNode.meteringType === 'Manual') {
                    const mSnap = await db.collection(`organisations/${organisation.domain}/modules/EM/manualEntries/${targetNode.id}/dates`)
                        .where('submittedAt', '>=', Timestamp.fromDate(start))
                        .where('submittedAt', '<=', Timestamp.fromDate(end));
                     const mSnapResult = await mSnap.get();
                     mSnapResult.docs.forEach(d => {
                        processPoints([{ ...d.data().readings, created_at: d.data().submittedAt }], 1);
                     });
                }
            };

            await resolveNodeData(node);
            if (isMounted) {
                const finalData = Array.from(intervalBuckets.entries()).map(([ts, metrics]) => {
                    const flattened: any = { created_at: Timestamp.fromMillis(ts) };
                    Object.entries(metrics).forEach(([key, stats]) => {
                        if (key.includes('energy_delta')) flattened[key] = stats.sum;
                        else flattened[key] = stats.count > 0 ? stats.sum / stats.count : 0;
                    });
                    return flattened;
                }).sort((a,b) => a.created_at.seconds - b.created_at.seconds);

                setHistoricalData(finalData);
                setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [node.id, startDate, endDate, organisation.domain, node.path, node.meteringType]);

    const toggleMetric = (id: string) => {
        setSelectedMetricIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 overflow-y-auto h-full">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-3xl">
                <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    <button onClick={() => setShowAvg(!showAvg)} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition-all ${showAvg ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Avg Line</button>
                    <button onClick={() => setShowTrend(!showTrend)} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition-all ${showTrend ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Trend Line</button>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                        {selectedMetricIds.map((mId, i) => (
                            <div key={mId} className="w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</div>
                        ))}
                    </div>
                    <button onClick={() => setIsSelectorOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 10-4m0 4a2 2 0 11-4m0 4v2m0-6V4" /></svg>
                        Adjust Metrics
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {loading ? (
                    <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl p-20 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-600 mb-4"></div>
                        <p className="font-black uppercase tracking-widest text-[10px]">Processing Telemetry Matrix...</p>
                    </div>
                ) : historicalData.length < 2 ? (
                    <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl p-20 flex flex-col items-center justify-center text-slate-300 text-center">
                         <svg className="w-20 h-20 mb-4 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                         <p className="font-black uppercase tracking-widest text-xs">Insufficient Historical Data for Selected Window</p>
                    </div>
                ) : (
                    selectedMetricIds.map((mId, idx) => {
                        const metric = METER_METRICS.find(m => m.id === mId);
                        return (
                            <div key={mId} className="bg-white rounded-[3rem] border border-slate-200 shadow-xl p-8 h-[350px] flex flex-col relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                <div className="flex justify-between items-center mb-4 px-4">
                                    <div className="flex flex-col">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{metric?.label}</h4>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{metric?.id} ({metric?.unit})</span>
                                    </div>
                                    <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100 shadow-inner">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Plane {idx + 1}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar flex flex-col" ref={idx === 0 ? chartRef : undefined}>
                                    <div className="flex-1 min-h-[220px]">
                                        <LineChart 
                                            data={historicalData.map(d => ({ date: d.created_at.toDate(), rate: d[mId] || 0 }))} 
                                            themeColor={COLORS[idx % COLORS.length]}
                                            showAverage={showAvg}
                                            showTrendline={showTrend}
                                            minDateOverride={new Date(startDate)}
                                            maxDateOverride={new Date(endDate)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Intelligence Matrix Selection" size="5xl">
                <div className="space-y-8 p-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Metric Parameters</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {METER_METRICS.map(m => {
                                    const isSelected = selectedMetricIds.includes(m.id);
                                    const order = selectedMetricIds.indexOf(m.id) + 1;
                                    return (
                                        <button key={m.id} onClick={() => toggleMetric(m.id)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-xl translate-y-[-2px]' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-white'}`}>
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black uppercase tracking-tight">{m.label}</span>
                                                <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>{m.id} {m.unit ? `• ${m.unit}` : ''}</span>
                                            </div>
                                            {isSelected && <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-black shadow-inner">{order}</div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Horizon Aggregates</h4>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2"><span>History Lookback</span><span className="text-indigo-600 font-black">{historyHorizon}m</span></div>
                                <input type="range" min="3" max="60" value={historyHorizon} onChange={e => setHistoryHorizon(Number(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2"><span>Forecast Window</span><span className="text-purple-600 font-black">{forecastHorizon}m</span></div>
                                <input type="range" min="1" max="60" value={forecastHorizon} onChange={e => setForecastHorizon(Number(e.target.value))} className="w-full accent-purple-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-slate-100">
                        <Button onClick={() => setIsSelectorOpen(false)} className="!w-auto px-16 rounded-full font-black uppercase text-xs tracking-[0.2em] h-14 shadow-2xl shadow-indigo-100" style={{ backgroundColor: theme.colorPrimary }}>Confirm Selections</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default EnergyTrendsView;