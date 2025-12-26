
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkRequest, WorkOrder } from '../../../../types/am_types';
import WorkRequestDetailModal from './WorkRequestDetailModal';
import Input from '../../../Input';
import Button from '../../../Button';
import 'firebase/compat/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface WorkRequestListProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onEditRequest: (request: WorkRequest) => void;
  onViewWorkOrder?: (workOrder: WorkOrder) => void;
  viewMode: 'new' | 'converted'; // Controlled by parent
  onCreate?: () => void; // Trigger for create form
}

// Extends WorkRequest to include potential denormalized WO data for the list
interface ExtendedWorkRequest extends WorkRequest {
    workOrderDisplayId?: string;
    workOrderStatus?: string;
}

interface SavedView {
    id: string;
    name: string;
    columns: string[];
    sortKey: string;
    sortDirection: 'asc' | 'desc';
}

const ALL_COLUMNS = [
    { id: 'wrId', label: 'WR ID', minWidth: '100px', wrap: false },
    { id: 'title', label: 'Title', minWidth: '200px', wrap: true },
    { id: 'description', label: 'Description', minWidth: '250px', wrap: true },
    { id: 'asset', label: 'Asset', minWidth: '200px', wrap: true },
    { id: 'risk', label: 'Risk Impact', minWidth: '120px', wrap: false },
    { id: 'tagSource', label: 'Source', minWidth: '100px', wrap: true },
    { id: 'createdAt', label: 'Date', minWidth: '100px', wrap: false },
    { id: 'createdBy', label: 'Created By', minWidth: '120px', wrap: true },
    // Converted / Processed Fields
    { id: 'woId', label: 'Work Order', minWidth: '120px', wrap: false },
    { id: 'woStatus', label: 'WO Status', minWidth: '100px', wrap: false },
    { id: 'convertedAt', label: 'Processed Date', minWidth: '100px', wrap: false },
    { id: 'convertedBy', label: 'Processed By', minWidth: '120px', wrap: true },
    { id: 'cancellationReason', label: 'Reason', minWidth: '150px', wrap: true },
];

