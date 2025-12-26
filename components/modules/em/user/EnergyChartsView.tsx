import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import 'firebase/compat/firestore';
import WeeklyCalendarView from './charts/WeeklyCalendarView';
import LineChart from '../../../common/LineChart';

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

type GroupingPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';
type ChartType = 'column' | 'bar' | 'pie';

interface DrillStep {
    level: GroupingPeriod;
    label: string;
    start: Date;
    end: Date;
}

// --- HELPERS ---
const getWeekKey = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

const getWeekRange = (weekKey: string) => {
    const [year, week] = weekKey.split('-W').map(Number);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
    ISOweekEnd.setHours(23, 59, 59, 999);
    
    return { start: ISOweekStart, end: ISOweekEnd };
};

const aggregateDataPoints = (
    points: any[], 
    period: GroupingPeriod, 
    metricConfig: ParameterConfig & { id: string }
) => {
    const buckets: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const sourceParamId = metricConfig.parameterId;
    const method = metricConfig.method || 'Sum';

    points.forEach(p => {
        const date = p.created_at.toDate();
        let key = '';
        
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');

        switch (period) {
            case 'hour': key = date.getHours().toString().padStart(2, '0') + ':00'; break;
            case 'day': key = `${y}-${m}-${d}`; break;
            case 'week': key = getWeekKey(date); break;
            case 'month': key = `${y}-${m}`; break;
            case 'year': key = `${y}`; break;
        }

        const val = (p[sourceParamId] || 0) * (p.multiplier || 1);
        
        if (method === 'Sum') {
            buckets[key] = (buckets[key] || 0) + val;
        } else if (method === 'Max') {
            buckets[key] = Math.max(buckets[key] === undefined ? -Infinity : buckets[key], val);
        } else if (method === 'Min') {
            buckets[key] = Math.min(buckets[key] === undefined ? Infinity : buckets[key], val);
        } else if (method === 'Avg') {
            buckets[key] = (buckets[key] || 0) + val;
            counts[key] = (counts[key] || 0) + 1;
        } else {
            buckets[key] = val;
        }
    });

    if (method === 'Avg') {
        Object.keys(buckets).forEach(k => {
            if (counts[k] > 0) buckets[k] = buckets[k] / counts[k];
        });
    }

    return Object.entries(buckets)
        .map(([label, value]) => ({ 
            label, 
            value: value === Infinity || value === -Infinity ? 0 : value 
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
};

const PieChart: React.FC<{ 
    data: { label: string, value: number }[], 
    onSliceClick: (label: string) => void 
}> = ({ data, onSliceClick }) => {
    const total = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data]);
    let currentAngle = -Math.PI / -2;

    if (total === 0) return <div className="flex items-center justify-center h-full text-slate-400 italic">No value to display.</div>;

    return (
        <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-10">
            <div className="w-72 h-72">
                <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
                    {data.map((d, i) => {
                        if (d.value <= 0) return null;
                        const sliceAngle = (d.value / total) * 2 * Math.PI;
                        const x1 = 200 + 150 * Math.cos(currentAngle);
                        const y1 = 200 + 150 * Math.sin(currentAngle);
                        
                        currentAngle += sliceAngle;
                        const x2 = 200 + 150 * Math.cos(currentAngle);
                        const y2 = 200 + 150 * Math.sin(currentAngle);

                        const largeArc = sliceAngle > Math.PI ? 1 : 0;
                        const pathData = `M 200 200 L ${x1} ${y1} A 150 150 0 ${largeArc} 1 ${x2} ${y2} Z`;

                        return (
                            <g key={i} className="group cursor-pointer" onClick={() => onSliceClick(d.label)}>
                                <path 
                                    d={pathData} 
                                    fill={BAR_COLORS[i % BAR_COLORS.length]} 
                                    className="transition-all duration-300 hover:scale-[1.05] hover:opacity-90 origin-[200px_200px]"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div className="max-h-60 overflow-y-auto pr-4 space-y-2 custom-scrollbar">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs group cursor-pointer" onClick={() => onSliceClick(d.label)}>
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}></div>
                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{d.label}</span>
                        <span className="text-slate-400 font-mono">{(d.value / total * 100).toFixed(1)}%</span>
                        <span className="font-black text-slate-800 ml-auto">{d.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ColumnChart: React.FC<{ 
    data: { label: string, value: number }[], 
    color: string, 
    onBarClick: (label: string) => void
}> = ({ data, color, onBarClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const height = 350;
    const padding = { top: 40, right: 30, bottom: 80, left: 60 };
    const minBarWidth = 80;

    useEffect(() => {
        const obs = new ResizeObserver(entries => { if(entries[0]) setWidth(entries[0].contentRect.width); });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const { bars, yTicks, yScale, actualWidth } = useMemo(() => {
        if (!width || data.length === 0) return { bars: [], yTicks: [], yScale: (v: number) => 0, actualWidth: 0 };
        
        const minChartWidth = data.length * minBarWidth + padding.left + padding.right;
        const actualWidth = Math.max(width, minChartWidth);
        const chartW = actualWidth - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const maxVal = Math.max(...data.map(d => d.value), 1) * 1.2;

        const xScale = (i: number) => padding.left + (i / data.length) * chartW;
        const yScale = (v: number) => padding.top + chartH - (v / maxVal) * chartH;
        const barWidth = (chartW / data.length) * 0.8;

        const bars = data.map((d, i) => ({
            x: xScale(i) + (chartW / data.length - barWidth) / 2,
            y: yScale(d.value),
            w: barWidth,
            h: Math.max(0, chartH - (yScale(d.value) - padding.top)),
            value: d.value,
            label: d.label
        }));

        const yTicks = [0, maxVal / 2, maxVal];

        return { bars, yTicks, yScale, actualWidth };
    }, [data, width]);

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
                    <g key={i} className="group cursor-pointer" onClick={() => onBarClick(b.label)}>
                        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={color} rx="4" className="transition-all duration-700 opacity-80 hover:opacity-100 shadow-sm" />
                        <text 
                            x={b.x + b.w / 2} 
                            y={height - padding.bottom + 15} 
                            textAnchor="middle" 
                            fontSize="9" 
                            fontWeight="black" 
                            fill="#64748b" 
                            className="uppercase tracking-tighter" 
                            transform={`rotate(35, ${b.x + b.w / 2}, ${height - padding.bottom + 15})`}
                        >
                            {b.label}
                        </text>
                        <text x={b.x + b.w / 2} y={b.y - 5} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {b.value.toFixed(1)}
                        </text>
                    </g>
                ))}
                <line x1={padding.left} y1={height - padding.bottom} x2={actualWidth - padding.right} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="2" />
            </svg>
        </div>
    );
};

const DrillDownContainer: React.FC<{
    node: TopographyNode;
    organisation: Organisation;
    metricConfig: ParameterConfig & { id: string };
    theme: Organisation['theme'];
    initialStep: DrillStep;
}> = ({ node, organisation, metricConfig, theme, initialStep }) => {
    const [drillStack, setDrillStack] = useState<DrillStep[]>([initialStep]);
    const [telemetryPoints, setTelemetryPoints] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const activeStep = drillStack[drillStack.length - 1];

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        const fetchData = async () => {
            const now = new Date();
            const points: any[] = [];
            
            const sDate = activeStep.start;
            let eDate = activeStep.end;
            if (eDate > now) eDate = now;

            const resolveNodeData = async (targetNode: TopographyNode) => {
                if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                    for (const link of targetNode.linkedMeters) {
                        const mSnap = await db.doc(`organisations/${organisation.domain}/modules/EM/meters/${link.meterId}`).get();
                        const ip = mSnap.data()?.ipAddress;
                        if (ip) {
                            const q = db.collection('energyManagement').doc(ip).collection('data')
                                .where('created_at', '>=', Timestamp.fromDate(sDate))
                                .where('created_at', '<=', Timestamp.fromDate(eDate))
                                .orderBy('created_at', 'asc');
                            const snap = await q.get();
                            snap.docs.forEach(d => points.push({ ...d.data(), multiplier: link.operation === 'subtract' ? -1 : 1 }));
                        }
                    }
                } else if (targetNode.meteringType === 'Summation') {
                    const childrenSnap = await db.collection(`${targetNode.path}/nodes`).get();
                    for (const childDoc of childrenSnap.docs) {
                        const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                        await resolveNodeData(child);
                    }
                } else if (targetNode.meteringType === 'Manual') {
                    const qManual = db.collection(`organisations/${organisation.domain}/modules/EM/manualEntries/${targetNode.id}/dates`)
                        .where('submittedAt', '>=', Timestamp.fromDate(sDate))
                        .where('submittedAt', '<=', Timestamp.fromDate(eDate));
                    const mSnap = await qManual.get();
                    mSnap.docs.forEach(d => points.push({ ...d.data().readings, created_at: d.data().submittedAt, multiplier: 1 }));
                }
            };
            await resolveNodeData(node);
            if (isMounted) {
                setTelemetryPoints(points.sort((a, b) => a.created_at.seconds - b.created_at.seconds));
                setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [node.id, activeStep, organisation.domain]);

    const aggregatedData = useMemo(() => {
        if (!metricConfig || telemetryPoints.length === 0) return [];
        return aggregateDataPoints(telemetryPoints, activeStep.level, metricConfig);
    }, [telemetryPoints, metricConfig, activeStep.level]);

    const handleInternalDrill = (label: string) => {
        let nextLevel: GroupingPeriod | null = null;
        let start: Date;
        let end: Date;

        if (activeStep.level === 'year') {
            nextLevel = 'month';
            start = new Date(parseInt(label), 0, 1);
            end = new Date(parseInt(label), 11, 31, 23, 59, 59, 999);
        } else if (activeStep.level === 'month') {
            nextLevel = 'week';
            const [y, m] = label.split('-').map(Number);
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59, 999);
        } else if (activeStep.level === 'week') {
            nextLevel = 'day';
            const range = getWeekRange(label);
            start = range.start;
            end = range.end;
        } else if (activeStep.level === 'day') {
            nextLevel = 'hour';
            start = new Date(label);
            end = new Date(label);
            end.setHours(23, 59, 59, 999);
        }

        if (nextLevel) {
            setDrillStack(prev => [...prev, { level: nextLevel!, label, start, end }]);
        }
    };

    const goBack = () => setDrillStack(p => p.slice(0, -1));
    
    const renderChart = () => {
        if (loading) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Calculating...</p>
                </div>
            );
        }
    
        if (activeStep.level === 'day') {
            return (
                <WeeklyCalendarView 
                    data={aggregatedData}
                    onDayClick={handleInternalDrill}
                    themeColor={theme.colorPrimary}
                />
            );
        }
        
        return (
            <div className="flex flex-col h-full">
                {activeStep.level === 'hour' ? (
                    <div className="flex-1 min-h-[300px]">
                         <LineChart 
                            data={telemetryPoints.map(p => ({ date: p.created_at.toDate(), rate: p[metricConfig.parameterId] || 0 }))} 
                            themeColor={BAR_COLORS[drillStack.length % BAR_COLORS.length]}
                            minDateOverride={activeStep.start}
                            maxDateOverride={activeStep.end}
                         />
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <ColumnChart 
                            data={aggregatedData} 
                            color={BAR_COLORS[drillStack.length % BAR_COLORS.length]} 
                            onBarClick={handleInternalDrill}
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                    {drillStack.length > 1 && (
                        <button onClick={goBack} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors mr-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                    )}
                    <div className="flex flex-wrap gap-1 items-center">
                        {drillStack.map((step, idx) => (
                            <React.Fragment key={idx}>
                                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">{step.label}</span>
                                {idx < drillStack.length - 1 && <span className="text-slate-300 mx-1">/</span>}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Resolution</span>
                    <span className="text-xs font-bold text-slate-700 uppercase">{activeStep.level}</span>
                </div>
            </div>

            <div className={activeStep.level === 'day' ? 'animate-fade-in' : 'h-[400px] animate-fade-in'}>
                {renderChart()}
            </div>
        </div>
    );
};

interface EnergyChartsViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
    startDate: string;
    endDate: string;
}

const EnergyChartsView: React.FC<EnergyChartsViewProps> = ({ node, organisation, theme, activeParams, startDate, endDate }) => {
    const [selectedMetricId, setSelectedMetricId] = useState<string>('');
    const [grouping, setGrouping] = useState<GroupingPeriod>('day');
    const [chartType, setChartType] = useState<ChartType>('column');
    const [telemetryPoints, setTelemetryPoints] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [drillModal, setDrillModal] = useState<{ isOpen: boolean; initialStep: DrillStep | null }>({ isOpen: false, initialStep: null });
    
    const summableParams = useMemo(() => {
        return activeParams.filter(p => p.method === 'Sum');
    }, [activeParams]);

    const selectedMetricConfig = useMemo(() => {
        return summableParams.find(p => p.id === selectedMetricId) || summableParams[0];
    }, [summableParams, selectedMetricId]);

    useEffect(() => {
        if (!selectedMetricId && summableParams.length > 0) {
            setSelectedMetricId(summableParams[0].id);
        }
    }, [summableParams, selectedMetricId]);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        const fetchData = async () => {
            const now = new Date();
            const start = new Date(startDate); 
            if (startDate.length <= 10) start.setHours(0,0,0,0);
            
            let end = new Date(endDate); 
            if (endDate.length <= 10) end.setHours(23,59,59,999);
            
            const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
            const isBillingMaturityReached = diffDays > 27;

            if (end > now) end = now;

            const points: any[] = [];
            const resolveNodeData = async (targetNode: TopographyNode) => {
                if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                    for (const link of targetNode.linkedMeters) {
                        const mSnap = await db.doc(`organisations/${organisation.domain}/modules/EM/meters/${link.meterId}`).get();
                        const ip = mSnap.data()?.ipAddress;
                        if (ip) {
                            const q = db.collection('energyManagement').doc(ip).collection('data')
                                .where('created_at', '>=', Timestamp.fromDate(start))
                                .where('created_at', '<=', Timestamp.fromDate(end))
                                .orderBy('created_at', 'asc');
                            const snap = await q.get();
                            snap.docs.forEach(d => {
                                const p = d.data();
                                if (selectedMetricId === 'apparent_power_kva' && !isBillingMaturityReached) {
                                    return;
                                }
                                points.push({ ...p, multiplier: link.operation === 'subtract' ? -1 : 1 });
                            });
                        }
                    }
                } else if (targetNode.meteringType === 'Summation') {
                    const childrenSnap = await db.collection(`${targetNode.path}/nodes`).get();
                    for (const childDoc of childrenSnap.docs) {
                        const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                        await resolveNodeData(child);
                    }
                } else if (targetNode.meteringType === 'Manual') {
                    const qManual = db.collection(`organisations/${organisation.domain}/modules/EM/manualEntries/${targetNode.id}/dates`)
                        .where('submittedAt', '>=', Timestamp.fromDate(start))
                        .where('submittedAt', '<=', Timestamp.fromDate(end));
                    const mSnap = await qManual.get();
                    mSnap.docs.forEach(d => {
                        const readings = d.data().readings || {};
                        if (selectedMetricId === 'apparent_power_kva' && !isBillingMaturityReached) {
                            return;
                        }
                        points.push({ ...readings, created_at: d.data().submittedAt, multiplier: 1 });
                    });
                }
            };
            await resolveNodeData(node);
            if (isMounted) {
                setTelemetryPoints(points.sort((a, b) => a.created_at.seconds - b.created_at.seconds));
                setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [node.id, startDate, endDate, organisation.domain, selectedMetricId]);

    const aggregatedData = useMemo(() => {
        if (!selectedMetricConfig || telemetryPoints.length === 0) return [];
        return aggregateDataPoints(telemetryPoints, grouping, selectedMetricConfig);
    }, [telemetryPoints, selectedMetricConfig, grouping]);

    const handleMainBarClick = (label: string) => {
        let nextLevel: GroupingPeriod | null = null;
        let start: Date;
        let end: Date;

        if (grouping === 'year') {
            nextLevel = 'month';
            start = new Date(parseInt(label), 0, 1);
            end = new Date(parseInt(label), 11, 31, 23, 59, 59, 999);
        } else if (grouping === 'month') {
            nextLevel = 'week';
            const [y, m] = label.split('-').map(Number);
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59, 999);
        } else if (grouping === 'week') {
            nextLevel = 'day';
            const range = getWeekRange(label);
            start = range.start;
            end = range.end;
        } else if (grouping === 'day') {
            nextLevel = 'hour';
            start = new Date(label);
            end = new Date(label);
            end.setHours(23, 59, 59, 999);
        }

        if (nextLevel) {
            setDrillModal({
                isOpen: true,
                initialStep: { level: nextLevel, label, start, end }
            });
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4 animate-fade-in">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-[0.2em] ml-1">Metric</label>
                        <select value={selectedMetricId} onChange={e => setSelectedMetricId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-indigo-700 shadow-inner">
                            {summableParams.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.customLabel || METER_METRICS.find(m => m.id === p.parameterId)?.label || p.parameterId}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-[0.2em] ml-1">Time Dimension (Grouping)</label>
                        <select value={grouping} onChange={e => setGrouping(e.target.value as GroupingPeriod)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 shadow-inner">
                            <option value="year">Yearly</option>
                            <option value="month">Monthly</option>
                            <option value="week">Weekly</option>
                            <option value="day">Daily</option>
                            <option value="hour">Hourly</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-[0.2em] ml-1">Visual Logic</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner h-[42px]">
                            {['column', 'bar', 'pie'].map(opt => (
                                <button key={opt} onClick={() => setChartType(opt as ChartType)} className={`flex-1 text-[9px] font-black uppercase rounded-lg transition-all ${chartType === opt ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{opt}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 flex-1 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-8 flex-shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Intelligence Matrix</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                             {(selectedMetricConfig?.customLabel || METER_METRICS.find(m => m.id === selectedMetricConfig?.parameterId)?.label || selectedMetricId).toUpperCase()} • Aggregated by {grouping.toUpperCase()}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Total in window</span>
                        <p className="text-4xl font-black text-slate-900 tabular-nums">
                            {aggregatedData.reduce((acc, d) => acc + d.value, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Aggregating dataset...</p>
                        </div>
                    ) : aggregatedData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed rounded-3xl">
                            <p className="font-black uppercase tracking-widest text-xs">No telemetry available in selected window</p>
                        </div>
                    ) : (
                        chartType === 'column' ? (
                            <div className="h-full flex items-end space-x-2 px-4 pb-16">
                                {aggregatedData.map((d, i) => {
                                    const h = (d.value / Math.max(...aggregatedData.map(x => x.value), 1)) * 100;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end">
                                            <div className="w-full relative flex flex-col items-center justify-end" style={{ height: '100%' }}>
                                                <span className="text-[9px] font-black text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.value.toFixed(1)}</span>
                                                <div 
                                                    onClick={() => handleMainBarClick(d.label)}
                                                    className="w-full max-w-[40px] rounded-t-lg transition-all duration-500 shadow-sm group-hover:shadow-lg cursor-pointer hover:scale-x-110" 
                                                    style={{ height: `${Math.max(h, 2)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                                                ></div>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-500 mt-2 uppercase tracking-tighter truncate w-full text-center px-1" title={d.label}>{d.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : chartType === 'bar' ? (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                                {aggregatedData.map((d, i) => {
                                    const w = (d.value / Math.max(...aggregatedData.map(x => x.value), 1)) * 100;
                                    return (
                                        <div key={i} className="flex items-center gap-4 group cursor-pointer" onClick={() => handleMainBarClick(d.label)}>
                                            <div className="w-24 flex-shrink-0 text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate text-right">{d.label}</div>
                                            <div className="flex-1 h-8 bg-slate-50 rounded-r-full overflow-hidden border border-slate-100 shadow-inner group-hover:bg-indigo-50/30 transition-colors">
                                                <div className="h-full transition-all duration-700 shadow-sm flex items-center justify-end pr-4" style={{ width: `${Math.max(w, 2)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}>
                                                    <span className="text-[9px] font-black text-white drop-shadow-md">{d.value.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <PieChart 
                                data={aggregatedData} 
                                onSliceClick={handleMainBarClick} 
                            />
                        )
                    )}
                </div>
            </div>

            {/* Drill Down Modal */}
            <Modal isOpen={drillModal.isOpen} onClose={() => setDrillModal({ isOpen: false, initialStep: null })} title="Intelligence Drill-down Sequence" size="6xl">
                {drillModal.initialStep && (
                    <DrillDownContainer 
                        node={node}
                        organisation={organisation}
                        metricConfig={selectedMetricConfig}
                        theme={theme}
                        initialStep={drillModal.initialStep}
                    />
                )}
            </Modal>
        </div>
    );
};

export default EnergyChartsView;