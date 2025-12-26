
import React from 'react';
import OrgEmployees from '../../org/OrgEmployees';
import EmployeeProfile from '../../org/EmployeeProfile';
import type { AppUser, Organisation } from '../../../types';

interface SetupEmployeesProps {
    editingEmployeeUid: string | null;
    setEditingEmployeeUid: (uid: string | null) => void;
    currentUserProfile: AppUser;
    theme: Organisation['theme'];
}

export const SetupEmployees: React.FC<SetupEmployeesProps> = ({ 
    editingEmployeeUid, 
    setEditingEmployeeUid, 
    currentUserProfile, 
    theme 
}) => {
    return editingEmployeeUid ? (
        <EmployeeProfile 
            employeeUid={editingEmployeeUid} 
            onBack={() => setEditingEmployeeUid(null)} 
            currentUserProfile={currentUserProfile}
            theme={theme}
        />
    ) : (
        <OrgEmployees 
            currentUserProfile={currentUserProfile} 
            onEditEmployee={(uid) => setEditingEmployeeUid(uid)}
            onAddEmployee={() => setEditingEmployeeUid('new')}
            theme={theme}
        />
    );
};
