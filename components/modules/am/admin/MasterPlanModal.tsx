import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { MaintenanceMasterPlan, MaintenanceDiscipline, MaintenanceInterval, MaintenanceStatus } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';
import { collection, query, where, getDocs, doc, setDoc, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';

interface MasterPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
    planToEdit?: MaintenanceMasterPlan | null;
    initialData?: {
        assemblyId: string;
        assemblyName: string;
        assemblyPath: string;
        disciplineCode: string;
        disciplineName: string;
        intervalCode: string;
        intervalName: string;
    } | null;
    onAssemblySelected?: (node: HierarchyNode) => void;
}

const MasterPlanModal: React.FC<MasterPlanModalProps> = ({ isOpen, onClose, organisation, theme, planToEdit, initialData, onAssemblySelected }) => {
    const { currentUserProfile } = useAuth();
    const isEditing = !!planToEdit;

    // --- Steps State ---
    const [step, setStep] = useState(1); 

    // --- Hierarchy Selection State ---
    const [selection, setSelection] = useState({ l3: '', l4: '', l5: '', l6: '', l7: '' });
    const [hierarchy, setHierarchy] = useState<{
        l3: HierarchyNode[], l4: HierarchyNode[], l5: HierarchyNode[], l6: HierarchyNode[], l7: HierarchyNode[]
    }>({ l3: [], l4: [], l5: [], l6: [], l7: [] });
    const [loadingHier, setLoadingHier] = useState(false);

    // --- Form State ---
    const [disciplineCode, setDisciplineCode] = useState('');
    const [intervalCode, setIntervalCode] = useState('');
    const [statusCode, setStatusCode] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [activeFromType, setActiveFromType] = useState<'specific' | 'indefinite'>('indefinite');
    const [activeFromDate, setActiveFromDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Master Data State ---
    const [disciplines, setDisciplines] = useState<MaintenanceDiscipline[]>([]);
    const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);
    const [statuses, setStatuses] = useState<MaintenanceStatus[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [duplicateError, setDuplicateError] = useState('');
    const [error, setError] = useState('');

    const handleHierarchySelect = (level: number, id: string) => {
        const nextSelection = { ...selection };
        const nextHierarchy = { ...hierarchy };
        (nextSelection as any)[`l${level}`] = id;
        for (let i = level + 1; i <= 7; i++) {
            (nextSelection as any)[`l${i}`] = '';
            (nextHierarchy as any)[`l${i}`] = [];
        }
        setSelection(nextSelection);
        setHierarchy(nextHierarchy);
    };

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchInitial = async () => {
            setLoadingHier(true);
            try {
                // Fetch Global Master Variables
                const discSnap = await getDocs(query(collection(db, 'modules/AM/disciplines'), where('enabled', '==', true)));
                setDisciplines(discSnap.docs.map(d => ({ ...d.data() } as MaintenanceDiscipline)).sort((a,b) => a.name.localeCompare(b.name)));

                const intSnap = await getDocs(query(collection(db, 'modules/AM/intervals'), where('enabled', '==', true)));
                setIntervals(intSnap.docs.map(d => ({ ...d.data() } as MaintenanceInterval)).sort((a,b) => a.name.localeCompare(b.name)));

                const statSnap = await getDocs(query(collection(db, 'modules/AM/status'), where('enabled', '==', true)));
                setStatuses(statSnap.docs.map(d => ({ ...d.data() } as MaintenanceStatus)).sort((a,b) => a.name.localeCompare(b.name)));

                // Hierarchy Initialization
                const orgPath = `organisations/${organisation.domain}`;
                const l1Snap = await getDocs(collection(db, `${orgPath}/level_1`));
                const l3Nodes: HierarchyNode[] = [];
                for (const l1 of l1Snap.docs) {
                    const l2Snap = await getDocs(collection(l1.ref, 'level_2'));
                    for (const l2 of l2Snap.docs) {
                        const l3Snap = await getDocs(query(collection(l2.ref, 'level_3'), orderBy('name')));
                        l3Snap.forEach(l3 => l3Nodes.push({ id: l3.id, path: l3.ref.path, ...l3.data() } as HierarchyNode));
                    }
                }
                setHierarchy(prev => ({ ...prev, l3: l3Nodes }));

                if (isEditing && planToEdit) {
                    setDisciplineCode(planToEdit.disciplineCode);
                    setIntervalCode(planToEdit.intervalCode);
                    setStatusCode(planToEdit.statusCode);
                    setEnabled(planToEdit.enabled);
                    if (planToEdit.activeFrom === 'Indefinite') {
                        setActiveFromType('indefinite');
                    } else {
                        setActiveFromType('specific');
                        setActiveFromDate(planToEdit.activeFrom);
                    }
                    setStep(2);
                } else if (initialData) {
                    setDisciplineCode(initialData.disciplineCode || '');
                    setIntervalCode(initialData.intervalCode || '');
                    setStep(2);
                } else {
                    setDisciplineCode(''); 
                    setIntervalCode(''); 
                    setStatusCode(''); 
                    setEnabled(true);
                    setActiveFromType('indefinite'); 
                    setStep(1);
                }
            } catch (e) { console.error(e); } finally { setLoadingHier(false); }
        };
        fetchInitial();
    }, [isOpen, organisation.domain, isEditing, planToEdit, initialData]);

    const fetchLevel = async (level: number, parentPath: string) => {
        const snap = await getDocs(query(collection(db, `${parentPath}/level_${level}`), orderBy('name')));
        const nodes = snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode));
        setHierarchy(prev => ({ ...prev, [`l${level}`]: nodes }));
    };

    useEffect(() => { if (selection.l3) { const node = hierarchy.l3.find(n => n.id === selection.l3); if (node?.path) fetchLevel(4, node.path); } }, [selection.l3]);
    useEffect(() => { if (selection.l4) { const node = hierarchy.l4.find(n => n.id === selection.l4); if (node?.path) fetchLevel(5, node.path); } }, [selection.l4]);
    useEffect(() => { if (selection.l5) { const node = hierarchy.l5.find(n => n.id === selection.l5); if (node?.path) fetchLevel(6, node.path); } }, [selection.l5]);
    useEffect(() => { if (selection.l6) { const node = hierarchy.l6.find(n => n.id === selection.l6); if (node?.path) fetchLevel(7, node.path); } }, [selection.l6]);

    useEffect(() => {
        if (!isOpen || isEditing) return;
        const checkUniqueness = async () => {
            const targetAssemblyId = initialData?.assemblyId || selection.l7;
            if (targetAssemblyId && disciplineCode && intervalCode && statusCode) {
                setDuplicateError('');
                const plansRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans`);
                const q = query(
                    plansRef, 
                    where('assemblyId', '==', targetAssemblyId),
                    where('disciplineCode', '==', disciplineCode),
                    where('intervalCode', '==', intervalCode),
                    where('statusCode', '==', statusCode)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setDuplicateError("A master plan with this exact combination already exists.");
                }
            }
        };
        checkUniqueness();
    }, [selection.l7, disciplineCode, intervalCode, statusCode, organisation.domain, initialData, isOpen, isEditing]);

    const handleSave = async () => {
        if (!disciplineCode || !intervalCode || !statusCode) {
            setError("Discipline, Interval and Status are required.");
            return;
        }

        if (duplicateError) return;

        setIsLoading(true);
        setError('');

        try {
            const assemblyNode = hierarchy.l7.find(n => n.id === selection.l7);
            const disc = disciplines.find(d => d.code === disciplineCode);
            const inter = intervals.find(i => i.code === intervalCode);
            const stat = statuses.find(s => s.code === statusCode);

            const targetAssemblyId = isEditing ? planToEdit!.assemblyId : (initialData?.assemblyId || selection.l7);
            const targetAssemblyName = isEditing ? planToEdit!.assemblyName : (initialData?.assemblyName || assemblyNode?.name || 'Unknown');
            const targetAssemblyPath = isEditing ? planToEdit!.assemblyPath : (initialData?.assemblyPath || assemblyNode?.path || '');

            const planData: Omit<MaintenanceMasterPlan, 'id'> = {
                code: `${disciplineCode}_${intervalCode}_${statusCode}`,
                assemblyId: targetAssemblyId,
                assemblyName: targetAssemblyName,
                assemblyPath: targetAssemblyPath,
                disciplineCode,
                disciplineName: disc?.name || '',
                intervalCode,
                intervalName: inter?.name || '',
                statusCode,
                statusName: stat?.name || '',
                enabled,
                activeFrom: activeFromType === 'indefinite' ? 'Indefinite' : activeFromDate,
                createdAt: isEditing ? planToEdit!.createdAt : Timestamp.now(),
                createdBy: isEditing ? planToEdit!.createdBy : { uid: currentUserProfile?.uid || '', name: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}` }
            };

            const collectionRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans`);
            
            if (isEditing && planToEdit) {
                await setDoc(doc(collectionRef, planToEdit.id), planData, { merge: true });
            } else {
                await addDoc(collectionRef, planData);
            }

            onClose();
        } catch (e: any) {
            setError(e.message || "Failed to save Master Plan.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit Master Plan Header` : 'Register Master Maintenance Plan'} size="4xl">
            <div className="space-y-6">
                {!isEditing && (
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className={`flex items-center gap-2 ${step === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${step === 1 ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>1</span>
                            <span className="text-sm font-bold uppercase tracking-wider">Select Assembly</span>
                        </div>
                        <div className="h-px w-12 bg-slate-200"></div>
                        <div className={`flex items-center gap-2 ${step === 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${step === 2 ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>2</span>
                            <span className="text-sm font-bold uppercase tracking-wider">Define Profile</span>
                        </div>
                    </div>
                )}

                {step === 1 && !initialData ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h4 className="text-blue-800 font-bold uppercase text-xs tracking-wider mb-2">Step 1: Target Technical Object</h4>
                            <p className="text-sm text-blue-600">Select the Level 7 Assembly for which you are defining this maintenance template.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <Input as="select" id="l3" label="1. Site (L3)" value={selection.l3} onChange={e => handleHierarchySelect(3, e.target.value)}>
                                    <option value="">Select Site...</option>
                                    {hierarchy.l3.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </Input>
                                <Input as="select" id="l4" label="2. Department (L4)" value={selection.l4} onChange={e => handleHierarchySelect(4, e.target.value)} disabled={!selection.l3}>
                                    <option value="">Select Dept...</option>
                                    {hierarchy.l4.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </Input>
                                <Input as="select" id="l5" label="3. Section (L5)" value={selection.l5} onChange={e => handleHierarchySelect(5, e.target.value)} disabled={!selection.l4}>
                                    <option value="">Select Section...</option>
                                    {hierarchy.l5.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </Input>
                            </div>
                            <div className="space-y-4">
                                <Input as="select" id="l6" label="4. Asset (L6)" value={selection.l6} onChange={e => handleHierarchySelect(6, e.target.value)} disabled={!selection.l5}>
                                    <option value="">Select Asset...</option>
                                    {hierarchy.l6.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </Input>
                                <Input as="select" id="l7" label="5. Assembly (L7)" value={selection.l7} onChange={e => handleHierarchySelect(7, e.target.value)} disabled={!selection.l6}>
                                    <option value="">Select Assembly...</option>
                                    {hierarchy.l7.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </Input>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 border-t">
                            <Button onClick={() => setStep(2)} disabled={!selection.l7} className="!w-auto px-8">Next: Define Profile &rarr;</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="md:col-span-2 flex justify-between items-center mb-4">
                                 <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Plan Configuration</h4>
                                 {!isEditing && !initialData && <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline font-bold">Change Target Object</button>}
                                 {(initialData || selection.l7) && (
                                     <div className="flex flex-col items-end">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Selected Technical Object</span>
                                         <span className="text-sm font-bold text-indigo-700">{initialData?.assemblyName || hierarchy.l7.find(n => n.id === selection.l7)?.name}</span>
                                     </div>
                                 )}
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Technical Discipline</label>
                                    <select 
                                        value={disciplineCode} 
                                        onChange={e => setDisciplineCode(e.target.value)} 
                                        className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                        required
                                    >
                                        <option value="">Select Discipline...</option>
                                        {disciplines.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Interval</label>
                                    <select 
                                        value={intervalCode} 
                                        onChange={e => setIntervalCode(e.target.value)} 
                                        className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                        required
                                    >
                                        <option value="">Select Interval...</option>
                                        {intervals.map(i => <option key={i.code} value={i.code}>{i.name} ({i.code})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Operational Status</label>
                                    <select 
                                        value={statusCode} 
                                        onChange={e => setStatusCode(e.target.value)} 
                                        className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                                        required
                                    >
                                        <option value="">Select Status...</option>
                                        {statuses.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 border rounded-lg bg-white shadow-inner">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Autogenerated Code Preview</p>
                                    <p className="font-mono text-lg font-bold text-indigo-700">
                                        {(disciplineCode && intervalCode && statusCode) ? `${disciplineCode}_${intervalCode}_${statusCode}` : '---'}
                                    </p>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md">
                                    <label className="text-sm font-bold text-slate-700">Plan Enabled?</label>
                                    <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">Active From Validity</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={activeFromType === 'indefinite'} onChange={() => setActiveFromType('indefinite')} className="text-indigo-600" />
                                            <span className="text-xs font-semibold text-slate-600">Indefinitely</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={activeFromType === 'specific'} onChange={() => setActiveFromType('specific')} className="text-indigo-600" />
                                            <span className="text-xs font-semibold text-slate-600">Specific Date</span>
                                        </label>
                                    </div>
                                    {activeFromType === 'specific' && (
                                        <input type="date" value={activeFromDate} onChange={e => setActiveFromDate(e.target.value)} className="mt-2 block w-full p-2 border border-slate-300 rounded-md text-sm" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {duplicateError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 font-bold">{duplicateError}</p>}
                        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100">{error}</p>}

                        <div className="flex justify-between pt-6 border-t mt-4">
                            <Button variant="secondary" onClick={() => setStep(1)} disabled={isLoading || isEditing || !!initialData} className="!w-auto">&larr; Back to Selection</Button>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto">Cancel</Button>
                                <Button 
                                    onClick={handleSave} 
                                    isLoading={isLoading} 
                                    disabled={!!duplicateError || !disciplineCode || !intervalCode || !statusCode}
                                    style={{ backgroundColor: (duplicateError || !disciplineCode || !intervalCode || !statusCode) ? '#CBD5E1' : theme.colorPrimary }} 
                                    className="!w-auto shadow-lg shadow-indigo-100 font-bold"
                                >
                                    {isEditing ? 'Update Header' : 'Generate Master Plan'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MasterPlanModal;