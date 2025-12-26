import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../../types';
import type { MaintenancePlan } from '../../../../types/am_types';
import MaintenancePlanDetail from '../../am/maintenance_plans/MaintenancePlanDetail';
import PmDashboardSubTab from './planned_jobs/PmDashboardSubTab';
import PlannedSchedulesSubTab from './planned_jobs/PlannedSchedulesSubTab';
import PmSetupSubTab from './planned_jobs/PmSetupSubTab';

interface PlannedJobsTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  selectedPlan: MaintenancePlan | null;
  setSelectedPlan: (plan: MaintenancePlan | null) => void;
  onViewWorkOrder: (workOrder: any) => void; // Assuming it can be WorkOrder or any related type
}

type SubTab = 'dashboard' | 'schedules' | 'setup';

const PlannedJobsTab: React.FC<PlannedJobsTabProps> = ({ currentUser, theme, organisation, selectedPlan, setSelectedPlan, onViewWorkOrder }) => {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');

  const SubTabButton: React.FC<{ tabId: SubTab, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setSubTab(tabId)}
      className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
        subTab === tabId
          ? 'text-white'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
      style={subTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  if (selectedPlan) {
    return (
        <div className="bg-white rounded-b-lg shadow-md">
            <MaintenancePlanDetail
                plan={selectedPlan}
                onBack={() => setSelectedPlan(null)}
                onViewWorkOrder={onViewWorkOrder}
                organisation={organisation}
                currentUser={currentUser}
                theme={theme}
            />
        </div>
    );
  }

  return (
    <div className="bg-white rounded-b-lg shadow-md">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
        <nav className="flex space-x-2" aria-label="Planned Jobs Sub Tabs">
          <SubTabButton tabId="dashboard" label="Dashboard" />
          <SubTabButton tabId="schedules" label="Schedule Calls" />
          <SubTabButton tabId="setup" label="Setup" />
        </nav>
      </div>
      <div>
        {subTab === 'dashboard' && <PmDashboardSubTab organisation={organisation} theme={theme} />}
        {subTab === 'schedules' && <PlannedSchedulesSubTab organisation={organisation} theme={theme} onSelectPlan={setSelectedPlan} />}
        {subTab === 'setup' && <PmSetupSubTab organisation={organisation} theme={theme} />}
      </div>
    </div>
  );
};

export default PlannedJobsTab;