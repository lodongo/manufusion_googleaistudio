import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import type { MaintenancePlan } from '../../../../../types/am_types';
import { MaintenancePlanList } from '../../../am/maintenance_plans/MaintenancePlanList';
import CreateMaintenancePlanModal from '../../../am/maintenance_plans/CreateMaintenancePlanModal';

interface PlannedCorrectiveMaintenanceSubTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onSelectPlan: (plan: MaintenancePlan) => void;
}

const PlannedCorrectiveMaintenanceSubTab: React.FC<PlannedCorrectiveMaintenanceSubTabProps> = ({ currentUser, theme, organisation, onSelectPlan }) => {
    const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);

    return (
        <div className="p-6">
            <MaintenancePlanList
                organisation={organisation}
                theme={theme}
                onSelectPlan={onSelectPlan}
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
    );
};

export default PlannedCorrectiveMaintenanceSubTab;