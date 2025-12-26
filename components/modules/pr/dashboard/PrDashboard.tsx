
import React from 'react';
import type { Organisation } from '../../../../types';

interface PrDashboardProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

const StatCard: React.FC<{ title: string; value: string; color: string }> = ({ title, value, color }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4" style={{ borderColor: color }}>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
);

const PrDashboard: React.FC<PrDashboardProps> = ({ organisation, theme }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800">Procurement Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Pending Requests" value="0" color="#f59e0b" />
                <StatCard title="Open Orders" value="0" color={theme.colorPrimary} />
                <StatCard title="Active Vendors" value="0" color={theme.colorSecondary} />
                <StatCard title="YTD Spend" value="$0.00" color="#10b981" />
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center text-slate-500">
                <p>Procurement analytics and charts will appear here.</p>
            </div>
        </div>
    );
};

export default PrDashboard;
