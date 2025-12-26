
import React from 'react';
import type { PurchaseRequisition } from '../../../../types/pr_types';

interface PrDashboardTabProps {
    pr: PurchaseRequisition;
}

const StatCard: React.FC<{ label: string; value: string | number; subtext?: string; colorClass?: string }> = ({ label, value, subtext, colorClass = "text-slate-800" }) => (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center items-center h-full">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</span>
        <span className={`text-4xl font-extrabold ${colorClass}`}>{value}</span>
        {subtext && <span className="text-xs text-slate-500 mt-1">{subtext}</span>}
    </div>
);

const PrDashboardTab: React.FC<PrDashboardTabProps> = ({ pr }) => {
    const createdAt = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
    const now = new Date();
    const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const calculateTAT = (endDate?: any) => {
        if (!endDate || !endDate.toDate) return 'Pending';
        const end = endDate.toDate();
        const diffHours = Math.round((end.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
        if (diffHours < 24) return `${diffHours} hrs`;
        return `${Math.floor(diffHours / 24)} days`;
    };

    const approvalTAT = calculateTAT(pr.approvedAt);
    const conversionTAT = calculateTAT(pr.convertedAt);
    
    const linesCount = pr.lines?.length || 0;
    const totalQty = pr.lines?.reduce((sum, line) => sum + (line.quantity || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <h4 className="text-lg font-bold text-slate-700">Request Statistics</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    label="Current Age" 
                    value={`${ageDays} Days`} 
                    subtext={`Created: ${createdAt.toLocaleDateString()}`}
                    colorClass={ageDays > 7 ? 'text-red-600' : 'text-slate-800'}
                />
                <StatCard 
                    label="Lines / Qty" 
                    value={`${linesCount} / ${totalQty}`} 
                    subtext="Total items requested"
                    colorClass="text-blue-600"
                />
                <StatCard 
                    label="Approval TAT" 
                    value={approvalTAT} 
                    subtext="Creation to Approval"
                    colorClass="text-green-600"
                />
                <StatCard 
                    label="Conversion TAT" 
                    value={conversionTAT} 
                    subtext="Creation to PO/RFQ"
                    colorClass="text-purple-600"
                />
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h5 className="text-sm font-bold text-slate-700 mb-2">Workflow Status</h5>
                <div className="flex items-center space-x-4 text-sm">
                    <div className={`flex items-center gap-2 ${pr.createdAt ? 'text-green-700' : 'text-slate-400'}`}>
                        <div className={`w-3 h-3 rounded-full ${pr.createdAt ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                        Created
                    </div>
                    <div className="h-0.5 w-8 bg-slate-300"></div>
                    <div className={`flex items-center gap-2 ${pr.approvedAt ? 'text-green-700' : 'text-slate-400'}`}>
                         <div className={`w-3 h-3 rounded-full ${pr.approvedAt ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                         Approved
                    </div>
                    <div className="h-0.5 w-8 bg-slate-300"></div>
                     <div className={`flex items-center gap-2 ${pr.convertedAt ? 'text-green-700' : 'text-slate-400'}`}>
                         <div className={`w-3 h-3 rounded-full ${pr.convertedAt ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                         Processed
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrDashboardTab;
