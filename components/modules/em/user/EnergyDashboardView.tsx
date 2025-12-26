import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import DialGauge from '../../../common/DialGauge';
import LineChart from '../../../common/LineChart';

const { Timestamp } = firebase.firestore;

interface EnergyDashboardViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
    startDate: string;
    endDate: string;
}

const MetricTile: React.FC<{ label: string; value: string | number; unit?: string; colorClass?: string; trend?: number }> = ({ label, value, unit, colorClass = "text-slate-800", trend }) => (
    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:shadow-lg hover:-translate-y-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
        <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black tabular-nums ${colorClass}`}>
                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : value}
            </span>
            {unit && <span className="text-[10px] font-black text-slate-400 uppercase">{unit}</span>}
        </div>
        {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-[9px] font-bold ${trend >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                <span>{trend >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(trend).toFixed(1)}% vs prev.</span>
            </div>
        )}
    </div>
);

const EnergyDashboardView: React.FC<EnergyDashboardViewProps> = ({ node, organisation, theme, activeParams, startDate, endDate }) => {
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentReading, setCurrentReading] = useState<any>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

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

            // Interval mapping for aggregation (5 minute buckets)
            const intervalBuckets = new Map<number, Record<string, { sum: number, count: number }>>();

            const processPoints = (data: any[], multiplier: number) => {
                data.forEach(p => {
                    const ts = p.created_at?.toMillis ? p.created_at.toMillis() : (p.created_at?.seconds * 1000 || 0);
                    const bucketKey = Math.floor(ts / (5 * 60 * 1000)) * (5 * 60 * 1000);
                    
                    if (!intervalBuckets.has(bucketKey)) {
                        intervalBuckets.set(bucketKey, {});
                    }
                    
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
                        if (!ip) continue;

                        const snap = await db.collection('energyManagement').doc(ip).collection('data')
                            .where('created_at', '>=', Timestamp.fromDate(start))
                            .where('created_at', '<=', Timestamp.fromDate(end))
                            .orderBy('created_at', 'asc')
                            .get();

                        processPoints(snap.docs.map(d => d.data()), link.operation === 'subtract' ? -1 : 1);
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
                        .where('submittedAt', '<=', Timestamp.fromDate(end))
                        .get();

                     mSnap.docs.forEach(d => {
                        const readings = d.data().readings || {};
                        const ts = d.data().submittedAt;
                        processPoints([{ ...readings, created_at: ts }], 1);
                     });
                }
            };

            await resolveNodeData(node);

            if (isMounted) {
                const finalData = Array.from(intervalBuckets.entries())
                    .map(([ts, metrics]) => {
                        const flattened: any = { created_at: Timestamp.fromMillis(ts) };
                        Object.entries(metrics).forEach(([key, stats]) => {
                            // Energy delta is summative across meters, power/voltage/pf are averaged
                            if (key.includes('energy_delta')) {
                                flattened[key] = stats.sum;
                            } else {
                                flattened[key] = stats.count > 0 ? stats.sum / stats.count : 0;
                            }
                        });
                        return flattened;
                    })
                    .sort((a, b) => a.created_at.seconds - b.created_at.seconds);
                
                setHistoricalData(finalData);
                if (finalData.length > 0) {
                    setCurrentReading(finalData[finalData.length - 1]);
                }
                setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [node.id, startDate, endDate, organisation.domain, node.path, node.meteringType]);

    const metrics = useMemo(() => {
        if (historicalData.length === 0) return { totalConsumption: 0, avgPower: 0, peakDemand: 0, avgPF: 0 };
        
        let totalConsumption = 0;
        let powerSum = 0;
        let peakDemand = 0;
        let pfSum = 0;

        historicalData.forEach(d => {
            totalConsumption += (d.active_energy_delta_kwh || 0);
            const p = (d.active_power_kw || 0);
            const kva = (d.apparent_power_kva || 0);
            powerSum += p;
            if (kva > peakDemand) peakDemand = kva;
            pfSum += (d.power_factor || 0);
        });

        return {
            totalConsumption,
            avgPower: powerSum / historicalData.length,
            peakDemand,
            avgPF: pfSum / historicalData.length
        };
    }, [historicalData]);

    const chartSeries = useMemo(() => {
        return historicalData.map(d => ({
            date: d.created_at.toDate(),
            rate: d.active_power_kw || 0
        }));
    }, [historicalData]);

    return (
        <div className="space-y-8 animate-fade-in flex flex-col h-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-shrink-0">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <DialGauge 
                                value={metrics.avgPower} 
                                min={0} 
                                max={metrics.peakDemand * 1.2 || 1000} 
                                label="Average Site Load"
                                unit="kW"
                                color={theme.colorPrimary}
                                size={280}
                            />
                        </div>
                        
                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Power Factor</span>
                            <p className="text-4xl font-black text-slate-800">{metrics.avgPF.toFixed(3)}</p>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                                <div 
                                    className="h-full transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, Math.abs(metrics.avgPF) * 100)}%`, backgroundColor: theme.colorPrimary }}
                                ></div>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Efficiency Score</span>
                        </div>

                        <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl text-white flex flex-col items-center justify-center text-center relative overflow-hidden group">
                             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">Consolidated Usage</span>
                            <p className="text-4xl font-black text-white tabular-nums relative z-10">{metrics.totalConsumption.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest relative z-10">Total kWh</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                         <MetricTile label="Maximum kVA Demand" value={metrics.peakDemand} unit="kVA" colorClass="text-rose-600" />
                         <MetricTile label="Average Current" value={currentReading?.current_avg || 0} unit="A" />
                         <MetricTile label="System Frequency" value={currentReading?.frequency || 50.0} unit="Hz" />
                         <MetricTile label="Voltage Balance" value={currentReading?.voltage_imbalance_pct || 0} unit="%" />
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col h-full min-h-[400px]">
                    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full">
                        <div className="px-8 py-6 border-b bg-slate-50 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest">Active Load Signature</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Telemetry time-series profile</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-widest">
                                    {node.meteringType} Logic
                                </span>
                            </div>
                        </div>

                        <div className="p-8 flex-1 flex flex-col overflow-x-auto custom-scrollbar min-h-0" ref={chartRef}>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-slate-400 italic text-sm">
                                    Aggregating sensor data...
                                </div>
                            ) : chartSeries.length > 1 ? (
                                <div className="flex-1 min-h-[250px]">
                                    <LineChart 
                                        data={chartSeries} 
                                        themeColor={theme.colorPrimary} 
                                        minDateOverride={new Date(startDate)}
                                        maxDateOverride={new Date(endDate)}
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-300">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    <p className="text-xs uppercase font-black tracking-widest">No telemetry for this window</p>
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                            <div className="flex gap-8">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase opacity-40 tracking-widest">Site Branch</span>
                                    <span className="text-xs font-bold">{currentReading?.building || 'Main Intake'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase opacity-40 tracking-widest">Process Stream</span>
                                    <span className="text-xs font-bold">{currentReading?.process || 'Unified'}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[8px] font-black uppercase opacity-40 tracking-widest">Synchronization</span>
                                <p className="text-[10px] font-mono font-bold text-indigo-400">
                                    {currentReading?.created_at?.toDate ? currentReading.created_at.toDate().toLocaleTimeString() : 'Establishing link...'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnergyDashboardView;