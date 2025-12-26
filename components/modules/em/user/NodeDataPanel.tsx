
import React, { useState, useEffect, useMemo } from 'react';
import type { TopographyNode, ParameterConfig } from '../../../../types/em_types';
import type { Organisation, AppUser } from '../../../../types';
import ManualEntryForm from './ManualEntryForm';
import EnergyLiveView from './EnergyLiveView';
import EnergyTrendsView from './EnergyTrendsView';
import EnergyParetoView from './EnergyParetoView';
import EnergyBillView from './EnergyBillView';
import EnergySnapshotView from './EnergySnapshotView';
import EnergyDashboardView from './EnergyDashboardView';
import EnergyChartsView from './EnergyChartsView';
import { db } from '../../../../services/firebase';

interface NodeDataPanelProps {
    node: TopographyNode;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
    startDate: string;
    endDate: string;
}

type ViewMode = 'dashboard' | 'live' | 'snapshot' | 'trends' | 'pareto' | 'charts' | 'manual' | 'bill';

// FIX: Destructure currentUser from props to ensure it is defined within the component scope
const NodeDataPanel: React.FC<NodeDataPanelProps> = ({ node, organisation, currentUser, theme, startDate, endDate }) => {
    const [activeView, setActiveView] = useState<ViewMode>('dashboard');
    const [globalParams, setGlobalParams] = useState<Record<string, ParameterConfig>>({});
    const [loadingParams, setLoadingParams] = useState(true);

    useEffect(() => {
        setLoadingParams(true);
        const fetchGlobalParams = async () => {
            try {
                const snap = await db.doc(`organisations/${organisation.domain}/modules/EM/settings/parameterConfig`).get();
                if (snap.exists) {
                    setGlobalParams(snap.data()?.configs || {});
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingParams(false);
            }
        };
        fetchGlobalParams();
    }, [organisation.domain]);

    const activeParams = useMemo(() => {
        return (Object.entries(globalParams) as [string, ParameterConfig][])
            .filter(([_, cfg]) => cfg.enabled !== false)
            .map(([id, cfg]) => ({ id, ...cfg }));
    }, [globalParams]);

    const formatWindowDisplay = () => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const isSameDay = s.toDateString() === e.toDateString();

        const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

        if (isSameDay) {
            return (
                <>
                    <span className="text-xs font-bold font-mono">{s.toLocaleDateString(undefined, dateOpts)}</span>
                    <span className="text-slate-500 mx-1">|</span>
                    <span className="text-xs font-bold font-mono text-indigo-400">
                        {s.toLocaleTimeString(undefined, timeOpts)} → {e.toLocaleTimeString(undefined, timeOpts)}
                    </span>
                </>
            );
        }

        return (
            <>
                <span className="text-xs font-bold font-mono">
                    {s.toLocaleDateString(undefined, dateOpts)} {s.toLocaleTimeString(undefined, timeOpts)}
                </span>
                <span className="text-slate-500 mx-1">→</span>
                <span className="text-xs font-bold font-mono text-indigo-400">
                    {e.toLocaleDateString(undefined, dateOpts)} {e.toLocaleTimeString(undefined, timeOpts)}
                </span>
            </>
        );
    };

    if (loadingParams) return (
        <div className="flex flex-col items-center justify-center h-full p-20 text-slate-400 italic">
            <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin mb-4" style={{ borderColor: theme.colorPrimary }}></div>
            <p className="font-bold uppercase tracking-widest text-xs">Synchronizing Intelligence Matrix...</p>
        </div>
    );

    const TabButton: React.FC<{ id: ViewMode; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveView(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                activeView === id 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col gap-4 flex-shrink-0">
                <div className="flex flex-nowrap bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar no-scrollbar">
                    <TabButton id="dashboard" label="Dashboard" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} />
                    <TabButton id="live" label="Live" icon={<div className={`w-2 h-2 rounded-full ${activeView === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>} />
                    <TabButton id="snapshot" label="Snapshot" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                    <TabButton id="trends" label="Trends" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                    <TabButton id="pareto" label="Pareto" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                    <TabButton id="charts" label="Charts" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>} />
                    <TabButton id="bill" label="Bill" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>} />
                    {node.meteringType === 'Manual' && (
                        <TabButton id="manual" label="Entry" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {activeView === 'dashboard' && <EnergyDashboardView node={node} organisation={organisation} theme={theme} activeParams={activeParams} startDate={startDate} endDate={endDate} />}
                    {activeView === 'live' && <EnergyLiveView node={node} organisation={organisation} theme={theme} activeParams={activeParams} />}
                    {activeView === 'snapshot' && <EnergySnapshotView node={node} organisation={organisation} theme={theme} startDate={startDate} endDate={endDate} />}
                    {activeView === 'trends' && <EnergyTrendsView node={node} organisation={organisation} theme={theme} activeParams={activeParams} startDate={startDate} endDate={endDate} />}
                    {activeView === 'pareto' && <EnergyParetoView node={node} organisation={organisation} theme={theme} activeParams={activeParams} startDate={startDate} endDate={endDate} />}
                    {activeView === 'charts' && <EnergyChartsView node={node} organisation={organisation} theme={theme} activeParams={activeParams} startDate={startDate} endDate={endDate} />}
                    {activeView === 'bill' && <EnergyBillView node={node} organisation={organisation} theme={theme} startDate={startDate} endDate={endDate} />}
                    {activeView === 'manual' && node.meteringType === 'Manual' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                            <ManualEntryForm node={node} organisation={organisation} currentUser={currentUser} theme={theme} activeParams={activeParams} />
                        </div>
                    )}
                    
                    {activeView !== 'live' && activeView !== 'manual' && (
                        <div className="mt-8 flex justify-center">
                            <div className="px-6 py-2 bg-slate-900 text-white rounded-full shadow-lg border border-slate-700 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Analysis Scope:</span>
                                <div className="flex items-center gap-1">
                                    {formatWindowDisplay()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NodeDataPanel;
