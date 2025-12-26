
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder } from '../../../../types/am_types';
import Input from '../../../Input';
import Button from '../../../Button';
import 'firebase/compat/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface WorkOrderListProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
  viewMode: 'open' | 'closed';
}

interface SavedView {
    id: string;
    name: string;
    columns: string[];
    sortKey: string;
    sortDirection: 'asc' | 'desc';
}

const ALL_COLUMNS = [
    { id: 'woId', label: 'WO ID', minWidth: '100px' },
    { id: 'wrId', label: 'Req Ref', minWidth: '100px' },
    { id: 'title', label: 'Title', minWidth: '200px' },
    { id: 'asset', label: 'Asset', minWidth: '150px' },
    { id: 'location', label: 'Location', minWidth: '200px' },
    { id: 'status', label: 'Status', minWidth: '100px' },
    { id: 'type', label: 'Type', minWidth: '100px' },
    { id: 'priority', label: 'Priority', minWidth: '100px' }, // Derived from impact
    { id: 'assignedTo', label: 'Assigned To', minWidth: '150px' },
    { id: 'createdAt', label: 'Created', minWidth: '120px' },
    { id: 'scheduledStart', label: 'Scheduled', minWidth: '120px' },
];

const WorkOrderList: React.FC<WorkOrderListProps> = ({ currentUser, theme, organisation, onSelectWorkOrder, viewMode }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  
  // Advanced Table Features
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['woId', 'title', 'asset', 'status', 'assignedTo', 'createdAt']);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showColSelector, setShowColSelector] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  
  // Filters
  const [filterLevel3, setFilterLevel3] = useState('');
  const [filterLevel4, setFilterLevel4] = useState('');
  const [filterLevel5, setFilterLevel5] = useState('');
  const [dateFilter, setDateFilter] = useState<'all'|'today'|'week'|'month'|'year'|'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Load Saved Views
  useEffect(() => {
      const fetchViews = async () => {
          if (!currentUser.uid) return;
          try {
              const docRef = doc(db, `users/${currentUser.uid}/settings/am_work_order_views`);
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

  // Fetch Data
  useEffect(() => {
    const workOrdersRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workOrders');
    // We fetch all and filter client side for flexibility with the requested date ranges/status combos without complex compound indexes
    const q = workOrdersRef.orderBy('createdAt', 'desc');
    
    const unsubscribe = q.onSnapshot(snapshot => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
      setWorkOrders(allOrders);
      setLoading(false);
    }, (err) => {
        console.error("Error fetching work orders:", err);
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

  const handleSaveView = async () => {
      if (!newViewName.trim()) return;
      try {
          const newView: SavedView = {
              id: Date.now().toString(),
              name: newViewName,
              columns: visibleColumns,
              sortKey: sortConfig.key,
              sortDirection: sortConfig.direction
          };
          const updatedViews = [...savedViews, newView];
          await setDoc(doc(db, `users/${currentUser.uid}/settings/am_work_order_views`), { views: updatedViews });
          setSavedViews(updatedViews);
          setNewViewName('');
          setShowViewMenu(false);
      } catch (e) { console.error(e); }
  };
  
  const handleLoadView = (view: SavedView) => {
      setVisibleColumns(view.columns);
      setSortConfig({ key: view.sortKey, direction: view.sortDirection });
      setShowViewMenu(false);
  };
  
  const handleDeleteView = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedViews = savedViews.filter(v => v.id !== id);
      await setDoc(doc(db, `users/${currentUser.uid}/settings/am_work_order_views`), { views: updatedViews });
      setSavedViews(updatedViews);
  };

  // --- Filtering & Sorting ---
  const filteredOrders = useMemo(() => {
      let data = workOrders.filter(wo => {
          // 1. Status Filter (Open vs Closed Tab)
          const isClosed = wo.status === 'CLOSED';
          if (viewMode === 'open' && isClosed) return false;
          if (viewMode === 'closed' && !isClosed) return false;

          // 2. Hierarchy Filters
          if (filterLevel3 && wo.allocationLevel3Id !== filterLevel3) return false;
          if (filterLevel4 && wo.allocationLevel4Id !== filterLevel4) return false;
          if (filterLevel5 && wo.allocationLevel5Id !== filterLevel5) return false;
          
          // 3. Date Filter
          if (dateFilter !== 'all') {
             const d = wo.createdAt?.toDate();
             if (!d) return false;
             const now = new Date();
             const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
             
             if (dateFilter === 'custom') {
                 if (customDateRange.start && d < new Date(customDateRange.start)) return false;
                 if (customDateRange.end) {
                     const end = new Date(customDateRange.end);
                     end.setHours(23,59,59,999);
                     if (d > end) return false;
                 }
             } else if (dateFilter === 'today') {
                 if (d < today) return false;
             } else if (dateFilter === 'week') {
                 const weekStart = new Date(today);
                 weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                 if (d < weekStart) return false;
             } else if (dateFilter === 'month') {
                 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                 if (d < monthStart) return false;
             } else if (dateFilter === 'year') {
                 const yearStart = new Date(now.getFullYear(), 0, 1);
                 if (d < yearStart) return false;
             }
          }
          
          // 4. Text Search
          if (searchTerm) {
              const lower = searchTerm.toLowerCase();
              return (
                  wo.woId.toLowerCase().includes(lower) ||
                  wo.title.toLowerCase().includes(lower) ||
                  (wo.allocationLevel6Name || '').toLowerCase().includes(lower) ||
                  (wo.assignedTo?.name || '').toLowerCase().includes(lower)
              );
          }

          return true;
      });

      // Sorting
      return data.sort((a, b) => {
          let aVal: any = '';
          let bVal: any = '';

          switch (sortConfig.key) {
              case 'woId': aVal = a.woId; bVal = b.woId; break;
              case 'title': aVal = a.title; bVal = b.title; break;
              case 'asset': aVal = a.allocationLevel6Name || ''; bVal = b.allocationLevel6Name || ''; break;
              case 'status': aVal = a.status; bVal = b.status; break;
              case 'createdAt': aVal = a.createdAt?.toMillis() || 0; bVal = b.createdAt?.toMillis() || 0; break;
              case 'assignedTo': aVal = a.assignedTo?.name || ''; bVal = b.assignedTo?.name || ''; break;
              case 'priority': aVal = a.impactCategoryName || ''; bVal = b.impactCategoryName || ''; break;
              default: aVal = (a as any)[sortConfig.key] || ''; bVal = (b as any)[sortConfig.key] || '';
          }

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

  }, [workOrders, viewMode, filterLevel3, filterLevel4, filterLevel5, dateFilter, customDateRange, searchTerm, sortConfig]);

  // Options for filters (dynamic based on current data for simplicity)
  const locationOptions = useMemo(() => {
      const l3 = new Map(), l4 = new Map(), l5 = new Map();
      workOrders.forEach(w => {
          if(w.allocationLevel3Id) l3.set(w.allocationLevel3Id, w.allocationLevel3Name);
          if(w.allocationLevel4Id && (!filterLevel3 || w.allocationLevel3Id === filterLevel3)) l4.set(w.allocationLevel4Id, w.allocationLevel4Name);
          if(w.allocationLevel5Id && (!filterLevel4 || w.allocationLevel4Id === filterLevel4)) l5.set(w.allocationLevel5Id, w.allocationLevel5Name);
      });
      return {
          l3: Array.from(l3).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name)),
          l4: Array.from(l4).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name)),
          l5: Array.from(l5).map(([id, name]) => ({id, name})).sort((a,b) => a.name.localeCompare(b.name)),
      };
  }, [workOrders, filterLevel3, filterLevel4]);


  const getStatusChip = (status: WorkOrder['status']) => {
    switch (status) {
        case 'OPEN': return 'bg-blue-100 text-blue-800';
        case 'SCHEDULED': return 'bg-cyan-100 text-cyan-800';
        case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
        case 'COMPLETED': return 'bg-purple-100 text-purple-800';
        case 'CLOSED': return 'bg-green-100 text-green-800';
        case 'CANCELLED': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderCell = (colId: string, wo: WorkOrder) => {
      switch(colId) {
          case 'woId': return <button onClick={() => onSelectWorkOrder(wo)} className="font-mono font-bold text-blue-600 hover:underline">{wo.woId}</button>;
          case 'wrId': return <span className="font-mono text-slate-500">{wo.wrId}</span>;
          case 'title': return <div className="truncate font-medium text-slate-800" title={wo.title}>{wo.title}</div>;
          case 'asset': return <div className="truncate text-slate-600">{wo.allocationLevel6Name}</div>;
          case 'location': return <div className="truncate text-xs text-slate-500" title={`${wo.allocationLevel3Name} > ${wo.allocationLevel4Name}`}>{wo.allocationLevel3Name} / {wo.allocationLevel4Name}</div>;
          case 'status': return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusChip(wo.status)}`}>{wo.status}</span>;
          case 'priority': return <span className="text-xs">{wo.impactCategoryName}</span>;
          case 'type': return <span className="text-xs">{wo.maintenanceType || 'N/A'}</span>;
          case 'assignedTo': return <div className="text-xs">{wo.assignedTo?.name || '-'}</div>;
          case 'createdAt': return <div className="text-xs">{wo.createdAt?.toDate().toLocaleDateString()}</div>;
          case 'scheduledStart': return <div className="text-xs text-slate-500">{wo.scheduledStartDate || '-'}</div>;
          default: return null;
      }
  };

  if (loading) return <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin" style={{borderColor: theme.colorPrimary}}></div></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 flex-shrink-0">
             <div className="flex gap-2 w-full md:w-auto">
                 <Input 
                    id="searchWO" 
                    label="" 
                    placeholder="Search orders..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    containerClassName="mb-0 flex-grow md:w-64" 
                />
                
                <div className="relative">
                    <Button variant="secondary" onClick={() => setShowViewMenu(!showViewMenu)} className="!px-3 h-10" title="Views">
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
                            </div>
                            <div className="border-t pt-2 flex gap-1">
                                <input className="flex-1 text-xs border rounded p-1" placeholder="View Name" value={newViewName} onChange={e => setNewViewName(e.target.value)} />
                                <button onClick={handleSaveView} className="bg-blue-600 text-white text-xs px-2 rounded">Save</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <Button variant="secondary" onClick={() => setShowColSelector(!showColSelector)} className="!px-3 h-10" title="Columns">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2 2h-2a2 2 0 00-2 2" /></svg>
                    </Button>
                    {showColSelector && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-2 grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                             {ALL_COLUMNS.map(col => (
                                <label key={col.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                    <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => setVisibleColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])} className="rounded text-blue-600" />
                                    <span className="text-sm text-slate-700">{col.label}</span>
                                </label>
                             ))}
                        </div>
                    )}
                </div>
             </div>
             
             {/* Date Filters */}
             <div className="flex gap-2 items-center flex-wrap">
                 <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="p-2 border rounded-md text-sm bg-white h-10">
                     <option value="all">All Time</option>
                     <option value="today">Today</option>
                     <option value="week">This Week</option>
                     <option value="month">This Month</option>
                     <option value="year">This Year</option>
                     <option value="custom">Custom</option>
                 </select>
                 {dateFilter === 'custom' && (
                     <>
                        <input type="date" value={customDateRange.start} onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} className="p-2 border rounded text-sm h-10"/>
                        <input type="date" value={customDateRange.end} onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} className="p-2 border rounded text-sm h-10"/>
                     </>
                 )}
             </div>
        </div>

        <div className="flex-1 flex overflow-hidden border rounded-lg bg-white shadow-sm border-slate-200">
            {/* Table */}
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
                                        className="px-6 py-3 text-left font-bold text-slate-600 uppercase cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap"
                                        style={{ minWidth: colDef?.minWidth }}
                                    >
                                        <div className="flex items-center gap-1">
                                            {colDef?.label}
                                            {sortConfig.key === colId && <span className="text-blue-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredOrders.map(wo => (
                            <tr key={wo.id} className="hover:bg-slate-50 transition-colors">
                                {visibleColumns.map(colId => (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">{renderCell(colId, wo)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredOrders.length === 0 && <div className="p-12 text-center text-slate-500 absolute inset-0 flex items-center justify-center pointer-events-none">No {viewMode} orders found matching filters.</div>}
            </div>

            {/* Right Filter Sidebar */}
            <div className="w-64 flex-none border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto">
                 <h4 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-wider">Location Filters</h4>
                 <div className="space-y-3">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Site</label>
                        <select value={filterLevel3} onChange={e => { setFilterLevel3(e.target.value); setFilterLevel4(''); setFilterLevel5(''); }} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white">
                            <option value="">All Sites</option>
                            {locationOptions.l3.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Department</label>
                        <select value={filterLevel4} onChange={e => { setFilterLevel4(e.target.value); setFilterLevel5(''); }} disabled={!filterLevel3} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white disabled:opacity-50">
                            <option value="">All Depts</option>
                            {locationOptions.l4.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Section</label>
                        <select value={filterLevel5} onChange={e => setFilterLevel5(e.target.value)} disabled={!filterLevel4} className="w-full text-sm border-slate-300 rounded-md p-1.5 bg-white disabled:opacity-50">
                            <option value="">All Sections</option>
                            {locationOptions.l5.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                     </div>
                 </div>
                 
                 <div className="mt-8 pt-4 border-t border-slate-200">
                    <button 
                        onClick={() => { setFilterLevel3(''); setFilterLevel4(''); setFilterLevel5(''); setDateFilter('all'); setSearchTerm(''); }}
                        className="w-full text-xs text-slate-500 hover:text-red-600 underline"
                    >
                        Reset All Filters
                    </button>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default WorkOrderList;
