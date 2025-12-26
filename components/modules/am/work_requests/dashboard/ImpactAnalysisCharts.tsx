
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../../services/firebase';
import type { Organisation } from '../../../../../types';
import type { WorkRequest } from '../../../../../types/am_types';

interface ImpactAnalysisChartsProps {
    requests: WorkRequest[];
    theme: Organisation['theme'];
}

const ImpactAnalysisCharts: React.FC<ImpactAnalysisChartsProps> = ({ requests, theme }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [riskColors, setRiskColors] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsubscribe = db.collection('modules/AM/Risks').onSnapshot(snapshot => {
            const colors: Record<string, string> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    colors[data.name] = data.color || theme.colorPrimary;
                }
            });
            setRiskColors(colors);
        }, err => console.error("Error fetching risk colors:", err));
        return () => unsubscribe();
    }, [theme.colorPrimary]);

    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        requests.forEach(r => {
            const cat = r.impactCategoryName || 'Unclassified';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Descending sort
    }, [requests]);

    const subCategoryData = useMemo(() => {
        if (!selectedCategory) return [];
        const counts: Record<string, number> = {};
        requests
            .filter(r => (r.impactCategoryName || 'Unclassified') === selectedCategory)
            .forEach(r => {
                const sub = r.impactSubcategoryName || 'General';
                counts[sub] = (counts[sub] || 0) + 1;
            });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [requests, selectedCategory]);

    const maxValue = Math.max(...categoryData.map(d => d.value), 1);

    return (
        <div className="relative bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Impact Analysis (All Raised Requests)</h3>

            <div className="flex-1 flex items-end space-x-6 px-4 min-h-[250px] pb-4">
                {categoryData.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        No data available for current selection.
                    </div>
                )}
                {categoryData.map((item) => {
                    const isSelected = selectedCategory === item.name;
                    // Smart Scaling: Ensure small bars are visible (min 5%), but scale rest relatively
                    const percentageHeight = Math.max((item.value / maxValue) * 100, 5); 
                    const barColor = riskColors[item.name] || theme.colorPrimary;

                    return (
                        <div 
                            key={item.name} 
                            className="flex-1 flex flex-col items-center group cursor-pointer h-full justify-end"
                            onClick={() => setSelectedCategory(isSelected ? null : item.name)}
                        >
                            {/* Bar Container */}
                            <div className="w-full flex flex-col justify-end items-center relative" style={{ height: '100%' }}>
                                {/* Value Label on top */}
                                <span className={`text-xs font-bold mb-1 transition-opacity ${isSelected ? 'opacity-100' : 'text-slate-500 opacity-70 group-hover:opacity-100'}`} style={isSelected ? { color: barColor } : {}}>
                                    {item.value}
                                </span>
                                
                                <div 
                                    className={`w-full max-w-[60px] rounded-t-md transition-all duration-300 ease-out ${isSelected ? 'opacity-100 ring-2 ring-offset-2 shadow-lg' : 'opacity-70 group-hover:opacity-90'}`}
                                    style={{ 
                                        height: `${percentageHeight}%`, 
                                        backgroundColor: barColor,
                                        // Dynamic ring color for selected state
                                        ['--tw-ring-color' as any]: barColor
                                    }}
                                ></div>
                            </div>
                            
                            {/* Category Label */}
                            <span className={`text-[10px] font-medium mt-3 text-center uppercase tracking-wide transition-colors line-clamp-2 h-8 leading-tight ${isSelected ? 'font-bold' : 'text-slate-500'}`} style={isSelected ? { color: barColor } : {}}>
                                {item.name}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Popup / Overlay for Subcategories */}
            {selectedCategory && (
                <div className="absolute top-16 right-6 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-5 z-10 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Drill-down</p>
                            <h4 className="font-bold text-slate-800">{selectedCategory}</h4>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedCategory(null); }}
                            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {subCategoryData.map((sub, idx) => {
                            const subMax = Math.max(...subCategoryData.map(d => d.value), 1);
                            const subPercent = (sub.value / subMax) * 100;
                            const parentColor = riskColors[selectedCategory] || theme.colorPrimary;
                            
                            return (
                                <div key={idx} className="flex flex-col gap-1 group">
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span className="font-medium truncate pr-2" title={sub.name}>{sub.name}</span>
                                        <span className="font-bold">{sub.value}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${subPercent}%`, backgroundColor: parentColor, opacity: 0.8 }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImpactAnalysisCharts;
