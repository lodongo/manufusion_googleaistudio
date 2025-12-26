import React from 'react';

interface WeeklyCalendarViewProps {
    data: { label: string; value: number }[];
    onDayClick: (dayLabel: string) => void;
    themeColor: string;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({ data, onDayClick, themeColor }) => {
    if (!data || data.length === 0) {
        return <div className="p-8 text-center text-slate-400">No data for this week.</div>;
    }

    // Find min/max values for color scaling
    const values = data.map(d => Number(d.value || 0));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values, 1); // Avoid division by zero

    // Create a map for quick lookup: 'YYYY-MM-DD' -> value
    const dataMap = new Map(data.map(d => [d.label, Number(d.value || 0)]));

    // Determine the start and end dates from the data
    const dates = data.map(d => new Date(d.label));
    const startDate = dates.reduce((a, b) => a < b ? a : b);
    const endDate = dates.reduce((a, b) => a > b ? a : b);
    
    const startDayOfWeek = startDate.getUTCDay(); // 0 for Sunday

    const calendarDays: ({ date: Date; value: number | null })[] = [];
    
    // Fill initial empty cells if the week doesn't start on Sunday
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push({ date: new Date(), value: null });
    }

    // Fill the data for the week
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${dayNum}`;
        
        calendarDays.push({ date: new Date(d), value: Number(dataMap.get(localDateStr)) || 0 });
    }

    // Function to get color based on value
    const getColorForValue = (value: number | null) => {
        if (value === null || value === 0) return 'bg-slate-50 text-slate-400';
        const percentage = (value - minVal) / (maxVal - minVal);
        if (percentage < 0.25) return 'bg-green-100 text-green-800';
        if (percentage < 0.5) return 'bg-yellow-100 text-yellow-800';
        if (percentage < 0.75) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-inner border animate-fade-in">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 mb-2">
                {WEEK_DAYS.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                    if (day.value === null) {
                        return <div key={index} className="h-28 rounded-md bg-slate-50 border"></div>;
                    }
                    
                    const y = day.date.getFullYear();
                    const m = String(day.date.getMonth() + 1).padStart(2, '0');
                    const d = String(day.date.getDate()).padStart(2, '0');
                    const localDateStr = `${y}-${m}-${d}`;

                    return (
                        <button
                            key={localDateStr}
                            onClick={() => onDayClick(localDateStr)}
                            className={`h-28 p-2 rounded-lg flex flex-col justify-between text-left transition-all hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 ring-offset-2 ring-indigo-500 ${getColorForValue(day.value)} border`}
                        >
                            <div className="font-black text-slate-700">{day.date.getDate()}</div>
                            <div className={`text-right font-black text-lg`}>
                                {day.value.toFixed(1)}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default WeeklyCalendarView;
