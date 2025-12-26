
import React, { useState } from 'react';
import type { Module } from '../../types';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import StorageLocationsTab from './in/StorageLocationsTab';
import SpareTypesTab from './in/SpareTypesTab';
import SupplierEvaluationSetupTab from './in/SupplierEvaluationSetupTab';
import { useAuth } from '../../context/AuthContext';

interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
}

const InMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const { currentUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('storageLocations');

  const TabButton: React.FC<{ tabName: string; label: string }> = ({ tabName, label }) => (
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
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initial Setup for {module.name}</h2>
            <p className="text-gray-600">
              This is the dedicated setup page for the Inventory (IN) module.
              Here, administrators will configure the foundational settings required for this module to function, such as default units of measure, inventory valuation methods (e.g., FIFO, LIFO), and item categories.
            </p>
          </div>
        );
      case 'storageLocations':
        return <StorageLocationsTab />;
      case 'spareTypes':
        return <SpareTypesTab />;
      case 'supplierEval':
        return currentUserProfile?.domain ? <SupplierEvaluationSetupTab organisationId={currentUserProfile.domain} /> : <p>Error: No organization loaded.</p>;
      case 'rights':
        return <ModuleRightsManager module={module} />;
      default:
        return null;
    }
  };

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
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs" role="tablist">
              <TabButton tabName="general" label="General" />
              <TabButton tabName="storageLocations" label="Storage Locations" />
              <TabButton tabName="spareTypes" label="Spare Types" />
              <TabButton tabName="supplierEval" label="Supplier Evaluation" />
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

export default InMemsSetupPage;
