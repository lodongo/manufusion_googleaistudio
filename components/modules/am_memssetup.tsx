import React, { useState } from 'react';
import type { Module, Organisation } from '../../types';
import MaintenanceTypesTab from './am/MaintenanceTypesTab';
import FailureModesTab from './am/FailureModesTab';
import SolutionModesTab from './am/SolutionModesTab';
import RisksTab from './am/RisksTab';
import NotificationSourcesTab from './am/NotificationSourcesTab';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import PmVariablesTab from './am/admin/PmVariablesTab';

interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
  theme: Organisation['theme']; // Added theme to props
}

const AmMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules, theme }) => {
  const [activeTab, setActiveTab] = useState('maintenanceTypes');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'maintenanceTypes':
        return <MaintenanceTypesTab />;
      case 'failureModes':
        return <FailureModesTab />;
      case 'solutionModes':
        return <SolutionModesTab />;
      case 'risks':
        return <RisksTab />;
      case 'notificationSources':
        return <NotificationSourcesTab />;
      case 'pmVariables':
        return <PmVariablesTab theme={theme} />;
      case 'rights':
        return <ModuleRightsManager module={module} />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
      role="tab"
      aria-selected={activeTab === tabName}
      id={`tab-${tabName}`}
      aria-controls={`panel-${tabName}`}
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
      style={activeTab === tabName ? { borderColor: theme?.colorPrimary, color: theme?.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="text-gray-500 font-semibold">Module Setup</p>
        </div>
        <button
            onClick={onBackToModules}
            className="text-sm text-blue-600 hover:underline"
        >
            &larr; Back to Module Management
        </button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-2">Initial Setup for {module.name}</h2>
        <p className="text-gray-600 mb-6">
          Here, administrators configure the foundational settings for this module to function. Use the tabs below to configure specific areas.
        </p>

        <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs" role="tablist">
                <TabButton tabName="maintenanceTypes" label="Maintenance Types" />
                <TabButton tabName="pmVariables" label="PM Maintenance Variables" />
                <TabButton tabName="failureModes" label="Failure Modes" />
                <TabButton tabName="solutionModes" label="Solution Modes" />
                <TabButton tabName="risks" label="Risks" />
                <TabButton tabName="notificationSources" label="Notification Sources" />
                <TabButton tabName="rights" label="Rights" />
            </nav>
        </div>
        
        <div
            className="mt-6"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
        >
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AmMemsSetupPage;