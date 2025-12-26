
import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { EnrichedTask, MaintenancePlan } from '../../../../../types/am_types';
import type { Organisation } from '../../../../types';

interface PlanGanttTabProps {
    scheduledTasks: EnrichedTask[];
    plan: MaintenancePlan;
    // We need the calculated plan with edit overrides here
    effectivePlan: {
        scheduledStartDate: string;
        scheduledEndDate: string;
        workStartTime: string;
        workEndTime: string;
        breaks: any[];
    };
    criticalPathTasks: Set<string>;
    theme: Organisation['theme'];
}

const formatGanttDate = (date: Date) => {
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const PlanGanttTab: React.FC<PlanGanttTabProps> = ({ scheduledTasks, plan, effectivePlan, criticalPathTasks, theme }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number, y: number, content: string } | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const chartDimensions = useMemo(() => {
        if (containerWidth === 0) return null;

        const planStart = new Date(`${effectivePlan.scheduledStartDate}T${effectivePlan.workStartTime || '00:00'}:00`);
        const planEnd = new Date(`${effectivePlan.scheduledEndDate}T${effectivePlan.workEndTime || '23:59'}:00`);
        
        if (isNaN(planStart.getTime()) || isNaN(planEnd.getTime())) return null;

        const totalHours = Math.max((planEnd.getTime() - planStart.getTime()) / (1000 * 3600), 1);
        
        const padding = { top: 50, right: 30, bottom: 20, left: 160 }; 
        const rowHeight = 40;
        let hourWidth = Math.max((containerWidth - padding.left - padding.right) / totalHours, 40);

        const chartHeight = scheduledTasks.length * rowHeight + padding.top + padding.bottom;
        const chartWidth = totalHours * hourWidth + padding.left + padding.right;

        const xScale = (date: Date) => {
            const timeDiffHours = (date.getTime() - planStart.getTime()) / (1000 * 3600);
            return padding.left + timeDiffHours * hourWidth;
        };
        
        const ticks: Date[] = [];
        const iter = new Date(planStart);
        iter.setMinutes(0,0,0);
        
        while (iter <= planEnd) {
             if (iter >= planStart) ticks.push(new Date(iter));
             iter.setHours(iter.getHours() + 1);
        }

        const nonWorkingIntervals: {start: Date, end: Date}[] = [];
        const nwIter = new Date(planStart);
        nwIter.setHours(0,0,0,0);
        const nwEnd = new Date(planEnd);
        nwEnd.setDate(nwEnd.getDate() + 2);
        
        while(nwIter < nwEnd) {
            const workEnd = new Date(nwIter);
            const [eh, em] = (effectivePlan.workEndTime || '17:00').split(':').map(Number);
            workEnd.setHours(eh, em, 0, 0);
            
            const nextDayStart = new Date(nwIter);
            nextDayStart.setDate(nextDayStart.getDate() + 1);
            const [sh, sm] = (effectivePlan.workStartTime || '08:00').split(':').map(Number);
            nextDayStart.setHours(sh, sm, 0, 0);
            
            if (workEnd < nextDayStart) {
                nonWorkingIntervals.push({ start: workEnd, end: nextDayStart });
            }

            (effectivePlan.breaks || []).forEach(b => {
                const bStart = new Date(nwIter);
                const [bsh, bsm] = b.startTime.split(':').map(Number);
                bStart.setHours(bsh, bsm, 0, 0);
                const bEnd = new Date(nwIter);
                const [beh, bem] = b.endTime.split(':').map(Number);
                bEnd.setHours(beh, bem, 0, 0);
                
                if (bStart < bEnd) {
                     nonWorkingIntervals.push({ start: bStart, end: bEnd });
                }
            });
            
            nwIter.setDate(nwIter.getDate() + 1);
        }
        nonWorkingIntervals.sort((a,b) => a.start.getTime() - b.start.getTime());

        return { chartWidth, chartHeight, padding, xScale, rowHeight, ticks, planStart, planEnd, nonWorkingIntervals };

    }, [scheduledTasks, containerWidth, effectivePlan]);

    const handleMouseMove = (e: React.MouseEvent, task: EnrichedTask) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft + 15;
        const y = e.clientY - rect.top;
        
        const assignees = task.assignedTo && task.assignedTo.length > 0
            ? task.assignedTo.map(a => a.name).join(', ')
            : 'Unassigned';

        const content = `
            <div class="font-sans">
                <strong class="text-sm block border-b pb-1 mb-1">${task.taskName}</strong>
                <span class="text-xs text-slate-300 block mb-2">${task.taskId}</span>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span class="text-slate-400">Start:</span> <span>${formatGanttDate(task.ganttStartDate!)}</span>
                    <span class="text-slate-400">End:</span> <span>${formatGanttDate(task.ganttEndDate!)}</span>
                    <span class="text-slate-400">Duration:</span> <span>${task.estimatedDurationHours} hrs</span>
                    <span class="text-slate-400">Who:</span> <span>${assignees}</span>
                    ${task.isSafetyTask ? '<span class="col-span-2 text-amber-400 font-bold mt-1">⚠️ Safety Task</span>' : ''}
                </div>
            </div>
        `;
        setTooltip({ x, y, content });
    };
    
    const getTaskSegments = (taskStart: Date, taskEnd: Date, intervals: {start: Date, end: Date}[]) => {
        const segments: { start: Date, end: Date, type: 'work' | 'break' }[] = [];
        let cursor = new Date(taskStart);
        const relevantIntervals = intervals.filter(i => i.start < taskEnd && i.end > taskStart);

        for (const interval of relevantIntervals) {
             if (cursor < interval.start) {
                 segments.push({ start: new Date(cursor), end: new Date(interval.start), type: 'work' });
                 cursor = new Date(interval.start);
             }
             if (cursor < interval.end && cursor < taskEnd) {
                 const breakEnd = interval.end > taskEnd ? taskEnd : interval.end;
                 segments.push({ start: new Date(cursor), end: new Date(breakEnd), type: 'break' });
                 cursor = new Date(breakEnd);
             }
        }
        if (cursor < taskEnd) {
             segments.push({ start: new Date(cursor), end: new Date(taskEnd), type: 'work' });
        }
        return segments;
    };

    return (
        <div>
            <div className="mb-4 flex items-center gap-4 text-sm text-slate-600 bg-slate-50 p-2 rounded border">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> <span>Critical Path</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500"></div> <span>Non-Critical Task</span></div>
                 <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500"></div> <span>Safety Task</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border border-dashed border-gray-400"></div> <span>Break/Off-Shift</span></div>
                 <div className="flex-1 text-right">Window: {effectivePlan.workStartTime} - {effectivePlan.workEndTime}</div>
            </div>
            
            <div 
                className="relative w-full overflow-x-auto p-4 bg-slate-50 rounded-b-lg border" 
                style={{minHeight: '400px', height: chartDimensions ? `${chartDimensions.chartHeight + 60}px` : 'auto'}} 
            >
                <div ref={containerRef} className="w-full h-full overflow-x-auto">
                    {scheduledTasks.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No tasks to display in Gantt chart.</div>
                    ) : !chartDimensions ? (
                        <div className="p-8 text-center text-slate-500">Calculating schedule...</div>
                    ) : (
                        <svg width={chartDimensions.chartWidth} height={chartDimensions.chartHeight} onMouseLeave={() => setTooltip(null)}>
                            <rect x={chartDimensions.padding.left} y={chartDimensions.padding.top} width={chartDimensions.chartWidth - chartDimensions.padding.left - chartDimensions.padding.right} height={chartDimensions.chartHeight - chartDimensions.padding.top - chartDimensions.padding.bottom} fill="white" />
                            
                            <g>
                                {chartDimensions.ticks.map((date, i) => {
                                    const x = chartDimensions.xScale(date);
                                    const isDayStart = date.getHours() === 0;
                                    return (
                                        <g key={`t-${i}`}>
                                            <line x1={x} y1={chartDimensions.padding.top - 5} x2={x} y2={chartDimensions.chartHeight - chartDimensions.padding.bottom} stroke={isDayStart ? "#94a3b8" : "#e2e8f0"} strokeWidth={isDayStart ? 2 : 1} />
                                            <text x={x} y={chartDimensions.padding.top - 10} textAnchor="middle" fontSize="10" fill="#64748b">{date.getHours()}:00</text>
                                            {isDayStart && <text x={x + 5} y={chartDimensions.padding.top - 25} textAnchor="start" fontSize="11" fill="#334155" fontWeight="bold">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>}
                                        </g>
                                    );
                                })}
                            </g>

                            {scheduledTasks.map((task, index) => {
                                const y = chartDimensions.padding.top + index * chartDimensions.rowHeight;
                                const segments = getTaskSegments(task.ganttStartDate!, task.ganttEndDate!, chartDimensions.nonWorkingIntervals);
                                
                                const isCritical = criticalPathTasks.has(task.id) || !!task.isCritical;
                                // Yellow for safety, Red for Critical, Blue for Normal
                                const barColor = task.isSafetyTask ? '#eab308' : (isCritical ? '#ef4444' : '#3b82f6');

                                return (
                                    <g key={task.id} transform={`translate(0, ${y})`}>
                                        <line x1={chartDimensions.padding.left} x2={chartDimensions.chartWidth - chartDimensions.padding.right} y1={chartDimensions.rowHeight} y2={chartDimensions.rowHeight} stroke="#f1f5f9" />
                                        <text x={chartDimensions.padding.left - 10} y={chartDimensions.rowHeight / 2} dy="0.35em" textAnchor="end" fontSize="12" fill="#334155" fontWeight={task.isSafetyTask ? 'normal' : 'bold'} style={task.isSafetyTask ? {fontStyle: 'italic'} : {}}>
                                            {task.taskId}
                                        </text>
                                        
                                        {segments.map((seg, sIdx) => {
                                            const x1 = chartDimensions.xScale(seg.start);
                                            const x2 = chartDimensions.xScale(seg.end);
                                            const width = Math.max(x2 - x1, 0);
                                            if (width <= 0) return null;

                                            if (seg.type === 'break') {
                                                return <line key={sIdx} x1={x1} x2={x2} y1={chartDimensions.rowHeight * 0.5} y2={chartDimensions.rowHeight * 0.5} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4" />;
                                            } else {
                                                return (
                                                    <rect
                                                        key={sIdx}
                                                        x={x1}
                                                        y={chartDimensions.rowHeight * 0.25}
                                                        width={width}
                                                        height={chartDimensions.rowHeight * 0.5}
                                                        fill={barColor}
                                                        rx={4}
                                                        ry={4}
                                                        onMouseMove={(e) => handleMouseMove(e, task)}
                                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                                    />
                                                );
                                            }
                                        })}
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                </div>
                {tooltip && <div style={{ top: tooltip.y, left: tooltip.x, minWidth: '220px' }} className="absolute p-3 bg-slate-800 text-white rounded shadow-xl z-50 pointer-events-none"><div dangerouslySetInnerHTML={{ __html: tooltip.content }} /></div>}
            </div>
        </div>
    );
};

export default PlanGanttTab;
