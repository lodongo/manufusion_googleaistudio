
import React, { useState } from 'react';
import type { Module } from '../../types';
import MaintenanceTypesTab from './am/MaintenanceTypesTab';
import { HazardsTab } from './she/HazardsTab';
import SolutionModesTab from './am/SolutionModesTab';
import RisksTab from './am/RisksTab';
import NotificationSourcesTab from './am/NotificationSourcesTab';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import InjuriesTab from './she/InjuriesTab';
import RatingsTab from './she/RatingsTab';
import ControlsTab from './she/ControlsTab';
import OperatingModesTab from './she/OperatingModesTab';


interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
}

const SheMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const [activeTab, setActiveTab] = useState('hazards');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hazards':
        return <HazardsTab />;
      case 'injuries':
        return <InjuriesTab />;
      case 'ratings':
        return <RatingsTab />;
      case 'controls':
        return <ControlsTab />;
      case 'operatingModes':
        return <OperatingModesTab />;
      case 'rights':
        return <ModuleRightsManager module={module} />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
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

        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                <TabButton tabName="hazards" label="Hazards" />
                <TabButton tabName="injuries" label="Injuries" />
                <TabButton tabName="ratings" label="Risk Ratings" />
                <TabButton tabName="controls" label="Controls" />
                <TabButton tabName="operatingModes" label="Modes of Operation" />
                <TabButton tabName="rights" label="Rights" />
            </nav>
        </div>
        
        <div className="mt-6">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SheMemsSetupPage;
