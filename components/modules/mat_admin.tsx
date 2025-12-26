
// components/modules/mat_admin.tsx
import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../../services/firebase';
import type { Module, AppUser, Organisation, Pillar, OrgPillarConfig, AssessmentPeriod } from '../../types';
import Button from '../Button';
import Input from '../Input';
import Modal from '../common/Modal';
import ConfirmationModal from '../common/ConfirmationModal';
import { addLog } from '../../services/logger';
import { levelInfo, HierarchyNode } from '../org/HierarchyNodeModal';
import ModuleRightsManager from '../admin/ModuleRightsManager';

const { Timestamp } = firebase.firestore;

interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
  currentUser: AppUser;
}

// --- ICONS ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

// --- PERIOD MODAL ---
const PeriodModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (period: any, id?: string) => Promise<void>;
    period?: any | null;
    organisation: Organisation;
}> = ({ isOpen, onClose, onSave, period, organisation }) => {
    const [formData, setFormData] = useState({ 
        name: '', 
        startDate: '', 
        endDate: '',
        targetLevel: 2,
        targetId: ''
    });
    const [targetOptions, setTargetOptions] = useState<HierarchyNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [error, setError] = useState('');
    const isEditing = !!period;

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: period?.name || '',
                startDate: period?.startDate || '',
                endDate: period?.endDate || '',
                targetLevel: period?.targetLevel || 2,
                targetId: period?.targetId || ''
            });
            setError('');
        }
    }, [isOpen, period]);

    // Fetch nodes based on selected level
    useEffect(() => {
        const fetchNodes = async () => {
            setLoadingOptions(true);
            try {
                const level = formData.targetLevel;
                // We need to traverse to find all nodes at this level.
                // Simplified approach: Query collectionGroup if possible, or traverse from root.
                // Since structure is nested, collectionGroup is best for flat list retrieval.
                // Note: Requires Firestore index on 'name' for the collectionGroup query usually.
                
                // Fallback traversal method if indexes aren't set up for collectionGroup
                let nodes: HierarchyNode[] = [];
                
                if (level === 2) {
                    const l1Ref = db.collection(`organisations/${organisation.domain}/level_1`);
                    const l1Snap = await l1Ref.get();
                    for (const l1 of l1Snap.docs) {
                        const l2Ref = l1.ref.collection('level_2');
                        const l2Snap = await l2Ref.get();
                        l2Snap.forEach(d => nodes.push({ id: d.id, ...d.data() } as HierarchyNode));
                    }
                } else if (level === 3) {
                    // Simplified: Assuming we want a list. Deep traversal might be slow.
                    // Using collectionGroup for efficiency (assuming index exists or small dataset)
                    const snap = await db.collectionGroup(`level_${level}`).get();
                    // Filter client side to ensure it belongs to this org (check path)
                    nodes = snap.docs
                        .filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`))
                        .map(d => ({ id: d.id, ...d.data() } as HierarchyNode));
                } else if (level === 4) {
                    const snap = await db.collectionGroup(`level_${level}`).get();
                    nodes = snap.docs
                        .filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`))
                        .map(d => ({ id: d.id, ...d.data() } as HierarchyNode));
                }
                
                setTargetOptions(nodes.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error(err);
                setError("Failed to load hierarchy options.");
            } finally {
                setLoadingOptions(false);
            }
        };

        if (isOpen) {
            fetchNodes();
        }
    }, [isOpen, formData.targetLevel, organisation.domain]);

    const handleSave = async () => {
        if (!formData.name || !formData.startDate || !formData.endDate || !formData.targetId) {
            setError('All fields are required.');
            return;
        }
        if (formData.startDate > formData.endDate) {
            setError('Start date cannot be after the end date.');
            return;
        }
        
        const selectedNode = targetOptions.find(n => n.id === formData.targetId);
        
        setIsLoading(true);
        await onSave({
            ...formData,
            targetName: selectedNode?.name || 'Unknown',
            targetCode: selectedNode?.code || ''
        }, period?.id);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Assessment Period' : 'Create Assessment Period'}>
            <div className="space-y-4">
                <Input id="name" label="Period Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input id="startDate" label="Start Date" type="date" value={formData.startDate} onChange={e => setFormData(p => ({...p, startDate: e.target.value}))} required />
                    <Input id="endDate" label="End Date" type="date" value={formData.endDate} onChange={e => setFormData(p => ({...p, endDate: e.target.value}))} required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Target Hierarchy Level</label>
                        <select 
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                            value={formData.targetLevel}
                            onChange={e => setFormData(p => ({...p, targetLevel: Number(e.target.value), targetId: ''}))}
                            disabled={isEditing}
                        >
                            <option value={2}>{levelInfo[2].name} (Entity)</option>
                            <option value={3}>{levelInfo[3].name} (Site)</option>
                            <option value={4}>{levelInfo[4].name} (Department)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Target Unit</label>
                        <select 
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                            value={formData.targetId}
                            onChange={e => setFormData(p => ({...p, targetId: e.target.value}))}
                            disabled={loadingOptions || isEditing}
                        >
                            <option value="">{loadingOptions ? 'Loading...' : 'Select Unit...'}</option>
                            {targetOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Create Period'}</Button>
                </div>
            </div>
        </Modal>
    );
};