export const WorkRequestList: React.FC<WorkRequestListProps> = ({ currentUser, theme, organisation, onEditRequest, onViewWorkOrder, viewMode, onCreate }) => {
  const [requests, setRequests] = useState<ExtendedWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [detailModalRequest, setDetailModalRequest] = useState<WorkRequest | null>(null);
  const [riskColors, setRiskColors] = useState<Record<string, string>>({});

  // Enhanced Table States
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showColSelector, setShowColSelector] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [isSavingView, setIsSavingView] = useState(false);

  // New Filters State
  const [filterLevel3, setFilterLevel3] = useState('');
  const [filterLevel4, setFilterLevel4] = useState('');
  const [filterLevel5, setFilterLevel5] = useState('');
  const [dateFilter, setDateFilter] = useState<'all'|'today'|'yesterday'|'week'|'month'|'year'|'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [createdByMe, setCreatedByMe] = useState(false);

  // Initialize Columns based on mode
  useEffect(() => {
      if (viewMode === 'new') {
          setVisibleColumns(['wrId', 'title', 'asset', 'risk', 'createdAt', 'createdBy']);
      } else {
          setVisibleColumns(['wrId', 'title', 'asset', 'risk', 'createdAt', 'woId', 'woStatus']);
      }
  }, [viewMode]);

  // Load Saved Views
  useEffect(() => {
      const fetchViews = async () => {
          if (!currentUser.uid) return;
          try {
              const docRef = doc(db, `users/${currentUser.uid}/settings/am_work_request_views`);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                  setSavedViews(snap.data().views || []);
              }
          } catch (e) {
              console.error("Error loading views", e);
          }
      };
      fetchViews();
  }, [currentUser.uid]);

  // Fetch Risk Colors
  useEffect(() => {
      const unsubscribe = db.collection('modules/AM/Risks').onSnapshot(snapshot => {
          const colors: Record<string, string> = {};
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.color) {
                  colors[doc.id] = data.color; 
                  if (data.name) colors[data.name] = data.color;
              }
          });
          setRiskColors(colors);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const workRequestsRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests');
    const q = workRequestsRef.orderBy('createdAt', 'desc');
    
    const unsubscribe = q.onSnapshot(snapshot => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtendedWorkRequest)));
      setLoading(false);
    }, (err) => {
        console.error("Error fetching requests:", err);
        setLoading(false);
    });
    return unsubscribe;
  }, [organisation.domain]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Derive Facet Options
  const l3Options = useMemo(() => {
      const map = new Map<string, string>();
      requests.forEach(r => { if(r.allocationLevel3Id) map.set(r.allocationLevel3Id, r.allocationLevel3Name || r.allocationLevel3Id); });
      return Array.from(map.entries()).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name));
  }, [requests]);

  const l4Options = useMemo(() => {
      const map = new Map<string, string>();
      requests.filter(r => !filterLevel3 || r.allocationLevel3Id === filterLevel3).forEach(r => { if(r.allocationLevel4Id) map.set(r.allocationLevel4Id, r.allocationLevel4Name || r.allocationLevel4Id); });
      return Array.from(map.entries()).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name));
  }, [requests, filterLevel3]);

  const l5Options = useMemo(() => {
      const map = new Map<string, string>();
      requests.filter(r => (!filterLevel3 || r.allocationLevel3Id === filterLevel3) && (!filterLevel4 || r.allocationLevel4Id === filterLevel4)).forEach(r => { if(r.allocationLevel5Id) map.set(r.allocationLevel5Id, r.allocationLevel5Name || r.allocationLevel5Id); });
      return Array.from(map.entries()).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name));
  }, [requests, filterLevel3, filterLevel4]);

  const filteredAndSortedRequests = useMemo(() => {
    let data = requests.filter(req => {
        // Mode Filter
        if (viewMode === 'new') {
            if (!['CREATED', 'REJECTED'].includes(req.status)) return false;
        } else {
            if (!['CONVERTED', 'CLOSED', 'CANCELLED'].includes(req.status)) return false;
        }

        // Hierarchy Filters
        if (filterLevel3 && req.allocationLevel3Id !== filterLevel3) return false;
        if (filterLevel4 && req.allocationLevel4Id !== filterLevel4) return false;
        if (filterLevel5 && req.allocationLevel5Id !== filterLevel5) return false;

        // Created By Me Filter
        if (createdByMe && req.createdBy?.uid !== currentUser.uid) return false;

        // Date Filter
        if (dateFilter !== 'all') {
            const reqDate = req.createdAt?.toDate();
            if (!reqDate) return false;
            
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (dateFilter === 'custom') {
                if (customDateRange.start) {
                     const start = new Date(customDateRange.start);
                     if (reqDate < start) return false;
                }
                if (customDateRange.end) {
                     const end = new Date(customDateRange.end);
                     end.setHours(23, 59, 59, 999);
                     if (reqDate > end) return false;
                }
            } else if (dateFilter === 'today') {
                if (reqDate < todayStart) return false;
            } else if (dateFilter === 'yesterday') {
                const yestStart = new Date(todayStart);
                yestStart.setDate(yestStart.getDate() - 1);
                const yestEnd = new Date(todayStart);
                yestEnd.setMilliseconds(-1);
                if (reqDate < yestStart || reqDate > yestEnd) return false;
            } else if (dateFilter === 'week') {
                const weekStart = new Date(todayStart);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
                if (reqDate < weekStart) return false;
            } else if (dateFilter === 'month') {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                if (reqDate < monthStart) return false;
            } else if (dateFilter === 'year') {
                const yearStart = new Date(now.getFullYear(), 0, 1);
                if (reqDate < yearStart) return false;
            }
        }

        return true;
    });

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(r => 
            r.wrId.toLowerCase().includes(lower) || 
            r.title.toLowerCase().includes(lower) || 
            (r.allocationLevel6Name || '').toLowerCase().includes(lower) ||
            (r.workOrderDisplayId || '').toLowerCase().includes(lower)
        );
    }

    return data.sort((a, b) => {
        let aVal: any = '';
        let bVal: any = '';

        // Generalized sort for simple fields, custom for specific
        switch (sortConfig.key) {
            case 'asset': aVal = a.allocationLevel6Name || ''; bVal = b.allocationLevel6Name || ''; break;
            case 'risk': aVal = a.impactCategoryName || ''; bVal = b.impactCategoryName || ''; break;
            case 'createdAt': aVal = a.createdAt?.toMillis() || 0; bVal = b.createdAt?.toMillis() || 0; break;
            case 'convertedAt': aVal = a.convertedAt?.toMillis() || 0; bVal = b.convertedAt?.toMillis() || 0; break;
            case 'createdBy': aVal = a.createdBy?.name || ''; bVal = b.createdBy?.name || ''; break;
            case 'convertedBy': aVal = a.convertedBy?.name || ''; bVal = b.convertedBy?.name || ''; break;
            case 'woId': aVal = a.workOrderDisplayId || ''; bVal = b.workOrderDisplayId || ''; break;
            case 'woStatus': aVal = a.workOrderStatus || ''; bVal = b.workOrderStatus || ''; break;
            default: aVal = (a as any)[sortConfig.key] || ''; bVal = (b as any)[sortConfig.key] || '';
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [requests, viewMode, searchTerm, sortConfig, filterLevel3, filterLevel4, filterLevel5, dateFilter, customDateRange, createdByMe, currentUser.uid]);

  // Statistics
  const stats = useMemo(() => {
      const total = filteredAndSortedRequests.length;
      const safety = filteredAndSortedRequests.filter(r => r.impactCategoryName?.toLowerCase().includes('safety')).length;
      const critical = filteredAndSortedRequests.filter(r => r.impactCategoryName?.toLowerCase().includes('asset')).length;
      const highRisk = safety + critical;
      
      return { total, safety, critical, highRisk };
  }, [filteredAndSortedRequests]);

  const handleNavigateToWO = (e: React.MouseEvent, req: ExtendedWorkRequest) => {
    e.stopPropagation();
    if (req.workOrderId && onViewWorkOrder) {
        onViewWorkOrder({ id: req.workOrderId } as WorkOrder);
    }
  };

  const handleSaveView = async () => {
      if (!newViewName.trim()) return;
      setIsSavingView(true);
      try {
          const newView: SavedView = {
              id: Date.now().toString(),
              name: newViewName,
              columns: visibleColumns,
              sortKey: sortConfig.key,
              sortDirection: sortConfig.direction
          };
          const updatedViews = [...savedViews, newView];
          await setDoc(doc(db, `users/${currentUser.uid}/settings/am_work_request_views`), { views: updatedViews });
          setSavedViews(updatedViews);
          setNewViewName('');
          setShowViewMenu(false);
      } catch (e) {
          console.error("Failed to save view", e);
      } finally {
          setIsSavingView(false);
      }
  };

  const handleLoadView = (view: SavedView) => {
      setVisibleColumns(view.columns);
      setSortConfig({ key: view.sortKey, direction: view.sortDirection });
      setShowViewMenu(false);
  };
  
  const handleDeleteView = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedViews = savedViews.filter(v => v.id !== id);
      try {
        await setDoc(doc(db, `users/${currentUser.uid}/settings/am_work_request_views`), { views: updatedViews });
        setSavedViews(updatedViews);
      } catch(e) { console.error(e); }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <span className="ml-1 text-slate-300 opacity-50 text-[10px]">▼</span>;
    return <span className="ml-1 text-blue-600 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  if (loading) {
      return <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin" style={{borderColor: theme.colorPrimary}}></div></div>;
  }

  // --- Column Renderer Helper ---
  const renderCell = (colId: string, req: ExtendedWorkRequest) => {
      switch(colId) {
          case 'wrId': 
            return (
                <button onClick={(e) => { e.stopPropagation(); setDetailModalRequest(req); }} className="text-blue-600 hover:text-blue-800 hover:underline font-bold font-mono">
                    {req.wrId}
                </button>
            );
          case 'risk':
             const riskColor = riskColors[req.impactCategoryCode] || riskColors[req.impactCategoryName] || '#94a3b8';
             return (
                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border bg-white whitespace-nowrap" style={{ borderColor: riskColor, color: riskColor }}>
                     {req.impactCategoryName}
                 </span>
             );
          case 'createdAt': return req.createdAt?.toDate().toLocaleDateString();
          case 'convertedAt': return req.convertedAt?.toDate().toLocaleDateString() || '-';
          case 'createdBy': return <div className="text-xs">{req.createdBy?.name}</div>;
          case 'convertedBy': return <div className="text-xs">{req.convertedBy?.name}</div>;
          case 'woId': 
            return req.workOrderDisplayId ? (
                <button onClick={(e) => handleNavigateToWO(e, req)} className="font-mono font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded border border-blue-200 text-xs">
                    {req.workOrderDisplayId}
                </button>
            ) : <span className="text-slate-400">-</span>;
          case 'woStatus': 
            return req.workOrderStatus ? <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">{req.workOrderStatus}</span> : <span className="text-slate-400">-</span>;
          case 'asset':
             return (
                 <div className="flex flex-col">
                     <span>{req.allocationLevel6Name}</span>
                     {req.allocationLevel7Name && <span className="text-xs text-slate-500">Assembly: {req.allocationLevel7Name}</span>}
                 </div>
             );
          default: return (req as any)[colId];
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                {viewMode === 'new' ? 'Open Requests' : 'Processed Requests'}
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{stats.total}</span>
            </h3>
            
            <div className="flex gap-2 w-full md:w-auto">
                <Input 
                    id="searchRequests"
                    label=""
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    containerClassName="mb-0 flex-grow md:w-64"
                />
                
                {/* View Menu */}
                <div className="relative">
                    <Button variant="secondary" onClick={() => setShowViewMenu(!showViewMenu)} className="!px-3" title="Saved Views">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </Button>
                    {showViewMenu && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">Saved Views</h4>
                            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                                {savedViews.map(view => (
                                    <div key={view.id} onClick={() => handleLoadView(view)} className="flex justify-between items-center px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded text-sm">
                                        <span>{view.name}</span>
                                        <button onClick={(e) => handleDeleteView(view.id, e)} className="text-red-400 hover:text-red-600">&times;</button>
                                    </div>
                                ))}
                                {savedViews.length === 0 && <p className="text-xs text-slate-400 px-2 italic">No saved views.</p>}
                            </div>
                            <div className="border-t pt-2 flex gap-1">
                                <input className="flex-1 text-xs border rounded p-1" placeholder="New View Name" value={newViewName} onChange={e => setNewViewName(e.target.value)} />
                                <button onClick={handleSaveView} disabled={isSavingView || !newViewName} className="bg-blue-600 text-white text-xs px-2 rounded disabled:opacity-50">Save</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Column Selector */}
                <div className="relative">
                    <Button variant="secondary" onClick={() => setShowColSelector(!showColSelector)} className="!px-3" title="Columns">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                    </Button>
                    {showColSelector && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-2 grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                            {ALL_COLUMNS.map(col => (
                                <label key={col.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleColumns.includes(col.id)} 
                                        onChange={() => setVisibleColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])}
                                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                    <span className="text-sm text-slate-700">{col.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {viewMode === 'new' && onCreate && (
                    <Button onClick={onCreate} className="!w-auto flex items-center gap-2 whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Create
                    </Button>
                )}
            </div>
        </div>

        {/* Statistics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 flex-shrink-0">
             <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Total</p>
                 <p className="text-xl font-bold text-slate-800">{stats.total}</p>
             </div>
             <div className="bg-red-50 p-3 rounded border border-red-100 shadow-sm">
                 <p className="text-[10px] uppercase font-bold text-red-400">Safety Critical</p>
                 <p className="text-xl font-bold text-red-700">{stats.safety}</p>
             </div>
             <div className="bg-orange-50 p-3 rounded border border-orange-100 shadow-sm">
                 <p className="text-[10px] uppercase font-bold text-orange-400">Asset Critical</p>
                 <p className="text-xl font-bold text-orange-700">{stats.critical}</p>
             </div>
             <div className="bg-blue-50 p-3 rounded border border-blue-100 shadow-sm">
                 <p className="text-[10px] uppercase font-bold text-blue-400">High Priority</p>
                 <p className="text-xl font-bold text-blue-700">{stats.highRisk}</p>
             </div>
        </div>

        {/* Main Content Area: Table + Filter Panel */}
        <div className="flex-1 flex overflow-hidden border rounded-lg bg-white shadow-sm border-slate-200">
            {/* Scrollable Table Container */}
            <div className="flex-1 overflow-auto relative">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            {visibleColumns.map(colId => {
                                const colDef = ALL_COLUMNS.find(c => c.id === colId);
                                return (
                                    <th 
                                        key={colId} 
                                        onClick={() => handleSort(colId)} 
                                        className="px-6 py-3 text-left font-bold text-slate-600 uppercase cursor-pointer select-none hover:bg-slate-100 transition-colors whitespace-nowrap"
                                        style={{ minWidth: colDef?.minWidth }}
                                    >
                                        <div className="flex items-center gap-1">
                                            {colDef?.label} 
                                            <SortIcon columnKey={colId}/>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredAndSortedRequests.map(req => {
                            const riskColor = riskColors[req.impactCategoryCode] || riskColors[req.impactCategoryName] || '#94a3b8';
                            const rowStyle = {
                                boxShadow: `inset 4px 0 0 0 ${riskColor}`,
                                backgroundColor: riskColor !== '#94a3b8' ? `${riskColor}08` : 'transparent'
                            };

                            return (
                                <tr 
                                    key={req.id} 
                                    className="transition-colors cursor-pointer hover:bg-slate-50"
                                    style={rowStyle}
                                    onClick={() => setDetailModalRequest(req)}
                                >
                                    {visibleColumns.map(colId => {
                                        const colDef = ALL_COLUMNS.find(c => c.id === colId);
                                        return (
                                        <td key={colId} className={`px-6 py-4 text-slate-700 ${colDef?.wrap ? '' : 'whitespace-nowrap'}`}>
                                            {renderCell(colId, req)}
                                        </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredAndSortedRequests.length === 0 && (
                    <div className="p-12 text-center text-slate-500 absolute inset-0 flex items-center justify-center pointer-events-none">
                        No {viewMode === 'new' ? 'open' : 'processed'} requests found.
                    </div>
                )}
            </div>

            {/* Right Side Filter Panel */}
            <div className="w-64 flex-none border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto">
                <h4 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-wider">Filters</h4>
                
                {/* Date Filter */}
                <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Date Range</label>
                    <select 
                        value={dateFilter} 
                        onChange={(e) => setDateFilter(e.target.value as any)} 
                        className="w-full text-sm border-slate-300 rounded-md p-1.5 mb-2 bg-white"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    
                    {dateFilter === 'custom' && (
                        <div className="space-y-2">
                            <input type="date" value={customDateRange.start} onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} className="w-full text-xs border-slate-300 rounded p-1" placeholder="Start Date" />
                            <input type="date" value={customDateRange.end} onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} className="w-full text-xs border-slate-300 rounded p-1" placeholder="End Date" />
                        </div>
                    )}
                </div>

                {/* People Filter */}
                <div className="mb-6">
                     <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={createdByMe} onChange={e => setCreatedByMe(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-slate-700">Created By Me</span>
                    </label>
                </div>

                {/* Location Filter */}
                <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Location</label>
                    
                    <div>
                        <select value={filterLevel3} onChange={e => { setFilterLevel3(e.target.value); setFilterLevel4(''); setFilterLevel5(''); }} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white">
                            <option value="">All Sites</option>
                            {l3Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <select value={filterLevel4} onChange={e => { setFilterLevel4(e.target.value); setFilterLevel5(''); }} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white" disabled={!filterLevel3}>
                            <option value="">All Departments</option>
                            {l4Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <select value={filterLevel5} onChange={e => setFilterLevel5(e.target.value)} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white" disabled={!filterLevel4}>
                            <option value="">All Sections</option>
                            {l5Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200">
                    <button 
                        onClick={() => {
                            setFilterLevel3(''); setFilterLevel4(''); setFilterLevel5('');
                            setDateFilter('all'); setCustomDateRange({start:'', end:''});
                            setCreatedByMe(false);
                            setSearchTerm('');
                        }}
                        className="w-full text-xs text-slate-500 hover:text-red-600 underline"
                    >
                        Reset All Filters
                    </button>
                </div>
            </div>
        </div>

        {detailModalRequest && (
            <WorkRequestDetailModal
                request={detailModalRequest}
                isOpen={!!detailModalRequest}
                onClose={() => setDetailModalRequest(null)}
                onEdit={onEditRequest}
                currentUser={currentUser}
                organisation={organisation}
                theme={theme}
                onViewWorkOrder={onViewWorkOrder}
            />
        )}
    </div>
  );
};
