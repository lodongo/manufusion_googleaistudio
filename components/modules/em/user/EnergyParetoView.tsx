import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import 'firebase/compat/firestore';

const { Timestamp } = firebase.firestore;
const BAR_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6'];

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

const ColumnChart: React.FC<{ 
    data: { label: string, value: number }[], 
    color: string, 
    unit: string, 
    showAvg: boolean, 
    showTrend: boolean 
}> = ({ data, color, unit, showAvg, showTrend }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const height = 250;
    const padding = { top: 40, right: 30, bottom: 60, left: 60 };
    const minBarWidth = 80;

    useEffect(() => {
        const obs = new ResizeObserver(entries => { if(entries[0]) setWidth(entries[0].contentRect.width); });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const { bars, yTicks, avgY, trendPath, yScale, actualWidth } = useMemo(() => {
        if (!width || data.length === 0) return { bars: [], yTicks: [], avgY: null, trendPath: '', yScale: (v: number) => 0, actualWidth: 0 };
        
        const minChartWidth = data.length * minBarWidth + padding.left + padding.right;
        const actualWidth = Math.max(width, minChartWidth);
        const chartW = actualWidth - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const maxVal = Math.max(...data.map(d => d.value), 1) * 1.2;

        const xScale = (i: number) => padding.left + (i / data.length) * chartW;
        const yScale = (v: number) => padding.top + chartH - (v / maxVal) * chartH;
        const barWidth = (chartW / data.length) * 0.7;

        const bars = data.map((d, i) => ({
            x: xScale(i) + (chartW / data.length - barWidth) / 2,
            y: yScale(d.value),
            w: barWidth,
            h: Math.max(0, chartH - (yScale(d.value) - padding.top)),
            value: d.value,
            label: d.label
        }));

        const yTicks = [0, maxVal / 2, maxVal];
        const avg = data.reduce((a, b) => a + b.value, 0) / data.length;
        const avgYValue = yScale(avg);

        let trend = '';
        if (showTrend && data.length > 1) {
            const n = data.length;
            let sX = 0, sY = 0, sXY = 0, sXX = 0;
            data.forEach((d, i) => {
                sX += i; sY += d.value; sXY += i * d.value; sXX += i * i;
            });
            const m = (n * sXY - sX * sY) / (n * sXX - sX * sX || 1);
            const b = (sY - m * sX) / n;
            const startX = xScale(0) + (chartW / data.length) / 2;
            const endX = xScale(n - 1) + (chartW / data.length) / 2;
            trend = `M ${startX} ${yScale(b)} L ${endX} ${yScale(m * (n - 1) + b)}`;
        }

        return { bars, yTicks, avgY: avgYValue, trendPath: trend, yScale, actualWidth };
    }, [data, width, showTrend]);

    return (
        <div ref={containerRef} className="w-full h-full overflow-x-auto custom-scrollbar">
            <svg width={actualWidth} height={height} className="overflow-visible">
                {yTicks.map(t => (
                    <g key={t} transform={`translate(0, ${yScale(t)})`}>
                        <line x1={padding.left} x2={actualWidth - padding.right} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={padding.left - 10} dy="0.32em" textAnchor="end" fontSize="9" fontWeight="bold" fill="#94a3b8">{t.toFixed(1)}</text>
                    </g>
                ))}

                {bars.map((b, i) => (
                    <g key={i} className="group">
                        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={color} rx="4" className="transition-all duration-700 opacity-80 hover:opacity-100 shadow-sm" />
                        <text x={b.x + b.w / 2} y={height - padding.bottom + 15} textAnchor="middle" fontSize="9" fontWeight="black" fill="#64748b" className="uppercase tracking-tighter" transform={`rotate(25, ${b.x + b.w / 2}, ${height - padding.bottom + 15})`}>
                            {b.label}
                        </text>
                        <text x={b.x + b.w / 2} y={b.y - 5} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {b.value.toFixed(1)}
                        </text>
                    </g>
                ))}

                {showAvg && avgY !== null && (
                    <g>
                        <line x1={padding.left} y1={avgY} x2={actualWidth - padding.right} y2={avgY} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" opacity="0.6" />
                        <text x={actualWidth - padding.right} y={avgY - 5} textAnchor="end" fontSize="8" fontWeight="black" fill={color} opacity="0.8">MEAN</text>
                    </g>
                )}
                {showTrend && trendPath && (
                    <path d={trendPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 2" opacity="0.5" />
                )}
                
                <line x1={padding.left} y1={height - padding.bottom} x2={actualWidth - padding.right} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="2" />
            </svg>
        </div>
    );
};

interface EnergyParetoViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
    startDate: string;
    endDate: string;
}

const EnergyParetoView: React.FC<EnergyParetoViewProps> = ({ node, organisation, theme, startDate, endDate }) => {
    const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>(['active_energy_delta_kwh']);
    const [childPerformance, setChildPerformance] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    // UI Toggles
    const [showAvg, setShowAvg] = useState(true);
    const [showTrend, setShowTrend] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchData = async () => {
            const now = new Date();
            const start = new Date(startDate); 
            if (startDate.length <= 10) start.setHours(0,0,0,0);

            let end = new Date(endDate); 
            if (endDate.length <= 10) end.setHours(23,59,59,999);
            
            // kVA Maturity Check: based on SELECTED range
            const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
            const isBillingMaturityReached = diffDays > 27;

            // Cap at now for actual data querying
            if (end > now) end = now;

            const childrenSnap = await db.collection(`${node.path}/nodes`).get();
            
            const results = await Promise.all(childrenSnap.docs.map(async (childDoc) => {
                const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                const metrics: Record<string, number> = {};
                const metricsCounts: Record<string, number> = {};
                
                const fetchMetrics = async (n: TopographyNode) => {
                    if (n.meteringType === 'Metered' && n.linkedMeters) {
                        for(const l of n.linkedMeters) {
                            const mSnap = await db.doc(`organisations/${organisation.domain}/modules/EM/meters/${l.meterId}`).get();
                            const ip = mSnap.data()?.ipAddress;
                            if (ip) {
                                const q = db.collection('energyManagement').doc(ip).collection('data')
                                    .where('created_at', '>=', Timestamp.fromDate(start))
                                    .where('created_at', '<=', Timestamp.fromDate(end));
                                const dataSnap = await q.get();
                                dataSnap.docs.forEach(pDoc => {
                                    const p = pDoc.data();
                                    Object.keys(p).forEach(k => { 
                                        if(typeof p[k] === 'number') {
                                            const val = p[k] * (l.operation === 'subtract' ? -1 : 1);
                                            // Respect Node specific logic even in Pareto
                                            const method = n.parameterConfigs?.[k]?.method || 'Sum';
                                            
                                            // Dynamic kVA restriction
                                            if (k === 'apparent_power_kva' && !isBillingMaturityReached) {
                                                metrics[k] = 0;
                                                return;
                                            }

                                            if (method === 'Sum') metrics[k] = (metrics[k] || 0) + val;
                                            else if (method === 'Max') metrics[k] = Math.max(metrics[k] || -Infinity, val);
                                            else if (method === 'Min') metrics[k] = Math.min(metrics[k] || Infinity, val);
                                            else if (method === 'Avg') { metrics[k] = (metrics[k] || 0) + val; metricsCounts[k] = (metricsCounts[k] || 0) + 1; }
                                        }
                                    });
                                });
                            }
                        }
                    } else if (n.meteringType === 'Summation') {
                        const subs = await db.collection(`${n.path}/nodes`).get();
                        for(const s of subs.docs) await fetchMetrics({ id: s.id, ...s.data(), path: s.ref.path } as TopographyNode);
                    } else if (n.meteringType === 'Manual') {
                        const qManual = db.collection(`organisations/${organisation.domain}/modules/EM/manualEntries/${n.id}/dates`)
                            .where('submittedAt', '>=', Timestamp.fromDate(start))
                            .where('submittedAt', '<=', Timestamp.fromDate(end));
                         const mSnap = await qManual.get();
                         mSnap.docs.forEach(d => {
                             const readings = d.data().readings || {};
                             Object.keys(readings).forEach(k => {
                                 if(typeof readings[k] === 'number') {
                                     const method = n.parameterConfigs?.[k]?.method || 'Sum';

                                     // Dynamic kVA restriction
                                     if (k === 'apparent_power_kva' && !isBillingMaturityReached) {
                                        metrics[k] = 0;
                                        return;
                                     }

                                     if (method === 'Sum') metrics[k] = (metrics[k] || 0) + readings[k];
                                     else if (method === 'Max') metrics[k] = Math.max(metrics[k] || -Infinity, readings[k]);
                                     else if (method === 'Min') metrics[k] = Math.min(metrics[k] || Infinity, readings[k]);
                                     else if (method === 'Avg') { metrics[k] = (metrics[k] || 0) + readings[k]; metricsCounts[k] = (metricsCounts[k] || 0) + 1; }
                                 }
                             });
                         });
                    }
                };

                await fetchMetrics(child);
                Object.keys(metricsCounts).forEach(k => { if(metricsCounts[k]>0) metrics[k] = metrics[k]/metricsCounts[k]; });
                Object.keys(metrics).forEach(k => { if(metrics[k] === Infinity || metrics[k] === -Infinity) metrics[k] = 0; });
                return { id: child.id, name: child.name, metrics };
            }));

            if (isMounted) {
                setChildPerformance(results);
                setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [node.id, startDate, endDate, organisation.domain, selectedMetricIds]);

    const toggleMetric = (id: string) => {
        setSelectedMetricIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
             <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-3xl">
                <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    <button 
                        onClick={() => setShowAvg(!showAvg)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition-all ${showAvg ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                    >
                        Avg Line
                    </button>
                    <button 
                        onClick={() => setShowTrend(!showTrend)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition-all ${showTrend ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                    >
                        Trend Line
                    </button>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsSelectorOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Compare Benchmarks
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {loading ? (
                    <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl p-20 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-600 mb-4"></div>
                        <p className="font-black uppercase tracking-widest text-[10px]">Decomposing Branch Telemetry...</p>
                    </div>
                ) : childPerformance.length === 0 ? (
                    <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl p-20 flex flex-col items-center justify-center text-slate-300">
                         <p className="font-black uppercase tracking-widest text-xs">No sub-items found for distribution analysis</p>
                    </div>
                ) : (
                    selectedMetricIds.map((mId, idx) => {
                        const metric = METER_METRICS.find(m => m.id === mId);
                        const chartData = childPerformance
                            .map(c => ({ label: c.name, value: c.metrics[mId] || 0 }))
                            .sort((a,b) => b.value - a.value);

                        return (
                            <div key={mId} className="bg-white rounded-[3rem] border border-slate-200 shadow-xl p-10 h-[450px] flex flex-col relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}></div>
                                <div className="flex justify-between items-center mb-6 px-4">
                                    <div className="flex flex-col">
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{metric?.label} Contribution</h4>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cross-sectional analysis ({metric?.unit})</span>
                                    </div>
                                    <div className="bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 shadow-inner">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dimension {idx + 1}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar">
                                    <ColumnChart 
                                        data={chartData} 
                                        color={BAR_COLORS[idx % BAR_COLORS.length]} 
                                        unit={metric?.unit || ''}
                                        showAvg={showAvg}
                                        showTrend={showTrend}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Comparison Matrix Setup" size="5xl">
                <div className="space-y-8 p-2">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">Select up to 3 Comparative Metrics</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {METER_METRICS.map(m => {
                                const isSelected = selectedMetricIds.includes(m.id);
                                const order = selectedMetricIds.indexOf(m.id) + 1;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => toggleMetric(m.id)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                                            isSelected
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-xl translate-y-[-2px]'
                                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-black uppercase tracking-tight">{m.label}</span>
                                            <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>{m.id} {m.unit ? `• ${m.unit}` : ''}</span>
                                        </div>
                                        {isSelected && (
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-inner bg-white text-slate-900`}>
                                                {order}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-slate-100">
                        <Button 
                            onClick={() => setIsSelectorOpen(false)} 
                            className="!w-auto px-16 rounded-full font-black uppercase text-xs tracking-[0.2em] h-14 shadow-2xl shadow-indigo-100" 
                            style={{ backgroundColor: theme.colorPrimary }}
                        >
                            Update Benchmarks
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default EnergyParetoView;
