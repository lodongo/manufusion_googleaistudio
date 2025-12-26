
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { EnrichedTask, MaintenancePlan } from '../../../../../types/am_types';
import type { Organisation } from '../../../../types';

interface PlanResourcesTabProps {
    scheduledTasks: EnrichedTask[];
    plan: MaintenancePlan;
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

interface ResourceData {
    name: string;
    tasks: EnrichedTask[];
    totalAssignedHours: number;
}

const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const PlanResourcesTab: React.FC<PlanResourcesTabProps> = ({ scheduledTasks, plan, effectivePlan, criticalPathTasks, theme }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [tooltip, setTooltip] = useState<{ x: number, y: number, content: string } | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) setContainerWidth(entries[0].contentRect.width);
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const resourceMap = useMemo<Map<string, ResourceData>>(() => {
        const map = new Map<string, ResourceData>();
        scheduledTasks.forEach((task: EnrichedTask) => {
            if (task.assignedTo && task.assignedTo.length > 0) {
                task.assignedTo.forEach(assignee => {
                    if (!map.has(assignee.uid)) {
                        map.set(assignee.uid, { name: assignee.name, tasks: [], totalAssignedHours: 0 });
                    }
                    const resource = map.get(assignee.uid);
                    if (resource) {
                        resource.tasks.push(task);
                        resource.totalAssignedHours += (task.estimatedDurationHours || 0);
                    }
                });
            } else {
                if (!map.has('unassigned')) {
                    map.set('unassigned', { name: 'Unassigned', tasks: [], totalAssignedHours: 0 });
                }
                const resource = map.get('unassigned');
                if (resource) {
                    resource.tasks.push(task);
                    resource.totalAssignedHours += (task.estimatedDurationHours || 0);
                }
            }
        });
        return map;
    }, [scheduledTasks]);

    const resources: ResourceData[] = Array.from(resourceMap.values());

    const chartDimensions = useMemo(() => {
        if (containerWidth === 0) return null;

        const planStart = new Date(`${effectivePlan.scheduledStartDate}T${effectivePlan.workStartTime || '00:00'}:00`);
        const planEnd = new Date(`${effectivePlan.scheduledEndDate}T${effectivePlan.workEndTime || '23:59'}:00`);
        
        const days = Math.ceil((planEnd.getTime() - planStart.getTime()) / (1000 * 3600 * 24));
        // Calculate net daily hours (excluding breaks)
        const dailyStartMins = parseTime(effectivePlan.workStartTime || '08:00');
        const dailyEndMins = parseTime(effectivePlan.workEndTime || '17:00');
        let dailyBreakMins = 0;
        (effectivePlan.breaks || []).forEach(b => {
            dailyBreakMins += (parseTime(b.endTime) - parseTime(b.startTime));
        });
        const dailyWorkHours = (dailyEndMins - dailyStartMins - dailyBreakMins) / 60;
        const totalCapacityHours = days * dailyWorkHours;

        if (isNaN(planStart.getTime()) || isNaN(planEnd.getTime())) return null;

        const totalHours = Math.max((planEnd.getTime() - planStart.getTime()) / (1000 * 3600), 1);
        const padding = { top: 50, right: 80, bottom: 20, left: 150 }; 
        const rowHeight = 50;
        let hourWidth = Math.max((containerWidth - padding.left - padding.right) / totalHours, 40);

        const chartHeight = resources.length * rowHeight + padding.top + padding.bottom;
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

        return { chartWidth, chartHeight, padding, xScale, rowHeight, ticks, totalCapacityHours, planStart, planEnd, nonWorkingIntervals };
    }, [resources.length, containerWidth, effectivePlan]);

    const calculateResourceSegments = (resourceTasks: EnrichedTask[]) => {
        if (!chartDimensions) return [];
        
        const timePoints = new Set<number>();
        timePoints.add(chartDimensions.planStart.getTime());
        timePoints.add(chartDimensions.planEnd.getTime());

        resourceTasks.forEach(t => {
            if (t.ganttStartDate && t.ganttEndDate) {
                timePoints.add(t.ganttStartDate.getTime());
                timePoints.add(t.ganttEndDate.getTime());
            }
        });

        chartDimensions.nonWorkingIntervals.forEach(nw => {
            if (nw.start >= chartDimensions.planStart && nw.start <= chartDimensions.planEnd) timePoints.add(nw.start.getTime());
            if (nw.end >= chartDimensions.planStart && nw.end <= chartDimensions.planEnd) timePoints.add(nw.end.getTime());
        });

        const sortedPoints = Array.from(timePoints).sort((a,b) => a - b);
        const segments: { start: number, end: number, count: number, critical: boolean, type: 'work' | 'break' | 'activeTasks', activeTasks: EnrichedTask[] }[] = [];

        for (let i = 0; i < sortedPoints.length - 1; i++) {
            const start = sortedPoints[i];
            const end = sortedPoints[i+1];
            const mid = (start + end) / 2;

            const isNonWorking = chartDimensions.nonWorkingIntervals.some(nw => mid >= nw.start.getTime() && mid < nw.end.getTime());
            
            const activeTasks = resourceTasks.filter(t => {
                return t.ganttStartDate && t.ganttEndDate && mid >= t.ganttStartDate.getTime() && mid < t.ganttEndDate.getTime();
            });

            if (isNonWorking) {
                segments.push({ start, end, count: activeTasks.length, critical: false, type: 'break', activeTasks: [] });
            } else {
                if (activeTasks.length > 0) {
                     const isCritical = activeTasks.some(t => criticalPathTasks.has(t.id) || t.isCritical);
                     segments.push({ start, end, count: activeTasks.length, critical: isCritical, type: 'work', activeTasks });
                }
            }
        }

        return segments;
    };

