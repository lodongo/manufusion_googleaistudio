
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { AppUser, Organisation } from '../../types';
import HierarchyNodeModal, { HierarchyNode, levelInfo } from './HierarchyNodeModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { addLog } from '../../services/logger';
import 'firebase/compat/app';
import 'firebase/compat/firestore';

interface OrgHierarchyProps {
  currentUserProfile: AppUser;
  organisationData?: Organisation | null;
  theme: Organisation['theme'];
  readOnly?: boolean;
  maxLevel?: number;
  onConfigureNode?: (node: HierarchyNode) => void;
  onManageMaterial?: (node: HierarchyNode) => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = ({className = ''} : {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

export const OrgHierarchy: React.FC<OrgHierarchyProps> = ({ currentUserProfile, organisationData, theme, readOnly = false, maxLevel = 7, onConfigureNode, onManageMaterial }) => {
    const [tree, setTree] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
    const [modalState, setModalState] = useState<{ isOpen: boolean, nodeToEdit?: HierarchyNode, parentPath?: string, level: number, parentCode?: string | null }>({ isOpen: false, level: 1 });
    const [confirmDelete, setConfirmDelete] = useState<{ node: HierarchyNode, parentPath: string } | null>(null);

    const orgDomain = organisationData?.domain || currentUserProfile.domain;

    const fetchAndBuildTree = useCallback(async () => {
        setLoading(true);
        const level1Ref = collection(db, 'organisations', orgDomain, 'level_1');
        const q = query(level1Ref, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rootNodes = snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode));
            setTree(rootNodes);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching hierarchy:", error);
            setLoading(false);
        });
        return unsubscribe;
    }, [orgDomain]);

    useEffect(() => {
        const unsubscribe = fetchAndBuildTree();
        return () => { unsubscribe.then(unsub => unsub()); };
    }, [fetchAndBuildTree]);

    const handleToggle = (nodePath: string) => {
        setOpenNodes(prev => ({ ...prev, [nodePath]: !prev[nodePath] }));
    };

    const handleDeleteNode = async (node: HierarchyNode, parentPath: string) => {
        setLoading(true);
        try {
            const batch = writeBatch(db);

            const deleteChildren = async (path: string) => {
                const snapshot = await getDocs(collection(db, path));
                for (const doc of snapshot.docs) {
                    // Recursively delete sub-collections
                    // This is simplified. For deep structures, a cloud function is better.
                    // For now, let's assume we go a few levels deep.
                    for (let i = 1; i <= 7; i++) {
                        const subPath = `${doc.ref.path}/level_${i}`;
                        const subSnapshot = await getDocs(collection(db, subPath));
                        subSnapshot.forEach(subDoc => batch.delete(subDoc.ref));
                    }
                    batch.delete(doc.ref);
                }
            };
            
            // Delete the node itself
            batch.delete(doc(db, parentPath, node.id!));
            
            // Recursively delete children (simplified for client-side)
            for (let i = (node.code.split('-').length || 0) + 1; i <= 7; i++) {
                await deleteChildren(`${parentPath}/${node.id!}/level_${i}`);
            }

            await batch.commit();

            await addLog({
                action: 'Hierarchy Node Deleted',
                performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
                details: `Deleted node "${node.name}" (${node.code}) and its children from ${orgDomain}.`
            });
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setConfirmDelete(null);
            setLoading(false);
        }
    };
    
