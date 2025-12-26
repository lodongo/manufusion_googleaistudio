import React from 'react';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';

interface PeriodHeaderProps {
    range: TimeRange;
    onRangeChange: (r: TimeRange) => void;
    startDate: string;
    endDate: string;
    isCustomPeriod: boolean;
    onToggleCustom: (enabled: boolean) => void;
    onManualChange: (start: string, end: string) => void;
    loading?: boolean;
}

const PeriodHeader: React.FC<PeriodHeaderProps> = ({ 
    range, onRangeChange, startDate, endDate, isCustomPeriod, onToggleCustom, onManualChange, loading 
}) => {
    // Helper to format ISO to datetime-local compatible format (YYYY-MM-DDTHH:mm)
    const formatForInput = (iso: string) => {
        const d = new Date(iso);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Quick Selection Section */}
            <section className={`bg-slate-50 p-4 rounded-2xl border transition-all duration-300 ${isCustomPeriod ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : 'border-slate-200 shadow-inner'}`}>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presets</h4>
                    {!isCustomPeriod && (
                        <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">Live</span>
                    )}
                </div>
                <div className="flex justify-center">
                    <TimeRangeSelector range={range} onChange={onRangeChange} />
                </div>
            </section>
            
            {/* Specific Period Section */}
            <section className={`p-4 rounded-2xl border transition-all duration-300 ${
                isCustomPeriod 
                ? 'bg-indigo-50 border-indigo-200 ring-4 ring-indigo-500/10 shadow-lg' 
                : 'bg-white border-slate-200'
            }`}>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Range</h4>
                    <button 
                        onClick={() => onToggleCustom(!isCustomPeriod)}
                        className={`px-3 py-1 text-[8px] font-black uppercase rounded-full transition-all border ${
                            isCustomPeriod 
                            ? 'bg-indigo-600 text-white border-indigo-500' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {isCustomPeriod ? 'Enabled' : 'Enable Specific'}
                    </button>
                </div>
                
                <div className={`flex flex-col gap-4 transition-opacity duration-300 ${isCustomPeriod ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Start Point</span>
                        <input 
                            type="datetime-local" 
                            value={formatForInput(startDate)} 
                            onChange={e => onManualChange(e.target.value, endDate)} 
                            className="p-2.5 rounded-xl text-xs font-bold bg-white border border-indigo-100 text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">End Point</span>
                        <input 
                            type="datetime-local" 
                            value={formatForInput(endDate)} 
                            onChange={e => onManualChange(startDate, e.target.value)} 
                            className="p-2.5 rounded-xl text-xs font-bold bg-white border border-indigo-100 text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>
                </div>
            </section>

            <div className="px-3 py-2 flex items-center justify-center gap-4 text-slate-400 border-t border-slate-100 mt-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    {loading ? 'Crunching Intelligence...' : 'Logic Synced'}
                </span>
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
            </div>
        </div>
    );
};

export default PeriodHeader;
