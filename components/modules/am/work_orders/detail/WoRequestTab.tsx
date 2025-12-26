
import React from 'react';
import type { WorkOrder } from '../../../../../types/am_types';
import WorkOrderRequestDetails from '../WorkOrderRequestDetails';

interface WoRequestTabProps {
    workOrder: WorkOrder;
}

const WoRequestTab: React.FC<WoRequestTabProps> = ({ workOrder }) => {
    return (
        <div className="max-w-5xl mx-auto">
            <WorkOrderRequestDetails workOrder={workOrder} />
        </div>
    );
};

export default WoRequestTab;