    const renderNode = (node: HierarchyNode, level: number, parentPath: string, parentCode: string | null = null, isLast: boolean) => {
        if (level > maxLevel) return null;
        
        const isWarehouse = node.sectionType?.startsWith('Capital Inventory');
        const isMaterial = level === 7;
        
        return (
            <li key={node.id} className="relative list-none">
                <span className="absolute -left-[1.27rem] top-10 w-5 h-px bg-slate-300"></span> {/* Horizontal line */}
                <span className={`absolute -left-[1.27rem] w-px bg-slate-300 ${isLast ? 'h-10 top-0' : 'h-full top-0'}`}></span> {/* Vertical line */}

                <div className="py-2">
                    <div className="bg-white p-3 border rounded-lg shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center" onClick={() => handleToggle(node.path!)}>
                            {level < maxLevel && <ChevronDownIcon className={openNodes[node.path!] ? 'rotate-180' : ''} />}
                            <div className="ml-2">
                                <p className="font-semibold text-gray-800">{node.name}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-mono bg-slate-100 px-1 rounded inline-block">{node.code}</span>
                                    {node.sectionType && <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{node.sectionType}</span>}
                                    {node.assetType && <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">{node.assetType}</span>}
                                </div>
                            </div>
                        </div>
                         {!readOnly && (
                            <div className="flex items-center space-x-1">
                                {isWarehouse && onConfigureNode && <button onClick={() => onConfigureNode(node)} className="text-xs text-white px-2 py-1 rounded hover:opacity-90" style={{ backgroundColor: theme.colorSecondary }}>Configure Warehouse</button>}
                                {isMaterial && onManageMaterial && <button onClick={() => onManageMaterial(node)} className="text-xs text-white px-2 py-1 rounded hover:opacity-90" style={{ backgroundColor: theme.colorSecondary }}>Manage Material</button>}
                                {level < maxLevel && <button onClick={() => setModalState({ isOpen: true, parentPath: node.path, level: level + 1, parentCode: node.code })} className="text-xs text-white px-2 py-1 rounded hover:opacity-90" style={{ backgroundColor: theme.colorPrimary }}>Add {levelInfo[level+1].name}</button>}
                                <button onClick={() => setModalState({ isOpen: true, nodeToEdit: node, parentPath, level, parentCode })} className="p-2 hover:bg-blue-100 rounded-full" style={{ color: theme.colorPrimary }}><EditIcon /></button>
                                <button onClick={() => setConfirmDelete({ node, parentPath })} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                            </div>
                        )}
                    </div>
                </div>

                {openNodes[node.path!] && level < maxLevel && (
                    <ul className="pl-8">
                        <NodeList parentPath={node.path!} level={level + 1} parentCode={node.code} />
                    </ul>
                )}
            </li>
        );
    };
    
    const NodeList: React.FC<{ parentPath: string, level: number, parentCode: string | null }> = ({ parentPath, level, parentCode }) => {
        const [nodes, setNodes] = useState<HierarchyNode[]>([]);
        const [listLoading, setListLoading] = useState(true);

        useEffect(() => {
            if (level > maxLevel) {
                setListLoading(false);
                return;
            }
            const collectionName = `level_${level}`;
            const q = query(collection(db, parentPath, collectionName), orderBy('name'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setNodes(snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode)));
                setListLoading(false);
            });
            return () => unsubscribe();
        }, [parentPath, level]);
        
        if (listLoading) return <li className="list-none p-4">Loading...</li>;

        return (
            <>
                {nodes.map((node, index) => renderNode(node, level, `${parentPath}/level_${level}`, parentCode, index === nodes.length - 1))}
            </>
        );
    };

    if (loading) return <div>Loading hierarchy...</div>;

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Organization Hierarchy</h3>
                {!readOnly && (
                    <button onClick={() => setModalState({ isOpen: true, parentPath: `organisations/${orgDomain}`, level: 1, parentCode: null })} className="px-4 py-2 text-white rounded-md text-sm font-medium hover:opacity-90" style={{ backgroundColor: theme.colorPrimary }}>
                        + Add {levelInfo[1].name}
                    </button>
                )}
            </div>
             <p className="text-sm text-gray-600 mb-6">{readOnly ? 'This is a read-only view of the hierarchy.' : 'Define the physical or logical structure of your organization. Click on an item to expand its children.'}</p>

            <ul className="space-y-2">
                {tree.map((node, index) => renderNode(node, 1, `organisations/${orgDomain}/level_1`, null, index === tree.length - 1))}
            </ul>
            
            {modalState.isOpen && (
                <HierarchyNodeModal 
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState({ isOpen: false, level: 1 })}
                    collectionPath={`${modalState.parentPath}/level_${modalState.level}`}
                    nodeToEdit={modalState.nodeToEdit}
                    parentCode={modalState.parentCode}
                    level={modalState.level}
                    currentUser={currentUserProfile}
                    orgDomain={orgDomain}
                    theme={theme}
                />
            )}
            
            <ConfirmationModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => confirmDelete && handleDeleteNode(confirmDelete.node, confirmDelete.parentPath)}
                title={`Delete ${confirmDelete?.node.name}?`}
                message="Are you sure you want to delete this node? All child nodes nested under it will also be permanently deleted. This action cannot be undone."
                isLoading={loading}
            />
        </div>
    );
};
