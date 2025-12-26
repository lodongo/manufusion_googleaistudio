import React from 'react';
import type { Organisation } from '../../../../../types';
import PreventiveMaintenanceTab from '../../../am/admin/PreventiveMaintenanceTab';

interface PmSetupSubTabProps {
  theme: Organisation['theme'];
  organisation: Organisation;
}

const PmSetupSubTab: React.FC<PmSetupSubTabProps> = ({ theme, organisation }) => {
    return (
        <div className="p-4 md:p-6">
            <PreventiveMaintenanceTab
                theme={theme}
                organisation={organisation}
                mode="user" // This is important to ensure it's in user-facing mode
            />
        </div>
    );
};

export default PmSetupSubTab;