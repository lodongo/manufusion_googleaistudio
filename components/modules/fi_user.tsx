
import React, { useState } from 'react';
import type { Module, AppUser, Organisation } from '../../types';
import UserBudgetsTab from './fi/UserBudgetsTab';
import JournalsTab from './fi/JournalsTab';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const FiUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [activeTab, setActiveTab] = useState('budgets');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'budgets', label: 'Budgets' },
    { id: 'journals', label: 'Journals' },
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
      case 'dashboard':
        return (
          <div className="bg-white p-8 rounded-b-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Welcome to the {module.name} User Dashboard</h2>
            <p className="text-gray-600">
              Future functionality like expense reporting, budget tracking, and financial dashboards will be displayed here.
            </p>
          </div>
        );
      case 'budgets':
        return <UserBudgetsTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'journals':
        return <JournalsTab organisation={organisation} theme={theme} />;
      default:
        return null;
    }
  };

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
          {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
        </nav>
      </div>

      <div className="mt-1">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default FiUserPage;
