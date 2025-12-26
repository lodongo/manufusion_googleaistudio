import React from 'react';
import type { Organisation } from '../../../../../types';
import PmDashboard from '../../../am/planned_jobs/PmDashboard';

interface PmDashboardSubTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

const PmDashboardSubTab: React.FC<PmDashboardSubTabProps> = ({ organisation, theme }) => {
    return (
        <div className="p-4 md:p-6">
            <PmDashboard
                organisation={organisation}
                theme={theme}
            />
        </div>
    );
};

export default PmDashboardSubTab;