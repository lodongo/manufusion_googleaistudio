import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
// Added setDoc to the firebase/firestore imports
import { collection, onSnapshot, doc, getDocs, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { AppUser, Organisation } from '../../types';

interface EnergyManagementProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
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

const DataCard: React.FC<{ label: string; value: string | number; unit?: string; colorClass?: string }> = ({ label, value, unit, colorClass = "text-slate-800" }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold tabular-nums ${colorClass}`}>
                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
            </span>
            {unit && <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>}
        </div>
    </div>
);

const SectionHeader: React.FC<{ title: string; icon?: React.ReactNode }> = ({ title, icon }) => (
    <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-4 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{title}</h3>
    </div>
);

const EnergyManagement: React.FC<EnergyManagementProps> = ({ currentUser, theme }) => {
    const [meterIds, setMeterIds] = useState<string[]>([]);
    const [selectedIp, setSelectedIp] = useState<string>('');
    const [telemetry, setTelemetry] = useState<MeterTelemetry | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    
    // Simulator State
    const [isSimulating, setIsSimulating] = useState(false);

    // Fetch list of meter IPs (document IDs)
    useEffect(() => {
        const fetchMeterList = async () => {
            setLoadingList(true);
            try {
                const querySnapshot = await getDocs(collection(db, 'energyManagement'));
                const ids = querySnapshot.docs.map(doc => doc.id);
                setMeterIds(ids);
                if (ids.length > 0) setSelectedIp(ids[0]);
            } catch (err) {
                console.error("Error fetching meter list:", err);
            } finally {
                setLoadingList(false);
            }
        };
        fetchMeterList();
    }, []);

    // Subscribe to selected meter data
    useEffect(() => {
        if (!selectedIp) {
            setTelemetry(null);
            return;
        }

        setLoadingData(true);
        const meterDocRef = doc(db, 'energyManagement', selectedIp);
        const unsubscribe = onSnapshot(meterDocRef, (docSnap) => {
            if (docSnap.exists) {
                setTelemetry(docSnap.data() as MeterTelemetry);
            } else {
                setTelemetry(null);
            }
            setLoadingData(false);
        }, (err) => {
            console.error("Error fetching meter data:", err);
            setLoadingData(false);
        });

        return () => unsubscribe();
    }, [selectedIp]);

    // Background Simulator
    useEffect(() => {
        if (!isSimulating || !selectedIp || !telemetry) return;

        const interval = setInterval(async () => {
            const now = new Date();
            const jitter = () => (Math.random() - 0.5) * 2; // -1 to 1 range
            
            const newReading = {
                ...telemetry,
                active_power_kw: Math.max(0, telemetry.active_power_kw + jitter() * 5),
                active_energy_kwh: (telemetry.active_energy_kwh || 0) + (Math.random() * 0.5),
                active_energy_delta_kwh: Math.random() * 0.5,
                current_avg: Math.max(0, telemetry.current_avg + jitter()),
                power_factor: Math.min(1.0, Math.max(0.8, telemetry.power_factor + jitter() * 0.01)),
                created_at: serverTimestamp(),
                firestore_createdAt: serverTimestamp()
            };

            try {
                // Update root for live view
                await setDoc(doc(db, 'energyManagement', selectedIp), newReading, { merge: true });
                // Add to subcollection for historical charts
                await addDoc(collection(db, 'energyManagement', selectedIp, 'data'), newReading);
            } catch (e) {
                console.error("Sim write failed", e);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isSimulating, selectedIp, telemetry]);

    if (loadingList) return <div className="p-8 text-center text-slate-500 italic animate-pulse">Scanning Network for Meters...</div>;

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-full overflow-y-auto">
            {/* Header Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                <div className="flex flex-col w-full md:w-auto">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Meter (IP Address)</label>
                    <select 
                        value={selectedIp}
                        onChange={(e) => setSelectedIp(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner min-w-[200px]"
                    >
                        {meterIds.map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulator Engine</p>
                        <button 
                            onClick={() => setIsSimulating(!isSimulating)}
                            className={`mt-1 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${isSimulating ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                        >
                            {isSimulating ? 'PULSING DATA' : 'START SIMULATOR'}
                        </button>
                    </div>

                    {telemetry && (
                        <div className="hidden sm:flex gap-8 text-center border-l pl-8 border-slate-100">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Building</p>
                                <p className="text-sm font-bold text-slate-800">{telemetry.building || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process</p>
                                <p className="text-sm font-bold text-slate-800">{telemetry.process || '-'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loadingData ? (
                <div className="p-20 text-center text-slate-400 italic">Synchronizing Real-Time Data...</div>
            ) : telemetry ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                    
                    {/* Power & Energy */}
                    <SectionHeader title="Energy & Power Performance" />
                    <DataCard label="Total Active Energy" value={telemetry.active_energy_kwh ?? 0} unit="kWh" colorClass="text-indigo-600" />
                    <DataCard label="Active Power" value={telemetry.active_power_kw ?? 0} unit="kW" colorClass="text-indigo-600" />
                    <DataCard label="Energy Delta" value={telemetry.active_energy_delta_kwh ?? 0} unit="kWh" colorClass="text-emerald-600" />
                    <DataCard label="Power Factor" value={telemetry.power_factor ?? 0} unit="cos φ" />
                    <DataCard label="Apparent Power" value={telemetry.apparent_power_kva ?? 0} unit="kVA" />
                    <DataCard label="Reactive Power" value={telemetry.reactive_power_kvar ?? 0} unit="kVAR" />

                    {/* Voltage */}
                    <SectionHeader title="Voltage Parameters" />
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Voltage (L-N)</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tabular-nums text-slate-800">{(telemetry.voltage_avg_ln ?? 0).toFixed(1)}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">V</span>
                        </div>
                        <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${((telemetry.voltage_avg_ln ?? 0) / 300) * 100}%` }}></div>
                        </div>
                    </div>
                    <DataCard label="Line 1 Voltage" value={telemetry.voltage_l1n ?? 0} unit="V" />
                    <DataCard label="Line 2 Voltage" value={telemetry.voltage_l2n ?? 0} unit="V" />
                    <DataCard label="Line 3 Voltage" value={telemetry.voltage_l3n ?? 0} unit="V" />
                    <DataCard label="Voltage Imbalance" value={telemetry.voltage_imbalance_pct ?? 0} unit="%" colorClass={(telemetry.voltage_imbalance_pct ?? 0) > 2 ? "text-red-600" : "text-emerald-600"} />
                    <DataCard label="Frequency" value={telemetry.frequency ?? 0} unit="Hz" />

                    {/* Current */}
                    <SectionHeader title="Current & Loading" />
                    <DataCard label="Avg System Current" value={telemetry.current_avg ?? 0} unit="A" colorClass="text-amber-600" />
                    <DataCard label="Line 1 Current" value={telemetry.current_l1 ?? 0} unit="A" />
                    <DataCard label="Line 2 Current" value={telemetry.current_l2 ?? 0} unit="A" />
                    <DataCard label="Line 3 Current" value={telemetry.current_l3 ?? 0} unit="A" />
                    <DataCard label="Neutral Current" value={telemetry.neutral_current ?? 0} unit="A" colorClass="text-rose-600" />

                    {/* Harmonics */}
                    <SectionHeader title="Total Harmonic Distortion (THD)" />
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3">Voltage THD</h4>
                            <div className="space-y-2">
                                {[
                                    { l: 'L1', v: telemetry.thdv_l1 ?? 0 },
                                    { l: 'L2', v: telemetry.thdv_l2 ?? 0 },
                                    { l: 'L3', v: telemetry.thdv_l3 ?? 0 }
                                ].map(p => (
                                    <div key={p.l} className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">{p.l}</span>
                                        <span className="text-xs font-black font-mono">{p.v.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3">Current THD</h4>
                            <div className="space-y-2">
                                {[
                                    { l: 'L1', v: telemetry.thdi_l1 ?? 0 },
                                    { l: 'L2', v: telemetry.thdi_l2 ?? 0 },
                                    { l: 'L3', v: telemetry.thdi_l3 ?? 0 }
                                ].map(p => (
                                    <div key={p.l} className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">{p.l}</span>
                                        <span className="text-xs font-black font-mono">{p.v.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl shadow-lg flex flex-col justify-center items-center text-center">
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Last Telemetry Packet</span>
                            <p className="text-white text-sm font-bold">{telemetry.created_at?.toDate ? telemetry.created_at.toDate().toLocaleString() : 'N/A'}</p>
                            <span className="text-[8px] text-slate-500 font-bold mt-2 uppercase">Sync Status: Active</span>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium italic text-lg">No telemetry data found for the selected IP address.</p>
                </div>
            )}
        </div>
    );
};

export default EnergyManagement;