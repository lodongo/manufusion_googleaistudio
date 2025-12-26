import React, { useState, useEffect, useCallback } from 'react';
import type { Module, AppUser, Organisation } from '../../types';
import type { TopographyNode } from '../../types/em_types';
import TopographySidebar from './em/user/TopographySidebar';
import NodeDataPanel from './em/user/NodeDataPanel';
import PeriodHeader from './em/user/PeriodHeader';
import { TimeRange } from './em/user/TimeRangeSelector';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const EmUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [selectedNode, setSelectedNode] = useState<TopographyNode | null>(null);

  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const [range, setRange] = useState<TimeRange>('today');
  const [startDate, setStartDate] = useState(startOfToday.toISOString());
  const [endDate, setEndDate] = useState(now.toISOString());
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  
  const getTimeBounds = useCallback((targetRange: TimeRange) => {
      const now = new Date();
      const start = new Date();
      let end = new Date();

      switch (targetRange) {
          case 'current_hour': 
              start.setMinutes(0, 0, 0); 
              start.setMilliseconds(0);
              end = new Date(); 
              break;
          case 'last_hour': 
              start.setHours(now.getHours() - 1, 0, 0, 0); 
              end.setHours(now.getHours() - 1, 59, 59, 999); 
              break;
          case 'today': 
              start.setHours(0, 0, 0, 0); 
              end = new Date(); 
              break;
          case 'yesterday': 
              start.setDate(now.getDate() - 1); 
              start.setHours(0, 0, 0, 0); 
              end.setDate(now.getDate() - 1); 
              end.setHours(23, 59, 59, 999); 
              break;
          case 'current_month': 
              start.setDate(1); 
              start.setHours(0, 0, 0, 0); 
              end = new Date(); 
              break;
          case 'last_month': 
              start.setMonth(now.getMonth() - 1, 1); 
              start.setHours(0, 0, 0, 0); 
              end.setMonth(now.getMonth(), 0); 
              end.setHours(23, 59, 59, 999); 
              break;
          case 'current_year': 
              start.setMonth(0, 1); 
              start.setHours(0, 0, 0, 0); 
              end = new Date(); 
              break;
          case 'last_year': 
              start.setFullYear(now.getFullYear() - 1, 0, 1); 
              start.setHours(0, 0, 0, 0); 
              end.setFullYear(now.getFullYear() - 1, 11, 31); 
              end.setHours(23, 59, 59, 999); 
              break;
      }
      return { start, end };
  }, []);

  useEffect(() => {
      if (!isCustomPeriod && range !== 'custom') {
          const { start, end } = getTimeBounds(range);
          setStartDate(start.toISOString());
          setEndDate(end.toISOString());
      }
  }, [range, isCustomPeriod, getTimeBounds]);

  const handleManualDateChange = (start: string, end: string) => {
      setStartDate(new Date(start).toISOString());
      setEndDate(new Date(end).toISOString());
  };

  const handleToggleCustom = (enabled: boolean) => {
      setIsCustomPeriod(enabled);
      if (enabled) {
          setRange('custom');
      } else {
          setRange('today');
      }
  };
  
  const ChevronIcon = ({ direction = 'left' }: { direction?: 'left' | 'right' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
    </svg>
  );

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      <aside className={`flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out ${isLeftSidebarCollapsed ? 'w-0' : 'w-72'}`}>
        <TopographySidebar 
          organisation={organisation} 
          onSelectNode={setSelectedNode} 
          selectedNodeId={selectedNode?.id}
          theme={theme}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-3 bg-white border-b border-slate-200 flex justify-between items-center flex-shrink-0 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsLeftSidebarCollapsed(c => !c)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ChevronIcon direction={isLeftSidebarCollapsed ? 'right' : 'left'} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{module.name}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Energy Intelligence Terminal</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {canSeeAdminLink && (
              <button
                onClick={onSwitchToAdmin}
                className="px-4 py-2 text-white rounded-xl hover:opacity-90 text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all"
                style={{ backgroundColor: theme.colorPrimary }}
              >
                Admin
              </button>
            )}
            <button
              onClick={onBackToDashboard}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              &larr; Back to Hub
            </button>
            <button onClick={() => setIsRightSidebarCollapsed(c => !c)} className="p-2 rounded-full hover:bg-slate-100 transition-colors" title={isRightSidebarCollapsed ? 'Open Selections' : 'Close Selections'}>
                <ChevronIcon direction={isRightSidebarCollapsed ? 'left' : 'right'} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {selectedNode ? (
            <NodeDataPanel 
              node={selectedNode} 
              organisation={organisation} 
              currentUser={currentUser} 
              theme={theme} 
              startDate={startDate}
              endDate={endDate}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="w-24 h-24 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6 border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Select Topographic Point</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
                    Navigate the site hierarchy on the left to view live telemetry, enter manual data, or analyze consumption aggregates.
                </p>
            </div>
          )}
        </main>
      </div>

      <aside className={`flex-shrink-0 bg-white border-l border-slate-200 flex flex-col transition-all duration-300 ease-in-out ${isRightSidebarCollapsed ? 'w-0' : 'w-80'}`}>
        <div className={`flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0 transition-opacity ${isRightSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analysis Selections</h3>
          <button onClick={() => setIsRightSidebarCollapsed(c => !c)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ChevronIcon direction="right" />
          </button>
        </div>
        <div className={`p-4 overflow-y-auto transition-opacity ${isRightSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          <PeriodHeader 
            range={range}
            onRangeChange={setRange}
            startDate={startDate}
            endDate={endDate}
            isCustomPeriod={isCustomPeriod}
            onToggleCustom={handleToggleCustom}
            onManualChange={handleManualDateChange}
          />
        </div>
      </aside>
    </div>
  );
};

export default EmUserPage;
