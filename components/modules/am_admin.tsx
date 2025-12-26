import React, { useState } from 'react';
import type { Module, Organisation } from '../../types';
import AmSetupTab from './am/admin/AmSetupTab';
import PlanningGroupsTab from './am/admin/PlanningGroupsTab';
import PreventiveMaintenanceTab from './am/admin/PreventiveMaintenanceTab';
import FixedAssetsTab from './am/admin/FixedAssetsTab';

interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const AmAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation }) => {
  const [activeTab, setActiveTab] = useState('setup');

  const tabs = [
    { id: 'setup', label: 'Setup' },
    { id: 'planningGroups', label: 'Planning Groups' },
    { id: 'pmPlans', label: 'Preventive Maintenance Plans' },
    { id: 'fixedAssets', label: 'Fixed Assets' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' // Active styles applied via style prop
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
      aria-current={activeTab === tabId ? 'page' : undefined}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'setup':
        return <AmSetupTab theme={theme} organisation={organisation} />;
      case 'planningGroups':
        return <PlanningGroupsTab theme={theme} organisation={organisation} />;
      case 'pmPlans':
        return <PreventiveMaintenanceTab theme={theme} organisation={organisation} />;
      case 'fixedAssets':
        return <FixedAssetsTab theme={theme} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="font-semibold" style={{ color: theme.colorAccent }}>Admin Dashboard</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={onSwitchToUser}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Switch to User View
          </button>
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
        <nav className="-mb-px flex space-x-6 px-6" aria-label="Admin Tabs">
          {tabs.map(tab => (
            <TabButton key={tab.id} tabId={tab.id} label={tab.label} />
          ))}
        </nav>
      </div>

      <div className="mt-1">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AmAdminPage;