    const handleMouseMove = (e: React.MouseEvent, seg: any, resName: string) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft + 15;
        const y = e.clientY - rect.top;

        let content = '';
        if (seg.type === 'break') {
             content = `<div class="font-sans text-xs"><strong>Break / Off-Shift</strong></div>`;
        } else {
             const taskList = seg.activeTasks.map((t: EnrichedTask) => 
                 `<div class='mt-1 pl-2 border-l-2 border-slate-400'>${t.taskId}: ${t.taskName}</div>`
             ).join('');

             content = `
                <div class="font-sans text-xs">
                    <strong>${resName}</strong><br/>
                    ${new Date(seg.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(seg.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br/>
                    Allocation: ${seg.count > 1 ? '<span class="text-red-400 font-bold">Double (' + seg.count + ')</span>' : '<span class="text-green-400">Normal</span>'}
                    ${seg.critical ? '<br/><span class="text-amber-400 font-bold">Critical Path</span>' : ''}
                    <div class="mt-2 pt-1 border-t border-slate-600 opacity-90 font-normal">
                        <strong>Tasks:</strong>
                        ${taskList}
                    </div>
                </div>
            `;
        }
        setTooltip({ x, y, content });
    };

    return (
        <div>
            <div className="mb-4 flex items-center gap-4 text-sm text-slate-600 bg-slate-50 p-2 rounded border">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> <span>Single Allocation</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> <span>Double Allocation (Conflict)</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-black bg-transparent"></div> <span>Critical Path Assignment</span></div>
                 <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500"></div> <span>Safety Task</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-dashed border-gray-400"></div> <span>Break/Off-Shift</span></div>
            </div>
            
            <div className="relative w-full overflow-x-auto p-4 bg-slate-50 rounded-b-lg border" style={{minHeight: '400px'}}>
                 <div ref={containerRef} className="w-full h-full overflow-x-auto">
                    {!chartDimensions ? <div className="p-8 text-center">Calculating optimization...</div> : (
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
                            {resources.map((res, index) => {
                                const y = chartDimensions.padding.top + index * chartDimensions.rowHeight;
                                const segments = calculateResourceSegments(res.tasks);
                                const utilization = Math.round((res.totalAssignedHours / chartDimensions.totalCapacityHours) * 100);
                                const utilColor = utilization > 100 ? 'red' : utilization > 80 ? 'orange' : 'green';

                                return (
                                    <g key={index} transform={`translate(0, ${y})`}>
                                        <line x1={chartDimensions.padding.left} x2={chartDimensions.chartWidth - chartDimensions.padding.right} y1={chartDimensions.rowHeight} y2={chartDimensions.rowHeight} stroke="#f1f5f9" />
                                        <text x={chartDimensions.padding.left - 10} y={chartDimensions.rowHeight / 2} dy="0.35em" textAnchor="end" fontSize="12" fill="#334155" fontWeight="bold">
                                            {res.name}
                                        </text>
                                        <rect x={chartDimensions.chartWidth - chartDimensions.padding.right + 5} y={15} width="40" height="20" rx="4" fill={utilColor === 'red' ? '#fecaca' : utilColor === 'orange' ? '#fed7aa' : '#bbf7d0'} />
                                        <text x={chartDimensions.chartWidth - chartDimensions.padding.right + 25} y={29} textAnchor="middle" fontSize="11" fontWeight="bold" fill={utilColor === 'red' ? '#991b1b' : utilColor === 'orange' ? '#9a3412' : '#166534'}>
                                            {utilization}%
                                        </text>
                                        {segments.map((seg, sIdx) => {
                                            const x1 = chartDimensions.xScale(new Date(seg.start));
                                            const x2 = chartDimensions.xScale(new Date(seg.end));
                                            const width = Math.max(x2 - x1, 1);
                                            if (seg.type === 'break') {
                                                return (
                                                    <line key={sIdx} x1={x1} x2={x2} y1={25} y2={25} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4" onMouseMove={(e) => handleMouseMove(e, seg, res.name)} />
                                                );
                                            } else {
                                                const isSafety = seg.activeTasks.some(t => t.isSafetyTask);
                                                const fill = isSafety ? '#eab308' : (seg.count > 1 ? '#ef4444' : '#22c55e');
                                                const stroke = seg.critical ? '#000000' : 'none';
                                                const strokeWidth = seg.critical ? 2 : 0;
                                                return (
                                                    <rect key={sIdx} x={x1} y={10} width={width} height={30} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={4} ry={4} onMouseMove={(e) => handleMouseMove(e, seg, res.name)} className="hover:opacity-80" />
                                                );
                                            }
                                        })}
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                 </div>
                 {tooltip && <div style={{ top: tooltip.y, left: tooltip.x }} className="absolute p-2 bg-slate-800 text-white rounded shadow-xl z-50 pointer-events-none border border-slate-600 shadow-lg text-xs" dangerouslySetInnerHTML={{ __html: tooltip.content }} />}
            </div>
        </div>
    );
};

export default PlanResourcesTab;
