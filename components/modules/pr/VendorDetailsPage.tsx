
import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../types';
import type { Vendor } from '../../../types/pr_types';
import VendorProfileTab from './vendor/VendorProfileTab';
import VendorSRMTab from './vendor/VendorSRMTab';
import VendorOrdersTab from './vendor/VendorOrdersTab';
import VendorDashboardTab from './vendor/VendorDashboardTab';
import NewVendorTab from './NewVendorTab';

interface VendorDetailsPageProps {
    vendor: Vendor;
    onBack: () => void;
    organisation: Organisation;
    currentUser: AppUser;
    theme: Organisation['theme'];
}

const VendorDetailsPage: React.FC<VendorDetailsPageProps> = ({ vendor, onBack, organisation, currentUser, theme }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isEditing, setIsEditing] = useState(false);

    // If editing mode is triggered from Profile tab, show the NewVendorTab in Edit mode
    if (isEditing) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Edit Vendor</h2>
                    <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500 hover:underline">Cancel Edit</button>
                </div>
                <NewVendorTab 
                    theme={theme} 
                    currentUser={currentUser} 
                    organisation={organisation} 
                    vendorToEdit={vendor} 
                    onComplete={() => setIsEditing(false)} 
                />
            </div>
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
        <div className="flex flex-col h-full">
            <div className="bg-white p-6 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <button onClick={onBack} className="text-sm hover:underline mb-2" style={{ color: theme.colorPrimary }}>&larr; Back to Vendor List</button>
                        <h1 className="text-2xl font-bold text-slate-800">{vendor.legalName}</h1>
                        <p className="text-sm text-slate-500 font-mono">{vendor.vendorCode}</p>
                    </div>
                    <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            vendor.status === 'Active' || vendor.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                            vendor.status === 'Deleted' || vendor.status === 'Deactivated' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {vendor.status}
                        </span>
                    </div>
                </div>

                <div className="mt-6 flex space-x-6 overflow-x-auto">
                    <TabButton id="dashboard" label="Dashboard" />
                    <TabButton id="profile" label="Vendor Profile" />
                    <TabButton id="srm" label="SRM" />
                    <TabButton id="orders" label="Previous Orders" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {activeTab === 'dashboard' && <VendorDashboardTab vendor={vendor} organisation={organisation} theme={theme} />}
                {activeTab === 'profile' && <VendorProfileTab vendor={vendor} onEdit={() => setIsEditing(true)} organisation={organisation} currentUser={currentUser} />}
                {activeTab === 'srm' && <VendorSRMTab vendor={vendor} organisation={organisation} currentUser={currentUser} theme={theme} />}
                {activeTab === 'orders' && <VendorOrdersTab vendor={vendor} organisation={organisation} />}
            </div>
        </div>
    );
};

export default VendorDetailsPage;
