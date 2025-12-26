
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import type { AppUser, Organisation, Module } from '../../types';
import MaterialCatalogue from './in/MaterialCatalogue';
import { MaterialDetailPage } from './in/MaterialDetailPage';
import InventorySettingsTab from './in/InventorySettingsTab';
import StockTakeAdminTab from './in/StockTakeAdminTab';

interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
  currentUser: AppUser;
}

const InAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation, currentUser }) => {
  const [activeTab, setActiveTab] = useState('approvals');
  const [viewingMaterialId, setViewingMaterialId] = useState<string | null>(null);

  /* Added currencyConfig state to resolve missing prop error in MaterialDetailPage */
  const [currencyConfig, setCurrencyConfig] = useState({ local: 'USD', base: 'USD', rate: 1 });

  /* Added useEffect to fetch currency settings from the organization settings */
  useEffect(() => {
      const docRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/currency`);
      const unsubscribe = docRef.onSnapshot(snap => {
          if (snap.exists) {
              const data = snap.data();
              setCurrencyConfig({
                  local: data?.localCurrency || 'USD',
                  base: data?.baseCurrency || 'USD',
                  rate: data?.constantRateConfig?.calculatedRate || 1
              });
          }
      });
      return unsubscribe;
  }, [organisation.domain]);

  const tabs = [
    { id: 'approvals', label: 'Material Approvals' },
    { id: 'stocktake', label: 'Stock Take' },
    { id: 'settings', label: 'Classification Setup' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );

  if (viewingMaterialId) {
    return (
        <div className="p-4 md:p-8 w-full">
            <MaterialDetailPage
                materialId={viewingMaterialId}
                onBack={() => setViewingMaterialId(null)}
                currentUser={currentUser}
                organisation={organisation}
                theme={theme}
                /* Added missing currencyConfig prop */
                currencyConfig={currencyConfig}
            />
        </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="font-semibold" style={{ color: theme.colorAccent }}>Admin Dashboard</p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={onSwitchToUser} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium">Switch to User View</button>
          <button onClick={onBackToDashboard} className="text-sm hover:underline" style={{ color: theme.colorPrimary }}>&larr; Back to Main Dashboard</button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-lg shadow-md">
        <div className="border-b border-slate-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
            </nav>
        </div>
        <div className="mt-6">
            {activeTab === 'approvals' && (
                <MaterialCatalogue 
                    currentUser={currentUser} 
                    theme={theme} 
                    organisation={organisation} 
                    onViewMaterial={setViewingMaterialId}
                />
            )}
            {activeTab === 'stocktake' && (
                <StockTakeAdminTab organisation={organisation} theme={theme} currentUser={currentUser} />
            )}
            {activeTab === 'settings' && (
                <InventorySettingsTab organisation={organisation} currentUser={currentUser} theme={theme} />
            )}
        </div>
      </div>
    </div>
  );
};

export default InAdminPage;
