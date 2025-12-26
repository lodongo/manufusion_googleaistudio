
// components/modules/fi/admin.tsx
import React, { useState } from 'react';
import type { Module, Organisation, AppUser } from '../../types';
import BudgetingTab from './fi/BudgetingTab';
import PostingRulesTab from './fi/PostingRulesTab';
import CurrencySetupTab from './fi/CurrencySetupTab';
import GLAccountsTab from './fi/GLAccountsTab';
import BudgetGLsTab from './fi/BudgetGLsTab';
import ActiveCalendarsTab from './fi/ActiveCalendarsTab';
import PeriodsTab from './fi/PeriodsTab';
import CalendarConfigTab from './fi/CalendarConfigTab';


interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
  currentUser: AppUser;
}

const FiAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation, currentUser }) => {
  const [activeTab, setActiveTab] = useState('budgeting');
  const [activeBudgetingSubTab, setActiveBudgetingSubTab] = useState('templates');

  const tabs = [
    { id: 'glAccounts', label: 'GL Accounts' },
    { id: 'budgeting', label: 'Budgeting' },
    { id: 'postingRules', label: 'Posting Rules' },
    { id: 'currencies', label: 'Currencies' },
    { id: 'dashboard', label: 'Dashboard' },
  ];
  
  const budgetingSubTabs = [
    { id: 'templates', label: 'Budget Templates' },
    { id: 'budgetableGLs', label: 'Budgetable GLs' },
    { id: 'activeCalendars', label: 'Active Calendars' },
    { id: 'periods', label: 'Periods Management' },
    { id: 'calendarConfig', label: 'Calendar Config' },
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
  
  const renderBudgetingSubTabContent = () => {
    switch (activeBudgetingSubTab) {
      case 'templates':
        return <BudgetingTab organisation={organisation} theme={theme} currentUser={currentUser} />;
      case 'budgetableGLs':
        return <BudgetGLsTab organisation={organisation} theme={theme} />;
      case 'activeCalendars':
        return <ActiveCalendarsTab organisation={organisation} theme={theme} setActiveSubTab={setActiveBudgetingSubTab} />;
      case 'periods':
        return <PeriodsTab organisation={organisation} theme={theme} setActiveSubTab={setActiveBudgetingSubTab} />;
      case 'calendarConfig':
        return <CalendarConfigTab organisation={organisation} theme={theme} />;
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Admin Settings for {module.name}</h2>
            <p className="text-gray-600">
              This is the dedicated admin page for the Finance (FI) module.
              Configuration options for chart of accounts, fiscal periods, and approval workflows will be managed here.
            </p>
          </div>
        );
      case 'postingRules':
        return <div className="mt-6"><PostingRulesTab organisation={organisation} /></div>;
      case 'currencies':
        return <div className="mt-6"><CurrencySetupTab organisation={organisation} theme={theme} /></div>;
      case 'budgeting':
        const SubTabButton: React.FC<{ tabId: string; label: string }> = ({ tabId, label }) => (
            <button
              onClick={() => setActiveBudgetingSubTab(tabId)}
              className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeBudgetingSubTab === tabId
                  ? 'text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
              style={activeBudgetingSubTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
            >
              {label}
            </button>
          );
        return (
            <div className="mt-6">
                <div className="mb-6 pb-4 border-b border-slate-200 overflow-x-auto">
                    <nav className="flex space-x-2" aria-label="Budgeting Sub-tabs">
                        {budgetingSubTabs.map(subTab => (
                            <SubTabButton key={subTab.id} tabId={subTab.id} label={subTab.label} />
                        ))}
                    </nav>
                </div>
                {renderBudgetingSubTabContent()}
            </div>
        );
      case 'glAccounts':
        return <div className="mt-6"><GLAccountsTab organisation={organisation} /></div>;
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
        <div>
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default FiAdminPage;