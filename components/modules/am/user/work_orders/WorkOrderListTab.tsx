import React from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import type { WorkOrder } from '../../../../../types/am_types';
import WorkOrderList from '../../../am/work_orders/WorkOrderList';

interface WorkOrderListTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
  viewMode: 'open' | 'closed';
}

const WorkOrderListTab: React.FC<WorkOrderListTabProps> = ({ currentUser, theme, organisation, onSelectWorkOrder, viewMode }) => {
    return (
        <div className="p-4 md:p-6">
            <WorkOrderList
                currentUser={currentUser}
                theme={theme}
                organisation={organisation}
                onSelectWorkOrder={onSelectWorkOrder}
                viewMode={viewMode}
            />
        </div>
    );
};

export default WorkOrderListTab;