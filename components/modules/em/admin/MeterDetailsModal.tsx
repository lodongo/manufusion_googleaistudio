
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import Modal from '../../../common/Modal';

interface MeterDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    meterId: string;
}

interface MeterTelemetry {
    active_energy_delta_kwh: number;
    active_energy_kwh: number;
    active_power_kw: number;
    apparent_power_kva: number;
    building: string;
    created_at: any;
    current_avg: number;
    current_l1: number;
    current_l2: number;
    current_l3: number;
    firestore_createdAt: any;
    frequency: number;
    ip: string;
    neutral_current: number;
    power_factor: number;
    process: string;
    reactive_power_kvar: number;
    thdi_l1: number;
    thdi_l2: number;
    thdi_l3: number;
    thdv_l1: number;
    thdv_l2: number;
    thdv_l3: number;
    town: string;
    voltage_avg_ln: number;
    voltage_imbalance_pct: number;
    voltage_l1n: number;
    voltage_l2n: number;
    voltage_l3n: number;
}

const DataRow: React.FC<{ label: string; value: string | number; unit?: string; colorClass?: string }> = ({ label, value, unit, colorClass = "text-slate-800" }) => (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className={`text-sm font-black tabular-nums ${colorClass}`}>
                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : value}
            </span>
            {unit && <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>}
        </div>
    </div>
);

const MeterDetailsModal: React.FC<MeterDetailsModalProps> = ({ isOpen, onClose, meterId }) => {
    const [telemetry, setTelemetry] = useState<MeterTelemetry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !meterId) return;

        setLoading(true);
        // The user specified the path /energyManagement/$meterId/data. 
        // Assuming 'data' is a subcollection of time-series readings, we fetch the latest one.
        const dataCollRef = collection(db, 'energyManagement', meterId, 'data');
        const q = query(dataCollRef, orderBy('created_at', 'desc'), limit(1));

        const unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setTelemetry(snap.docs[0].data() as MeterTelemetry);
            } else {
                setTelemetry(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching telemetry history:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, meterId]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return 'N/A';
        if (ts.toDate) return ts.toDate().toLocaleString();
        if (ts instanceof Date) return ts.toLocaleString();
        return String(ts);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Meter Telemetry: ${meterId}`} size="5xl">
            {loading ? (
                <div className="p-20 text-center text-slate-400 italic animate-pulse">Establishing data link...</div>
            ) : telemetry ? (
                <div className="space-y-8 p-1">
                    {/* Hero Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-2">Total Active Energy</span>
                            <div className="text-3xl font-black tabular-nums">{(telemetry.active_energy_kwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <span className="text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">kWh</span>
                        </div>
                        <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-2">Active Power</span>
                            <div className="text-3xl font-black tabular-nums">{(telemetry.active_power_kw ?? 0).toFixed(2)}</div>
                            <span className="text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">kW</span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Power Factor</span>
                            <div className="text-3xl font-black text-slate-800 tabular-nums">{(telemetry.power_factor ?? 0).toFixed(3)}</div>
                            <span className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Cos φ</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Environmental & Context */}
                        <div className="space-y-6">
                            <section>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-100 pb-2 mb-4">Site & Registry</h4>
                                <div className="grid grid-cols-1 gap-y-1">
                                    <DataRow label="Building" value={telemetry.building} />
                                    <DataRow label="Process Area" value={telemetry.process} />
                                    <DataRow label="Town / Site" value={telemetry.town} />
                                    <DataRow label="Network IP" value={telemetry.ip} colorClass="font-mono text-xs text-indigo-500" />
                                </div>
                            </section>

                            <section>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-100 pb-2 mb-4">Secondary Metrics</h4>
                                <div className="grid grid-cols-1 gap-y-1">
                                    <DataRow label="Apparent Power" value={telemetry.apparent_power_kva} unit="kVA" />
                                    <DataRow label="Reactive Power" value={telemetry.reactive_power_kvar} unit="kVAR" />
                                    <DataRow label="Energy Delta (Last P)" value={telemetry.active_energy_delta_kwh} unit="kWh" colorClass="text-emerald-600" />
                                    <DataRow label="Grid Frequency" value={telemetry.frequency} unit="Hz" />
                                </div>
                            </section>
                        </div>

                        {/* Electrical Characteristics */}
                        <div className="space-y-6">
                            <section>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-100 pb-2 mb-4">Voltage Profile (L-N)</h4>
                                <div className="grid grid-cols-1 gap-y-1">
                                    <DataRow label="Average Voltage" value={telemetry.voltage_avg_ln} unit="V" colorClass="text-blue-700" />
                                    <DataRow label="Voltage Imbalance" value={telemetry.voltage_imbalance_pct} unit="%" colorClass={(telemetry.voltage_imbalance_pct ?? 0) > 2 ? "text-red-600" : "text-emerald-600"} />
                                    <DataRow label="Phase L1" value={telemetry.voltage_l1n} unit="V" />
                                    <DataRow label="Phase L2" value={telemetry.voltage_l2n} unit="V" />
                                    <DataRow label="Phase L3" value={telemetry.voltage_l3n} unit="V" />
                                </div>
                            </section>

                            <section>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-100 pb-2 mb-4">Current Loading</h4>
                                <div className="grid grid-cols-1 gap-y-1">
                                    <DataRow label="System Average" value={telemetry.current_avg} unit="A" colorClass="text-amber-600" />
                                    <DataRow label="Neutral Current" value={telemetry.neutral_current} unit="A" />
                                    <DataRow label="Phase L1" value={telemetry.current_l1} unit="A" />
                                    <DataRow label="Phase L2" value={telemetry.current_l2} unit="A" />
                                    <DataRow label="Phase L3" value={telemetry.current_l3} unit="A" />
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Quality Indicators (Harmonics) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section>
                            <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] border-b border-rose-100 pb-2 mb-4">Voltage THD (%)</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-rose-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-rose-400 uppercase">L1</span>
                                    <p className="font-black text-rose-700">{(telemetry.thdv_l1 ?? 0).toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-rose-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-rose-400 uppercase">L2</span>
                                    <p className="font-black text-rose-700">{(telemetry.thdv_l2 ?? 0).toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-rose-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-rose-400 uppercase">L3</span>
                                    <p className="font-black text-rose-700">{(telemetry.thdv_l3 ?? 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </section>
                        <section>
                            <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] border-b border-amber-100 pb-2 mb-4">Current THD (%)</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-amber-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase">L1</span>
                                    <p className="font-black text-amber-700">{(telemetry.thdi_l1 ?? 0).toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase">L2</span>
                                    <p className="font-black text-amber-700">{(telemetry.thdi_l2 ?? 0).toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl text-center">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase">L3</span>
                                    <p className="font-black text-amber-700">{(telemetry.thdi_l3 ?? 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Packet metadata */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] gap-4">
                        <div className="flex gap-4">
                            <p>Local Timestamp: {formatTimestamp(telemetry.created_at)}</p>
                            <p>Ingestion Time: {formatTimestamp(telemetry.firestore_createdAt)}</p>
                        </div>
                        <p className="text-indigo-400">Status: Active Link</p>
                    </div>
                </div>
            ) : (
                <div className="p-20 text-center text-slate-500 italic">No telemetry sequence found in /energyManagement/{meterId}/data.</div>
            )}
        </Modal>
    );
};

export default MeterDetailsModal;
