import React from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import WorkOrderDashboard from '../../../am/work_orders/WorkOrderDashboard';

interface WorkOrderDashboardTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const WorkOrderDashboardTab: React.FC<WorkOrderDashboardTabProps> = ({ currentUser, theme, organisation }) => {
    return (
        <div className="p-4 md:p-6">
            <WorkOrderDashboard
                currentUser={currentUser}
                theme={theme}
                organisation={organisation}
            />
        </div>
    );
};

export default WorkOrderDashboardTab;