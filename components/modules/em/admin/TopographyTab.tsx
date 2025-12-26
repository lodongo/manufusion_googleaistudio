
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { TopographyNode } from '../../../../types/em_types';
import Button from '../../../Button';
import TopographyNodeModal from './TopographyNodeModal';
import TopographyNodeConfigModal from './TopographyNodeConfigModal';
import ConfirmationModal from '../../../common/ConfirmationModal';

const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.982.033 2.285-.947 2.285-1.566.379-1.566 2.6 0 2.978.98.238 1.487 1.305.947 2.286-.835 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.566 2.6 1.566 2.978 0a1.533 1.533 0 012.287-.947c1.372.835 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.286c1.566-.379-1.566-2.6 0-2.978a1.532 1.532 0 01-.947-2.286c.835-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;

const NodeRenderer: React.FC<{ 
    node: TopographyNode; 
    parentPath: string; 
    onEdit: (node: TopographyNode) => void;
    onDelete: (node: TopographyNode, path: string) => void;
    onAdd: (parent: TopographyNode) => void;
    onConfig: (node: TopographyNode) => void;
    theme: Organisation['theme'];
}> = ({ node, parentPath, onEdit, onDelete, onAdd, onConfig, theme }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState<TopographyNode[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isExpanded) {
            setLoading(true);
            const childrenRef = collection(db, `${node.path}/nodes`);
            const q = query(childrenRef, orderBy('name'));
            const unsub = onSnapshot(q, (snap) => {
                setChildren(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), path: doc.ref.path } as TopographyNode)));
                setLoading(false);
            });
            return () => unsub();
        }
    }, [isExpanded, node.path]);

    return (
        <div className="ml-4 border-l border-slate-200 pl-4 py-1">
            <div className="flex items-center group">
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors flex-1"
                >
                    <ChevronDownIcon className={isExpanded ? '' : '-rotate-90 text-slate-300'} />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{node.name}</span>
                            {node.meteringType && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {node.meteringType}
                                </span>
                            )}
                        </div>
                        {node.description && <span className="text-[10px] text-slate-400 truncate max-w-xs">{node.description}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    <button onClick={() => onConfig(node)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Configure Metering & Consumers"><SettingsIcon /></button>
                    <button onClick={() => onAdd(node)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Add Sub-item"><PlusIcon /></button>
                    <button onClick={() => onEdit(node)} className="p-1.5 text-slate-600 hover:bg-slate-50 rounded" title="Edit Properties"><EditIcon /></button>
                    <button onClick={() => onDelete(node, node.path)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Delete"><DeleteIcon /></button>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-1">
                    {loading ? (
                        <p className="text-[10px] text-slate-400 italic ml-6">Loading structure...</p>
                    ) : children.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic ml-6">No sub-items defined.</p>
                    ) : (
                        children.map(child => (
                            <NodeRenderer 
                                key={child.id} 
                                node={child} 
                                parentPath={node.path} 
                                onEdit={onEdit} 
                                onDelete={onDelete} 
                                onAdd={onAdd}
                                onConfig={onConfig}
                                theme={theme}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const TopographyTab: React.FC<{ organisation: Organisation, theme: Organisation['theme'], currentUser: AppUser }> = ({ organisation, theme, currentUser }) => {
    const [rootNodes, setRootNodes] = useState<TopographyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean, parentNode?: TopographyNode | null, nodeToEdit?: TopographyNode | null }>({ open: false });
    const [configModal, setConfigModal] = useState<{ open: boolean, node: TopographyNode | null }>({ open: false, node: null });
    const [confirmDelete, setConfirmDelete] = useState<{ node: TopographyNode, path: string } | null>(null);

    const rootCollectionPath = `organisations/${organisation.domain}/modules/EM/topography`;

    useEffect(() => {
        const q = query(collection(db, rootCollectionPath), orderBy('name'));
        const unsub = onSnapshot(q, (snap) => {
            setRootNodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), path: doc.ref.path } as TopographyNode)));
            setLoading(false);
        });
        return () => unsub();
    }, [rootCollectionPath]);

    const handleSaveNode = async (data: Partial<TopographyNode>) => {
        let nodeRef;
        if (modal.nodeToEdit) {
            nodeRef = doc(db, modal.nodeToEdit.path);
        } else if (modal.parentNode) {
            nodeRef = doc(collection(db, `${modal.parentNode.path}/nodes`));
        } else {
            nodeRef = doc(collection(db, rootCollectionPath));
        }

        const payload = {
            ...data,
            id: nodeRef.id,
            path: nodeRef.path,
            level: modal.nodeToEdit ? modal.nodeToEdit.level : (modal.parentNode ? modal.parentNode.level + 1 : 1),
            createdAt: modal.nodeToEdit ? modal.nodeToEdit.createdAt : firebase.firestore.FieldValue.serverTimestamp()
        };

        await setDoc(nodeRef, payload, { merge: true });
        setModal({ open: false });
    };

    const handleDeleteNode = async () => {
        if (!confirmDelete) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const deleteRecursive = async (path: string) => {
                const subNodesSnap = await getDocs(collection(db, `${path}/nodes`));
                for (const subDoc of subNodesSnap.docs) {
                    await deleteRecursive(subDoc.ref.path);
                }
                batch.delete(doc(db, path));
            };
            await deleteRecursive(confirmDelete.path);
            await batch.commit();
        } catch (e) {
            console.error("Delete failed", e);
        } finally {
            setConfirmDelete(null);
            setLoading(false);
        }
    };

    if (loading && rootNodes.length === 0) return <div className="p-12 text-center text-slate-400 italic animate-pulse">Building topographic map...</div>;

    return (
        <div className="space-y-6 mt-6">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">System Topography</h3>
                    <p className="text-sm text-slate-500 mt-1">Define and configure the hierarchical metering structure of your site.</p>
                </div>
                <Button 
                    onClick={() => setModal({ open: true, parentNode: null, nodeToEdit: null })} 
                    className="!w-auto flex items-center gap-2"
                >
                    <PlusIcon /> Add Root Item
                </Button>
            </div>

            <div className="bg-white border rounded-2xl p-6 shadow-sm min-h-[400px]">
                {rootNodes.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl">
                        <p className="italic">No topographic points defined.</p>
                        <p className="text-xs mt-1">Start by adding a high-level container like "Plant" or "Site".</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {rootNodes.map(node => (
                            <NodeRenderer 
                                key={node.id} 
                                node={node} 
                                parentPath={rootCollectionPath}
                                onAdd={(parent) => setModal({ open: true, parentNode: parent, nodeToEdit: null })}
                                onEdit={(node) => setModal({ open: true, parentNode: null, nodeToEdit: node })}
                                onConfig={(node) => setConfigModal({ open: true, node })}
                                onDelete={(node, path) => setConfirmDelete({ node, path })}
                                theme={theme}
                            />
                        ))}
                    </div>
                )}
            </div>

            <TopographyNodeModal 
                isOpen={modal.open}
                onClose={() => setModal({ open: false })}
                onSave={handleSaveNode}
                nodeToEdit={modal.nodeToEdit}
                parentNode={modal.parentNode}
                theme={theme}
            />

            {configModal.open && configModal.node && (
                <TopographyNodeConfigModal
                    isOpen={configModal.open}
                    onClose={() => setConfigModal({ open: false, node: null })}
                    node={configModal.node}
                    organisation={organisation}
                    theme={theme}
                />
            )}

            <ConfirmationModal 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteNode}
                title="Destroy Topographic Branch?"
                message={`Are you sure you want to delete "${confirmDelete?.node.name}"? This will recursively delete all nested departments and sections within this branch. This action cannot be undone.`}
            />
        </div>
    );
};

export default TopographyTab;
