import React from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import WorkRequestDashboard from '../../../am/work_requests/WorkRequestDashboard';

interface WorkRequestDashboardSubTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const WorkRequestDashboardSubTab: React.FC<WorkRequestDashboardSubTabProps> = ({ currentUser, theme, organisation }) => {
    return (
        <div className="p-4 md:p-6">
            <WorkRequestDashboard
                currentUser={currentUser}
                theme={theme}
                organisation={organisation}
            />
        </div>
    );
};

export default WorkRequestDashboardSubTab;