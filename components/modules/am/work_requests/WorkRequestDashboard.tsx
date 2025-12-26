
import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkRequest } from '../../../../types/am_types';
import DashboardFilterPanel from './dashboard/DashboardFilterPanel';
import ImpactAnalysisCharts from './dashboard/ImpactAnalysisCharts';

const { Timestamp } = firebase.firestore;

interface WorkRequestDashboardProps {
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

const WorkRequestDashboard: React.FC<WorkRequestDashboardProps> = ({ currentUser, theme, organisation }) => {
    const [requests, setRequests] = useState<WorkRequest[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    });

    const [hierarchySelection, setHierarchySelection] = useState({ l3: '', l4: '', l5: '' });
    const [levelNames, setLevelNames] = useState({ l3: '', l4: '', l5: '' });

    useEffect(() => {
        setLoading(true);
        const workRequestsRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests');
        
        // Base Query: Only CREATED requests in date range
        let q = workRequestsRef
            .where('status', '==', 'CREATED')
            .where('createdAt', '>=', Timestamp.fromDate(dateRange.start))
            .where('createdAt', '<=', Timestamp.fromDate(dateRange.end));

        const unsubscribe = q.onSnapshot(snapshot => {
            const rawRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkRequest));
            
            // Apply Hierarchy Filters Client-Side
            const filtered = rawRequests.filter(req => {
                if (hierarchySelection.l5 && req.allocationLevel5Id !== hierarchySelection.l5) return false;
                if (hierarchySelection.l4 && req.allocationLevel4Id !== hierarchySelection.l4) return false;
                if (hierarchySelection.l3 && req.allocationLevel3Id !== hierarchySelection.l3) return false;
                return true;
            });

            setRequests(filtered);
            setLoading(false);
        }, (err) => {
            console.error("Dashboard Fetch Error:", err);
            setLoading(false);
        });

        return unsubscribe;
    }, [organisation.domain, dateRange, hierarchySelection]);

    const stats = useMemo(() => {
        const openCount = requests.length; // Already filtered by CREATED
        const safetyCount = requests.filter(r => r.impactCategoryName?.toLowerCase().includes('safety')).length;
        
        // Count by priority or other metric if available, for now just use Total vs Safety
        const criticalAssetCount = requests.filter(r => r.impactCategoryName?.toLowerCase().includes('asset integrity')).length;

        return {
            openCount,
            safetyCount,
            criticalAssetCount
        };
    }, [requests]);

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

            {/* Right: Visualization */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Key Metric: Total Open Requests */}
                    <StatCard 
                        label={`Pending Requests`} 
                        value={stats.openCount} 
                        subtext="Status: CREATED"
                        colorClass="text-blue-600" 
                    />

                     {/* Key Metric: Asset Integrity */}
                     <StatCard 
                        label="Asset Critical" 
                        value={stats.criticalAssetCount} 
                        subtext="High Impact Risks"
                        colorClass="text-orange-600" 
                    />
                    
                    {/* Key Metric: Safety Impact */}
                     <StatCard 
                        label="Safety Concerns" 
                        value={stats.safetyCount} 
                        subtext="Requires Immediate Attention"
                        colorClass="text-red-600" 
                    />
                </div>

                <div className="flex-1 min-h-[400px]">
                     {loading ? (
                         <div className="flex justify-center items-center h-full bg-white rounded-lg border border-slate-200">
                             <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-slate-400"></div>
                         </div>
                     ) : (
                        <ImpactAnalysisCharts requests={requests} theme={theme} />
                     )}
                </div>
            </div>
        </div>
    );
};

export default WorkRequestDashboard;
