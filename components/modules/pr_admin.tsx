

import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../types';
import type { Vendor } from '../../types/pr_types';
import VendorListTab from './pr/VendorListTab';
import NewVendorTab from './pr/NewVendorTab';
import VendorDetailsPage from './pr/VendorDetailsPage';
import PrThresholdsTab from './pr/settings/PrThresholdsTab';
import ExceptionNoticeList from './pr/exceptions/ExceptionNoticeList';

const PrAdminPage: React.FC<{ organisation: Organisation; currentUser: AppUser; theme: Organisation['theme']; onSwitchToUser: () => void; onBackToDashboard: () => void }> = ({ organisation, currentUser, theme, onSwitchToUser, onBackToDashboard }) => {
    const [activeTab, setActiveTab] = useState('vendors');
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

    // If a vendor is selected, show the details page entirely
    if (selectedVendor) {
        return (
            <VendorDetailsPage 
                vendor={selectedVendor} 
                onBack={() => setSelectedVendor(null)} 
                organisation={organisation} 
                currentUser={currentUser} 
                theme={theme}
            />
        );
    }

    const TabButton: React.FC<{ id: string; label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeTab === id ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    return (
        <div className="p-4 md:p-8 w-full">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Procurement (PR)</h1>
                    <p className="font-semibold" style={{ color: theme.colorAccent }}>Admin Dashboard</p>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={onSwitchToUser} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium">Switch to User View</button>
                    <button onClick={onBackToDashboard} className="text-sm hover:underline" style={{ color: theme.colorPrimary }}>&larr; Back to Main Dashboard</button>
                </div>
            </div>

            <div className="border-b border-slate-200 bg-white rounded-t-lg shadow-md overflow-x-auto">
                <nav className="-mb-px flex space-x-6 px-6">
                    <TabButton id="vendors" label="Vendor List" />
                    <TabButton id="new_vendor" label="Register New Vendor" />
                    <TabButton id="exceptions" label="Exception Notices" />
                    <TabButton id="thresholds" label="Policy & Thresholds" />
                </nav>
            </div>

            <div className="mt-1">
                {activeTab === 'vendors' && <VendorListTab organisation={organisation} theme={theme} onSelectVendor={setSelectedVendor} />}
                {activeTab === 'new_vendor' && <NewVendorTab theme={theme} currentUser={currentUser} organisation={organisation} onComplete={() => setActiveTab('vendors')} />}
                {activeTab === 'exceptions' && <ExceptionNoticeList organisation={organisation} theme={theme} />}
                {activeTab === 'thresholds' && <PrThresholdsTab organisation={organisation} theme={theme} />}
            </div>
        </div>
    );
};

export default PrAdminPage;