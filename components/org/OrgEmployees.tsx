
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { AppUser, Organisation } from '../../types';
import type { Role, EmploymentHistoryEntry } from '../../types/hr_types';
import { levelInfo } from './HierarchyNodeModal';

interface OrgEmployeesProps {
  currentUserProfile: AppUser;
  onEditEmployee: (uid: string) => void;
  onAddEmployee: () => void;
  theme: Organisation['theme'];
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;

const OrgEmployees: React.FC<OrgEmployeesProps> = ({ currentUserProfile, onEditEmployee, onAddEmployee, theme }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [level2Filter, setLevel2Filter] = useState('');

  useEffect(() => {
    if (!currentUserProfile.domain) {
        setLoading(false);
        return;
    }
    const usersQuery = db.collection("users").where("domain", "==", currentUserProfile.domain);
    
    const unsubscribeUsers = usersQuery.onSnapshot((querySnapshot) => {
      const usersData: AppUser[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ ...doc.data(), uid: doc.id } as AppUser);
      });
      usersData.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching org users:", error);
      setLoading(false);
    });

    const rolesCollectionRef = collection(db, 'organisations', currentUserProfile.domain, 'roles');
    const unsubscribeRoles = onSnapshot(query(rolesCollectionRef), snapshot => {
        setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
    }, (error) => {
        console.error("Error fetching roles:", error);
    });

    return () => {
        unsubscribeUsers();
        unsubscribeRoles();
    };
  }, [currentUserProfile.domain]);

  const level2Options = useMemo(() => {
    const level2s = new Map<string, string>();
    users.forEach(user => {
        if (user.allocationLevel2Id && user.allocationLevel2Name) {
            level2s.set(user.allocationLevel2Id, user.allocationLevel2Name);
        }
    });
    return Array.from(level2s.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const activeAndDisabledUsers = useMemo(() => {
    return users.filter(user => user.status !== 'deleted');
  }, [users]);

  const filteredUsers = useMemo(() => {
    let filtered = activeAndDisabledUsers;

    if (level2Filter) {
        filtered = filtered.filter(user => user.allocationLevel2Id === level2Filter);
    }
    
    if (filter) {
        const lowercasedFilter = filter.toLowerCase();
        filtered = filtered.filter(user =>
          (`${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(lowercasedFilter)) ||
          (user.email || '').toLowerCase().includes(lowercasedFilter) ||
          (user.employeeCode || '').toLowerCase().includes(lowercasedFilter)
        );
    }
    
    return filtered;
  }, [activeAndDisabledUsers, filter, level2Filter]);

  const rolesMap = useMemo(() => new Map(roles.map(role => [role.id, role])), [roles]);

  const getCurrentRole = useCallback((user: AppUser): { name: string; code: string; type: string } | null => {
      if (!user.employmentHistory) return null;
      const currentRoles = user.employmentHistory.filter(h => !h.archived);
      if (currentRoles.length === 0) return null;

      const acting = currentRoles.find(r => r.employmentType === 'Acting');
      const substantive = currentRoles
        .filter(r => r.employmentType !== 'Acting')
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
      
      const displayRoleHistory = acting || substantive;
      if (!displayRoleHistory) return null;

      const roleDetails = rolesMap.get(displayRoleHistory.roleId);

      return {
          name: displayRoleHistory.roleName,
          code: roleDetails?.code || 'N/A',
          type: displayRoleHistory.employmentType,
      };
  }, [rolesMap]);

  if (loading) {
    return <div className="flex justify-center items-center p-8"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Employee Management</h2>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <select
            value={level2Filter}
            onChange={e => setLevel2Filter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label={`Filter by ${levelInfo[2].name}`}
          >
              <option value="">All {levelInfo[2].name}s</option>
              {level2Options.map(option => (
                  <option key={option.id} value={option.id}>{option.name}</option>
              ))}
          </select>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name, email, code..."
            className="w-full md:w-64 px-3 py-2 border border-slate-300 rounded-md shadow-sm"
          />
          <button
              onClick={onAddEmployee}
              className="w-full md:w-auto px-4 py-2 text-white rounded-md hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: theme.colorPrimary }}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add New Employee
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No employees found.
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => {
                const currentRole = getCurrentRole(user);
                return (
                <tr key={user.uid} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => onEditEmployee(user.uid)} className="flex items-center text-left">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img className="h-10 w-10 rounded-full object-cover" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`} alt="" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{user.firstName} {user.lastName}</div>
                        <div className="text-xs text-slate-500 font-mono bg-slate-100 px-1 rounded inline-block">{user.employeeCode || 'No Code'}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {currentRole ? (
                        <div>
                            <div className="font-medium text-slate-900">{currentRole.name}</div>
                            <div className="text-xs font-mono bg-slate-100 px-1 rounded inline-block">{currentRole.code}</div>
                        </div>
                    ) : (user.jobTitle || 'N/A')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{currentRole ? currentRole.type : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.allocationLevel3Name || user.allocationLevel2Name || user.allocationLevel1Name || 'Unassigned'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div>{user.email}</div>
                    <div>{user.phoneNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                      {user.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => onEditEmployee(user.uid)} className="p-2 rounded-full hover:bg-blue-100 transition-colors" style={{ color: theme.colorPrimary }}>
                      <EditIcon />
                    </button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrgEmployees;
