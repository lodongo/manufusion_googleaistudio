import React from 'react';
import type { AppUser, Organisation } from '../../../../../types';
import type { WorkRequest } from '../../../../../types/am_types';
import CreateWorkRequest from '../../../am/work_requests/CreateWorkRequest';
import Button from '../../../../Button';

interface CreateWorkRequestTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onComplete: () => void;
  requestToEdit?: WorkRequest | null;
}

const CreateWorkRequestTab: React.FC<CreateWorkRequestTabProps> = ({ currentUser, theme, organisation, onComplete, requestToEdit }) => {
    return (
        <div className="p-4 md:p-6">
            <CreateWorkRequest
                currentUser={currentUser}
                theme={theme}
                organisation={organisation}
                onComplete={onComplete}
                requestToEdit={requestToEdit}
            />
        </div>
    );
};

export default CreateWorkRequestTab;