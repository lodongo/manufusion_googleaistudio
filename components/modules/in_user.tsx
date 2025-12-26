import React, { useState, useEffect } from 'react';
import type { Module, AppUser, Organisation } from '../../types';
import { MaterialDetailPage } from './in/MaterialDetailPage';
import MasterDataDetailView from './in/MasterDataDetailView';
import Inventory from './in/Inventory';
import SalesOrderList from './in/SalesOrderList';
import ReservationList from './in/ReservationList';
import MovementList from './in/MovementList';
import BinsTab from './in/BinsTab';
import CountsTab from './in/CountsTab';
import MrpPrsTab from './in/inventory/MrpPrsTab';
import { db } from '../../services/firebase';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const InUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [activeTab, setActiveTab] = useState('inventory');
  const [viewingMaterialId, setViewingMaterialId] = useState<string | null>(null);
  const [viewingMaterialPath, setViewingMaterialPath] = useState<string | undefined>(undefined);
  const [viewingMaterialTab, setViewingMaterialTab] = useState<string | undefined>(undefined);

  // Currency Configuration State
  const [currencyConfig, setCurrencyConfig] = useState({ local: 'USD', base: 'USD', rate: 1 });

  useEffect(() => {
      const fetchCurrencySettings = async () => {
          try {
              const docRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/currency`);
              docRef.onSnapshot(snap => {
                  if (snap.exists) {
                      const data = snap.data();
                      setCurrencyConfig({
                          local: data?.localCurrency || 'USD',
                          base: data?.baseCurrency || 'USD',
                          rate: data?.constantRateConfig?.calculatedRate || 1
                      });
                  }
              });
          } catch (e) {
              console.error("Error fetching currency settings", e);
          }
      };
      fetchCurrencySettings();
  }, [organisation.domain]);

  const tabs = [
      { id: 'inventory', label: 'Inventory' },
      { id: 'mrp_prs', label: 'MRP PRs' },
      { id: 'stock_take', label: 'Stock Take' },
      { id: 'sales_orders', label: 'Sales Orders' },
      { id: 'reservations', label: 'Reservations' },
      { id: 'movements', label: 'Movements' },
      { id: 'bins', label: 'Bins View' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  const handleViewMaterial = (id: string, path?: string, tab?: string) => {
      setViewingMaterialId(id);
      setViewingMaterialPath(path);
      setViewingMaterialTab(tab);
  };

  const handleCloseMaterial = () => {
      setViewingMaterialId(null);
      setViewingMaterialPath(undefined);
      setViewingMaterialTab(undefined);
  };

  if (viewingMaterialId) {
      if (viewingMaterialPath) {
          // Warehouse Specific View (Existing)
          return (
            <div className="p-4 md:p-8 w-full">
                <MaterialDetailPage
                    materialId={viewingMaterialId}
                    materialPath={viewingMaterialPath}
                    onBack={handleCloseMaterial}
                    currentUser={currentUser}
                    organisation={organisation}
                    theme={theme}
                    onNavigateToMaterial={handleViewMaterial}
                    currencyConfig={currencyConfig}
                    initialTab={viewingMaterialTab}
                />
            </div>
        );
      } else {
          // Master Data Registry View (New)
          return (
            <div className="p-4 md:p-8 w-full">
                <MasterDataDetailView
                    materialId={viewingMaterialId}
                    onBack={handleCloseMaterial}
                    currentUser={currentUser}
                    organisation={organisation}
                    theme={theme}
                />
            </div>
          );
      }
  }

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

      <div className="mt-1">
          {activeTab === 'inventory' && <Inventory currentUser={currentUser} theme={theme} organisation={organisation} onViewMaterial={handleViewMaterial} currencyConfig={currencyConfig} />}
          {activeTab === 'mrp_prs' && (
              <div className="bg-white p-6 rounded-b-lg shadow-md">
                <MrpPrsTab 
                    organisation={organisation}
                    theme={theme}
                    currentUser={currentUser}
                    onViewMaterial={handleViewMaterial}
                />
              </div>
          )}
          {activeTab === 'stock_take' && <CountsTab organisation={organisation} theme={theme} />}
          {activeTab === 'sales_orders' && <SalesOrderList organisation={organisation} theme={theme} currentUser={currentUser} currencyConfig={currencyConfig} />}
          {activeTab === 'reservations' && <ReservationList organisation={organisation} theme={theme} />}
          {activeTab === 'movements' && <MovementList organisation={organisation} theme={theme} currencyConfig={currencyConfig} />}
          {activeTab === 'bins' && <BinsTab organisation={organisation} theme={theme} onViewMaterial={handleViewMaterial} />}
      </div>
    </div>
  );
};

export default InUserPage;