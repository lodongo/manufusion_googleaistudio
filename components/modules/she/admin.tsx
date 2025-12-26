
import React, { useState } from 'react';
import type { Module, Organisation, AppUser } from '../../types';
import RiskAssessmentSetupTab from './she/RiskAssessmentSetupTab';

interface ModuleAdminPageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const SheAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation, currentUser }) => {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' // Active styles are applied via style prop
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
      case 'settings':
        return <RiskAssessmentSetupTab organisation={organisation} theme={theme} />;
      case 'configuration':
        return <div className="p-8 text-center text-slate-500">Module configuration options will be available here.</div>;
      case 'dashboard':
        return <div className="p-8 text-center text-slate-500">An admin-level dashboard for the SHE module will be displayed here.</div>;
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
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
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

      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
          </nav>
        </div>
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SheAdminPage;