
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collection, query, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import type { Organisation, MaterialMasterData } from '../../../types';
import type { MaterialMovement } from '../../../types/in_types';

interface InventoryDashboardTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

const StatCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => (
    <div className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: color }}>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
);

const InventoryDashboardTab: React.FC<InventoryDashboardTabProps> = ({ organisation, theme }) => {
    const [materials, setMaterials] = useState<MaterialMasterData[]>([]);
    const [movements, setMovements] = useState<MaterialMovement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const masterDataRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);
        const qMaterials = query(masterDataRef, where('status', '==', 'Approved'));

        // Fetch Movements across all warehouses in the org
        const movementsRef = collectionGroup(db, 'materialMovements');
        // Note: Client-side filtering for path prefix is required for collectionGroup if not using specific indexes
        
        const unsubMaterials = onSnapshot(qMaterials, (snapshot) => {
            setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialMasterData)));
        });

        const unsubMovements = onSnapshot(movementsRef, (snapshot) => {
             const orgMovements = snapshot.docs
                .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(doc => ({ id: doc.id, ...doc.data() } as MaterialMovement));
             setMovements(orgMovements);
             setLoading(false);
        });

        return () => {
            unsubMaterials();
            unsubMovements();
        };
    }, [organisation.domain]);

    const dashboardData = useMemo(() => {
        const criticalityCounts = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
        const now = new Date();
        
        const detailedStats = materials.map(m => {
            // Criticality Counting
            const critClass = m.inventoryData?.criticalityClass || 'N/A';
            if (critClass in criticalityCounts) {
                (criticalityCounts as any)[critClass]++;
            } else {
                criticalityCounts['N/A']++;
            }

            // Filter movements for this material (Issue type only for demand)
            const itemMovements = movements.filter(mov => mov.materialId === m.id && mov.type === 'ISSUE');
            
            // Sort descending for last issue
            itemMovements.sort((a, b) => b.date.toMillis() - a.date.toMillis());
            
            const lastIssueDate = itemMovements.length > 0 ? itemMovements[0].date.toDate() : null;

            // Demand Calculations
            let demand7Days = 0;
            let demand30Days = 0;
            let demand365Days = 0;

            itemMovements.forEach(mov => {
                const moveDate = mov.date.toDate();
                const diffTime = Math.abs(now.getTime() - moveDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 7) demand7Days += mov.quantity;
                if (diffDays <= 30) demand30Days += mov.quantity;
                if (diffDays <= 365) demand365Days += mov.quantity;
            });

            return {
                ...m,
                stats: {
                    lastIssue: lastIssueDate,
                    demand7Days,
                    demand30Days,
                    demand365Days,
                    // Procurement Data Lead Time (Calculated from Purchasing + Delivery + GR)
                    leadTimeDays: m.procurementData?.totalLeadTimeDays || 
                                  ((Number(m.procurementData?.purchasingProcessingDays)||0) + 
                                   (Number(m.procurementData?.plannedDeliveryDays)||0) + 
                                   (Number(m.procurementData?.grProcessingDays)||0)),
                    currentQty: m.inventoryData?.issuableQuantity || 0
                }
            };
        });

        return {
            totalItems: materials.length,
            criticalityCounts,
            detailedStats
        };
    }, [materials, movements]);

    const getClassColor = (cls?: string) => {
        switch(cls) {
            case 'A': return 'text-red-700 bg-red-100';
            case 'B': return 'text-orange-700 bg-orange-100';
            case 'C': return 'text-yellow-700 bg-yellow-100';
            case 'D': return 'text-green-700 bg-green-100';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading dashboard analytics...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">Inventory Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Total Materials" value={dashboardData.totalItems} color={theme.colorPrimary} />
                    <StatCard title="Class A (Critical)" value={dashboardData.criticalityCounts.A} color="#dc2626" />
                    <StatCard title="Class B (High)" value={dashboardData.criticalityCounts.B} color="#ea580c" />
                    <StatCard title="Class C (Medium)" value={dashboardData.criticalityCounts.C} color="#ca8a04" />
                    <StatCard title="Class D (Low)" value={dashboardData.criticalityCounts.D} color="#65a30d" />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-700">Detailed Inventory Statistics</h3>
                    <p className="text-sm text-slate-500">Real-time stock levels, criticality parameters, and consumption trends.</p>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700">Material</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Class</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Current Qty</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-center bg-blue-50">Min / Max</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-center bg-blue-50">Reorder Pt</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Lead Time</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-right bg-gray-50">Last Issue</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-right bg-gray-50">7-Day Demand</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-right bg-gray-50">30-Day Demand</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 text-right bg-gray-50">Annual Demand</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {dashboardData.detailedStats.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{item.procurementComponentName}</div>
                                        <div className="text-xs font-mono text-slate-500">{item.materialCode}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getClassColor(item.inventoryData?.criticalityClass)}`}>
                                            {item.inventoryData?.criticalityClass || '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                                        {item.stats.currentQty} <span className="text-xs font-normal text-slate-400">{item.inventoryData?.inventoryUom}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center bg-blue-50/30">
                                        <div className="text-xs">
                                            <span className="text-red-600 font-semibold">{item.inventoryData?.minStockLevel ?? '-'}</span> / 
                                            <span className="text-green-600 font-semibold"> {item.inventoryData?.maxStockLevel ?? '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono bg-blue-50/30 text-indigo-700">
                                        {item.inventoryData?.reorderPointQty ?? '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {item.stats.leadTimeDays > 0 ? `${item.stats.leadTimeDays} days` : <span className="text-slate-400 italic">Not Set</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right bg-gray-50/30 text-xs">
                                        {item.stats.lastIssue ? item.stats.lastIssue.toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right bg-gray-50/30 font-medium">
                                        {item.stats.demand7Days}
                                    </td>
                                    <td className="px-4 py-3 text-right bg-gray-50/30 font-medium">
                                        {item.stats.demand30Days}
                                    </td>
                                    <td className="px-4 py-3 text-right bg-gray-50/30 font-bold text-slate-700">
                                        {item.stats.demand365Days}
                                    </td>
                                </tr>
                            ))}
                             {dashboardData.detailedStats.length === 0 && (
                                <tr><td colSpan={10} className="p-8 text-center text-slate-500">No approved materials found to display statistics.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryDashboardTab;
