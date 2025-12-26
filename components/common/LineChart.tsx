import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

interface ChartDataPoint {
  date: Date;
  rate: number;
}

interface LineChartProps {
  data: ChartDataPoint[];
  themeColor: string;
  showAverage?: boolean;
  showTrendline?: boolean;
  label?: string;
  minDateOverride?: Date;
  maxDateOverride?: Date;
}

const LineChart: React.FC<LineChartProps> = ({ 
  data, 
  themeColor, 
  showAverage = false, 
  showTrendline = false, 
  label,
  minDateOverride,
  maxDateOverride
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoomRange, setZoomRange] = useState<{ start: number, end: number } | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: ChartDataPoint } | null>(null);
  
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          setDimensions({ width, height });
        }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const safeId = useMemo(() => themeColor.replace('#', ''), [themeColor]);

  const chartInfo = useMemo(() => {
    if (data.length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      return null;
    }

    const { width, height } = dimensions;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Determine X-Scale bounds based on data, override, or zoom
    const dates = data.map(d => d.date.getTime());
    let minDate = minDateOverride ? minDateOverride.getTime() : Math.min(...dates);
    let maxDate = maxDateOverride ? maxDateOverride.getTime() : Math.max(...dates);

    if (zoomRange) {
        minDate = zoomRange.start;
        maxDate = zoomRange.end;
    }

    const minRateVal = 0; 
    const visiblePoints = data.filter(d => d.date.getTime() >= minDate && d.date.getTime() <= maxDate);
    const rates = visiblePoints.length > 0 ? visiblePoints.map(d => d.rate) : [0];
    const maxRateVal = Math.max(...rates, 1) * 1.2;

    const xScale = (date: number) => padding.left + ((date - minDate) / (maxDate - minDate || 1)) * chartWidth;
    const yScale = (rate: number) => padding.top + chartHeight - ((rate - minRateVal) / (maxRateVal - minRateVal || 1)) * chartHeight;

    const linePath = visiblePoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.date.getTime())} ${yScale(d.rate)}`).join(' ');
    const areaPath = linePath ? (linePath + ` L ${xScale(maxDate)} ${padding.top + chartHeight} L ${xScale(minDate)} ${padding.top + chartHeight} Z`) : '';

    const xTicks = [];
    if (visiblePoints.length > 1) {
        const tickCount = Math.min(6, visiblePoints.length);
        for (let i = 0; i < tickCount; i++) {
            xTicks.push(visiblePoints[Math.floor(i * (visiblePoints.length - 1) / (tickCount - 1))]);
        }
    } else if (visiblePoints.length === 1) {
        xTicks.push(visiblePoints[0]);
    }

    const yTicks = [0, maxRateVal / 2, maxRateVal];
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const avgY = yScale(avg);

    let trendPath = '';
    if (showTrendline && visiblePoints.length > 1) {
        const n = visiblePoints.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        visiblePoints.forEach((d, i) => {
            sumX += i; sumY += d.rate; sumXY += i * d.rate; sumXX += i * i;
        });
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
        const intercept = (sumY - slope * sumX) / n;
        trendPath = `M ${xScale(visiblePoints[0].date.getTime())} ${yScale(intercept)} L ${xScale(visiblePoints[n-1].date.getTime())} ${yScale(slope * (n - 1) + intercept)}`;
    }
    
    return { xScale, yScale, path: linePath, areaPath, xTicks, yTicks, avgY, trendPath, minDate, maxDate };
  }, [data, dimensions, showTrendline, padding.left, padding.right, padding.top, padding.bottom, minDateOverride, maxDateOverride, zoomRange]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    setDragStart(svgP.x);
    setDragCurrent(svgP.x);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartInfo || data.length === 0) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    if (dragStart !== null) {
        setDragCurrent(svgP.x);
        setTooltip(null);
    } else {
        const visiblePoints = data.filter(d => d.date.getTime() >= chartInfo.minDate && d.date.getTime() <= chartInfo.maxDate);
        if (visiblePoints.length === 0) return;
        
        const closestPoint = visiblePoints.reduce((prev, curr) => 
            (Math.abs(chartInfo.xScale(curr.date.getTime()) - svgP.x) < Math.abs(chartInfo.xScale(prev.date.getTime()) - svgP.x) ? curr : prev)
        );

        setTooltip({
          x: chartInfo.xScale(closestPoint.date.getTime()),
          y: chartInfo.yScale(closestPoint.rate),
          point: closestPoint
        });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragStart !== null && dragCurrent !== null && chartInfo) {
        const startX = Math.min(dragStart, dragCurrent);
        const endX = Math.max(dragStart, dragCurrent);
        
        if (endX - startX > 10) { // Minimum zoom width
            const startTime = ((startX - padding.left) / (dimensions.width - padding.left - padding.right)) * (chartInfo.maxDate - chartInfo.minDate) + chartInfo.minDate;
            const endTime = ((endX - padding.left) / (dimensions.width - padding.left - padding.right)) * (chartInfo.maxDate - chartInfo.minDate) + chartInfo.minDate;
            setZoomRange({ start: startTime, end: endTime });
        }
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[150px] relative overflow-hidden group">
      {zoomRange && (
          <button 
            onClick={() => setZoomRange(null)}
            className="absolute top-4 right-4 z-30 px-3 py-1 bg-slate-900/80 text-white text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-sm border border-white/10 hover:bg-slate-900 transition-all shadow-lg"
          >
            Reset Zoom
          </button>
      )}
      {chartInfo && (
        <svg 
            width={dimensions.width} 
            height={dimensions.height} 
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setTooltip(null); setDragStart(null); setDragCurrent(null); }} 
            className="overflow-visible block cursor-crosshair select-none"
        >
            <defs>
                <linearGradient id={`areaGradient-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Y-axis Ticks */}
            {chartInfo.yTicks.map((tick, i) => (
            <g key={i} transform={`translate(0, ${chartInfo.yScale(tick)})`}>
                <line x1={padding.left} x2={dimensions.width - padding.right} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padding.left - 10} dy="0.32em" textAnchor="end" fontSize="9" fontWeight="bold" fill="#94a3b8" className="uppercase">
                    {tick.toFixed(1)}
                </text>
            </g>
            ))}

            {/* X-axis Ticks */}
            {chartInfo.xTicks.map((tick, i) => (
            <g key={i} transform={`translate(${chartInfo.xScale(tick.date.getTime())}, 0)`}>
                <text y={dimensions.height - padding.bottom + 20} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#94a3b8">
                    {tick.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </text>
            </g>
            ))}

            {/* Label */}
            {label && (
                <text x={padding.left} y={20} fontSize="10" fontWeight="black" fill={themeColor} className="uppercase tracking-widest">{label}</text>
            )}

            {/* Average Line */}
            {showAverage && chartInfo.avgY !== null && (
                <g>
                    <line x1={padding.left} y1={chartInfo.avgY} x2={dimensions.width - padding.right} y2={chartInfo.avgY} stroke={themeColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                    <text x={dimensions.width - padding.right} y={chartInfo.avgY - 5} textAnchor="end" fontSize="8" fontWeight="bold" fill={themeColor} opacity="0.8">AVG</text>
                </g>
            )}

            {/* Trendline */}
            {showTrendline && chartInfo.trendPath && (
                <path d={chartInfo.trendPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 2" opacity="0.6" />
            )}

            {/* Area Background */}
            {chartInfo.areaPath && <path d={chartInfo.areaPath} fill={`url(#areaGradient-${safeId})`} className="transition-all duration-300" />}

            {/* Line Path */}
            {chartInfo.path && <path d={chartInfo.path} fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />}
            
            {/* Zoom Overlay */}
            {dragStart !== null && dragCurrent !== null && (
                <rect 
                    x={Math.min(dragStart, dragCurrent)}
                    y={padding.top}
                    width={Math.abs(dragCurrent - dragStart)}
                    height={dimensions.height - padding.top - padding.bottom}
                    fill="rgba(79, 70, 229, 0.2)"
                    stroke="rgba(79, 70, 229, 0.4)"
                    strokeWidth="1"
                />
            )}

            {/* Tooltip */}
            {tooltip && dragStart === null && (
            <g transform={`translate(${tooltip.x}, ${tooltip.y})`}>
                <circle r="4" fill="white" stroke={themeColor} strokeWidth="2" />
                <line y1={4} y2={dimensions.height - padding.bottom - tooltip.y} stroke={themeColor} strokeDasharray="3,3" opacity="0.3" />
                <g transform="translate(0, -40)">
                    <rect x="-35" y="0" width="70" height="30" fill="#1e293b" rx="6" />
                    <text x="0" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="black" className="tabular-nums">
                        {tooltip.point.rate.toFixed(2)}
                    </text>
                    <text x="0" y="24" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="7" fontWeight="bold" className="uppercase">
                        {tooltip.point.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </text>
                </g>
            </g>
            )}

            <line x1={padding.left} y1={dimensions.height - padding.bottom} x2={dimensions.width - padding.right} y2={dimensions.height - padding.bottom} stroke="#cbd5e1" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
};

export default LineChart;