import React from 'react';

export type TimeRange = 
    | 'current_hour' 
    | 'last_hour' 
    | 'today' 
    | 'yesterday' 
    | 'current_month' 
    | 'last_month' 
    | 'current_year' 
    | 'last_year'
    | 'custom';

interface TimeRangeSelectorProps {
    range: TimeRange;
    onChange: (range: TimeRange) => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ range, onChange }) => {
    const options: { id: TimeRange; label: string }[] = [
        { id: 'current_hour', label: 'Hour' },
        { id: 'last_hour', label: 'Prev Hour' },
        { id: 'today', label: 'Today' },
        { id: 'yesterday', label: 'Yesterday' },
        { id: 'current_month', label: 'Month' },
        { id: 'last_month', label: 'Prev Month' },
        { id: 'current_year', label: 'Year' },
        { id: 'last_year', label: 'Prev Year' },
    ];

    return (
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-[1.8rem] w-fit border border-slate-200 shadow-inner">
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${
                        range === opt.id 
                        ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

export default TimeRangeSelector;