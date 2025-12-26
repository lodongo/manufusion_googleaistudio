
import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../../types';
import type { MaintenancePlan, WorkOrder } from '../../../../types/am_types';
import MaintenancePlanDetail from './MaintenancePlanDetail';
import { MaintenancePlanList } from './MaintenancePlanList';
import CreateMaintenancePlanModal from './CreateMaintenancePlanModal';

interface MaintenancePlansTabProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
    organisation: Organisation;
    selectedPlan: MaintenancePlan | null;
    setSelectedPlan: (plan: MaintenancePlan | null) => void;
    onViewWorkOrder: (workOrder: WorkOrder) => void;
}

const MaintenancePlansTab: React.FC<MaintenancePlansTabProps> = ({ 
    currentUser, 
    theme, 
    organisation, 
    selectedPlan, 
    setSelectedPlan, 
    onViewWorkOrder 
}) => {
    const [subTab, setSubTab] = useState<'planned_corrective' | 'planned_overhauls'>('planned_corrective');
    const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);

    const tabs = [
        { id: 'planned_corrective', label: 'Planned Corrective Maintenance' },
        { id: 'planned_overhauls', label: 'Planned Overhauls' },
    ];

    const SubTabButton: React.FC<{ tabId: string, label: string, active: string, onClick: (id: string) => void }> = ({ tabId, label, active, onClick }) => (
        <button
          onClick={() => onClick(tabId)}
          className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            active === tabId
              ? 'text-white'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
          style={active === tabId ? { backgroundColor: theme.colorPrimary } : {}}
        >
          {label}
        </button>
    );

    if (selectedPlan) {
        return (
            <MaintenancePlanDetail 
                plan={selectedPlan} 
                onBack={() => setSelectedPlan(null)} 
                onViewWorkOrder={onViewWorkOrder}
                organisation={organisation}
                currentUser={currentUser}
                theme={theme}
            />
        );
    }

    return (
        <div className="bg-white rounded-b-lg shadow-md">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                <nav className="flex space-x-2" aria-label="Maintenance Plan Tabs">
                    {tabs.map(tab => (
                        <SubTabButton 
                            key={tab.id} 
                            tabId={tab.id} 
                            label={tab.label} 
                            active={subTab} 
                            onClick={(id) => setSubTab(id as any)} 
                        />
                    ))}
                </nav>
            </div>
            
            <div className="p-6">
                {subTab === 'planned_corrective' && (
                    <>
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
                    </>
                )}
                {subTab === 'planned_overhauls' && (
                    <div className="p-8 text-center text-slate-500">
                        Planned Overhauls functionality is under development.
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaintenancePlansTab;
