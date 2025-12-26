
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { Module, AppUser, Organisation } from '../../../types';
// FIX: The 'WorkRequest' type was imported from 'am_types' but not used directly. Remove them to clean up the code.
import type { WorkOrder, WorkOrderTask, MaintenancePlan } from '../../../types/am_types';
import CreateWorkRequest from './am/work_requests/CreateWorkRequest';
import WorkRequestDashboard from './am/work_requests/WorkRequestDashboard';
import { WorkRequestList } from './am/work_requests/WorkRequestList';
import WorkOrderList from './am/work_orders/WorkOrderList';
// FIX: Changed default import to named import.
import { WorkOrderDetail } from './am/work_orders/WorkOrderDetail';
// FIX: Changed to named import to resolve "no default export" error.
import { WorkOrderTaskDetail } from './am/work_orders/WorkOrderTaskDetail';
// FIX: The 'Modal', 'Input', and 'Button' components were imported but not used. Remove these unused imports to clean up the code.
import MaintenancePlanDetail from './am/maintenance_plans/MaintenancePlanDetail';
import { MaintenancePlanList } from './am/maintenance_plans/MaintenancePlanList';
import CreateMaintenancePlanModal from './am/maintenance_plans/CreateMaintenancePlanModal';
import PlannedJobsList from './am/planned_jobs/PlannedJobsList';
import PreventiveMaintenanceTab from './am/admin/PreventiveMaintenanceTab';
import PmDashboard from './am/planned_jobs/PmDashboard';


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
  const [workRequestSubTab, setWorkRequestSubTab] = useState('list');
  const [requestToEdit, setRequestToEdit] = useState<any | null>(null);
  const [activeWorkOrder, setActiveWorkOrder] = useState<WorkOrder | null>(null);
  const [activeTask, setActiveTask] = useState<WorkOrderTask | 'new' | null>(null);
  const [maintenancePlanSubTab, setMaintenancePlanSubTab] = useState('planned_corrective');
  
  // FIX: Initialize `selectedPlan` with its own state.
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);

  useEffect(() => {
    if (activeTab !== 'work_orders') {
        setActiveWorkOrder(null);
        setActiveTask(null);
    }
    if (activeTab !== 'maintenance_plans' && activeTab !== 'planned_jobs') {
        setSelectedPlan(null);
    }
  }, [activeTab]);

  const handleViewWorkOrderFromPlan = (workOrder: WorkOrder) => {
    setActiveTab('work_orders');
    setActiveWorkOrder(workOrder);
    setSelectedPlan(null);
  }
  
  const handleViewPlanFromWO = async (planId: string) => {
    const plansRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('maintenancePlans');
    const q = plansRef.where('planId', '==', planId);
    const snapshot = await q.get();
    if (!snapshot.empty) {
        const plan = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as MaintenancePlan;
        setActiveTab('maintenance_plans');
        setSelectedPlan(plan);
        setActiveWorkOrder(null); // Ensure we switch view context
    } else {
        alert(`Could not find Maintenance Plan with ID: ${planId}`);
    }
  }


  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'work_requests', label: 'Work Requests' },
    { id: 'work_orders', label: 'Work Orders' },
    { id: 'maintenance_plans', label: 'Maintenance Plans' },
    { id: 'planned_jobs', label: 'PM Schedules' },
    { id: 'capital_assets', label: 'Capital Assets' },
  ];
  
  const workRequestTabs = [
    { id: 'create', label: 'Create Request' },
    { id: 'list', label: 'Request List' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  const maintenancePlanTabs = [
      { id: 'planned_corrective', label: 'Planned Corrective Maintenance' },
      { id: 'planned_overhauls', label: 'Planned Overhauls' },
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
      aria-current={activeTab === tabId ? 'page' : undefined}
    >
      {label}
    </button>
  );
  
  const SubTabButton: React.FC<{ tabId: string, label: string, active: string, setActive: (id: any) => void }> = ({ tabId, label, active, setActive }) => (
    <button
      onClick={() => {
        if (tabId === 'create') {
            setRequestToEdit(null); // Clear any edits if "Create" is clicked directly
        }
        setActive(tabId);
      }}
      className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
        active === tabId
          ? 'text-white'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
      style={active === tabId ? { backgroundColor: theme.colorPrimary } : {}}
      aria-current={active === tabId ? 'page' : undefined}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="bg-white p-8 rounded-b-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Welcome to the {module.name} Dashboard</h2>
            <p className="text-gray-600">
              This is the main dashboard for the Asset Management (AM) module. Future functionality like asset tracking summaries, maintenance KPIs, and lifecycle reports will be displayed here.
            </p>
          </div>
        );
      case 'work_requests':
        return (
            <div className="bg-white rounded-b-lg shadow-md">
                 <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                    <nav className="flex space-x-2" aria-label="Work Request Tabs">
                        {workRequestTabs.map(tab => (
                            <SubTabButton key={tab.id} tabId={tab.id} label={tab.label} active={workRequestSubTab} setActive={setWorkRequestSubTab} />
                        ))}
                    </nav>
                </div>
                <div className="p-4 md:p-6">
                    {workRequestSubTab === 'dashboard' && <WorkRequestDashboard currentUser={currentUser} theme={theme} organisation={organisation} />}
                    {workRequestSubTab === 'list' && <WorkRequestList currentUser={currentUser} theme={theme} organisation={organisation} onEditRequest={(request) => {
                        setRequestToEdit(request);
                        setWorkRequestSubTab('create');
                    }} onViewWorkOrder={handleViewWorkOrderFromPlan} viewMode="new" />}
                    {workRequestSubTab === 'create' && <CreateWorkRequest currentUser={currentUser} theme={theme} organisation={organisation} onComplete={() => {
                        setWorkRequestSubTab('list');
                        setRequestToEdit(null);
                    }} requestToEdit={requestToEdit} />}
                </div>
            </div>
        );
      case 'work_orders':
        if (activeTask && activeWorkOrder) {
            return (
                <div className="bg-white rounded-b-lg shadow-md">
                    <WorkOrderTaskDetail
                        workOrder={activeWorkOrder}
                        task={activeTask === 'new' ? null : activeTask}
                        onBack={() => setActiveTask(null)}
                        currentUser={currentUser}
                        organisation={organisation}
                        theme={theme}
                    />
                </div>
            );
        }
        return (
          <div className="bg-white rounded-b-lg shadow-md">
              {activeWorkOrder ? (
                  <WorkOrderDetail 
                      workOrder={activeWorkOrder}
                      onBack={() => setActiveWorkOrder(null)}
                      onSelectTask={(task) => setActiveTask(task)}
                      onViewPlan={handleViewPlanFromWO}
                      theme={theme}
                      currentUser={currentUser}
                      organisation={organisation}
                  />
              ) : (
                  <div className="p-4 md:p-6">
                      <WorkOrderList 
                          currentUser={currentUser}
                          theme={theme}
                          organisation={organisation}
                          onSelectWorkOrder={(wo) => setActiveWorkOrder(wo)}
                          viewMode="open"
                      />
                  </div>
              )}
          </div>
        );
      case 'maintenance_plans':
          if (selectedPlan) {
              return <MaintenancePlanDetail 
                  plan={selectedPlan} 
                  onBack={() => setSelectedPlan(null)} 
                  onViewWorkOrder={handleViewWorkOrderFromPlan}
                  organisation={organisation}
                  currentUser={currentUser}
                  theme={theme}
              />
          }
          return (
            <div className="bg-white rounded-b-lg shadow-md">
                 <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                    <nav className="flex space-x-2" aria-label="Maintenance Plan Tabs">
                        {maintenancePlanTabs.map(tab => (
                            <SubTabButton key={tab.id} tabId={tab.id} label={tab.label} active={maintenancePlanSubTab} setActive={setMaintenancePlanSubTab} />
                        ))}
                    </nav>
                </div>
                {maintenancePlanSubTab === 'planned_corrective' && (
                    <div className="p-6">
                        <MaintenancePlanList 
                            organisation={organisation}
                            theme={theme}
                            onSelectPlan={setSelectedPlan}
                            onCreatePlan={() => setIsCreatePlanModalOpen(true)}
                            currentUser={currentUser}
                        />
                        <CreateMaintenancePlanModal
                            isOpen={isCreatePlanModalOpen}
                            onClose={() => setIsCreatePlanModalOpen(false)}
                            currentUser={currentUser}
                            organisation={organisation}
                        />
                    </div>
                )}
                {maintenancePlanSubTab === 'planned_overhauls' && <div className="p-8 text-center text-slate-500">Planned Overhauls functionality is under development.</div>}
            </div>
          );
      case 'planned_jobs':
        if (selectedPlan) {
            return (
                <div className="bg-white rounded-b-lg shadow-md">
                    <MaintenancePlanDetail 
                        plan={selectedPlan}
                        onBack={() => setSelectedPlan(null)}
                        onViewWorkOrder={handleViewWorkOrderFromPlan}
                        organisation={organisation}
                        currentUser={currentUser}
                        theme={theme}
                    />
                </div>
            )
        }
        return (
            <div className="bg-white rounded-b-lg shadow-md">
                 <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                    <nav className="flex space-x-2" aria-label="Planned Jobs Sub Tabs">
                        <SubTabButton 
                            tabId="dashboard" 
                            label="Dashboard" 
                            active={plannedJobsSubTab} 
                            setActive={setPlannedJobsSubTab} 
                        />
                        <SubTabButton 
                            tabId="schedules" 
                            label="Schedule Calls" 
                            active={plannedJobsSubTab} 
                            setActive={setPlannedJobsSubTab} 
                        />
                        <SubTabButton 
                            tabId="setup" 
                            label="Setup" 
                            active={plannedJobsSubTab} 
                            setActive={setPlannedJobsSubTab} 
                        />
                    </nav>
                </div>
                <div>
                    {plannedJobsSubTab === 'dashboard' && (
                        <PmDashboard organisation={organisation} theme={theme} />
                    )}
                    {plannedJobsSubTab === 'schedules' && (
                        <PlannedJobsList 
                            theme={theme} 
                            onOpenSchedules={() => {}} // Handle opening modal if needed, or pass prop
                            organisation={organisation}
                            onSelectPlan={setSelectedPlan}
                        />
                    )}
                    {plannedJobsSubTab === 'setup' && (
                        <PreventiveMaintenanceTab 
                            theme={theme} 
                            organisation={organisation} 
                            mode="user" 
                        />
                    )}
                </div>
            </div>
        );
      case 'capital_assets':
        return <div className="bg-white p-8 rounded-b-lg shadow-md"><h2 className="text-xl font-semibold mb-4">Capital Assets</h2><p className="text-gray-600">View and manage the complete register of your organization's capital assets, including their history, value, and lifecycle status.</p></div>;
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
