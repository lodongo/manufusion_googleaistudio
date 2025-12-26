import React, { useState } from 'react';
import type { Module } from '../types';
import ProcurementClassifications from './pr/ProcurementClassifications';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import AssessmentTemplateTab from './pr/AssessmentTemplateTab';
import ListsTab from './pr/ListsTab';
import { useAuth } from '../../context/AuthContext';

interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
}

const PrMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const [activeTab, setActiveTab] = useState('classifications');
  const { currentUserProfile } = useAuth(); // Get profile for organisation

  const renderTabContent = () => {
    switch (activeTab) {
      case 'classifications':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-2">Procurement Categorisation</h2>
            <p className="text-gray-600 mb-6">
              Define the hierarchical structure for all procurement items. Manage classifications, broad categories, and specific subcategories below.
            </p>
            <ProcurementClassifications />
          </div>
        );
      case 'lists':
        return <ListsTab />;
      case 'assessmentTemplate':
        if (!currentUserProfile?.domain) return <div>Error: No organisation found.</div>;
        return <AssessmentTemplateTab organisation={{ domain: currentUserProfile.domain } as any} />;
      case 'rights':
        return <ModuleRightsManager module={module} />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabId: string; label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? 'border-blue-600 text-blue-600'
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
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                <TabButton tabId="classifications" label="Classifications" />
                <TabButton tabId="lists" label="Lists" />
                <TabButton tabId="assessmentTemplate" label="Assessment Template" />
                <TabButton tabId="rights" label="Rights" />
            </nav>
        </div>
        
        <div className="mt-6">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default PrMemsSetupPage;
