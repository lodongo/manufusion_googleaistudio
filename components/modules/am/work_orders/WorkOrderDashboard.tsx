
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkOrder } from '../../../../types/am_types';
import DashboardFilterPanel from '../work_requests/dashboard/DashboardFilterPanel';
import Modal from '../../../common/Modal'; // Assuming Modal is available here

const { Timestamp } = firebase.firestore;

interface WorkOrderDashboardProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const StatCard: React.FC<{ label: string, value: string | number, subtext?: string, colorClass?: string }> = ({ label, value, subtext, colorClass = "text-slate-800" }) => (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center items-center h-full">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</span>
        <span className={`text-4xl font-extrabold ${colorClass}`}>{value}</span>
        {subtext && <span className="text-xs text-slate-500 mt-1">{subtext}</span>}
    </div>
);

const BarChart: React.FC<{ 
    title: string; 
    data: { label: string; value: number; color?: string }[];
    onBarClick?: (label: string) => void;
    activeLabel?: string | null;
    subtitle?: string;
}> = ({ title, data, onBarClick, activeLabel, subtitle }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 uppercase">{title}</h4>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className="flex-1 flex items-end space-x-4 justify-center min-h-[200px] overflow-x-auto pb-2 px-2">
                {data.length === 0 && <span className="text-slate-400 text-sm italic self-center">No data available</span>}
                {data.map((d, i) => {
                    const isActive = activeLabel ? activeLabel === d.label : false;
                    const isFaded = activeLabel ? !isActive : false;
                    
                    return (
                        <div 
                            key={i} 
                            className={`flex flex-col items-center flex-1 group relative h-full justify-end cursor-pointer transition-all duration-300 ${isFaded ? 'opacity-40 grayscale' : 'opacity-100'}`}
                            onClick={() => onBarClick && onBarClick(d.label)}
                        >
                            <div className="w-full max-w-[40px] min-w-[20px] bg-slate-100 rounded-t-md relative flex items-end overflow-hidden transition-all hover:bg-slate-200" style={{ height: '100%' }}>
                                <div 
                                    className={`w-full rounded-t-md transition-all duration-500 ${d.color || 'bg-blue-500'}`} 
                                    style={{ height: `${(d.value / max) * 100}%` }}
                                ></div>
                                <span className="absolute top-0 left-0 w-full text-center text-[10px] font-bold text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-2 text-center leading-tight truncate w-full" title={d.label}>{d.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const WorkOrderDashboard: React.FC<WorkOrderDashboardProps> = ({ currentUser, theme, organisation }) => {
    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1); // Start of year
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    });

    const [hierarchySelection, setHierarchySelection] = useState({ l3: '', l4: '', l5: '' });
    const [levelNames, setLevelNames] = useState({ l3: '', l4: '', l5: '' });

    // Interactive Chart State
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [drillDown, setDrillDown] = useState<{
        active: boolean;
        level: 'L4' | 'L5';
        contextName: string; // The name of the clicked bar (Site Name or Dept Name)
        parentContextName?: string; // Only for L5 (Site Name)
    }>({ active: false, level: 'L4', contextName: '' });

    useEffect(() => {
        setLoading(true);
        const woRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workOrders');
        
        // Query by Date Range
        let q = woRef
            .where('createdAt', '>=', Timestamp.fromDate(dateRange.start))
            .where('createdAt', '<=', Timestamp.fromDate(dateRange.end));

        const unsubscribe = q.onSnapshot(snapshot => {
            const rawOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
            
            // Client-side Hierarchy Filtering (Sidebar filters)
            const filtered = rawOrders.filter(wo => {
                if (hierarchySelection.l5 && wo.allocationLevel5Id !== hierarchySelection.l5) return false;
                if (hierarchySelection.l4 && wo.allocationLevel4Id !== hierarchySelection.l4) return false;
                if (hierarchySelection.l3 && wo.allocationLevel3Id !== hierarchySelection.l3) return false;
                return true;
            });

            setOrders(filtered);
            setLoading(false);
        }, (err) => {
            console.error("Dashboard Error:", err);
            setLoading(false);
        });

        return unsubscribe;
    }, [organisation.domain, dateRange, hierarchySelection]);

    const analytics = useMemo(() => {
        // 1. Base Stats (unaffected by chart clicks, only by sidebar/date filters)
        const active = orders.filter(o => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status));
        const closed = orders.filter(o => o.status === 'CLOSED');
        
        // MTTC Calculation
        let totalClosureDays = 0;
        let closedCount = 0;
        closed.forEach(o => {
            if (o.actualCompletionDate && o.createdAt) {
                const diffTime = Math.abs(o.actualCompletionDate.toDate().getTime() - o.createdAt.toDate().getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                totalClosureDays += diffDays;
                closedCount++;
            }
        });
        const mttc = closedCount > 0 ? (totalClosureDays / closedCount).toFixed(1) : '0';

        // Helper to group data
        const groupCount = (list: WorkOrder[], key: keyof WorkOrder) => {
            const counts: Record<string, number> = {};
            list.forEach(o => {
                const val = (o[key] as string) || 'Unknown';
                counts[val] = (counts[val] || 0) + 1;
            });
            return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);
        };

        // 2. Status Chart Data (Distribution of ALL filtered orders)
        const byStatus = groupCount(orders.filter(o => o.status !== 'CLOSED'), 'status').map(d => ({ ...d, color: 'bg-blue-500' }));

        // 3. Hierarchy Data (Filtered by Selected Status if any)
        const statusFilteredOrders = selectedStatus ? orders.filter(o => o.status === selectedStatus) : orders;

        // Level 3 Data (Base Chart)
        const byL3 = groupCount(statusFilteredOrders, 'allocationLevel3Name').map(d => ({ ...d, color: 'bg-indigo-500' }));

        // Drill-down Data Calculation
        let drillDownData: { label: string; value: number; color?: string }[] = [];
        
        if (drillDown.active) {
            let contextOrders = statusFilteredOrders;
            
            if (drillDown.level === 'L4') {
                // Filter by Site Name (contextName)
                contextOrders = contextOrders.filter(o => o.allocationLevel3Name === drillDown.contextName);
                drillDownData = groupCount(contextOrders, 'allocationLevel4Name').map(d => ({ ...d, color: 'bg-violet-500' }));
            } else if (drillDown.level === 'L5') {
                 // Filter by Site Name (grandParent) AND Dept Name (contextName)
                contextOrders = contextOrders.filter(o => 
                    o.allocationLevel3Name === drillDown.parentContextName && 
                    o.allocationLevel4Name === drillDown.contextName
                );
                drillDownData = groupCount(contextOrders, 'allocationLevel5Name').map(d => ({ ...d, color: 'bg-purple-500' }));
            }
        }

        return {
            total: orders.length,
            activeCount: active.length,
            closedCount: closed.length,
            mttc,
            byStatus,
            byL3,
            drillDownData
        };
    }, [orders, selectedStatus, drillDown]);

    const handleStatusClick = (status: string) => {
        if (selectedStatus === status) {
            setSelectedStatus(null);
        } else {
            setSelectedStatus(status);
        }
        // Reset drilldown when filter changes to avoid empty/confusing states
        setDrillDown({ active: false, level: 'L4', contextName: '' });
    };

    const handleL3Click = (siteName: string) => {
        setDrillDown({
            active: true,
            level: 'L4',
            contextName: siteName
        });
    };

    const handleL4Click = (deptName: string) => {
        // When clicking a department in the L4 modal, drill down to L5
        setDrillDown({
            active: true,
            level: 'L5',
            contextName: deptName,
            parentContextName: drillDown.contextName // The Site Name becomes the parent context
        });
    };

    const closeDrillDown = () => {
        setDrillDown({ active: false, level: 'L4', contextName: '' });
    };
    
    const goBackDrillDown = () => {
        if (drillDown.level === 'L5') {
            setDrillDown({
                active: true,
                level: 'L4',
                contextName: drillDown.parentContextName || ''
            });
        } else {
            closeDrillDown();
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
             {/* Left: Filter Panel */}
             <div className="w-full lg:w-72 flex-shrink-0">
                <DashboardFilterPanel 
                    organisationDomain={organisation.domain}
                    currentUserL1Id={currentUser.allocationLevel1Id}
                    currentUserL2Id={currentUser.allocationLevel2Id}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    selection={hierarchySelection}
                    setSelection={setHierarchySelection}
                    levelNames={levelNames}
                    setLevelNames={setLevelNames}
                />
            </div>

            {/* Right: Content */}
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                     <StatCard label="Total Orders" value={analytics.total} subtext="In Period" />
                     <StatCard label="Active" value={analytics.activeCount} subtext="Pending Completion" colorClass="text-blue-600" />
                     <StatCard label="Closed" value={analytics.closedCount} subtext="Completed" colorClass="text-green-600" />
                     <StatCard label="MTTC" value={analytics.mttc} subtext="Mean Days to Close" colorClass="text-purple-600" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="h-80">
                         <BarChart 
                            title="Orders by Status (Active)" 
                            data={analytics.byStatus} 
                            onBarClick={handleStatusClick}
                            activeLabel={selectedStatus}
                            subtitle="Click a bar to filter hierarchy charts"
                        />
                    </div>
                    <div className="h-80">
                         <BarChart 
                            title="By Site (Level 3)" 
                            data={analytics.byL3} 
                            onBarClick={handleL3Click}
                            subtitle={selectedStatus ? `Filtered by status: ${selectedStatus}` : "Click a site to view departments"}
                        />
                    </div>
                </div>
            </div>

            {/* Drill Down Modal */}
            <Modal 
                isOpen={drillDown.active} 
                onClose={closeDrillDown} 
                title={drillDown.level === 'L4' ? `${drillDown.contextName}: Departments` : `${drillDown.contextName}: Sections`}
                size="lg"
            >
                <div className="h-80 w-full">
                    {drillDown.level === 'L4' && (
                        <BarChart 
                            title={`Orders by Department in ${drillDown.contextName}`} 
                            data={analytics.drillDownData} 
                            onBarClick={handleL4Click}
                            subtitle="Click a department to view sections"
                        />
                    )}
                    {drillDown.level === 'L5' && (
                         <BarChart 
                            title={`Orders by Section in ${drillDown.contextName}`} 
                            data={analytics.drillDownData} 
                            subtitle="Lowest hierarchy level"
                        />
                    )}
                </div>
                <div className="flex justify-end mt-4 gap-2">
                    {drillDown.level === 'L5' && (
                        <button onClick={goBackDrillDown} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
                            Back
                        </button>
                    )}
                    <button onClick={closeDrillDown} className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded">
                        Close
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default WorkOrderDashboard;
