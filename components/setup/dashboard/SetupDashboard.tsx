
import React from 'react';
import type { Organisation } from '../../../types';

interface SetupDashboardProps {
    organisationData?: Organisation;
    isEditing: boolean;
}

export const SetupDashboard: React.FC<SetupDashboardProps> = ({ organisationData, isEditing }) => {
    const currentData = isEditing ? organisationData : null;
    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-semibold text-slate-700">Basic Info Summary</h3>
                    <div className="text-sm text-slate-600 mt-2 space-y-1">
                        <p><strong>Name:</strong> {currentData?.name || 'Not Set'}</p>
                        <p><strong>Industry:</strong> {currentData?.industryCategory || 'Not Set'}</p>
                        <p><strong>Location:</strong> {`${currentData?.address?.country || ''}, ${currentData?.address?.continent || ''}`}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                    <h3 className="font-semibold text-slate-700">Employees</h3>
                    <p className="text-slate-500 text-sm mt-1">Manage employee records.</p>
                    <p className="text-4xl font-bold text-indigo-600 mt-2">0</p>
                </div>
                 <div className="bg-white p-6 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                    <h3 className="font-semibold text-slate-700">Roles</h3>
                     <p className="text-slate-500 text-sm mt-1">Define user roles and permissions.</p>
                    <p className="text-4xl font-bold text-indigo-600 mt-2">0</p>
                </div>
            </div>
        </div>
    );
};
