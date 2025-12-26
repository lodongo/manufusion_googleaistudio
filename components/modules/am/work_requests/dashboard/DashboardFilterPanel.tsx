
import React, { useState, useEffect } from 'react';
import { db } from '../../../../../services/firebase';
import type { HierarchyNode } from '../../../../org/HierarchyNodeModal';

interface DashboardFilterPanelProps {
    organisationDomain: string;
    currentUserL1Id?: string;
    currentUserL2Id?: string;
    dateRange: { start: Date; end: Date };
    setDateRange: (range: { start: Date; end: Date }) => void;
    selection: { l3: string; l4: string; l5: string };
    setSelection: (s: { l3: string; l4: string; l5: string }) => void;
    levelNames: { l3: string; l4: string; l5: string };
    setLevelNames: (n: { l3: string; l4: string; l5: string }) => void;
}

const DashboardFilterPanel: React.FC<DashboardFilterPanelProps> = ({
    organisationDomain,
    currentUserL1Id,
    currentUserL2Id,
    dateRange,
    setDateRange,
    selection,
    setSelection,
    levelNames,
    setLevelNames
}) => {
    const [l3Options, setL3Options] = useState<HierarchyNode[]>([]);
    const [l4Options, setL4Options] = useState<HierarchyNode[]>([]);
    const [l5Options, setL5Options] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState({ l3: false, l4: false, l5: false });

    // Helper to format date for input field (YYYY-MM-DD)
    const formatDateForInput = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const handleQuickFilter = (type: 'today' | 'week' | 'month' | 'year') => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        // Always set end to end of today
        end.setHours(23, 59, 59, 999);

        switch (type) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                // Start of current week (Sunday)
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                // Start of current month
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'year':
                // Start of current year
                start = new Date(now.getFullYear(), 0, 1);
                start.setHours(0, 0, 0, 0);
                break;
        }
        setDateRange({ start, end });
    };

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        const newDate = new Date(value);
        if (field === 'start') {
            newDate.setHours(0, 0, 0, 0);
            setDateRange({ ...dateRange, start: newDate });
        } else {
            newDate.setHours(23, 59, 59, 999);
            setDateRange({ ...dateRange, end: newDate });
        }
    };

    // Fetch Level 3 (Sites)
    useEffect(() => {
        if (!currentUserL1Id || !currentUserL2Id) return;
        
        const fetchL3 = async () => {
            setLoading(p => ({ ...p, l3: true }));
            try {
                const path = `organisations/${organisationDomain}/level_1/${currentUserL1Id}/level_2/${currentUserL2Id}/level_3`;
                const snap = await db.collection(path).orderBy('name').get();
                setL3Options(snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode)));
            } catch (error) {
                console.error("Error fetching sites:", error);
            } finally {
                setLoading(p => ({ ...p, l3: false }));
            }
        };
        fetchL3();
    }, [organisationDomain, currentUserL1Id, currentUserL2Id]);

    // Fetch Level 4 (Departments)
    useEffect(() => {
        if (!selection.l3) {
            setL4Options([]);
            setL5Options([]);
            return;
        }
        const node = l3Options.find(n => n.id === selection.l3);
        if (!node?.path) return;

        const fetchL4 = async () => {
            setLoading(p => ({ ...p, l4: true }));
            try {
                const snap = await db.collection(`${node.path}/level_4`).orderBy('name').get();
                setL4Options(snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode)));
            } catch (error) {
                console.error("Error fetching departments:", error);
            } finally {
                setLoading(p => ({ ...p, l4: false }));
            }
        };
        fetchL4();
    }, [selection.l3, l3Options]);

    // Fetch Level 5 (Sections)
    useEffect(() => {
        if (!selection.l4) {
            setL5Options([]);
            return;
        }
        const node = l4Options.find(n => n.id === selection.l4);
        if (!node?.path) return;

        const fetchL5 = async () => {
            setLoading(p => ({ ...p, l5: true }));
            try {
                const snap = await db.collection(`${node.path}/level_5`).orderBy('name').get();
                setL5Options(snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode)));
            } catch (error) {
                console.error("Error fetching sections:", error);
            } finally {
                setLoading(p => ({ ...p, l5: false }));
            }
        };
        fetchL5();
    }, [selection.l4, l4Options]);

    const handleL3Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const name = l3Options.find(n => n.id === id)?.name || '';
        setSelection({ l3: id, l4: '', l5: '' });
        setLevelNames({ l3: name, l4: '', l5: '' });
    };

    const handleL4Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const name = l4Options.find(n => n.id === id)?.name || '';
        setSelection({ ...selection, l4: id, l5: '' });
        setLevelNames({ ...levelNames, l4: name, l5: '' });
    };

    const handleL5Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const name = l5Options.find(n => n.id === id)?.name || '';
        setSelection({ ...selection, l5: id });
        setLevelNames({ ...levelNames, l5: name });
    };

    const QuickFilterButton: React.FC<{ label: string, onClick: () => void }> = ({ label, onClick }) => (
        <button
            onClick={onClick}
            className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider border-b pb-2">Filters</h3>
            
            {/* Time Filter */}
            <div className="mb-6 space-y-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Date Range</label>
                
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-1">From</label>
                        <input 
                            type="date" 
                            className="w-full p-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            value={formatDateForInput(dateRange.start)}
                            onChange={(e) => handleDateChange('start', e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-1">To</label>
                        <input 
                            type="date" 
                            className="w-full p-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            value={formatDateForInput(dateRange.end)}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    <QuickFilterButton label="Today" onClick={() => handleQuickFilter('today')} />
                    <QuickFilterButton label="This Week" onClick={() => handleQuickFilter('week')} />
                    <QuickFilterButton label="This Month" onClick={() => handleQuickFilter('month')} />
                    <QuickFilterButton label="This Year" onClick={() => handleQuickFilter('year')} />
                </div>
            </div>

            {/* Hierarchy Filters */}
            <div className="space-y-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase -mb-2">Location Context</label>
                
                <div>
                    <select 
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                        value={selection.l3}
                        onChange={handleL3Change}
                    >
                        <option value="">All Sites</option>
                        {l3Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>

                <div>
                    <select 
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 disabled:opacity-50"
                        value={selection.l4}
                        onChange={handleL4Change}
                        disabled={!selection.l3}
                    >
                        <option value="">All Departments</option>
                        {l4Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>

                <div>
                    <select 
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 disabled:opacity-50"
                        value={selection.l5}
                        onChange={handleL5Change}
                        disabled={!selection.l4}
                    >
                        <option value="">All Sections</option>
                        {l5Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Current Selection Display (Minimized List) */}
            <div className="mt-auto pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Active Context</h4>
                <ul className="space-y-2 text-sm">
                    {levelNames.l3 ? (
                        <li className="flex items-center text-slate-700">
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                            <span className="font-semibold mr-1">Site:</span> {levelNames.l3}
                        </li>
                    ) : <li className="text-slate-400 italic text-xs">Global View</li>}
                    
                    {levelNames.l4 && (
                        <li className="flex items-center text-slate-700 ml-3 border-l-2 border-slate-200 pl-2">
                            <span className="font-semibold mr-1">Dept:</span> {levelNames.l4}
                        </li>
                    )}
                    
                    {levelNames.l5 && (
                        <li className="flex items-center text-slate-700 ml-6 border-l-2 border-slate-200 pl-2">
                            <span className="font-semibold mr-1">Sec:</span> {levelNames.l5}
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default DashboardFilterPanel;
