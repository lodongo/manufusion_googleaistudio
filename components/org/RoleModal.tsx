import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, updateDoc, addDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { AppUser, Organisation } from '../../types';
import type { Role, CareerCategory, CareerLevel, CareerProfession } from '../../types/hr_types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import { addLog } from '../../services/logger';
import { levelInfo } from './HierarchyNodeModal';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: AppUser;
  roleToEdit?: Role | null;
  parentRole?: Role | null;
  allRoles: Role[];
  theme: Organisation['theme'];
}

interface HierarchyTree {
    [id: string]: {
        node: { id: string; name: string; path: string; };
        children: HierarchyTree;
    }
}

const RoleModal: React.FC<RoleModalProps> = ({ isOpen, onClose, currentUserProfile, roleToEdit, parentRole, allRoles, theme }) => {
    // Form State
    const [name, setName] = useState('');
    const [abbreviation, setAbbreviation] = useState('');
    const [description, setDescription] = useState('');
    const [reportsToRoleId, setReportsToRoleId] = useState<string | null>(null);
    const [departmentPath, setDepartmentPath] = useState('');
    const [code, setCode] = useState('');
    const [level, setLevel] = useState(0);
    
    // Career Profession State
    const [careerData, setCareerData] = useState<{categories: CareerCategory[], levels: CareerLevel[], professions: CareerProfession[]}>({ categories: [], levels: [], professions: [] });
    const [selectedCareer, setSelectedCareer] = useState({ category: '', level: '', profession: '' });

    // New state for cascading dropdowns
    const [fullHierarchy, setFullHierarchy] = useState<HierarchyTree>({});
    const [departmentSelection, setDepartmentSelection] = useState<{ targetLevel: number; pathIds: string[] }>({ targetLevel: 0, pathIds: [] });

    // Loading & Errors
    const [loading, setLoading] = useState({ careers: false, saving: false, hierarchy: false });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isEditing = !!roleToEdit;
    const orgDomain = currentUserProfile.domain;

    const fetchFullHierarchy = useCallback(async () => {
        setLoading(p => ({ ...p, hierarchy: true }));
        const hierarchyTree: HierarchyTree = {};

        async function fetchChildren(parentPath: string, level: number, treeNode: HierarchyTree) {
            if (level > 7) return;
            const collectionRef = db.collection(parentPath);
            const snapshot = await collectionRef.orderBy('name').get();
            for (const doc of snapshot.docs) {
                const nodeData = { id: doc.id, name: doc.data().name, path: doc.ref.path };
                treeNode[doc.id] = { node: nodeData, children: {} };
                await fetchChildren(`${doc.ref.path}/level_${level + 1}`, level + 1, treeNode[doc.id].children);
            }
        }

        await fetchChildren(`organisations/${orgDomain}/level_1`, 1, hierarchyTree);
        setFullHierarchy(hierarchyTree);
        setLoading(p => ({ ...p, hierarchy: false }));
    }, [orgDomain]);
    
    const fetchCareers = useCallback(async () => {
        setLoading(p => ({ ...p, careers: true }));
        const catRef = db.collection('modules/HR/Careers');
        const snapshot = await catRef.orderBy('name').get();
        setCareerData(p => ({...p, categories: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareerCategory))}));
        setLoading(p => ({ ...p, careers: false }));
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchFullHierarchy();
            fetchCareers();
        }
    }, [isOpen, fetchFullHierarchy, fetchCareers]);

    useEffect(() => {
        if (isOpen) {
            const newRoleLevel = isEditing && roleToEdit ? roleToEdit.level : (parentRole ? parentRole.level + 1 : 0);
            setLevel(newRoleLevel);

            if (isEditing && roleToEdit) {
                setName(roleToEdit.name);
                setAbbreviation(roleToEdit.abbreviation || '');
                setDescription(roleToEdit.description);
                setReportsToRoleId(roleToEdit.reportsToRoleId);
                setDepartmentPath(roleToEdit.departmentPath);
                setCode(roleToEdit.code);
                
                if (roleToEdit.departmentPath) {
                    const pathParts = roleToEdit.departmentPath.split('/');
                    const ids = pathParts.filter((_, i) => i > 2 && i % 2 !== 0);
                    setDepartmentSelection({
                        targetLevel: ids.length,
                        pathIds: ids,
                    });
                } else {
                    setDepartmentSelection({ targetLevel: 0, pathIds: [] });
                }

                if (roleToEdit.careerProfessionPath) {
                    const pathParts = roleToEdit.careerProfessionPath.split('/');
                    if (pathParts.length >= 7) {
                        const [_m, _h, _c, catId, _l, levelId, _p, profId] = pathParts;
                        setSelectedCareer({ category: catId, level: levelId, profession: profId });
                    }
                } else {
                    setSelectedCareer({ category: '', level: '', profession: '' });
                }

            } else {
                setName('');
                setAbbreviation('');
                setDescription('');
                setReportsToRoleId(parentRole?.id || null);
                setDepartmentPath('');
                setSelectedCareer({ category: '', level: '', profession: '' });
                setDepartmentSelection({ targetLevel: 0, pathIds: [] });
            }
            setErrors({});
        }
    }, [isOpen, isEditing, roleToEdit, parentRole]);

    useEffect(() => {
        if (isOpen && !isEditing) {
            const newRoleLevel = parentRole ? parentRole.level + 1 : 0;
            const levelStr = newRoleLevel.toString().padStart(3, '0');
            const prefix = `RL${levelStr}`;

            const siblings = allRoles.filter(r => r.reportsToRoleId === (parentRole?.id || null));
            
            const maxSeq = siblings.reduce((max, sibling) => {
                if (sibling.code && sibling.code.startsWith(prefix)) {
                    const seqStr = sibling.code.substring(prefix.length);
                    const seqNum = parseInt(seqStr, 10);
                    if (!isNaN(seqNum)) {
                        return Math.max(max, seqNum);
                    }
                }
                return max;
            }, 0);

            const newSequence = (maxSeq + 1).toString().padStart(3, '0');
            const newCode = `${prefix}${newSequence}`;
            setCode(newCode);
        }
    }, [isOpen, isEditing, parentRole, allRoles]);

    const handleCareerCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCategory = e.target.value;
        setSelectedCareer({ category: newCategory, level: '', profession: '' });
        setCareerData(p => ({ ...p, levels: [], professions: [] }));
    };

    const handleCareerLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLevel = e.target.value;
        setSelectedCareer(p => ({ ...p, level: newLevel, profession: '' }));
        setCareerData(p => ({ ...p, professions: [] }));
    };

    useEffect(() => {
        if (!selectedCareer.category) {
            setCareerData(p => ({ ...p, levels: [], professions: [] }));
            return;
        }
        const fetchLevels = async () => {
            const levelRef = db.collection('modules/HR/Careers').doc(selectedCareer.category).collection('Levels');
            const snapshot = await levelRef.orderBy('order').get();
            setCareerData(p => ({...p, levels: snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as CareerLevel))}));
        };
        fetchLevels();
    }, [selectedCareer.category]);

    useEffect(() => {
        if (!selectedCareer.level) {
             setCareerData(p => ({ ...p, professions: [] }));
            return;
        }
        const fetchProfessions = async () => {
            const profRef = db.collection('modules/HR/Careers').doc(selectedCareer.category).collection('Levels').doc(selectedCareer.level).collection('Professions');
            const snapshot = await profRef.orderBy('name').get();
            setCareerData(p => ({...p, professions: snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as CareerProfession))}));
        };
        fetchProfessions();
    }, [selectedCareer.level, selectedCareer.category]);

    const getDepartmentName = (path: string): string => {
        if (!path || Object.keys(fullHierarchy).length === 0) return '';
        const pathParts = path.split('/');
        const ids = pathParts.filter((_, i) => i > 2 && i % 2 !== 0);
        
        let currentLevel = fullHierarchy;
        let finalNode = null;
        for (const id of ids) {
            if (currentLevel[id]) {
                finalNode = currentLevel[id].node;
                currentLevel = currentLevel[id].children;
            } else {
                finalNode = null;
                break;
            }
        }
        return finalNode?.name || '';
    };

    const handleSave = async () => {
        if (!name || (departmentSelection.targetLevel > 0 && !departmentPath) || !selectedCareer.profession) {
            setErrors({ form: 'Please fill all required fields.' });
            return;
        }
        setLoading(p => ({ ...p, saving: true }));

        const deptName = departmentSelection.targetLevel === 0 ? "Entire Organization" : getDepartmentName(departmentPath);
        const profName = careerData.professions.find(p => p.id === selectedCareer.profession)?.name || '';
        const profPath = `modules/HR/Careers/${selectedCareer.category}/Levels/${selectedCareer.level}/Professions/${selectedCareer.profession}`;

        try {
            if (isEditing && roleToEdit) {
                const dataToUpdate: Partial<Role> = {
                    name, abbreviation, description, reportsToRoleId, departmentPath, departmentName: deptName,
                    careerProfessionPath: profPath, careerProfessionName: profName,
                };
                await db.collection('organisations').doc(orgDomain).collection('roles').doc(roleToEdit.id).update(dataToUpdate as any);
                await addLog({ action: 'Role Updated', performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email }, details: `Updated role "${name}" (${roleToEdit.code}) in ${orgDomain}.`});
            } else {
                const dataToSave: Omit<Role, 'id'> = {
                    name, abbreviation, description, reportsToRoleId, departmentPath, departmentName: deptName,
                    careerProfessionPath: profPath, careerProfessionName: profName,
                    code: code,
                    level: level,
                };
                await db.collection('organisations').doc(orgDomain).collection('roles').add(dataToSave);
                await addLog({ action: 'Role Created', performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email }, details: `Created role "${name}" (${code}) in ${orgDomain}.`});
            }
            onClose();
        } catch (err: any) {
            setErrors({ form: err.message || 'Failed to save role.' });
        } finally {
            setLoading(p => ({ ...p, saving: false }));
        }
    };
    
    const handleTargetLevelChange = (level: number) => {
        setDepartmentSelection({ targetLevel: level, pathIds: [] });
        setDepartmentPath('');
    };

    const handlePathChange = (levelIndex: number, id: string) => {
        const newPathIds = [...departmentSelection.pathIds.slice(0, levelIndex), id];
        
        let newFullPath = '';
        if (newPathIds.length === departmentSelection.targetLevel && id) {
            newFullPath = `organisations/${orgDomain}`;
            newPathIds.forEach((segmentId, index) => {
                newFullPath += `/level_${index + 1}/${segmentId}`;
            });
        }
        setDepartmentSelection(prev => ({...prev, pathIds: newPathIds}));
        setDepartmentPath(newFullPath);
    };

    const renderDepartmentDropdowns = () => {
        if (loading.hierarchy) {
            return <p className="text-sm text-gray-500">Loading hierarchy...</p>;
        }

        const dropdowns = [];
        let currentLevelOptions = fullHierarchy;

        for (let i = 0; i < departmentSelection.targetLevel; i++) {
            const level = i + 1;
            const options = Object.values(currentLevelOptions).map((item: any) => item.node);
            const selectedId = departmentSelection.pathIds[i] || '';

            dropdowns.push(
                <div key={`dep-level-${level}`} className="mt-2">
                    <label className="block text-sm font-medium text-gray-700">{levelInfo[level].name}</label>
                    <select
                        value={selectedId}
                        onChange={(e) => handlePathChange(i, e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    >
                        <option value="">Select...</option>
                        {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
            );

            if (selectedId && currentLevelOptions[selectedId]?.children) {
                currentLevelOptions = currentLevelOptions[selectedId].children;
            } else {
                break;
            }
        }
        return dropdowns;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Role' : 'Add New Role'} size="4xl">
            <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1">
                         <Input id="code" label="Role Code" value={code} disabled />
                    </div>
                     <div className="md:col-span-1">
                         <Input id="abbreviation" label="Abbreviation" value={abbreviation} onChange={e => setAbbreviation(e.target.value.toUpperCase())} />
                    </div>
                    <div className="md:col-span-3">
                        <Input id="name" label="Role Title" value={name} onChange={e => setName(e.target.value.toUpperCase())} required />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full p-2 border border-gray-300 rounded-md" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Reports To</label>
                    <select value={reportsToRoleId || ''} onChange={e => setReportsToRoleId(e.target.value || null)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="">(Top-Level Role)</option>
                        {allRoles.filter(r => r.id !== roleToEdit?.id).map(role => (
                            <option key={role.id} value={role.id}>{role.name} ({role.code})</option>
                        ))}
                    </select>
                </div>
                
                <div className="pt-4 border-t">
                     <h4 className="font-medium text-gray-800 mb-2">Department / Section</h4>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Department Level</label>
                        <select
                            value={departmentSelection.targetLevel}
                            onChange={e => handleTargetLevelChange(Number(e.target.value))}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                        >
                            <option value={0}>Level 0: Entire Organization</option>
                            {Object.keys(levelInfo).map(level => (
                                <option key={level} value={level}>{`Level ${level}: ${levelInfo[Number(level)].name}`}</option>
                            ))}
                        </select>
                    </div>
                    {departmentSelection.targetLevel > 0 && (
                        <div className="mt-2 space-y-2 border-l-2 pl-4 ml-1 border-gray-200">
                            {renderDepartmentDropdowns()}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-800 mb-2">Standard Career Profession</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Category</label>
                            <select value={selectedCareer.category} onChange={handleCareerCategoryChange} disabled={loading.careers} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                <option value="">{loading.careers ? 'Loading...' : 'Select...'}</option>
                                {careerData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Level</label>
                            <select value={selectedCareer.level} onChange={handleCareerLevelChange} disabled={!selectedCareer.category} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                <option value="">Select...</option>
                                {careerData.levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Profession</label>
                            <select value={selectedCareer.profession} onChange={e => setSelectedCareer(p => ({...p, profession: e.target.value}))} disabled={!selectedCareer.level} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                <option value="">Select...</option>
                                {careerData.professions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {errors.form && <p className="text-sm text-red-600 mt-2">{errors.form}</p>}

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} isLoading={loading.saving} style={{ backgroundColor: theme.colorPrimary }}>
                        {isEditing ? 'Save Changes' : 'Create Role'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default RoleModal;