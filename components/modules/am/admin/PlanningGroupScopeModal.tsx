import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { PlanningGroup, PlanningGroupSection } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import { collection, query, getDocs, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';

interface PlanningGroupScopeModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
    group: PlanningGroup;
}

const PlanningGroupScopeModal: React.FC<PlanningGroupScopeModalProps> = ({ isOpen, onClose, organisation, theme, group }) => {
    // Local state for draft assignments
    const [assignedSections, setAssignedSections] = useState<PlanningGroupSection[]>([]);
    const [allOtherGroups, setAllOtherGroups] = useState<PlanningGroup[]>([]);
    
    // Selection state
    const [l3Options, setL3Options] = useState<HierarchyNode[]>([]);
    const [l4Options, setL4Options] = useState<HierarchyNode[]>([]);
    const [l5Options, setL5Options] = useState<HierarchyNode[]>([]);
    const [selectedL3, setSelectedL3] = useState('');
    const [selectedL4, setSelectedL4] = useState('');
    const [selectedL5, setSelectedL5] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingHierarchy, setLoadingHierarchy] = useState(false);
    const [error, setError] = useState('');

    // Memoize the set of L5 IDs already used in ANY other group
    const globalForbiddenIds = useMemo(() => {
        const ids = new Set<string>();
        allOtherGroups.forEach(other => {
            // Include ALL IDs from other groups
            if (other.id !== group.id) {
                other.assignedSections?.forEach(sec => ids.add(sec.l5Id));
            }
        });
        // Also include IDs currently in the draft list
        assignedSections.forEach(sec => ids.add(sec.l5Id));
        return ids;
    }, [allOtherGroups, assignedSections, group.id]);

    useEffect(() => {
        if (isOpen) {
            setAssignedSections(group.assignedSections || []);
            setSelectedL3('');
            setSelectedL4('');
            setSelectedL5('');
            setError('');
            fetchL3();
            fetchAllGroups();
        }
    }, [isOpen, group, organisation.domain]);

    const fetchAllGroups = async () => {
        const groupsRef = collection(db, `organisations/${organisation.domain}/modules/AM/planningGroups`);
        const snap = await getDocs(groupsRef);
        setAllOtherGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlanningGroup)));
    };

    const fetchL3 = async () => {
        setLoadingHierarchy(true);
        const l3Nodes: HierarchyNode[] = [];
        try {
            const l1Ref = collection(db, `organisations/${organisation.domain}/level_1`);
            const l1Snap = await getDocs(l1Ref);
            
            for (const l1 of l1Snap.docs) {
                const l2Snap = await getDocs(collection(l1.ref, 'level_2'));
                for (const l2 of l2Snap.docs) {
                    const l3Snap = await getDocs(query(collection(l2.ref, 'level_3'), orderBy('name')));
                    l3Snap.forEach(l3 => {
                        l3Nodes.push({ id: l3.id, path: l3.ref.path, ...l3.data() } as HierarchyNode);
                    });
                }
            }
            setL3Options(l3Nodes.sort((a,b) => a.name.localeCompare(b.name)));
        } catch (e) {
            console.error("Error fetching sites:", e);
        } finally {
            setLoadingHierarchy(false);
        }
    };

    // Fetch L4 when L3 changes
    useEffect(() => {
        if (!selectedL3) { setL4Options([]); setSelectedL4(''); return; }
        const l3Node = l3Options.find(n => n.id === selectedL3);
        if (l3Node?.path) {
            getDocs(query(collection(db, `${l3Node.path}/level_4`), orderBy('name'))).then(snap => {
                setL4Options(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)));
            });
        }
        setSelectedL4('');
        setSelectedL5('');
    }, [selectedL3, l3Options]);

    // Fetch L5 when L4 changes
    useEffect(() => {
        if (!selectedL4) { setL5Options([]); setSelectedL5(''); return; }
        const l4Node = l4Options.find(n => n.id === selectedL4);
        if (l4Node?.path) {
            getDocs(query(collection(db, `${l4Node.path}/level_5`), orderBy('name'))).then(snap => {
                // FILTER: Hide any section that is already in ANY group
                const available = snap.docs
                    .map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode))
                    .filter(node => !globalForbiddenIds.has(node.id!));
                setL5Options(available);
            });
        }
        setSelectedL5('');
    }, [selectedL4, l4Options, globalForbiddenIds]);

    const handleAddSection = () => {
        const l3 = l3Options.find(n => n.id === selectedL3);
        const l4 = l4Options.find(n => n.id === selectedL4);
        const l5 = l5Options.find(n => n.id === selectedL5);

        if (!l3 || !l4 || !l5) return;

        const newSection: PlanningGroupSection = {
            l3Id: l3.id!, l3Name: l3.name,
            l4Id: l4.id!, l4Name: l4.name,
            l5Id: l5.id!, l5Name: l5.name,
            path: l5.path!
        };

        setAssignedSections([...assignedSections, newSection]);
        setSelectedL5(''); // Reset selection
    };

    const handleRemoveSection = (l5Id: string) => {
        setAssignedSections(assignedSections.filter(s => s.l5Id !== l5Id));
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError('');

        try {
            const groupRef = doc(db, `organisations/${organisation.domain}/modules/AM/planningGroups`, group.id);
            await updateDoc(groupRef, {
                assignedSections: assignedSections,
                updatedAt: Timestamp.now()
            });
            onClose();
        } catch (e: any) {
            setError(e.message || "Failed to update group scope.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Scope: ${group.name}`} size="4xl">
            <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-sm text-blue-800 font-bold uppercase tracking-tight">Scope Assignment Rule</p>
                        <p className="text-xs text-blue-600">A Level 5 section can only be assigned to a single planning group. Added sections are hidden from future selections.</p>
                    </div>
                </div>

                {/* Section Selection Area */}
                <div className="pt-4 border-t">
                    <h4 className="font-bold text-slate-700 mb-3">Add Level 5 Sections</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 items-end">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">1. Site (L3)</label>
                            <select value={selectedL3} onChange={e => setSelectedL3(e.target.value)} className="w-full p-2 text-sm border rounded bg-white outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">{loadingHierarchy ? 'Loading...' : 'Select Site...'}</option>
                                {l3Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">2. Department (L4)</label>
                            <select value={selectedL4} onChange={e => setSelectedL4(e.target.value)} disabled={!selectedL3} className="w-full p-2 text-sm border rounded bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100">
                                <option value="">Select Dept...</option>
                                {l4Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">3. Section (L5)</label>
                            <select 
                                value={selectedL5} 
                                onChange={e => setSelectedL5(e.target.value)} 
                                disabled={!selectedL4} 
                                className={`w-full p-2 text-sm border rounded bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100`}
                            >
                                <option value="">{l5Options.length === 0 ? 'No Available Sections' : 'Select Section...'}</option>
                                {l5Options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button 
                            type="button" 
                            onClick={handleAddSection} 
                            disabled={!selectedL5}
                            className="!w-auto !py-2.5 h-[38px] !bg-indigo-600 hover:!bg-indigo-700 text-white font-bold text-xs"
                        >
                            + ADD TO GROUP
                        </Button>
                    </div>

                    {/* Active Assignment List */}
                    <div className="mt-6">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Assigned Scope ({assignedSections.length})</h5>
                        {assignedSections.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-dashed">
                                No sections assigned. This group is currently blank.
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase text-[10px]">Site / Dept</th>
                                            <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase text-[10px]">Level 5 Section</th>
                                            <th className="px-4 py-2 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {assignedSections.map((sec, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 group">
                                                <td className="px-4 py-2">
                                                    <p className="font-medium text-slate-800">{sec.l3Name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase">{sec.l4Name}</p>
                                                </td>
                                                <td className="px-4 py-2 font-bold text-slate-700">
                                                    {sec.l5Name}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveSection(sec.l5Id)}
                                                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                        title="Remove from group"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 font-medium">{error}</p>}

                <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto">Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={isLoading} 
                        style={{ backgroundColor: theme.colorPrimary }}
                        className="!w-auto shadow-lg shadow-indigo-100"
                    >
                        Save Group Scope
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default PlanningGroupScopeModal;