import React from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import type { WorkRequest, WorkOrder } from '../../../../../types/am_types';
import { WorkRequestList } from '../../../am/work_requests/WorkRequestList';

interface WorkRequestListTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onEditRequest: (request: WorkRequest) => void;
  onViewWorkOrder?: (workOrder: WorkOrder) => void;
  viewMode: 'new' | 'converted';
  onCreate?: () => void;
}

const WorkRequestListTab: React.FC<WorkRequestListTabProps> = ({ currentUser, theme, organisation, onEditRequest, onViewWorkOrder, viewMode, onCreate }) => {
    return (
        <div className="p-4 md:p-6">
            <WorkRequestList
                currentUser={currentUser}
                theme={theme}
                organisation={organisation}
                onEditRequest={onEditRequest}
                onViewWorkOrder={onViewWorkOrder}
                viewMode={viewMode}
                onCreate={onCreate}
            />
        </div>
    );
};

export default WorkRequestListTab;