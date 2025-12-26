


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { db, firebaseConfig } from '../../services/firebase';
import { collection, query, orderBy, getDocs, where, doc, updateDoc } from 'firebase/firestore';
import { addLog } from '../../services/logger';
import type { AppUser, MemsSettings, Organisation } from '../../types';
import type { NextOfKin, Role, EmploymentHistoryEntry, FamilyMember } from '../../types/hr_types';
import Input from '../Input';
import Button from '../Button';
import CountryCodeSelect from '../CountryCodeSelect';
import Modal from '../common/Modal';
import ConfirmationModal from '../common/ConfirmationModal';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { levelInfo } from './HierarchyNodeModal';

interface EmployeeProfileProps {
  employeeUid: string; // 'new' for creating a new employee
  onBack: () => void;
  currentUserProfile: AppUser;
  theme: Organisation['theme'];
}

interface HierarchyTree {
    [id: string]: {
        node: { id: string; name: string; path: string; };
        children: HierarchyTree;
    }
}

type Tab = 'basicInfo' | 'employment' | 'contacts' | 'family' | 'currentRole' | 'previousRoles' | 'education' | 'skills';

const reasonForLeavingOptions: EmploymentHistoryEntry['reasonForLeaving'][] = [
    'New Assignment',
    'Promotion',
    'End of Contract',
    'End of Acting Period',
    'Expired',
    'Retirement',
    'Resignation',
    'Dismissal',
    'Death',
    'Other',
];

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ employeeUid, onBack, currentUserProfile, theme }) => {
    const [employee, setEmployee] = useState<Partial<AppUser>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const [nationalityIsoCode, setNationalityIsoCode] = useState('US');
    const [workPhone, setWorkPhone] = useState({ countryCode: 'US', nationalNumber: '' });
    const [nokPhones, setNokPhones] = useState<{ countryCode: string, nationalNumber: string }[]>([]);

    const [fullHierarchy, setFullHierarchy] = useState<HierarchyTree>({});
    const [loadingHierarchy, setLoadingHierarchy] = useState(true);
    const [selectedAllocation, setSelectedAllocation] = useState({ level1: '', level2: '', level3: '', level4: '' });
    
    const [activeTab, setActiveTab] = useState<Tab>('basicInfo');

    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [allEmployees, setAllEmployees] = useState<AppUser[]>([]);
    
    // Role state
    const [substantiveRole, setSubstantiveRole] = useState<Partial<EmploymentHistoryEntry> | null>(null);
    const [actingRole, setActingRole] = useState<Partial<EmploymentHistoryEntry> | null>(null);
    const [previousRoles, setPreviousRoles] = useState<EmploymentHistoryEntry[]>([]);

    const [archiveModalState, setArchiveModalState] = useState<{
        isOpen: boolean;
        roleToArchive: Partial<EmploymentHistoryEntry> | null;
        endDate: string;
        reason: EmploymentHistoryEntry['reasonForLeaving'];
        isLoading: boolean;
    }>({
        isOpen: false,
        roleToArchive: null,
        endDate: new Date().toISOString().split('T')[0],
        reason: 'New Assignment',
        isLoading: false,
    });

    const [familyModalState, setFamilyModalState] = useState<{ isOpen: boolean; member: Partial<FamilyMember> | null }>({ isOpen: false, member: null });
    const [familyMemberToDelete, setFamilyMemberToDelete] = useState<FamilyMember | null>(null);

    const isNew = employeeUid === 'new';
    const orgDomain = currentUserProfile.domain;
    const today = new Date().toISOString().split('T')[0];

    const fetchFullHierarchy = useCallback(async () => {
        setLoadingHierarchy(true);
        const hierarchyTree: HierarchyTree = {};
        async function fetchChildren(parentPath: string, level: number, treeNode: HierarchyTree) {
            if (level > 4) return; // Updated to include Level 4
            const collectionRef = collection(db, parentPath);
            const snapshot = await getDocs(query(collectionRef, orderBy('name')));
            for (const doc of snapshot.docs) {
                const nodeData = { id: doc.id, name: doc.data().name, path: doc.ref.path };
                treeNode[doc.id] = { node: nodeData, children: {} };
                await fetchChildren(`${doc.ref.path}/level_${level + 1}`, level + 1, treeNode[doc.id].children);
            }
        }
        await fetchChildren(`organisations/${orgDomain}/level_1`, 1, hierarchyTree);
        setFullHierarchy(hierarchyTree);
        setLoadingHierarchy(false);
    }, [orgDomain]);

    useEffect(() => {
        const fetchDropdownData = async () => {
            if (!orgDomain) return;
            const rolesRef = collection(db, 'organisations', orgDomain, 'roles');
            const rolesSnap = await getDocs(query(rolesRef, orderBy('name')));
            setAllRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
    
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(query(usersRef, where('domain', '==', orgDomain), orderBy('firstName')));
            setAllEmployees(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
        };
        fetchDropdownData();
    }, [orgDomain]);
    
    const getNextRoleStartDate = (history: EmploymentHistoryEntry[], employeeStartDate?: string) => {
        const mostRecentSubstantive = history
            .filter(r => r.employmentType !== 'Acting' && r.endDate && r.endDate !== 'To Date')
            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

        if (mostRecentSubstantive) {
            return mostRecentSubstantive.endDate;
        }
        return employeeStartDate || '';
    };

    useEffect(() => {
        fetchFullHierarchy();

        if (isNew) {
            const initialData: Partial<AppUser> = { domain: orgDomain, status: 'active', accessLevel: 1, nextOfKin: [], employmentHistory: [], familyMembers: [] };
            setEmployee(initialData);
            setWorkPhone({ countryCode: currentUserProfile.nationality || 'US', nationalNumber: '' });
            setNokPhones([]);
            setSubstantiveRole({ id: `new_${Date.now()}`, employmentType: 'Permanent', endDate: 'To Date', archived: false });
            setActingRole(null);
            setPreviousRoles([]);
            setLoading(false);
        } else {
            const unsubscribe = db.collection('users').doc(employeeUid).onSnapshot(doc => {
                if (doc.exists) {
                    const data = { uid: doc.id, ...doc.data() } as AppUser;
                    if (!data.familyMembers) {
                        data.familyMembers = [];
                    }
                    setEmployee(data);
                    
                    const parsedWorkPhone = parsePhoneNumberFromString(data.phoneNumber || '', 'US');
                    setWorkPhone({ countryCode: parsedWorkPhone?.country || 'US', nationalNumber: parsedWorkPhone?.nationalNumber || data.phoneNumber || '' });
                    const parsedNokPhones = (data.nextOfKin || []).map(nok => {
                        const parsed = parsePhoneNumberFromString(nok.phoneNumber || '', 'US');
                        return { countryCode: parsed?.country || 'US', nationalNumber: parsed?.nationalNumber || nok.phoneNumber || '' };
                    });
                    setNokPhones(parsedNokPhones);
                    setNationalityIsoCode(data.nationality || 'US');
                    setSelectedAllocation({ 
                        level1: data.allocationLevel1Id || '', 
                        level2: data.allocationLevel2Id || '', 
                        level3: data.allocationLevel3Id || '',
                        level4: data.allocationLevel4Id || '' 
                    });

                    // Role processing
                    const history = data.employmentHistory || [];
                    
                    const currentRolesFromDB = history.filter(role => !role.archived);
                    const previousRolesFromDB = history.filter(role => role.archived)
                        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

                    setPreviousRoles(previousRolesFromDB);

                    let currentSubstantive: Partial<EmploymentHistoryEntry> | null = null;
                    let currentActing: Partial<EmploymentHistoryEntry> | null = null;

                    currentRolesFromDB.forEach(role => {
                        if (role.employmentType === 'Acting') {
                            if (!currentActing || new Date(role.startDate) > new Date(currentActing.startDate!)) {
                                currentActing = role;
                            }
                        } else {
                            if (!currentSubstantive || new Date(role.startDate) > new Date(currentSubstantive.startDate!)) {
                                currentSubstantive = role;
                            }
                        }
                    });

                    setActingRole(currentActing);
                    setSubstantiveRole(currentSubstantive || { 
                        id: `new_${Date.now()}`, 
                        employmentType: 'Permanent', 
                        endDate: 'To Date', 
                        startDate: getNextRoleStartDate(previousRolesFromDB, data.startDate),
                        archived: false 
                    });

                } else { setError('Employee not found'); }
                setLoading(false);
            }, err => { setError(err.message); setLoading(false); });
            return unsubscribe;
        }
    }, [employeeUid, isNew, orgDomain, fetchFullHierarchy, currentUserProfile.nationality]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setError('');

        let finalHistory: EmploymentHistoryEntry[] = [...previousRoles];
        
        if (substantiveRole && substantiveRole.roleId) {
             const isFirstRole = previousRoles.filter(r => r.employmentType !== 'Acting').length === 0;
             const finalSubstantive = {
                ...substantiveRole,
                startDate: isFirstRole && employee.startDate ? employee.startDate : substantiveRole.startDate,
                endDate: 'To Date',
                archived: false,
             }
             finalHistory.push(finalSubstantive as EmploymentHistoryEntry);
        }

        if (actingRole && actingRole.roleId) {
            finalHistory.push({ ...actingRole, archived: false } as EmploymentHistoryEntry);
        }
        
        const dataToSave: Partial<AppUser> = { ...employee, employmentHistory: finalHistory };

        const parsedWorkPhone = parsePhoneNumberFromString(workPhone.nationalNumber, workPhone.countryCode as CountryCode);
        dataToSave.phoneNumber = parsedWorkPhone?.number || workPhone.nationalNumber;
        const finalNextOfKin = (dataToSave.nextOfKin || []).map((nok: NextOfKin, index: number) => {
            const phoneState = nokPhones[index];
            const parsedNokPhone = parsePhoneNumberFromString(phoneState.nationalNumber, phoneState.countryCode as CountryCode);
            return { ...nok, id: nok.id.startsWith('temp_') ? db.collection('users').doc().id : nok.id, phoneNumber: parsedNokPhone?.number || phoneState.nationalNumber };
        }).filter(nok => nok.firstName?.trim() || nok.lastName?.trim() || nok.phoneNumber?.trim());
        dataToSave.nextOfKin = finalNextOfKin;
        
        const finalFamilyMembers = (dataToSave.familyMembers || []).map((member: FamilyMember) => {
            const newMember: Partial<FamilyMember> = { ...member };
            if (newMember.id!.startsWith('temp_')) {
                newMember.id = db.collection('users').doc().id;
            }
            if (newMember.relationship !== 'Child' && 'dateOfBirth' in newMember) {
                delete newMember.dateOfBirth;
            }
            return newMember as FamilyMember;
        }).filter(member => member.firstName?.trim() || member.lastName?.trim());
        dataToSave.familyMembers = finalFamilyMembers;
        
        const allocationData: Partial<AppUser> = {};
        if (selectedAllocation.level1 && fullHierarchy[selectedAllocation.level1]) {
            const l1 = fullHierarchy[selectedAllocation.level1];
            allocationData.allocationLevel1Id = l1.node.id;
            allocationData.allocationLevel1Name = l1.node.name;
            
            if (selectedAllocation.level2 && l1.children[selectedAllocation.level2]) {
                const l2 = l1.children[selectedAllocation.level2];
                allocationData.allocationLevel2Id = l2.node.id;
                allocationData.allocationLevel2Name = l2.node.name;
                
                if (selectedAllocation.level3 && l2.children[selectedAllocation.level3]) {
                     const l3 = l2.children[selectedAllocation.level3];
                    allocationData.allocationLevel3Id = l3.node.id;
                    allocationData.allocationLevel3Name = l3.node.name;

                    if (selectedAllocation.level4 && l3.children[selectedAllocation.level4]) {
                        const l4 = l3.children[selectedAllocation.level4];
                        allocationData.allocationLevel4Id = l4.node.id;
                        allocationData.allocationLevel4Name = l4.node.name;
                    } else {
                        allocationData.allocationLevel4Id = '';
                        allocationData.allocationLevel4Name = '';
                    }
                } else { 
                    allocationData.allocationLevel3Id = ''; 
                    allocationData.allocationLevel3Name = '';
                    allocationData.allocationLevel4Id = '';
                    allocationData.allocationLevel4Name = '';
                }
            } else { 
                allocationData.allocationLevel2Id = ''; 
                allocationData.allocationLevel2Name = ''; 
                allocationData.allocationLevel3Id = ''; 
                allocationData.allocationLevel3Name = '';
                allocationData.allocationLevel4Id = '';
                allocationData.allocationLevel4Name = '';
            }
        } else { 
            allocationData.allocationLevel1Id = ''; 
            allocationData.allocationLevel1Name = ''; 
            allocationData.allocationLevel2Id = ''; 
            allocationData.allocationLevel2Name = ''; 
            allocationData.allocationLevel3Id = ''; 
            allocationData.allocationLevel3Name = '';
            allocationData.allocationLevel4Id = '';
            allocationData.allocationLevel4Name = '';
        }

        try {
            if (isNew) {
                const appName = 'employeeCreationApp';
                let secondaryApp: firebase.app.App | undefined;
                try {
                    secondaryApp = firebase.apps.find(app => app.name === appName) || firebase.initializeApp(firebaseConfig, appName);
                    const secondaryAuth = firebase.auth(secondaryApp);
                    const settingsRef = db.collection('settings').doc('memsSetup');
                    const settingsSnap = await settingsRef.get();
                    const defaultPassword = (settingsSnap.data() as MemsSettings)?.defaultPassword;
                    if (!defaultPassword || !dataToSave.email) throw new Error("Default password or email is missing.");
                    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(dataToSave.email, defaultPassword);
                    const newUser = userCredential.user;
                    if (!newUser) throw new Error("User creation failed.");
                    const newUserData = { ...dataToSave, ...allocationData, nationality: nationalityIsoCode, uid: newUser.uid, createdAt: new Date().toISOString(), mustChangePassword: true };
                    await db.collection("users").doc(newUser.uid).set(newUserData);
                    await addLog({ action: 'Employee Created', performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! }, targetUser: { uid: newUser.uid, email: newUser.email! }, details: `New employee created: ${newUserData.firstName} ${newUserData.lastName}.` });
                    await secondaryAuth.signOut();
                    onBack();
                } finally {
                    const existingApp = firebase.apps.find(app => app.name === appName);
                    if (existingApp) await existingApp.delete();
                }
            } else {
                const dataToUpdate:any = { ...dataToSave, ...allocationData, nationality: nationalityIsoCode };
                delete dataToUpdate.uid;
                await db.collection('users').doc(employeeUid).update(dataToUpdate);
                await addLog({ action: 'Employee Updated', performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! }, targetUser: { uid: employeeUid, email: employee.email! }, details: `Updated profile for ${employee.firstName} ${employee.lastName}.` });
                onBack();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }, [employee, isNew, nationalityIsoCode, orgDomain, employeeUid, currentUserProfile, onBack, selectedAllocation, fullHierarchy, workPhone, nokPhones, substantiveRole, actingRole, previousRoles]);

    const handleOpenArchiveModal = (role: Partial<EmploymentHistoryEntry> | null) => {
        if (!role) return;
        setArchiveModalState({
            isOpen: true,
            roleToArchive: role,
            endDate: new Date().toISOString().split('T')[0],
            reason: 'New Assignment',
            isLoading: false,
        });
    };

    const handleConfirmArchive = async () => {
        const { roleToArchive, endDate, reason } = archiveModalState;
        if (!roleToArchive || !roleToArchive.id || !employee) return;
    
        setArchiveModalState(prev => ({ ...prev, isLoading: true }));
        setError('');
    
        try {
            const updatedHistory = (employee.employmentHistory || []).map(role => {
                if (role.id === roleToArchive.id) {
                    return { ...role, endDate, reasonForLeaving: reason, archived: true };
                }
                return role;
            });
    
            await updateDoc(doc(db, 'users', employeeUid), {
                employmentHistory: updatedHistory
            });
            
            await addLog({
                action: 'Employee Role Archived',
                performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
                targetUser: { uid: employeeUid, email: employee.email! },
                details: `Archived role "${roleToArchive.roleName}" for ${employee.firstName} ${employee.lastName}.`
            });
            
            setArchiveModalState({ isOpen: false, roleToArchive: null, endDate: today, reason: 'New Assignment', isLoading: false });
    
        } catch (err: any) {
            setError(err.message);
            setArchiveModalState(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setEmployee(prev => ({ ...prev, [e.target.name]: e.target.value })); };
    const handleNextOfKinChange = (index: number, field: keyof Omit<NextOfKin, 'phoneNumber' | 'id'>, value: string) => { setEmployee(prev => ({ ...prev, nextOfKin: (prev.nextOfKin || []).map((nok, i) => i === index ? {...nok, [field]: value} : nok) }))};
    const handleNokPhoneChange = (index: number, part: 'countryCode' | 'nationalNumber', value: string) => { const newNokPhones = [...nokPhones]; if(newNokPhones[index]) { (newNokPhones[index] as any)[part] = value; setNokPhones(newNokPhones); } };
    const addNok = () => { if((employee.nextOfKin?.length || 0) >= 3) return; const newNok: NextOfKin = { id: `temp_${Date.now()}`, firstName: '', lastName: '', phoneNumber: '', email: '', relationship: 'Other' }; setEmployee(prev => ({ ...prev, nextOfKin: [...(prev.nextOfKin || []), newNok] })); setNokPhones(prev => [...prev, { countryCode: currentUserProfile.nationality || 'US', nationalNumber: '' }]); };
    const removeNok = (index: number) => { setEmployee(prev => ({ ...prev, nextOfKin: prev.nextOfKin?.filter((_, i) => i !== index) })); setNokPhones(prev => prev.filter((_, i) => i !== index)); };

    const openFamilyModal = (member?: FamilyMember) => {
        setFamilyModalState({ isOpen: true, member: member || { id: `temp_${Date.now()}`, relationship: 'Child' } });
    };
    
    const closeFamilyModal = () => {
        setFamilyModalState({ isOpen: false, member: null });
    };

    const handleSaveFamilyMember = async (member: Partial<FamilyMember>) => {
        if (!member || !member.firstName?.trim() || !member.relationship) {
            throw new Error("First name and relationship are required.");
        }
        
        const updatedMembers = [...(employee.familyMembers || [])];
        const existingIndex = updatedMembers.findIndex(m => m.id === member.id);
        
        const finalMember: FamilyMember = {
            ...member,
            id: member.id?.startsWith('temp_') ? doc(collection(db, 'users')).id : member.id,
        } as FamilyMember;
        
        if (finalMember.relationship !== 'Child') {
            delete finalMember.dateOfBirth;
        }

        if (existingIndex > -1) {
            updatedMembers[existingIndex] = finalMember;
        } else {
            updatedMembers.push(finalMember);
        }

        await updateDoc(doc(db, 'users', employeeUid), {
            familyMembers: updatedMembers
        });
        
        await addLog({
            action: existingIndex > -1 ? 'Family Member Updated' : 'Family Member Added',
            performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
            targetUser: { uid: employeeUid, email: employee.email! },
            details: `${existingIndex > -1 ? 'Updated' : 'Added'} family member: ${finalMember.firstName} ${finalMember.lastName}.`
        });
        
        closeFamilyModal();
    };

    const handleDeleteFamilyMember = (id: string) => {
        const member = (employee.familyMembers || []).find(m => m.id === id);
        if (member) {
            setFamilyMemberToDelete(member);
        }
    };
    
    const confirmDeleteFamilyMember = async () => {
        if (!familyMemberToDelete) return;
        setSaving(true);
        const updatedMembers = (employee.familyMembers || []).filter(m => m.id !== familyMemberToDelete.id);
        try {
            await updateDoc(doc(db, 'users', employeeUid), { familyMembers: updatedMembers });
            await addLog({
                action: 'Family Member Deleted',
                performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
                targetUser: { uid: employeeUid, email: employee.email! },
                details: `Deleted family member: ${familyMemberToDelete.firstName} ${familyMemberToDelete.lastName}.`
            });
            setFamilyMemberToDelete(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center p-8"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;

    const TabButton: React.FC<{ tabId: Tab, label: string }> = ({ tabId, label }) => ( <button type="button" onClick={() => setActiveTab(tabId)} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${ activeTab !== tabId && 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300' }`} style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}} aria-current={activeTab === tabId ? 'page' : undefined}>{label}</button> );
    
    const renderTabContent = () => {
        const Placeholder: React.FC<{ title: string }> = ({ title }) => ( <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-b-md"><h3 className="font-semibold text-lg">{title}</h3><p>This section is under development.</p></div> );
        switch (activeTab) {
            case 'basicInfo': return ( <div className="p-6 space-y-4"> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Input id="firstName" name="firstName" label="First Name" value={employee.firstName || ''} onChange={handleChange} required /> <Input id="lastName" name="lastName" label="Last Name" value={employee.lastName || ''} onChange={handleChange} required /> <Input id="email" name="email" label="Work Email" type="email" value={employee.email || ''} onChange={handleChange} required disabled={!isNew} containerClassName={!isNew ? 'bg-slate-100 rounded-md p-2' : ''} /> <Input id="dateOfBirth" name="dateOfBirth" label="Date of Birth" type="date" value={employee.dateOfBirth || ''} onChange={handleChange} max={today} /> <div> <label htmlFor="gender" className="block text-sm font-medium text-slate-700">Gender</label> <select id="gender" name="gender" value={employee.gender || ''} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"> <option value="">Select...</option> <option value="Male">Male</option> <option value="Female">Female</option> <option value="Other">Other</option> </select> </div> <CountryCodeSelect id="nationality" value={nationalityIsoCode} onChange={e => setNationalityIsoCode(e.target.value)} required label="Nationality"/> <Input id="nationalId" name="nationalId" label="National ID / SSN" value={employee.nationalId || ''} onChange={handleChange} /> <Input id="passportNumber" name="passportNumber" label="Passport Number" value={employee.passportNumber || ''} onChange={handleChange} /> </div> </div> );
            case 'employment': return ( <div className="p-6 space-y-6"> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Input id="employeeCode" name="employeeCode" label="Employee Code" value={employee.employeeCode || ''} onChange={handleChange} /> <Input id="startDate" name="startDate" label="Employment Start Date" type="date" value={employee.startDate || ''} onChange={handleChange} max={today} /> <div> <label htmlFor="accessLevel" className="block text-sm font-medium text-slate-700">Access Level</label> <select id="accessLevel" name="accessLevel" value={employee.accessLevel || 1} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"> <option value={1}>1</option> <option value={2}>2</option> <option value={3}>3</option> <option value={4}>4</option> <option value={5}>5</option> </select> </div> <div> <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label> <select id="status" name="status" value={employee.status || 'active'} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"> <option value="active">Active</option> <option value="disabled">Disabled</option> </select> </div> </div> <div> <h3 className="text-lg font-semibold text-slate-700 mb-4 border-t pt-6">Allocation / Location</h3> <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> <div> <label className="block text-sm font-medium text-slate-700">{levelInfo[1].name}</label> <select value={selectedAllocation.level1} onChange={e => setSelectedAllocation({ level1: e.target.value, level2: '', level3: '', level4: '' })} disabled={loadingHierarchy} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"> <option value="">{loadingHierarchy ? 'Loading...' : 'Select...'}</option> {Object.values(fullHierarchy).map((item: any) => item.node).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)} </select> </div> <div> <label className="block text-sm font-medium text-slate-700">{levelInfo[2].name}</label> <select value={selectedAllocation.level2} onChange={e => setSelectedAllocation(p => ({ ...p, level2: e.target.value, level3: '', level4: '' }))} disabled={!selectedAllocation.level1} className="mt-1 block w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-100"> <option value="">Select...</option> {selectedAllocation.level1 ? Object.values(fullHierarchy[selectedAllocation.level1]?.children || {}).map((item: any) => item.node).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>) : []} </select> </div> <div> <label className="block text-sm font-medium text-slate-700">{levelInfo[3].name}</label> <select value={selectedAllocation.level3} onChange={e => setSelectedAllocation(p => ({...p, level3: e.target.value, level4: ''}))} disabled={!selectedAllocation.level2} className="mt-1 block w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-100"> <option value="">Select...</option> {selectedAllocation.level2 ? Object.values(fullHierarchy[selectedAllocation.level1]?.children[selectedAllocation.level2]?.children || {}).map((item: any) => item.node).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>) : []} </select> </div> <div> <label className="block text-sm font-medium text-slate-700">{levelInfo[4].name}</label> <select value={selectedAllocation.level4} onChange={e => setSelectedAllocation(p => ({...p, level4: e.target.value}))} disabled={!selectedAllocation.level3} className="mt-1 block w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-100"> <option value="">Select...</option> {selectedAllocation.level3 ? Object.values(fullHierarchy[selectedAllocation.level1]?.children[selectedAllocation.level2]?.children[selectedAllocation.level3]?.children || {}).map((item: any) => item.node).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>) : []} </select> </div> </div> </div> </div> );
            case 'contacts': const relOpts = ['Friend', 'Colleague', 'Sibling', 'Child', 'Spouse', 'Other']; return ( <div className="p-6 space-y-6"> <div> <h3 className="text-lg font-semibold text-slate-700 mb-4">Contact Information</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div className="grid grid-cols-5 gap-2 items-start"> <div className="col-span-2"><CountryCodeSelect id="countryCode" value={workPhone.countryCode} onChange={e => setWorkPhone(p => ({...p, countryCode: e.target.value}))} required label="Phone Country" /></div> <div className="col-span-3"><Input id="phoneNumber" name="phoneNumber" label="Work Phone" type="tel" value={workPhone.nationalNumber} onChange={e => setWorkPhone(p => ({...p, nationalNumber: e.target.value}))} required error={errors.phoneNumber} /></div> </div> <Input id="personalEmail" name="personalEmail" label="Personal Email Address" type="email" value={employee.personalEmail || ''} onChange={handleChange} /> </div> </div> <div className="border-t pt-6"> <h3 className="text-lg font-semibold text-slate-700 mb-4">Next of Kin</h3> <div className="space-y-6"> {(employee.nextOfKin || []).map((nok, index) => ( <div key={nok.id || index} className="p-4 border rounded-md bg-slate-50 relative"> <h4 className="font-semibold text-slate-600 mb-3">Next of Kin {index + 1}</h4> <button type="button" onClick={() => removeNok(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-xl">&times;</button> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Input id={`nok_firstName_${index}`} label="First Name" value={nok.firstName} onChange={e => handleNextOfKinChange(index, 'firstName', e.target.value)} /> <Input id={`nok_lastName_${index}`} label="Last Name" value={nok.lastName} onChange={e => handleNextOfKinChange(index, 'lastName', e.target.value)} /> <div className="grid grid-cols-5 gap-2 items-start"> <div className="col-span-2"><CountryCodeSelect id={`nok_country_${index}`} value={nokPhones[index]?.countryCode || 'US'} onChange={e => handleNokPhoneChange(index, 'countryCode', e.target.value)} label="Phone Country"/></div> <div className="col-span-3"><Input id={`nok_phone_${index}`} label="Phone Number" type="tel" value={nokPhones[index]?.nationalNumber || ''} onChange={e => handleNokPhoneChange(index, 'nationalNumber', e.target.value)} error={errors[`nokPhone_${index}`]} /></div> </div> <Input id={`nok_email_${index}`} label="Email Address" type="email" value={nok.email || ''} onChange={e => handleNextOfKinChange(index, 'email', e.target.value)} /> <div> <label className="block text-sm font-medium text-slate-700">Relationship</label> <select value={nok.relationship} onChange={e => handleNextOfKinChange(index, 'relationship', e.target.value as NextOfKin['relationship'])} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"> {relOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)} </select> </div> </div> </div> ))} {(employee.nextOfKin?.length || 0) < 3 && ( <Button type="button" onClick={addNok} variant="secondary">+ Add Next of Kin</Button> )} </div> </div> </div> );
            case 'family':
                return (
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-700">Family Members</h3>
                            <Button type="button" onClick={() => openFamilyModal()} variant="secondary" className="!w-auto">
                                + Add Member
                            </Button>
                        </div>
                        {(employee.familyMembers || []).length > 0 ? (
                            <div className="space-y-3">
                                {employee.familyMembers?.map(member => (
                                    <div key={member.id} className="p-3 border rounded-md bg-slate-50 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-slate-800">{member.firstName} {member.lastName}</p>
                                            <p className="text-sm text-slate-600">
                                                {member.relationship}
                                                {member.relationship === 'Child' && member.dateOfBirth && (
                                                    <span className="text-xs text-slate-500 ml-2">(DOB: {member.dateOfBirth})</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button type="button" onClick={() => openFamilyModal(member)} className="p-2 text-blue-600 rounded-full hover:bg-blue-100 transition-colors" title="Edit">
                                                <EditIcon />
                                            </button>
                                            <button type="button" onClick={() => handleDeleteFamilyMember(member.id)} className="p-2 text-red-600 rounded-full hover:bg-red-100 transition-colors" title="Delete">
                                                <DeleteIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-slate-500 py-4">No family members added yet.</p>
                        )}
                    </div>
                );
            case 'currentRole': return ( <div className="p-6 space-y-6"> {substantiveRole && ( <div className="p-4 border rounded-lg shadow-sm"> <div className="flex justify-between items-center mb-4"> <h3 className="text-lg font-semibold text-slate-800">Substantive Role</h3> {!isNew && substantiveRole.roleId && <Button type="button" onClick={() => handleOpenArchiveModal(substantiveRole)} variant="secondary">Archive Current Role</Button>} </div> <RoleForm role={substantiveRole} setRole={setSubstantiveRole} isActing={false} isNew={!substantiveRole.roleId} isFirstRole={previousRoles.filter(r => r.employmentType !== 'Acting').length === 0} allRoles={allRoles} allEmployees={allEmployees} employeeUid={employeeUid} employeeStartDate={employee.startDate} today={today} /> </div> )} <div className="p-4 border rounded-lg shadow-sm"> <h3 className="text-lg font-semibold text-slate-800 mb-4">Acting Role</h3> {actingRole ? ( <> <RoleForm role={actingRole} setRole={setActingRole} isActing={true} isNew={false} isFirstRole={false} allRoles={allRoles} allEmployees={allEmployees} employeeUid={employeeUid} today={today} /> {!isNew && actingRole.roleId && <Button type="button" onClick={() => handleOpenArchiveModal(actingRole)} variant="secondary" className="mt-4 !bg-yellow-100 !text-yellow-800">Archive Acting Role</Button>} </> ) : ( <Button type="button" onClick={() => setActingRole({ id: `new_acting_${Date.now()}`, employmentType: 'Acting', endDate: 'To Date', archived: false })}>+ Add Acting Role</Button> )} </div> </div> );
            case 'previousRoles': return ( <div className="p-6"> {previousRoles.length === 0 ? ( <p>No previous roles recorded.</p> ) : ( <ul className="space-y-4"> {previousRoles.map(role => ( <li key={role.id} className="p-4 border rounded-md bg-slate-50"> <p className="font-semibold">{role.roleName} <span className="text-sm font-normal text-slate-600">({role.employmentType})</span></p> <p className="text-sm text-slate-500">{new Date(role.startDate).toLocaleDateString()} - {role.endDate !== 'To Date' ? new Date(role.endDate).toLocaleDateString() : 'Current'}</p> {role.reportsToPersonName && <p className="text-xs text-slate-500">Reports to: {role.reportsToPersonName}</p>} {role.reasonForLeaving && <p className="text-xs text-slate-500 mt-1">Reason for leaving: <span className="font-medium">{role.reasonForLeaving}</span></p>} </li> ))} </ul> )} </div> );
            case 'education': return <Placeholder title="Education" />;
            case 'skills': return <Placeholder title="Skills" />;
            default: return null;
        }
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm">
            <button onClick={onBack} className="hover:underline mb-4" style={{ color: theme.colorPrimary }}>&larr; Back to Employees</button>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{isNew ? 'Add New Employee' : `Edit: ${employee.firstName} ${employee.lastName}`}</h2>
            <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
                <div className="border-b border-slate-200"><nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabId="basicInfo" label="Basic Information" /> <TabButton tabId="employment" label="Employment" /> <TabButton tabId="contacts" label="Contacts" /> <TabButton tabId="family" label="Family" /> <TabButton tabId="currentRole" label="Current Role" /> <TabButton tabId="previousRoles" label="Previous Roles" /> <TabButton tabId="education" label="Education" /> <TabButton tabId="skills" label="Skills" />
                </nav></div>
                <div className="mt-4 border rounded-md">{renderTabContent()}</div>
                {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
                <div className="flex justify-end pt-6 border-t mt-6">
                    <Button type="submit" isLoading={saving} style={{ backgroundColor: theme.colorPrimary }}>{isNew ? 'Create Employee' : 'Save Changes'}</Button>
                </div>
            </form>
            <Modal isOpen={archiveModalState.isOpen} onClose={() => setArchiveModalState(p => ({...p, isOpen: false, isLoading: false}))} title="Archive Role">
                <div className="space-y-4">
                    <p>You are archiving the role: <span className="font-semibold">{archiveModalState.roleToArchive?.roleName}</span>. Please provide an end date and a reason.</p>
                    <Input id="archiveEndDate" label="End Date" type="date" value={archiveModalState.endDate} onChange={e => setArchiveModalState(p => ({...p, endDate: e.target.value}))} max={today} required />
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Reason for Leaving</label>
                        <select value={archiveModalState.reason} onChange={e => setArchiveModalState(p => ({...p, reason: e.target.value as any}))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md">
                            {reasonForLeavingOptions.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setArchiveModalState(p => ({...p, isOpen: false, isLoading: false}))}>Cancel</Button>
                        <Button type="button" onClick={handleConfirmArchive} isLoading={archiveModalState.isLoading}>Confirm Archive</Button>
                    </div>
                </div>
            </Modal>
            {familyModalState.isOpen && <FamilyMemberModal isOpen={familyModalState.isOpen} onClose={closeFamilyModal} onSave={handleSaveFamilyMember} member={familyModalState.member} employeeFamilyMembers={employee.familyMembers || []} />}
            <ConfirmationModal isOpen={!!familyMemberToDelete} onClose={() => setFamilyMemberToDelete(null)} onConfirm={confirmDeleteFamilyMember} title="Delete Family Member" message={`Are you sure you want to delete ${familyMemberToDelete?.firstName} ${familyMemberToDelete?.lastName}?`} isLoading={saving} />
        </div>
    );
};

interface FamilyMemberModalProps { isOpen: boolean; onClose: () => void; onSave: (member: Partial<FamilyMember>) => Promise<void>; member: Partial<FamilyMember> | null; employeeFamilyMembers: FamilyMember[]; }
const FamilyMemberModal: React.FC<FamilyMemberModalProps> = ({ isOpen, onClose, onSave, member: initialMember, employeeFamilyMembers }) => {
    const [member, setMember] = useState<Partial<FamilyMember>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const familyRelationshipOptions: FamilyMember['relationship'][] = ['Mother', 'Father', 'Spouse', 'Sibling', 'Child', 'Grandmother', 'Grandfather', 'Mother-In-Law', 'Father-In-Law', 'Grandmother-In-Law', 'Grandfather-In-Law'];
    const singleInstanceRelationships: FamilyMember['relationship'][] = ['Mother', 'Father', 'Spouse', 'Grandmother', 'Grandfather', 'Mother-In-Law', 'Father-In-Law', 'Grandmother-In-Law', 'Grandfather-In-Law'];
    const multipleInstanceLimits: Partial<Record<FamilyMember['relationship'], number>> = { 'Sibling': 5, 'Child': 8 };
    
    useEffect(() => {
        if (initialMember) setMember(initialMember);
    }, [initialMember]);

    const relationshipCounts = useMemo(() => {
        const counts: Partial<Record<FamilyMember['relationship'], number>> = {};
        for (const m of employeeFamilyMembers) {
            counts[m.relationship] = (counts[m.relationship] || 0) + 1;
        }
        return counts;
    }, [employeeFamilyMembers]);
    
    const handleChange = (field: keyof FamilyMember, value: string) => {
        setMember(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setModalError('');
        try {
            await onSave(member);
        } catch (e: any) {
            setModalError(e.message || 'Failed to save.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={member.id?.startsWith('temp_') ? 'Add Family Member' : 'Edit Family Member'}>
            <div className="space-y-4">
                <Input id="famFirstName" label="First Name" value={member.firstName || ''} onChange={e => handleChange('firstName', e.target.value)} required />
                <Input id="famLastName" label="Last Name" value={member.lastName || ''} onChange={e => handleChange('lastName', e.target.value)} required />
                <div>
                    <label className="block text-sm font-medium text-slate-700">Relationship</label>
                    <select value={member.relationship || ''} onChange={e => handleChange('relationship', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md">
                        <option value="">Select...</option>
                        {familyRelationshipOptions.map(opt => {
                            const isSingle = singleInstanceRelationships.includes(opt);
                            const limit = multipleInstanceLimits[opt];
                            const currentCount = relationshipCounts[opt] || 0;
                            const isDisabled = (isSingle && currentCount >= 1 && member.relationship !== opt) || (limit && currentCount >= limit && member.relationship !== opt);
                            return (
                                <option key={opt} value={opt} disabled={isDisabled}>
                                    {opt} {isDisabled && '(Limit reached)'}
                                </option>
                            );
                        })}
                    </select>
                </div>
                {member.relationship === 'Child' && (
                    <Input id="famDob" label="Date of Birth" type="date" value={member.dateOfBirth || ''} onChange={e => handleChange('dateOfBirth', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                )}
                {modalError && <p className="text-sm text-red-600">{modalError}</p>}
                <div className="flex justify-end pt-4">
                    <Button type="button" onClick={handleSave} isLoading={isSaving}>Save</Button>
                </div>
            </div>
        </Modal>
    );
};

interface RoleFormProps { role: Partial<EmploymentHistoryEntry>; setRole: React.Dispatch<React.SetStateAction<Partial<EmploymentHistoryEntry> | null>>; isActing: boolean; isNew: boolean; isFirstRole: boolean; allRoles: Role[]; allEmployees: AppUser[]; employeeUid: string; employeeStartDate?: string; today: string; }
const RoleForm: React.FC<RoleFormProps> = ({ role, setRole, isActing, isNew, isFirstRole, allRoles, allEmployees, employeeUid, employeeStartDate, today }) => {
    const handleChange = (field: keyof EmploymentHistoryEntry, value: any) => { setRole(prev => (prev ? { ...prev, [field]: value } : null)); };
    const handleRoleChange = (roleId: string) => {
        const selectedRole = allRoles.find(r => r.id === roleId);
        setRole(prev => prev ? {
            ...prev,
            roleId: roleId,
            roleName: selectedRole?.name || '',
            reportsToRoleId: selectedRole?.reportsToRoleId || null,
            reportsToPersonUid: '', // Reset person when role changes
            reportsToPersonName: '',
        } : null);
    };
    const handleReportsToPersonChange = (uid: string) => {
        const person = allEmployees.find(e => e.uid === uid);
        const personName = person ? `${person.firstName} ${person.lastName}` : '';
        setRole(prev => (prev ? { ...prev, reportsToPersonUid: uid, reportsToPersonName: personName } : null));
    };
    const reportingToEmployees = useMemo(() => { if (!role.reportsToRoleId) return []; return allEmployees.filter(emp => { if (emp.uid === employeeUid || !emp.employmentHistory || emp.employmentHistory.length === 0) return false; const currentRoles = emp.employmentHistory.filter(r => !r.archived); const latestSubstantive = currentRoles.filter(r => r.employmentType !== 'Acting').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]; const latestActing = currentRoles.filter(r => r.employmentType === 'Acting').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]; const currentDisplayRole = latestActing || latestSubstantive; return currentDisplayRole && currentDisplayRole.roleId === role.reportsToRoleId; }); }, [role.reportsToRoleId, allEmployees, employeeUid]);
    if (!role) return null;
    return (
        <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div> <label className="block text-sm font-medium text-slate-700">Role Title</label> <select value={role.roleId || ''} onChange={e => handleRoleChange(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" required> <option value="">Select Role...</option> {allRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)} </select> </div>
                    {isActing ? ( <> <Input id="roleStartDate" label="Start Date" type="date" value={role.startDate || ''} onChange={e => handleChange('startDate', e.target.value)} required max={today} /> <Input id="roleActingExpiry" label="Acting Expiry Date" type="date" value={role.actingEndDate || ''} onChange={e => handleChange('actingEndDate', e.target.value)} required /> </>
                    ) : ( <> <Input id="roleStartDate" label="Start Date" type="date" value={isFirstRole ? (employeeStartDate || '') : (role.startDate || '')} onChange={e => !isFirstRole && handleChange('startDate', e.target.value)} disabled={isFirstRole} required containerClassName={isFirstRole ? 'bg-slate-200 rounded-md p-2 cursor-not-allowed' : ''} max={today}/> {isFirstRole && <p className="text-xs text-slate-500 -mt-2">Start date must match employment start date for the first role.</p>}  </> )}
                </div>
                <div className="space-y-4">
                    {!isActing && ( <div> <label className="block text-sm font-medium text-slate-700">Role Type</label> <select value={role.employmentType || ''} onChange={e => handleChange('employmentType', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"> <option value="Permanent">Permanent</option> <option value="Contract">Contract</option> <option value="Temporary">Temporary</option> </select> </div> )}
                    {role.employmentType === 'Contract' && !isActing && <Input id="contractEndDate" label="Contract Expiry Date" type="date" value={role.contractEndDate || ''} onChange={e => handleChange('contractEndDate', e.target.value)} />}
                    
                    <div> <label className="block text-sm font-medium text-slate-700">Reporting to (Role)</label> <select value={role.reportsToRoleId || ''} disabled className="mt-1 block w-full p-2 border border-slate-300 rounded-md bg-slate-200 cursor-not-allowed"> <option value="">None</option> {allRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)} </select> </div>
                    <div> <label className="block text-sm font-medium text-slate-700">Reporting to (Person)</label> <select value={role.reportsToPersonUid || ''} onChange={e => handleReportsToPersonChange(e.target.value)} disabled={!role.reportsToRoleId} className="mt-1 block w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-100"> <option value="">None</option> {reportingToEmployees.map(emp => <option key={emp.uid} value={emp.uid}>{emp.firstName} {emp.lastName}</option>)} </select> </div>
                </div>
            </div>
             {isNew && !isActing && ( <div className="text-center p-4 bg-blue-50 text-blue-800 rounded-md mt-4"> Fill in the details for the new substantive role and click "Save Changes" at the bottom of the page. </div> )}
        </div>
    );
};

export default EmployeeProfile;
