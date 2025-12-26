
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkRequest, RiskCategory, RiskSubcategory, NotificationSource } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import Input from '../../../Input';
import Button from '../../../Button';

const { Timestamp } = firebase.firestore;

interface CreateWorkRequestProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onComplete: () => void;
  requestToEdit?: WorkRequest | null;
}

const CreateWorkRequest: React.FC<CreateWorkRequestProps> = ({ currentUser, theme, organisation, onComplete, requestToEdit }) => {
  const isEditing = !!requestToEdit;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [raisedById, setRaisedById] = useState(currentUser.uid);
  const [tagSource, setTagSource] = useState('');
  
  const [hierarchy, setHierarchy] = useState<{
    l3: HierarchyNode[], l4: HierarchyNode[], l5: HierarchyNode[], l6: HierarchyNode[], l7: HierarchyNode[]
  }>({ l3: [], l4: [], l5: [], l6: [], l7: [] });
  
  const [selection, setSelection] = useState({
    l1: currentUser.allocationLevel1Id || '',
    l2: currentUser.allocationLevel2Id || '',
    l3: '', l4: '', l5: '', l6: '', l7: ''
  });

  const [levelNames, setLevelNames] = useState({ l1: '', l2: '', l3: '', l4: '', l5: '', l6: '', l7: '' });
  const [formReady, setFormReady] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState<Record<string, boolean>>({});

  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>([]);
  const [riskSubcategories, setRiskSubcategories] = useState<RiskSubcategory[]>([]);
  const [selectedRisk, setSelectedRisk] = useState({ category: '', subcategory: '' });
  
  const [allEmployees, setAllEmployees] = useState<AppUser[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);

  const [tagSources, setTagSources] = useState<NotificationSource[]>([]);
  const [loadingTagSources, setLoadingTagSources] = useState(true);
  
  const today = new Date().toISOString().split('T')[0];

  const fetchHierarchyLevel = useCallback(async (level: number, parentPath?: string) => {
    if (level > 1 && !parentPath) return [];
    const path = parentPath 
      ? `${parentPath}/level_${level}` 
      : `organisations/${organisation.domain}/level_1`;
    
    const ref = db.collection(path);
    const q = ref.orderBy('name');
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode & { path: string }));
  }, [organisation.domain]);

  const resetChildren = (level: number) => {
    const newHierarchy: any = {};
    const newSelection: any = {};
    const newLevelNames: any = {};
    for (let i = level + 1; i <= 7; i++) {
        newHierarchy[`l${i}`] = [];
        newSelection[`l${i}`] = '';
        newLevelNames[`l${i}`] = '';
    }
    setHierarchy(prev => ({...prev, ...newHierarchy}));
    setSelection(prev => ({...prev, ...newSelection}));
    setLevelNames(prev => ({ ...prev, ...newLevelNames}));
  };
  
  useEffect(() => {
    setLoadingHierarchy(true);
    const initialFetch = async () => {
        try {
            const l1Id = isEditing && requestToEdit?.allocationLevel1Id ? requestToEdit.allocationLevel1Id : currentUser.allocationLevel1Id;
            const l2Id = isEditing && requestToEdit?.allocationLevel2Id ? requestToEdit.allocationLevel2Id : currentUser.allocationLevel2Id;

            if (!l1Id || !l2Id) {
                throw new Error("User/Request must be allocated to a Level 1 and Level 2.");
            }

            const l1Path = `organisations/${organisation.domain}/level_1/${l1Id}`;
            const l2Path = `${l1Path}/level_2/${l2Id}`;

            const [l1Doc, l2Doc, l3Data, employeesSnapshot, riskCategoriesSnapshot] = await Promise.all([
                db.doc(l1Path).get(),
                db.doc(l2Path).get(),
                fetchHierarchyLevel(3, l2Path),
                db.collection('users').where('domain', '==', organisation.domain).where('allocationLevel2Id', '==', l2Id).get(),
                db.collection('modules/AM/Risks').orderBy('name').get()
            ]);

            const newLevelNames: any = {};
            if (l1Doc.exists) newLevelNames.l1 = l1Doc.data()!.name; else throw new Error("Allocated Level 1 not found.");
            if (l2Doc.exists) newLevelNames.l2 = l2Doc.data()!.name; else throw new Error("Allocated Level 2 not found.");
            
            setLevelNames(prev => ({ ...prev, ...newLevelNames }));
            setHierarchy(prev => ({ ...prev, l3: l3Data }));
            
            setAllEmployees(employeesSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)).sort((a, b) => a.firstName.localeCompare(b.firstName)));
            setRiskCategories(riskCategoriesSnapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as RiskCategory)));
            
            if (isEditing && requestToEdit) {
                 setTitle(requestToEdit.title);
                setDescription(requestToEdit.description);
                setRequestDate(requestToEdit.requestDate);
                setRaisedById(requestToEdit.raisedBy.uid);
                setTagSource(requestToEdit.tagSource);
                setSelectedRisk({ category: requestToEdit.impactCategoryCode, subcategory: requestToEdit.impactSubcategoryCode });
                setSelection({
                    l1: requestToEdit.allocationLevel1Id || '', l2: requestToEdit.allocationLevel2Id || '',
                    l3: requestToEdit.allocationLevel3Id || '', l4: requestToEdit.allocationLevel4Id || '',
                    l5: requestToEdit.allocationLevel5Id || '', l6: requestToEdit.allocationLevel6Id || '',
                    l7: requestToEdit.allocationLevel7Id || '',
                });
            }

        } catch (err: any) {
            setError("Failed to load initial data: " + err.message);
        } finally {
            setLoadingHierarchy(false);
        }
    };
    initialFetch();
  }, [currentUser, organisation.domain, fetchHierarchyLevel, isEditing, requestToEdit]);

  useEffect(() => {
    setLoadingTagSources(true);
    const sourcesRef = db.collection('modules/AM/Sources');
    const q = sourcesRef.where('enabled', '==', true).orderBy('name');
    const unsubscribe = q.onSnapshot((snapshot) => {
        const sourcesData = snapshot.docs.map(doc => ({ ...doc.data() } as NotificationSource));
        setTagSources(sourcesData);
        setLoadingTagSources(false);
    }, (err) => {
        setError('Failed to load notification sources: ' + err.message);
        setLoadingTagSources(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selection.l3) { resetChildren(3); setFormReady(false); return; }
    const node = hierarchy.l3.find(n => n.id === selection.l3) || (isEditing ? {id: selection.l3, path: `organisations/${organisation.domain}/level_1/${selection.l1}/level_2/${selection.l2}/level_3/${selection.l3}`} : undefined) as any;
    if (!node) return;
    setLevelNames(p => ({...p, l3: node.name}));
    setLoadingLevels(p => ({...p, l4: true}));
    fetchHierarchyLevel(4, node.path).then(data => { setHierarchy(prev => ({...prev, l4: data})); setLoadingLevels(p => ({...p, l4: false})); });
  }, [selection.l3, hierarchy.l3, isEditing, organisation.domain, selection.l1, selection.l2, fetchHierarchyLevel]);

  useEffect(() => {
    if (!selection.l4) { resetChildren(4); setFormReady(false); return; }
    const node = hierarchy.l4.find(n => n.id === selection.l4) || (isEditing ? {id: selection.l4, path: `organisations/${organisation.domain}/level_1/${selection.l1}/level_2/${selection.l2}/level_3/${selection.l3}/level_4/${selection.l4}`} : undefined) as any;
    if (!node) return;
    setLevelNames(p => ({...p, l4: node.name}));
    setLoadingLevels(p => ({...p, l5: true}));
    fetchHierarchyLevel(5, node.path).then(data => { setHierarchy(prev => ({...prev, l5: data})); setLoadingLevels(p => ({...p, l5: false})); });
  }, [selection.l4, hierarchy.l4, isEditing, organisation.domain, selection.l1, selection.l2, selection.l3, fetchHierarchyLevel]);

  useEffect(() => {
    if (!selection.l5) { resetChildren(5); setFormReady(false); return; }
    const node = hierarchy.l5.find(n => n.id === selection.l5) || (isEditing ? {id: selection.l5, path: `organisations/${organisation.domain}/level_1/${selection.l1}/level_2/${selection.l2}/level_3/${selection.l3}/level_4/${selection.l4}/level_5/${selection.l5}`} : undefined) as any;
    if (!node) return;
    setLevelNames(p => ({...p, l5: node.name}));
    setLoadingLevels(p => ({...p, l6: true}));
    fetchHierarchyLevel(6, node.path).then(data => { setHierarchy(prev => ({...prev, l6: data})); setLoadingLevels(p => ({...p, l6: false})); });
  }, [selection.l5, hierarchy.l5, isEditing, organisation.domain, selection.l1, selection.l2, selection.l3, selection.l4, fetchHierarchyLevel]);
  
  useEffect(() => {
    if (!selection.l6) { resetChildren(6); setFormReady(false); return; }
    const node = hierarchy.l6.find(n => n.id === selection.l6) || (isEditing ? {id: selection.l6, path: `organisations/${organisation.domain}/level_1/${selection.l1}/level_2/${selection.l2}/level_3/${selection.l3}/level_4/${selection.l4}/level_5/${selection.l5}/level_6/${selection.l6}`} : undefined) as any;
    if (!node) return;
    setLevelNames(p => ({...p, l6: node.name}));
    setLoadingLevels(p => ({...p, l7: true}));
    fetchHierarchyLevel(7, node.path).then(data => {
        setHierarchy(prev => ({...prev, l7: data}));
        if (data.length === 0) setFormReady(true);
        setLoadingLevels(p => ({...p, l7: false}));
    });
  }, [selection.l6, hierarchy.l6, isEditing, organisation.domain, selection.l1, selection.l2, selection.l3, selection.l4, selection.l5, fetchHierarchyLevel]);

  useEffect(() => {
    if (selection.l7) {
        const node = hierarchy.l7.find(n => n.id === selection.l7);
        setLevelNames(p => ({...p, l7: node?.name || ''}));
        setFormReady(true);
    } else {
        if (selection.l6 && (hierarchy.l7.length === 0 || !isEditing) && !loadingLevels.l7) {
            setFormReady(true);
        } else {
            setFormReady(false);
        }
    }
  }, [selection.l7, selection.l6, hierarchy.l7, loadingLevels.l7, isEditing]);
  
  useEffect(() => {
    if (!selectedRisk.category) { setRiskSubcategories([]); setSelectedRisk(prev => ({...prev, subcategory: ''})); return; }
    const subcategoriesRef = db.collection(`modules/AM/Risks/${selectedRisk.category}/Subcategories`);
    const qSubcategories = subcategoriesRef.orderBy('name');
    const unsubSubcategories = qSubcategories.onSnapshot(snapshot => { setRiskSubcategories(snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as RiskSubcategory))); });
    return unsubSubcategories;
  }, [selectedRisk.category]);

  const handleBreadcrumbClick = (level: number) => {
    const newSelection: any = {...selection}; const newNames: any = {...levelNames};
    for (let i = level; i <= 7; i++) { newSelection[`l${i}`] = ''; newNames[`l${i}`] = ''; }
    setSelection(newSelection); setLevelNames(newNames); setFormReady(false);
  };

  const filteredEmployees = useMemo(() => { return allEmployees.filter(emp => (`${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase().includes(employeeSearch.toLowerCase()))); }, [allEmployees, employeeSearch]);
  const selectedSourceDescription = useMemo(() => { return tagSources.find(s => s.code === tagSource)?.description || ''; }, [tagSource, tagSources]);
  const selectedSubcategoryDescription = useMemo(() => { return riskSubcategories.find(s => s.code === selectedRisk.subcategory)?.description || ''; }, [riskSubcategories, selectedRisk.subcategory]);
  const handleDescriptionBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => { const value = e.target.value.trim(); if (value) { const sentenceCased = value.charAt(0).toUpperCase() + value.slice(1); setDescription(sentenceCased); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !formReady || !tagSource || !selectedRisk.subcategory) { setError('Title, a complete hierarchy selection, Tag Source, and Impact are required.'); return; }
    setLoading(true); setError('');
    
    try {
        const l1Node = { id: selection.l1, name: levelNames.l1 };
        const l2Node = { id: selection.l2, name: levelNames.l2 };
        const l3Node = hierarchy.l3.find(n => n.id === selection.l3);
        const l4Node = hierarchy.l4.find(n => n.id === selection.l4);
        const l5Node = hierarchy.l5.find(n => n.id === selection.l5);
        const assetNode = hierarchy.l6.find(n => n.id === selection.l6);
        const assemblyNode = hierarchy.l7.find(n => n.id === selection.l7);

        const targetNode = assemblyNode || assetNode;
        const selectedRaisedBy = raisedById === currentUser.uid ? currentUser : allEmployees.find(e => e.uid === raisedById);
        const selectedRiskCategory = riskCategories.find(c => c.code === selectedRisk.category);
        const selectedRiskSubcategory = riskSubcategories.find(s => s.code === selectedRisk.subcategory);

        if (!targetNode || !selectedRaisedBy || !selectedRiskCategory || !selectedRiskSubcategory) { throw new Error('Invalid selection data. Please re-check your selections.'); }

        const payload = {
            title, description, assemblyPath: targetNode.path, assemblyName: targetNode.name, assemblyCode: targetNode.code,
            allocationLevel1Id: l1Node?.id || '', allocationLevel1Name: l1Node?.name || '',
            allocationLevel2Id: l2Node?.id || '', allocationLevel2Name: l2Node?.name || '',
            allocationLevel3Id: l3Node?.id || '', allocationLevel3Name: l3Node?.name || '',
            allocationLevel4Id: l4Node?.id || '', allocationLevel4Name: l4Node?.name || '',
            allocationLevel5Id: l5Node?.id || '', allocationLevel5Name: l5Node?.name || '',
            allocationLevel6Id: assetNode?.id || '', allocationLevel6Name: assetNode?.name || '',
            allocationLevel7Id: assemblyNode?.id || '', allocationLevel7Name: assemblyNode?.name || '',
            requestDate,
            raisedBy: { uid: selectedRaisedBy.uid, name: `${selectedRaisedBy.firstName} ${selectedRaisedBy.lastName}` },
            tagSource,
            impactCategoryCode: selectedRiskCategory.code, impactCategoryName: selectedRiskCategory.name,
            impactSubcategoryCode: selectedRiskSubcategory.code, impactSubcategoryName: selectedRiskSubcategory.name,
            impactSubcategoryDescription: selectedRiskSubcategory.description,
        };

        if (isEditing && requestToEdit) {
            const workRequestRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests').doc(requestToEdit.id);
            const updatePayload = { ...payload, updatedAt: Timestamp.now(), updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` } };
            await workRequestRef.update(updatePayload);
        } else {
            const counterRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('settings').doc('counters');
            const workRequestsRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('workRequests');
            
            const newWrId = await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let newCount = 1;
                if (counterDoc.exists) { newCount = (counterDoc.data()?.workRequestCounter || 0) + 1; }
                transaction.set(counterRef, { workRequestCounter: newCount }, { merge: true });
                return `WR${newCount.toString(16).toUpperCase().padStart(8, '0')}`;
            });
            
            const createPayload = { ...payload, wrId: newWrId, status: 'CREATED', createdAt: Timestamp.now(), createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` } };
            await workRequestsRef.add(createPayload);
        }
        onComplete();
    } catch (err: any) {
        setError(err.message || 'Failed to process work request.');
    } finally {
        setLoading(false);
    }
  };

  const BreadcrumbItem: React.FC<{label: string, onClick?: () => void}> = ({ label, onClick }) => ( <div className="flex items-center"> {onClick ? ( <button type="button" onClick={onClick} className="text-sm font-medium hover:underline" style={{color: theme.colorPrimary}}> {label} </button> ) : ( <span className="text-sm font-medium text-slate-700">{label}</span> )} <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg> </div> );

  return (
    <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">{isEditing ? `Edit Work Request: ${requestToEdit!.wrId}` : 'Create New Work Request'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-700">Select Asset / Assembly</h3>
            <p className="text-sm text-slate-500 -mt-4">Select the specific item that requires attention. The rest of the form will appear once selection is complete.</p>
            {loadingHierarchy ? <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin" style={{borderColor: theme.colorPrimary}}></div></div> :
            <>
                <div className="flex flex-wrap items-center gap-1 bg-white p-3 rounded-md border">
                    <span className="text-sm font-medium text-slate-500">{levelNames.l1}</span> <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    <span className="text-sm font-medium text-slate-500">{levelNames.l2}</span> <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    {selection.l3 && <BreadcrumbItem label={levelNames.l3} onClick={() => handleBreadcrumbClick(3)} />} {selection.l4 && <BreadcrumbItem label={levelNames.l4} onClick={() => handleBreadcrumbClick(4)} />}
                    {selection.l5 && <BreadcrumbItem label={levelNames.l5} onClick={() => handleBreadcrumbClick(5)} />} {selection.l6 && <BreadcrumbItem label={levelNames.l6} onClick={() => handleBreadcrumbClick(6)} />}
                    {selection.l7 && <BreadcrumbItem label={levelNames.l7} />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input id="l3Select" label="Lvl 3: Site" as="select" value={selection.l3} onChange={e => {setSelection(p => ({...p, l3: e.target.value})); resetChildren(3);}} required> <option value="">Select...</option>{hierarchy.l3.map(n => <option key={n.id} value={n.id}>{n.name}</option>)} </Input>
                    {selection.l3 && <Input id="l4Select" label="Lvl 4: Department" as="select" value={selection.l4} onChange={e => {setSelection(p => ({...p, l4: e.target.value})); resetChildren(4);}} disabled={!selection.l3} required> <option value="">Select...</option>{hierarchy.l4.map(n => <option key={n.id} value={n.id}>{n.name}</option>)} </Input>}
                    {selection.l4 && <Input id="l5Select" label="Lvl 5: Section" as="select" value={selection.l5} onChange={e => {setSelection(p => ({...p, l5: e.target.value})); resetChildren(5);}} disabled={!selection.l4} required> <option value="">Select...</option>{hierarchy.l5.map(n => <option key={n.id} value={n.id}>{n.name}</option>)} </Input>}
                    {selection.l5 && <Input id="l6Select" label="Lvl 6: Asset" as="select" value={selection.l6} onChange={e => {setSelection(p => ({...p, l6: e.target.value})); resetChildren(6);}} disabled={!selection.l5} required> <option value="">Select...</option>{hierarchy.l6.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)} </Input>}
                    {selection.l6 && !loadingLevels.l7 && hierarchy.l7.length > 0 && <Input id="l7Select" label="Lvl 7: Assembly" as="select" value={selection.l7} onChange={e => setSelection(p => ({...p, l7: e.target.value}))} disabled={!selection.l6} required> <option value="">Select...</option>{hierarchy.l7.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)} </Input>}
                </div>
            </>
            }
            {formReady && ( <> <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t mt-6"> <Input id="requestDate" label="Request Date" type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} max={today} required /> <div> <label className="block text-sm font-medium text-slate-700">Raised By</label> <Input id="employeeSearch" type="search" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Search employee..." containerClassName="mb-1" label="" /> <select value={raisedById} onChange={e => setRaisedById(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"> <option value={currentUser.uid}>Self ({currentUser.firstName} {currentUser.lastName})</option> {filteredEmployees.map(emp => ( <option key={emp.uid} value={emp.uid}>{emp.firstName} {emp.lastName}</option> ))} </select> </div> <div> <Input id="tagSource" as="select" label="Tag Source" value={tagSource} onChange={e => setTagSource(e.target.value)} required> <option value="">{loadingTagSources ? 'Loading...' : 'Select source...'}</option> {tagSources.map(opt => <option key={opt.code} value={opt.code}>{opt.name}</option>)} </Input> {selectedSourceDescription && <p className="text-xs text-slate-500 mt-1 p-2 bg-slate-100 rounded-md">{selectedSourceDescription}</p>} </div> </div> <Input id="title" label="Request" value={title} onChange={e => setTitle(e.target.value.toUpperCase())} maxLength={30} required /> <Input id="description" as="textarea" label="Description" value={description} onChange={e => setDescription(e.target.value)} onBlur={handleDescriptionBlur} rows={4} /> <h3 className="text-lg font-semibold text-slate-700 pt-4 border-t">Impact</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Input id="impactCategory" as="select" label="Impact Category" value={selectedRisk.category} onChange={e => setSelectedRisk({ category: e.target.value, subcategory: '' })} required> <option value="">Select Category...</option> {riskCategories.map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)} </Input> <Input id="impactSubcategory" as="select" label="Impact Subcategory" value={selectedRisk.subcategory} onChange={e => setSelectedRisk(p => ({...p, subcategory: e.target.value}))} disabled={!selectedRisk.category} required> <option value="">Select Subcategory...</option> {riskSubcategories.map(sub => <option key={sub.code} value={sub.code}>{sub.name}</option>)} </Input> </div> {selectedSubcategoryDescription && <p className="text-sm text-slate-600 p-3 bg-slate-100 rounded-md">{selectedSubcategoryDescription}</p>} {error && <p className="text-sm text-red-600">{error}</p>} <div className="flex justify-end gap-4 pt-4"> <Button type="button" variant="secondary" onClick={onComplete}>Cancel</Button> <Button type="submit" isLoading={loading} style={{ backgroundColor: theme.colorPrimary }}>{isEditing ? 'Save Changes' : 'Submit Request'}</Button> </div> </> )}
        </form>
    </div>
  );
};

export default CreateWorkRequest;
