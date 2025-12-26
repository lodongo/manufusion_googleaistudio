import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import DialGauge from '../../../common/DialGauge';

interface EnergyLiveViewProps {
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
}

const PhaseCard: React.FC<{ label: string; value: number; unit: string; color: string; max: number }> = ({ label, value, unit, color, max }) => (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tabular-nums text-slate-800">{(value || 0).toFixed(1)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
                className="h-full transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
            ></div>
        </div>
    </div>
);

const EnergyLiveView: React.FC<EnergyLiveViewProps> = ({ node, organisation, theme }) => {
    const [liveData, setLiveData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const listenToNodeData = async (targetNode: TopographyNode, onData: (data: Record<string, any>) => void) => {
            if (targetNode.meteringType === 'Metered' && targetNode.linkedMeters?.length) {
                const meterStates: Record<string, any> = {};
                for (const link of targetNode.linkedMeters) {
                    const mSnap = await db.doc(`organisations/${organisation.domain}/modules/EM/meters/${link.meterId}`).get();
                    const ip = mSnap.data()?.ipAddress;
                    if (!ip) continue;

                    db.collection('energyManagement').doc(ip).collection('data')
                        .orderBy('created_at', 'desc').limit(1).onSnapshot((snap) => {
                            if (!isMounted) return;
                            if (!snap.empty) meterStates[link.meterId] = snap.docs[0].data();

                            const nodeAggregate: Record<string, any> = {};
                            targetNode.linkedMeters?.forEach(l => {
                                const mTele = meterStates[l.meterId];
                                if (mTele) {
                                    Object.entries(mTele).forEach(([key, val]) => {
                                        if (typeof val === 'number') {
                                            const factor = l.operation === 'subtract' ? -1 : 1;
                                            nodeAggregate[key] = (nodeAggregate[key] || 0) + (val * factor);
                                        } else if (!nodeAggregate[key]) nodeAggregate[key] = val;
                                    });
                                }
                            });
                            onData(nodeAggregate);
                        });
                }
            } else if (targetNode.meteringType === 'Manual') {
                db.collection(`organisations/${organisation.domain}/modules/EM/manualEntries/${targetNode.id}/dates`)
                    .orderBy('submittedAt', 'desc').limit(1).onSnapshot((snap) => {
                        if (isMounted && !snap.empty) onData(snap.docs[0].data().readings || {});
                    });
            } else if (targetNode.meteringType === 'Summation') {
                db.collection(`${targetNode.path}/nodes`).onSnapshot(async (snap) => {
                    if (!isMounted) return;
                    const childDataMap: Record<string, any> = {};
                    snap.docs.forEach(childDoc => {
                        const child = { id: childDoc.id, ...childDoc.data(), path: childDoc.ref.path } as TopographyNode;
                        listenToNodeData(child, (data) => {
                            childDataMap[child.id] = data;
                            const sum: Record<string, any> = {};
                            Object.values(childDataMap).forEach(d => Object.entries(d).forEach(([k, v]) => {
                                if (typeof v === 'number') sum[k] = (sum[k] || 0) + v;
                            }));
                            onData(sum);
                        });
                    });
                });
            }
        };

        listenToNodeData(node, (data) => { if (isMounted) { setLiveData(data); setLoading(false); } });
        return () => { isMounted = false; };
    }, [node.id, organisation.domain]);

    const activePower = liveData.active_power_kw || 0;
    const powerFactor = liveData.power_factor || 0;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <DialGauge 
                        value={activePower} 
                        min={0} 
                        max={activePower > 1000 ? activePower * 1.5 : 1000} 
                        label="Instantaneous Load" 
                        unit="kW"
                        color={theme.colorPrimary}
                        size={320}
                    />
                    
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficiency Factor</span>
                        <p className="text-4xl font-black text-slate-800">{(powerFactor * 100).toFixed(1)}%</p>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden shadow-inner">
                            <div className="h-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.abs(powerFactor) * 100)}%`, backgroundColor: theme.colorPrimary }}></div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">cos φ Alignment</span>
                    </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden p-8 space-y-10">
                        <section>
                            <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em]">Voltage Map (L-N)</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">3-Phase Technical distribution</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-indigo-600 font-mono">{(liveData.voltage_avg_ln || 0).toFixed(1)}</span>
                                    <span className="text-xs font-black text-slate-400 ml-1">AVG VAC</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <PhaseCard label="Phase L1-N" value={liveData.voltage_l1n || 0} unit="V" color="#6366f1" max={300} />
                                <PhaseCard label="Phase L2-N" value={liveData.voltage_l2n || 0} unit="V" color="#8b5cf6" max={300} />
                                <PhaseCard label="Phase L3-N" value={liveData.voltage_l3n || 0} unit="V" color="#a855f7" max={300} />
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em]">Current Intensity</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Amperage load per line</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-emerald-600 font-mono">{(liveData.current_avg || 0).toFixed(1)}</span>
                                    <span className="text-xs font-black text-slate-400 ml-1">AVG AMP</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <PhaseCard label="Line 1 Current" value={liveData.current_l1 || 0} unit="A" color="#10b981" max={liveData.current_avg * 2 || 2000} />
                                <PhaseCard label="Line 2 Current" value={liveData.current_l2 || 0} unit="A" color="#059669" max={liveData.current_avg * 2 || 2000} />
                                <PhaseCard label="Line 3 Current" value={liveData.current_l3 || 0} unit="A" color="#047857" max={liveData.current_avg * 2 || 2000} />
                            </div>
                        </section>

                        <div className="pt-8 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-8">
                             <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Frequency</span>
                                <span className="text-lg font-black text-slate-800">{(liveData.frequency || 50.0).toFixed(2)} Hz</span>
                             </div>
                             <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Neutral Current</span>
                                <span className="text-lg font-black text-rose-600">{(liveData.neutral_current || 0).toFixed(2)} A</span>
                             </div>
                             <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Volts Imbalance</span>
                                <span className={`text-lg font-black ${(liveData.voltage_imbalance_pct || 0) > 2 ? 'text-rose-600' : 'text-emerald-600'}`}>{(liveData.voltage_imbalance_pct || 0).toFixed(2)}%</span>
                             </div>
                             <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Energy Cycle</span>
                                <span className="text-lg font-black text-slate-800">{(liveData.active_energy_delta_kwh || 0).toFixed(2)} kWh</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnergyLiveView;