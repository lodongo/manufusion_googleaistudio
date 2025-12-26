
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation, AppUser } from '../../../../types';
import Button from '../../../Button';

interface ManualEntryFormProps {
    node: TopographyNode;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
    activeParams: (ParameterConfig & { id: string })[];
}

const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ node, organisation, currentUser, theme, activeParams }) => {
    const currentUserName = `${currentUser.firstName} ${currentUser.lastName}`;
    const todayStr = new Date().toISOString().split('T')[0];
    
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [values, setValues] = useState<Record<string, number>>({});
    const [loadingState, setLoadingState] = useState<'idle' | 'checking' | 'saving'>('idle');
    const [existingRecord, setExistingRecord] = useState<any | null>(null);
    const [error, setError] = useState('');

    const entryDocPath = `organisations/${organisation.domain}/modules/EM/manualEntries/${node.id}/dates/${selectedDate}`;

    // Logic: Not future, and check if entry exists for selected date
    useEffect(() => {
        const checkEntry = async () => {
            setLoadingState('checking');
            setError('');
            setExistingRecord(null);
            
            try {
                const snap = await getDoc(doc(db, entryDocPath));
                if (snap.exists) {
                    setExistingRecord(snap.data());
                    setValues(snap.data().readings || {});
                } else {
                    setValues({});
                }
            } catch (e) {
                console.error("Error checking daily entry:", e);
                setError("Failed to verify existing records.");
            } finally {
                setLoadingState('idle');
            }
        };
        
        if (selectedDate) {
            checkEntry();
        }
    }, [selectedDate, entryDocPath]);

    const handleSave = async () => {
        if (existingRecord) {
            setError("Data has already been entered for this date.");
            return;
        }

        setLoadingState('saving');
        try {
            const payload = {
                date: selectedDate,
                nodeId: node.id,
                nodeName: node.name,
                readings: values,
                submittedBy: { uid: currentUser.uid, name: currentUserName },
                submittedAt: Timestamp.now()
            };
            await setDoc(doc(db, entryDocPath), payload);
            setExistingRecord(payload);
            alert("24-hour log committed successfully.");
        } catch (e) {
            console.error(e);
            setError("Failed to save entry. Please try again.");
        } finally {
            setLoadingState('idle');
        }
    };

    const isReadOnly = !!existingRecord;
    const isFuture = selectedDate > todayStr;

    return (
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 animate-fade-in">
            {/* Form Side */}
            <div className="flex-1 p-8 md:p-12 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8">
                    <div className="space-y-1">
                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual 24h Telemetry Log</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Entry Cycle for {node.name}</p>
                    </div>
                    <div className="w-full md:w-64">
                         <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1 tracking-widest">Select Target Date</label>
                         <input 
                            type="date" 
                            max={todayStr} 
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className={`w-full p-3 bg-white border rounded-2xl font-black text-slate-700 outline-none focus:ring-4 transition-all shadow-sm ${isFuture ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-indigo-100'}`}
                         />
                    </div>
                </div>

                {isFuture ? (
                    <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Future Date Restricted</p>
                            <p className="text-xs text-rose-700 mt-0.5">Telemetry logging is only permitted for the current date or past unlogged dates.</p>
                        </div>
                    </div>
                ) : isReadOnly ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">Record Locked</p>
                            <p className="text-xs text-emerald-700 mt-0.5">Logs for {selectedDate} have already been registered. Entry is now read-only.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100" style={{ backgroundColor: theme.colorPrimary }}>
                            <svg xmlns="http://www.w3.org/2000/ Pentecost" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-black text-indigo-900 uppercase tracking-tight">Pending 24h Entry</p>
                            <p className="text-xs text-indigo-700 mt-0.5">Enter absolute technical readings for the parameters defined in the global processing matrix.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {activeParams.map(param => (
                        <div key={param.id} className={`p-5 rounded-3xl border transition-all ${isReadOnly || isFuture ? 'bg-slate-50 border-slate-100 opacity-80' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{param.customLabel || param.parameterId}</label>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tighter" style={{ color: theme.colorPrimary, backgroundColor: `${theme.colorPrimary}10` }}>
                                    {param.method}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number"
                                    step="0.0000001"
                                    value={values[param.id] ?? ''}
                                    onChange={e => setValues({...values, [param.id]: Number(e.target.value)})}
                                    disabled={isReadOnly || isFuture}
                                    placeholder="0.000"
                                    className={`flex-1 text-2xl font-black bg-transparent outline-none ${isReadOnly || isFuture ? 'text-slate-400' : 'text-slate-800 focus:text-indigo-600'}`}
                                />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Units</span>
                            </div>
                        </div>
                    ))}
                </div>

                {!isReadOnly && !isFuture && activeParams.length > 0 && (
                    <div className="pt-10 flex justify-end">
                        <Button 
                            onClick={handleSave} 
                            isLoading={loadingState === 'saving'}
                            className="!w-auto px-16 shadow-2xl shadow-indigo-100 font-black uppercase tracking-widest rounded-full h-14"
                            style={{ backgroundColor: theme.colorPrimary }}
                        >
                            Commit Daily Log
                        </Button>
                    </div>
                )}

                {activeParams.length === 0 && (
                    <div className="p-20 text-center text-slate-400 italic bg-slate-50 border border-dashed rounded-[2rem]">
                        No telemetry parameters are currently active in the global matrix for processing.
                    </div>
                )}
            </div>

            {/* Sidebar Record Details */}
            <div className="w-full lg:w-96 bg-slate-50/50 p-8 space-y-10">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                         <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </div>
                    <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-6">Cycle Registry</h5>
                    <div className="space-y-6">
                        <div>
                            <span className="text-[9px] font-bold text-white/40 uppercase block tracking-widest mb-1">Target Period</span>
                            <p className="text-lg font-black text-white">{selectedDate}</p>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-white/40 uppercase block tracking-widest mb-1">Submission Authority</span>
                            <p className="text-sm font-bold text-white">{isReadOnly ? existingRecord.submittedBy.name : currentUserName}</p>
                        </div>
                         <div>
                            <span className="text-[9px] font-bold text-white/40 uppercase block tracking-widest mb-1">Registration Status</span>
                            <p className={`text-sm font-bold ${isReadOnly ? 'text-emerald-400' : isFuture ? 'text-rose-400' : 'text-blue-400'}`}>
                                {isReadOnly ? 'VERIFIED' : isFuture ? 'RESTRICTED' : 'OPEN'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data Governance</h5>
                    <ul className="space-y-3">
                        {[
                            'Entries must reflect the absolute reading at cycle completion.',
                            'Verify decimals for high-precision parameters.',
                            'Duplicate entries for the same date are restricted.',
                            'Future-dated logging is prohibited by system policy.'
                        ].map((txt, i) => (
                            <li key={i} className="flex gap-3 items-start text-[11px] font-medium text-slate-600 leading-relaxed">
                                <span className="text-indigo-600 font-black" style={{ color: theme.colorPrimary }}>•</span>
                                <span>{txt}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ManualEntryForm;
