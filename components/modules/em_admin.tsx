import React, { useState } from 'react';
import type { Module, Organisation, AppUser } from '../../types';
import BillingSetupTab from './em/admin/BillingSetupTab';
import MonthlyAdjustmentsTab from './em/admin/MonthlyAdjustmentsTab';
import MeterSetupTab from './em/admin/MeterSetupTab';
import TopographyTab from './em/admin/TopographyTab';
import ParameterProcessingTab from './em/admin/ParameterProcessingTab';
import GeneralSetupTab from './em/admin/GeneralSetupTab';

interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
  currentUser: AppUser;
}

const EmAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation, currentUser }) => {
  const [activeTab, setActiveTab] = useState('billing');

  const tabs = [
    { id: 'billing', label: 'Tariff Structure' },
    { id: 'adjustments', label: 'Monthly Adjustments' },
    { id: 'meters', label: 'Meter Setup' },
    { id: 'topography', label: 'Topography' },
    { id: 'parameters', label: 'Parameter Processing' },
    { id: 'general', label: 'General Setup' },
    { id: 'targets', label: 'Efficiency Targets' },
  ];

  const TabButton: React.FC<{ tabId: string; label: string }> = ({ tabId, label }) => (
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'billing':
        return <BillingSetupTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'adjustments':
        return <MonthlyAdjustmentsTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'meters':
        return <MeterSetupTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'topography':
        return <TopographyTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'parameters':
        return <ParameterProcessingTab organisation={organisation} theme={theme} />;
      case 'general':
        return <GeneralSetupTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'targets':
        return (
          <div className="mt-6 p-8 text-center text-slate-500 border-2 border-dashed rounded-xl">
            <h2 className="text-xl font-semibold mb-2">Efficiency Targets</h2>
            <p>Define energy intensity targets per production unit or department.</p>
          </div>
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

      <div className="bg-white p-6 md:p-8 rounded-lg shadow-md">
        <div className="border-b border-slate-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-6">
                {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
            </nav>
        </div>
        <div className="animate-fade-in">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default EmAdminPage;