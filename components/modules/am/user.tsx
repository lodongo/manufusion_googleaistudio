import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { Module, AppUser, Organisation } from '../../../types';
import type { WorkOrder, MaintenancePlan } from '../../../types/am_types';

// New tab component imports
import AmDashboardTab from './user/AmDashboardTab';
import WorkRequestsTab from './user/WorkRequestsTab';
import WorkOrdersTab from './user/WorkOrdersTab';
import MaintenancePlansTab from './user/MaintenancePlansTab';
import PlannedJobsTab from './user/PlannedJobsTab';
import CapitalAssetsTab from './user/CapitalAssetsTab';

interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const AmUserPage: React.FC<ModulePageProps> = ({ module, currentUser, onSwitchToAdmin, onBackToDashboard, theme, organisation }) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  const [activeTab, setActiveTab] = useState('work_requests');
  
  // State for Work Orders Tab
  const [activeWorkOrder, setActiveWorkOrder] = useState<WorkOrder | null>(null);
  
  // State for Maintenance Plans & Planned Jobs Tabs
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);

  // Helper to view a Work Order from any tab
  const handleViewWorkOrder = (workOrder: WorkOrder) => {
    setActiveTab('work_orders');
    setActiveWorkOrder(workOrder);
  };
  
  // Helper to view a Maintenance Plan from any tab
  const handleViewPlan = (plan: MaintenancePlan) => {
    setActiveTab('maintenance_plans');
    setSelectedPlan(plan);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'work_requests', label: 'Work Requests' },
    { id: 'work_orders', label: 'Work Orders' },
    { id: 'maintenance_plans', label: 'Maintenance Plans' },
    { id: 'planned_jobs', label: 'PM Schedules' },
    { id: 'capital_assets', label: 'Capital Assets' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => {
        setActiveTab(tabId);
        // Reset specific detail views when changing main tabs
        setActiveWorkOrder(null);
        setSelectedPlan(null);
      }}
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
      case 'dashboard':
        return <AmDashboardTab currentUser={currentUser} theme={theme} organisation={organisation} />;
      case 'work_requests':
        return <WorkRequestsTab currentUser={currentUser} theme={theme} organisation={organisation} onViewWorkOrder={handleViewWorkOrder} />;
      case 'work_orders':
        return <WorkOrdersTab currentUser={currentUser} theme={theme} organisation={organisation} activeWorkOrder={activeWorkOrder} setActiveWorkOrder={setActiveWorkOrder} onViewPlan={handleViewPlan} />;
      case 'maintenance_plans':
        return <MaintenancePlansTab currentUser={currentUser} theme={theme} organisation={organisation} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} onViewWorkOrder={handleViewWorkOrder} />;
      case 'planned_jobs':
        return <PlannedJobsTab currentUser={currentUser} theme={theme} organisation={organisation} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} onViewWorkOrder={handleViewWorkOrder} />;
      case 'capital_assets':
        return <CapitalAssetsTab />;
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

export default AmUserPage;