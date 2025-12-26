
import React from 'react';

interface DialGaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  size?: number;
}

const DialGauge: React.FC<DialGaugeProps> = ({ value, min, max, label, unit, color = "#4f46e5", size = 200 }) => {
  const radius = 80;
  const circumference = Math.PI * radius;
  const normalizedValue = Math.min(Math.max(value, min), max);
  const percentage = (normalizedValue - min) / (max - min);
  const strokeDashoffset = circumference - (percentage * circumference);
  const rotation = (percentage * 180) - 90;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="relative" style={{ width: size, height: size / 1.5 }}>
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background Path */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Value Path */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          {/* Center Text */}
          <text x="100" y="90" textAnchor="middle" className="text-2xl font-black fill-slate-800">
            {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </text>
          <text x="100" y="110" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 uppercase tracking-widest">
            {unit}
          </text>
          {/* Min/Max Labels */}
          <text x="15" y="115" textAnchor="middle" className="text-[8px] font-bold fill-slate-300">
            {min}
          </text>
          <text x="185" y="115" textAnchor="middle" className="text-[8px] font-bold fill-slate-300">
            {max}
          </text>
        </svg>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
};

export default DialGauge;
