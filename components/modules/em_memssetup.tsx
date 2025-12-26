
import React, { useState } from 'react';
import type { Module, Organisation } from '../types';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import ConsumerTypesTab from './em/setup/ConsumerTypesTab';

interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
  theme: Organisation['theme'];
}

const EmMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules, theme }) => {
  const [activeTab, setActiveTab] = useState('general');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initial Setup for {module.name}</h2>
            <p className="text-gray-600">
              Configure the foundational settings for the Energy Management (EM) module. 
              This includes utility provider definitions, unit of measure for energy (kWh, MJ, etc.), 
              and global carbon emission factors for sustainability reporting.
            </p>
          </div>
        );
      case 'consumerTypes':
        return <ConsumerTypesTab theme={theme} />;
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
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
        <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <TabButton tabName="general" label="General" />
                <TabButton tabName="consumerTypes" label="Consumer Types" />
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

export default EmMemsSetupPage;
