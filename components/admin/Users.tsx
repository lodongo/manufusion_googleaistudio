
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import type { AppUser } from '../../types';

interface UsersProps {
  onUserSelect: (user: AppUser) => void;
  onAddUser: () => void;
  currentUserProfile: AppUser;
}

// Icon Components for Actions
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;

const Users: React.FC<UsersProps> = ({ onUserSelect, onAddUser, currentUserProfile }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const isAdmin = currentUserProfile.accessLevel === 5;

  useEffect(() => {
    const q = db.collection("users").where("domain", "==", "manufusion.com");
    
    const unsubscribe = q.onSnapshot((querySnapshot) => {
      const usersData: AppUser[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ ...doc.data(), uid: doc.id } as AppUser);
      });
      // Sort users by name
      usersData.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeAndDisabledUsers = useMemo(() => {
    return users.filter(user => user.status !== 'deleted');
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!filter) return activeAndDisabledUsers;
    const lowercasedFilter = filter.toLowerCase();
    return activeAndDisabledUsers.filter(user =>
      (`${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(lowercasedFilter)) ||
      (user.email || '').toLowerCase().includes(lowercasedFilter) ||
      (user.phoneNumber && user.phoneNumber.includes(lowercasedFilter)) ||
      (user.uid || '').toLowerCase().includes(lowercasedFilter)
    );
  }, [activeAndDisabledUsers, filter]);


  if (loading) {
    return <div className="flex justify-center items-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-slate-800 self-start md:self-center">User Management</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter users..."
            className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
           {isAdmin && (
              <button
                  onClick={onAddUser}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  Add New User
              </button>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* User List for mobile */}
        <div className="divide-y divide-slate-200 md:hidden">
            {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No users found.</div>
            ) : (
                filteredUsers.map(user => (
                    <div key={user.uid} className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <img className="w-10 h-10 rounded-full object-cover mr-4" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`} alt={`${user.firstName} ${user.lastName}`} />
                                <div>
                                    <p className="text-slate-900 font-medium">{user.firstName} {user.lastName}</p>
                                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                                        {user.status === 'active' ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => onUserSelect(user)} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit user ${user.firstName}`}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className="mt-3 text-sm text-slate-600 space-y-1">
                            <p><strong className="font-medium text-slate-700">Email:</strong> {user.email}</p>
                            <p><strong className="font-medium text-slate-700">Phone:</strong> {user.phoneNumber}</p>
                            <p><strong className="font-medium text-slate-700">Access:</strong> {user.accessLevel}</p>
                        </div>
                    </div>
                ))
            )}
        </div>
        
        {/* User Table for desktop */}
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Contact</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Access</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                {filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-500">No users found.</td></tr>
                ) : (
                    filteredUsers.map(user => (
                    <tr key={user.uid} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                    <img className="h-10 w-10 rounded-full object-cover" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`} alt="" />
                                </div>
                                <div className="ml-4">
                                <div className="text-sm font-medium text-slate-900">{user.firstName} {user.lastName}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">{user.email}</div>
                            <div className="text-sm text-slate-500">{user.phoneNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">{user.accessLevel}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                                {user.status === 'active' ? 'Active' : 'Disabled'}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button onClick={() => onUserSelect(user)} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit user ${user.firstName}`}>
                                <EditIcon />
                            </button>
                        </td>
                    </tr>
                    ))
                )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Users;