// --- PILLAR CONFIG TAB ---
const PillarConfigTabWithProps: React.FC<{ organisation: Organisation, currentUser: AppUser }> = ({ organisation, currentUser }) => {
    const [globalPillars, setGlobalPillars] = useState<Pillar[]>([]);
    const [orgPillarConfigs, setOrgPillarConfigs] = useState<Map<string, OrgPillarConfig>>(new Map());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const globalPillarsRef = db.collection('modules/MAT/pillars');
    const orgPillarsRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('MAT').collection('pillars');

    useEffect(() => {
        setLoading(true);
        const unsubGlobal = globalPillarsRef.orderBy('code').onSnapshot(snapshot => {
            setGlobalPillars(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Pillar, 'id'>) })));
        });

        const unsubOrg = orgPillarsRef.onSnapshot(snapshot => {
            const configs = new Map<string, OrgPillarConfig>();
            snapshot.forEach(doc => {
                configs.set(doc.id, { id: doc.id, ...(doc.data() as Omit<OrgPillarConfig, 'id'>) });
            });
            setOrgPillarConfigs(configs);
            setLoading(false);
        });

        return () => { unsubGlobal(); unsubOrg(); };
    }, [organisation.domain]);

    const handleToggle = (pillar: Pillar) => {
        setOrgPillarConfigs(prev => {
            const newConfigs = new Map<string, OrgPillarConfig>(prev);
            const existing = newConfigs.get(pillar.id);
            if (existing) {
                newConfigs.set(pillar.id, { ...existing, enabled: !existing.enabled });
            } else {
                const newConfig: OrgPillarConfig = {
                    id: pillar.id,
                    code: pillar.code,
                    name: pillar.name,
                    description: pillar.description,
                    enabled: true
                };
                newConfigs.set(pillar.id, newConfig);
            }
            return newConfigs;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const batch = db.batch();
            
            globalPillars.forEach(pillar => {
                const config = orgPillarConfigs.get(pillar.id);
                const docRef = orgPillarsRef.doc(pillar.id);
                if (config) {
                    const { id, ...dataToSave } = config;
                    batch.set(docRef, dataToSave);
                } else {
                    const { id, ...pillarData } = pillar;
                    batch.set(docRef, { ...pillarData, enabled: false });
                }
            });
            await batch.commit();
            await addLog({
                action: 'MAT Pillars Configured',
                performedBy: { uid: currentUser.uid, email: currentUser.email! },
                details: `Updated the enabled maturity assessment pillars for ${organisation.name}.`
            });
            alert('Pillar configuration saved successfully.');
        } catch (error) {
            console.error("Failed to save pillar configuration:", error);
            alert("Error saving configuration.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading pillar configuration...</div>;

    return (
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pillar Configuration</h3>
            <p className="text-sm text-gray-600 mb-6">Enable the maturity assessment pillars that are relevant for your organization. These will appear on the user dashboard during open assessment periods.</p>
            <div className="space-y-4">
                {globalPillars.map(pillar => {
                    const isEnabled = orgPillarConfigs.get(pillar.id)?.enabled || false;
                    return (
                        <div key={pillar.id} className="p-4 border rounded-lg bg-slate-50 flex items-start justify-between">
                            <div className="flex-1">
                                <p className="font-semibold text-slate-800">{pillar.name} ({pillar.code})</p>
                                <p className="text-sm text-slate-600 mt-1">{pillar.description}</p>
                            </div>
                            <div className="ml-6">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isEnabled} onChange={() => handleToggle(pillar)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-end mt-6 pt-6 border-t">
                <Button onClick={handleSave} isLoading={saving}>Save Configuration</Button>
            </div>
        </div>
    );
};

// --- ASSESSMENT PERIODS TAB ---
const AssessmentPeriodsTab: React.FC<{ organisation: Organisation, currentUser: AppUser }> = ({ organisation, currentUser }) => {
    const [periods, setPeriods] = useState<AssessmentPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ isOpen: boolean, period?: AssessmentPeriod | null }>({isOpen: false});
    const [confirmDelete, setConfirmDelete] = useState<AssessmentPeriod | null>(null);

    const periodsRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('MAT').collection('periods');

    useEffect(() => {
        const q = periodsRef.orderBy('startDate', 'desc');
        const unsubscribe = q.onSnapshot(snapshot => {
            setPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<AssessmentPeriod, 'id'> })));
            setLoading(false);
        }, () => setLoading(false));
        return unsubscribe;
    }, [organisation.domain, periodsRef]);
    
    const handleSavePeriod = async (periodData: Omit<AssessmentPeriod, 'id'>, id?: string) => {
        const data = { ...periodData, status: 'Open' }; 
        if (id) {
            await periodsRef.doc(id).update(data);
        } else {
            await periodsRef.add(data);
        }
    };
    
    const handleDeletePeriod = async () => {
        if (!confirmDelete) return;
        setLoading(true);
        try {
            await periodsRef.doc(confirmDelete.id).delete();
        } catch (error) { console.error("Failed to delete period:", error); }
        finally { setLoading(false); setConfirmDelete(null); }
    };
    
    const handleToggleStatus = async (period: AssessmentPeriod) => {
        const newStatus = period.status === 'Open' ? 'Closed' : 'Open';
        await periodsRef.doc(period.id).update({ status: newStatus });
    };

    if (loading) return <div className="p-8 text-center">Loading assessment periods...</div>;
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Assessment Periods</h3>
                <Button onClick={() => setModal({isOpen: true, period: null})}>Create New Period</Button>
            </div>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-slate-50"><tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Target Level</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Start Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">End Date</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-200">
                        {periods.map((period: any) => (
                            <tr key={period.id}>
                                <td className="px-6 py-4 font-medium">{period.name}</td>
                                <td className="px-6 py-4">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full mr-2">L{period.targetLevel || 2}</span>
                                    {period.targetName}
                                </td>
                                <td className="px-6 py-4">{period.startDate}</td>
                                <td className="px-6 py-4">{period.endDate}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${period.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {period.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center space-x-2">
                                    <Button onClick={() => handleToggleStatus(period)} variant="secondary" className="!w-auto !py-1 !px-2 !text-xs">{period.status === 'Open' ? 'Close' : 'Re-open'}</Button>
                                    <button onClick={() => setModal({isOpen: true, period: period})} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                    <button onClick={() => setConfirmDelete(period)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {periods.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-500">No periods defined.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {modal.isOpen && <PeriodModal isOpen={modal.isOpen} onClose={() => setModal({isOpen: false})} onSave={handleSavePeriod} period={modal.period} organisation={organisation} />}
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDeletePeriod} title={`Delete ${confirmDelete?.name}?`} message="This will delete the period and all associated assessment data. This action cannot be undone." />
        </div>
    );
};


// --- MAIN PAGE ---
const MatAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation, currentUser }) => {
  const [activeTab, setActiveTab] = useState('pillars');
  
  const tabs = [
    { id: 'pillars', label: 'Pillar Configuration' },
    { id: 'periods', label: 'Assessment Periods' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${ activeTab === tabId ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300' }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="font-semibold" style={{ color: theme.colorAccent }}>Admin Dashboard</p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={onSwitchToUser} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium">Switch to User View</button>
          <button onClick={onBackToDashboard} className="text-sm hover:underline" style={{ color: theme.colorPrimary }}>&larr; Back to Main Dashboard</button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-lg shadow-md">
        <div className="border-b border-slate-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
            </nav>
        </div>
        <div className="mt-6">
            {activeTab === 'pillars' && <PillarConfigTabWithProps organisation={organisation} currentUser={currentUser} />}
            {activeTab === 'periods' && <AssessmentPeriodsTab organisation={organisation} currentUser={currentUser} />}
        </div>
      </div>
    </div>
  );
};

export default MatAdminPage;
