
import React, { useState, useEffect } from 'react';
import type { Module, AppUser, Organisation } from '../../types';
import type { Vendor, PurchaseRequisition, PurchaseOrder } from '../../types/pr_types';
import PrDashboard from './pr/dashboard/PrDashboard';
import { PurchaseRequestList } from './pr/requests/PurchaseRequestList';
import PurchaseRequestDetailView from './pr/requests/PurchaseRequestDetailView';
import PurchaseOrderList from './pr/orders/PurchaseOrderList';
import VendorListTab from './pr/VendorListTab';
import VendorDetailsPage from './pr/VendorDetailsPage';
import QuoteList from './pr/quotes/QuoteList';
import PurchaseOrderModal from './pr/orders/PurchaseOrderModal';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const PrUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  
  // Create PO from PR State
  const [poFromPr, setPoFromPr] = useState<PurchaseRequisition | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'requests', label: 'Purchase Requisitions' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'orders', label: 'Purchase Orders' },
    { id: 'vendors', label: 'Vendors' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => { setActiveTab(tabId); setSelectedVendor(null); setSelectedPrId(null); }}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' // Active styles applied via style prop
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  // If a vendor is selected (drill-down from Vendors tab), show details
  if (selectedVendor && activeTab === 'vendors') {
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

  // If a PR is selected (drill-down from Requests tab), show details view
  if (selectedPrId && activeTab === 'requests') {
      return (
          <PurchaseRequestDetailView 
              prId={selectedPrId} 
              onBack={() => setSelectedPrId(null)} 
              organisation={organisation} 
              currentUser={currentUser} 
              theme={theme} 
          />
      );
  }

  const handleCreatePO = (pr: PurchaseRequisition) => {
      setPoFromPr(pr);
      setIsPoModalOpen(true);
  };
  
  const handleClosePoModal = () => {
      setIsPoModalOpen(false);
      setPoFromPr(null);
  };

  const renderTabContent = () => {
      switch (activeTab) {
          case 'dashboard':
              return <PrDashboard organisation={organisation} theme={theme} />;
          case 'requests':
              return (
                  // Using component which now has Tabs inside it
                <div className="bg-white rounded-lg shadow-sm">
                    {/* The PurchaseRequestList now handles sub-tabs internally */}
                    {/* We need to pass the viewMode or create logic? Actually PurchaseRequestList logic was split. */}
                    {/* Re-instating Tab Logic if PurchaseRequestList handles it or just rendering the unified component */}
                    {/* Assuming we modified PurchaseRequestList to handle sub-navigation internally or we use WorkRequestsTab which wraps it. */}
                    {/* Let's use the unified list component directly but pass mode. 
                        Wait, the prompt edit suggests PurchaseRequestList handles list rendering. 
                        To keep it simple, we render the 'WorkRequestsTab' wrapper if available, OR render the List manually.
                        Since WorkRequestsTab exists in previous context, better use it? 
                        The user provided code uses `PurchaseRequestList`. 
                        I will use `PurchaseRequestList` inside a wrapper or directly. */}
                    
                    {/* Render Main Request View */}
                     <div className="p-6">
                        <PurchaseRequestList 
                            organisation={organisation} 
                            theme={theme} 
                            currentUser={currentUser} 
                            onViewPR={(pr) => setSelectedPrId(pr.id)}
                            onCreatePO={handleCreatePO}
                            viewMode="new" // Default view
                        />
                     </div>
                </div>
              );
          case 'quotes':
              return <QuoteList organisation={organisation} theme={theme} currentUser={currentUser} />;
          case 'orders':
              return <PurchaseOrderList organisation={organisation} theme={theme} currentUser={currentUser} />;
          case 'vendors':
              return (
                  <VendorListTab 
                    organisation={organisation} 
                    theme={theme} 
                    onSelectVendor={setSelectedVendor} 
                  />
              );
          default:
              return null;
      }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="text-gray-500">User Dashboard</p>
        </div>
        <div className="flex items-center space-x-4">
          {canSeeAdminLink && (
            <button
              onClick={onSwitchToAdmin}
              className="px-4 py-2 text-white rounded-md hover:opacity-90 text-sm font-medium"
              style={{ backgroundColor: theme.colorPrimary }}
            >
              Switch to Admin View
            </button>
          )}
          <button
            onClick={onBackToDashboard}
            className="text-sm hover:underline"
            style={{ color: theme.colorPrimary }}
          >
            &larr; Back to Main Dashboard
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white rounded-t-lg shadow-md overflow-x-auto">
        <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
          {tabs.map(tab => (
            <TabButton key={tab.id} tabId={tab.id} label={tab.label} />
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {renderTabContent()}
      </div>

      {isPoModalOpen && (
          <PurchaseOrderModal
            isOpen={isPoModalOpen}
            onClose={handleClosePoModal}
            organisation={organisation}
            currentUser={currentUser}
            theme={theme}
            initialPr={poFromPr}
            onSave={handleClosePoModal}
          />
      )}
    </div>
  );
};

export default PrUserPage;
