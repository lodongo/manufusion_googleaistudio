import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { AppUser, Organisation } from '../../types';
import type { Role } from '../../types/hr_types';
import RoleModal from './RoleModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { addLog } from '../../services/logger';

interface OrgRolesProps {
  currentUserProfile: AppUser;
  theme: Organisation['theme'];
  readOnly?: boolean;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const OrgRoles: React.FC<OrgRolesProps> = ({ currentUserProfile, theme, readOnly = false }) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<{ isOpen: boolean; roleToEdit?: Role | null; parentRole?: Role | null }>({ isOpen: false });
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const orgDomain = currentUserProfile.domain;
    const rolesCollectionRef = collection(db, 'organisations', orgDomain, 'roles');

    useEffect(() => {
        const q = query(rolesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, snapshot => {
            setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching roles: ", error);
            setLoading(false);
        });
        return unsubscribe;
    }, [orgDomain]);

    const rolesWithLevels = useMemo(() => {
        if (!roles.length) return [];
        const roleMap = new Map(roles.map(r => [r.id, r]));
        const levelCache = new Map<string, number>();

        const getLevel = (roleId: string | null): number => {
            if (roleId === null) return -1;
            if (levelCache.has(roleId)) return levelCache.get(roleId)!;
            
            const role = roleMap.get(roleId);
            if (!role) {
                return 0;
            }

            const level = 1 + getLevel((role as Role).reportsToRoleId);
            levelCache.set(roleId, level);
            return level;
        };

        return roles.map(role => ({
            ...role,
            level: getLevel(role.id),
        }));
    }, [roles]);

    const roleTree = useMemo(() => {
        const childrenOf: Record<string, (Role & { level: number })[]> = {};
        rolesWithLevels.forEach(role => {
            const parentId = role.reportsToRoleId || 'root';
            if (!childrenOf[parentId]) {
                childrenOf[parentId] = [];
            }
            childrenOf[parentId].push(role);
        });
        
        const buildTree = (parentId: string): any[] => {
            if (!childrenOf[parentId]) return [];
            childrenOf[parentId].sort((a,b) => a.name.localeCompare(b.name));
            return childrenOf[parentId].map(child => ({
                ...child,
                children: buildTree(child.id)
            }));
        };
        
        return buildTree('root');
    }, [rolesWithLevels]);

    const handleDelete = (role: Role) => {
        const hasChildren = roles.some(r => r.reportsToRoleId === role.id);
        if (hasChildren) {
            alert("Cannot delete a role that has subordinate roles. Please re-assign or delete subordinates first.");
            return;
        }

        const onConfirm = async () => {
            setLoading(true);
            try {
                await deleteDoc(doc(rolesCollectionRef, role.id));
                await addLog({
                    action: 'Role Deleted',
                    performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
                    details: `Deleted role "${role.name}" (${role.code}) in ${orgDomain}.`
                });
            } catch (err) {
                console.error("Delete failed:", err);
            } finally {
                setLoading(false);
                setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            }
        };

        setConfirmModalState({
            isOpen: true,
            title: `Delete Role: ${role.name}?`,
            message: 'Are you sure you want to delete this role? This action cannot be undone.',
            onConfirm,
        });
    };

    const TreeList: React.FC<{ nodes: any[] }> = ({ nodes }) => {
        if (!nodes || nodes.length === 0) {
            return null;
        }
        return (
            <ul className="pl-8">
                {nodes.map((node, index) => (
                    <li key={node.id} className="relative list-none">
                        {/* The connector lines */}
                        <span className="absolute -left-[1.27rem] top-10 w-5 h-px bg-slate-300"></span> {/* Horizontal line */}
                        <span className={`absolute -left-[1.27rem] w-px bg-slate-300 ${index === nodes.length - 1 ? 'h-10 top-0' : 'h-full top-0'}`}></span> {/* Vertical line */}
                        
                        {/* The node content */}
                        <div className="py-2">
                            <div className={`bg-white p-3 border rounded-lg shadow-sm flex items-center justify-between ${!readOnly ? 'hover:bg-slate-50 transition-colors' : ''}`}>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{node.code}</span>
                                        {node.abbreviation && <span className="font-mono text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">{node.abbreviation}</span>}
                                        <span>{node.name}</span>
                                    </p>
                                    <p className="text-sm" style={{color: theme.colorPrimary}}>{node.careerProfessionName}</p>
                                    <p className="text-xs text-gray-500 mt-1">Department: {node.departmentName}</p>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setModalState({ isOpen: true, parentRole: node })} className="text-xs text-white px-2 py-1 rounded hover:opacity-90" style={{ backgroundColor: theme.colorSecondary || theme.colorPrimary }}>Add Subordinate</button>
                                        <button onClick={() => setModalState({ isOpen: true, roleToEdit: node })} className="p-2 hover:bg-blue-100 rounded-full" style={{ color: theme.colorPrimary }}><EditIcon /></button>
                                        <button onClick={() => handleDelete(node)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Recursive call for children */}
                        {node.children && node.children.length > 0 && (
                             <TreeList nodes={node.children} />
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Organization Roles</h3>
                {!readOnly && (
                    <button onClick={() => setModalState({ isOpen: true })} className="px-4 py-2 text-white rounded-md text-sm font-medium hover:opacity-90" style={{ backgroundColor: theme.colorPrimary }}>
                        + Add Top-Level Role
                    </button>
                )}
            </div>
            <p className="text-sm text-gray-600 mb-6">{readOnly ? 'This is a read-only view of the roles and their reporting structure.' : 'Define the roles within your organization and build the reporting structure.'}</p>
            {loading ? <p>Loading roles...</p> : (
                roleTree.length === 0 ? <p className="text-center text-gray-500 py-8">{readOnly ? 'No roles found.' : 'No roles defined yet. Start by adding a top-level role.'}</p> :
                <TreeList nodes={roleTree} />
            )}

            {!readOnly && modalState.isOpen && <RoleModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false })}
                currentUserProfile={currentUserProfile}
                roleToEdit={modalState.roleToEdit}
                parentRole={modalState.parentRole}
                allRoles={rolesWithLevels}
                theme={theme}
            />}

            {!readOnly && <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
                title={confirmModalState.title}
                message={confirmModalState.message}
                onConfirm={confirmModalState.onConfirm}
                isLoading={loading}
            />}
        </div>
    );
};

export default OrgRoles;