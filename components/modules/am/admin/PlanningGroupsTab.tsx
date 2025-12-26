import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { PlanningGroup } from '../../../../types/am_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import PlanningGroupModal from './PlanningGroupModal';
import PlanningGroupScopeModal from './PlanningGroupScopeModal';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

interface PlanningGroupsTabProps {
  theme: Organisation['theme'];
  organisation: Organisation;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ScopeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

const PlanningGroupsTab: React.FC<PlanningGroupsTabProps> = ({ theme, organisation }) => {
  const [groups, setGroups] = useState<PlanningGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PlanningGroup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlanningGroup | null>(null);

  useEffect(() => {
    const groupsRef = collection(db, `organisations/${organisation.domain}/modules/AM/planningGroups`);
    const q = query(groupsRef, orderBy('code'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanningGroup)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching planning groups:", error);
      setLoading(false);
    });
    
    return () => unsub();
  }, [organisation.domain]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/AM/planningGroups`, confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete group.");
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading planning groups...</div>;

  return (
    <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Planning Groups</h2>
          <p className="text-sm text-slate-500 mt-1">Manage organizational groups for maintenance planning. Groups can be created and then assigned specific sections.</p>
        </div>
        <button 
          onClick={() => { setSelectedGroup(null); setIsModalOpen(true); }}
          className="px-4 py-2 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ backgroundColor: theme?.colorPrimary }}
        >
          <span>+</span> Add New Group
        </button>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Group Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Sections</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No planning groups defined. Click "Add New Group" to begin.</td>
              </tr>
            ) : (
              groups.map(group => (
                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-mono text-xs font-bold rounded border border-indigo-100">{group.code}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-800">{group.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-500 truncate max-w-xs">{group.description || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${group.assignedSections?.length ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {group.assignedSections?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedGroup(group); setIsScopeModalOpen(true); }}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors border border-blue-200"
                        title="Manage Assigned Sections"
                      >
                        <ScopeIcon /> <span className="text-[10px] font-bold uppercase">Scope</span>
                      </button>
                      <button onClick={() => { setSelectedGroup(group); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><EditIcon /></button>
                      <button onClick={() => setConfirmDelete(group)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><DeleteIcon /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PlanningGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organisation={organisation}
        theme={theme}
        groupToEdit={selectedGroup}
      />

      {selectedGroup && (
        <PlanningGroupScopeModal
          isOpen={isScopeModalOpen}
          onClose={() => setIsScopeModalOpen(false)}
          organisation={organisation}
          theme={theme}
          group={selectedGroup}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Planning Group?"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This will not delete the sections themselves, but they will be unassigned from this planning context.`}
        confirmButtonText="Delete Group"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default PlanningGroupsTab;