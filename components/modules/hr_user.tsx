
import React, { useState } from 'react';
import type { Module, AppUser, Organisation } from '../../types';
import { OrgHierarchy } from '../org/OrgHierarchy';
import OrgRoles from '../org/OrgRoles';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const HrUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [activeTab, setActiveTab] = useState('my_hr');
  const [myHrSubTab, setMyHrSubTab] = useState('leave');

  const tabs = [
    { id: 'my_hr', label: 'My HR' },
    { id: 'structure', label: 'Organisation Structure' },
    { id: 'roles', label: 'Roles' },
  ];

  const myHrTabs = [
      { id: 'leave', label: 'Leave' },
      { id: 'payslips', label: 'Payslips' },
      { id: 'performance', label: 'Performance Management' },
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
    >
      {label}
    </button>
  );

  const SubTabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
      <button
        onClick={() => setMyHrSubTab(tabId)}
        className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          myHrSubTab === tabId
            ? 'text-white'
            : 'text-slate-600 hover:bg-slate-200'
        }`}
        style={myHrSubTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
      >
        {label}
      </button>
    );

  const renderTabContent = () => {
      switch (activeTab) {
          case 'structure':
              return (
                  <div className="bg-white p-6 rounded-b-lg shadow-md">
                      <OrgHierarchy 
                          currentUserProfile={currentUser} 
                          organisationData={organisation} 
                          theme={theme} 
                          readOnly={true} 
                      />
                  </div>
              );
          case 'roles':
              return (
                  <div className="bg-white p-6 rounded-b-lg shadow-md">
                      <OrgRoles 
                          currentUserProfile={currentUser} 
                          theme={theme} 
                          readOnly={true} 
                      />
                  </div>
              );
          case 'my_hr':
              return (
                  <div className="bg-white rounded-b-lg shadow-md">
                      <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                          <nav className="flex space-x-2">
                              {myHrTabs.map(tab => <SubTabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
                          </nav>
                      </div>
                      <div className="p-8">
                          {myHrSubTab === 'leave' && (
                              <div className="text-center">
                                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Leave Management</h3>
                                  <p className="text-slate-600">View your leave balance, request time off, and check approval status.</p>
                                  <div className="mt-6 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                                      <p className="text-slate-500">Leave functionality coming soon.</p>
                                  </div>
                              </div>
                          )}
                          {myHrSubTab === 'payslips' && (
                              <div className="text-center">
                                  <h3 className="text-lg font-semibold text-slate-800 mb-2">My Payslips</h3>
                                  <p className="text-slate-600">Access and download your monthly payslips securely.</p>
                                  <div className="mt-6 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                                      <p className="text-slate-500">Payslip generation coming soon.</p>
                                  </div>
                              </div>
                          )}
                          {myHrSubTab === 'performance' && (
                              <div className="text-center">
                                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Performance Management</h3>
                                  <p className="text-slate-600">Track your goals, performance reviews, and feedback.</p>
                                   <div className="mt-6 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                                      <p className="text-slate-500">Performance module coming soon.</p>
                                  </div>
                              </div>
                          )}
                      </div>
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

export default HrUserPage;
