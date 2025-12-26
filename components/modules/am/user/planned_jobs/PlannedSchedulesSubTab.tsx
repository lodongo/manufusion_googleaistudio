import React from 'react';
import type { Organisation } from '../../../../../types';
import type { MaintenancePlan } from '../../../../../types/am_types';
import PlannedJobsList from '../../../am/planned_jobs/PlannedJobsList';

interface PlannedSchedulesSubTabProps {
  theme: Organisation['theme'];
  organisation: Organisation;
  onSelectPlan: (plan: MaintenancePlan) => void;
}

const PlannedSchedulesSubTab: React.FC<PlannedSchedulesSubTabProps> = ({ theme, organisation, onSelectPlan }) => {
    return (
        <div className="p-4 md:p-6">
            <PlannedJobsList
                theme={theme}
                onOpenSchedules={() => {}} // Placeholder for now, could open a modal in parent
                organisation={organisation}
                onSelectPlan={onSelectPlan}
            />
        </div>
    );
};

export default PlannedSchedulesSubTab;