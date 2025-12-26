
import React, { useState, useEffect, useCallback } from 'react';
import type { Module, Organisation, AppUser } from '../../types';
import type { GlAccount, MandatoryDeduction, Allowance, DeductionBracket } from '../../types/hr_types';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

import OrgRoles from '../org/OrgRoles';
// FIX: Changed to a default import to resolve module loading error.
import { OrgHierarchy } from '../org/OrgHierarchy';
import OrgEmployees from '../org/OrgEmployees';
import EmployeeProfile from '../org/EmployeeProfile';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


interface ModuleAdminPageProps {
  module: Module;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation?: Organisation;
}

const HrAdminPage: React.FC<ModuleAdminPageProps> = ({ module, onSwitchToUser, onBackToDashboard, theme, organisation }) => {
  const [activeTab, setActiveTab] = useState('employees');
  const [activePayrollSubTab, setActivePayrollSubTab] = useState('mandatoryDeductions');
  const { currentUserProfile } = useAuth();
  const [editingEmployeeUid, setEditingEmployeeUid] = useState<string | null>(null);

  useEffect(() => {
    // When switching away from the employees tab, reset the profile view.
    if (activeTab !== 'employees') {
      setEditingEmployeeUid(null);
    }
  }, [activeTab]);

  const tabs = [
    { id: 'roles', label: 'Roles' },
    { id: 'structure', label: 'Structure' },
    { id: 'employees', label: 'Employees' },
    { id: 'leave_setup', label: 'Leave Setup' },
    { id: 'payroll', label: 'Payroll' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      type="button"
      onClick={() => {
        // If we are on the employees tab and click it again, go back to list view.
        if (tabId === 'employees' && activeTab === 'employees') {
            setEditingEmployeeUid(null);
        }
        setActiveTab(tabId);
      }}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' // Active styles are applied via style prop
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
      aria-current={activeTab === tabId ? 'page' : undefined}
    >
      {label}
    </button>
  );
  
  const PayrollSubTabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      type="button"
      onClick={() => setActivePayrollSubTab(tabId)}
      className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
        activePayrollSubTab === tabId
          ? 'text-white'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
      style={activePayrollSubTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
      aria-current={activePayrollSubTab === tabId ? 'page' : undefined}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
    const placeholderClasses = "bg-white p-8 rounded-b-lg shadow-md";
    const titleClasses = "text-xl font-semibold mb-4";
    const textClasses = "text-gray-600";

    if (!currentUserProfile || !organisation) {
        return <div className="p-8 text-center">Loading user profile...</div>;
    }

    switch (activeTab) {
      case 'roles':
        return (
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-lg shadow-md">
                <OrgRoles currentUserProfile={currentUserProfile} theme={theme} readOnly={true} />
            </div>
        );
      case 'structure':
        if (!organisation) {
            return <div className="p-8 text-center text-slate-500">Organisation data not available.</div>;
        }
        return (
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-lg shadow-md">
            <OrgHierarchy
              currentUserProfile={currentUserProfile}
              organisationData={organisation}
              theme={theme}
              readOnly={true}
              maxLevel={5}
            />
          </div>
        );
      case 'employees':
        return editingEmployeeUid ? (
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-lg shadow-md">
                <EmployeeProfile 
                    employeeUid={editingEmployeeUid}
                    onBack={() => setEditingEmployeeUid(null)}
                    currentUserProfile={currentUserProfile}
                    theme={theme}
                />
            </div>
        ) : (
            <div className="rounded-b-lg shadow-md">
                <OrgEmployees 
                    currentUserProfile={currentUserProfile} 
                    onEditEmployee={(uid) => setEditingEmployeeUid(uid)}
                    onAddEmployee={() => setEditingEmployeeUid('new')}
                    theme={theme}
                />
            </div>
        );
      case 'leave_setup':
        return <div className={placeholderClasses}><h2 className={titleClasses}>Leave Setup</h2><p className={textClasses}>Configure leave types, accrual policies, holiday calendars, and approval workflows.</p></div>;
      case 'payroll':
        const payrollTabs = [
            { id: 'mandatoryDeductions', label: 'Mandatory Deductions' },
            { id: 'allowances', label: 'Allowances' },
        ];
        
        return (
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-lg shadow-md">
                <div className="mb-6 pb-4 border-b border-slate-200">
                    <h2 className={titleClasses}>Payroll Management</h2>
                    <p className={textClasses}>Set up payroll parameters, manage salary structures, run payroll, and generate reports.</p>
                </div>
                <div className="flex items-center space-x-2  mb-6">
                    {payrollTabs.map(tab => (
                        <PayrollSubTabButton key={tab.id} tabId={tab.id} label={tab.label} />
                    ))}
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                    {activePayrollSubTab === 'mandatoryDeductions' && <MandatoryDeductionsTab orgDomain={organisation.domain} theme={theme} />}
                    {activePayrollSubTab === 'allowances' && <AllowancesTab orgDomain={organisation.domain} theme={theme} />}
                </div>
            </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="font-semibold" style={{ color: theme.colorAccent }}>Admin Dashboard</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={onSwitchToUser}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
          >
            Switch to User View
          </button>
          <button
            onClick={onBackToDashboard}
            className="text-sm hover:underline"
            style={{ color: theme.colorPrimary }}
          >
            &larr; Back to Main Dashboard
          </button>
        </div>
      </div>
      
      <div className="border-b border-slate-200 bg-white rounded-t-lg shadow-md overflow-x-auto">
        <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
          {tabs.map(tab => (
            <TabButton key={tab.id} tabId={tab.id} label={tab.label} />
          ))}
        </nav>
      </div>

      <div className="mt-1">
        {renderTabContent()}
      </div>
    </div>
  );
};

// --- Payroll Sub-Components ---
const MandatoryDeductionsTab: React.FC<{orgDomain: string, theme: Organisation['theme']}> = ({ orgDomain, theme }) => {
    const [deductions, setDeductions] = useState<MandatoryDeduction[]>([]);
    const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<{isOpen: boolean, deduction: Partial<MandatoryDeduction> | null}>({isOpen: false, deduction: null});
    const [itemToDelete, setItemToDelete] = useState<MandatoryDeduction | null>(null);

    useEffect(() => {
        const glAccountsPath = 'modules/FI/ChartOfAccounts/20000/Subcategories/21000/Details';
        const qGl = query(collection(db, glAccountsPath), orderBy('name'));
        const unsubGl = onSnapshot(qGl, snapshot => {
            setGlAccounts(snapshot.docs.map(d => ({id: d.id, ...d.data()} as GlAccount)));
        });

        const deductionsPath = `organisations/${orgDomain}/mandatoryDeductions`;
        const qDeductions = query(collection(db, deductionsPath), orderBy('name'));
        const unsubDeductions = onSnapshot(qDeductions, snapshot => {
            setDeductions(snapshot.docs.map(d => ({id: d.id, ...d.data()} as MandatoryDeduction)));
            setLoading(false);
        });

        return () => { unsubGl(); unsubDeductions(); };
    }, [orgDomain]);
    
    const handleSave = async (deductionToSave: Partial<MandatoryDeduction>) => { 
        const collectionRef = collection(db, `organisations/${orgDomain}/mandatoryDeductions`);
        try {
            const { id, ...data } = deductionToSave;
            if (id) {
                await updateDoc(doc(collectionRef, id), data);
            } else {
                await addDoc(collectionRef, data);
            }
            setModalState({ isOpen: false, deduction: null });
        } catch(e) {
            console.error(e);
        }
    };
    
    const handleDelete = async () => { 
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, `organisations/${orgDomain}/mandatoryDeductions`, itemToDelete.id));
            setItemToDelete(null);
        } catch(e) {
            console.error(e);
        }
    };

    if (loading) return <div className="flex justify-center items-center p-4"><div className="w-6 h-6 border-2 border-slate-300 border-dashed rounded-full animate-spin"></div></div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Mandatory Deductions</h3>
                <Button onClick={() => setModalState({isOpen: true, deduction: { name: '', type: 'Flatrate', hasBrackets: false, brackets: [], settlementGlAccountId: '' }})} className="!w-auto text-sm">+ Add Deduction</Button>
            </div>
            <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Settlement GL Account</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {deductions.map(item => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.type}{item.type === 'Percentage' && ' of Gross'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.settlementGlAccountName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => setModalState({isOpen: true, deduction: item })} className="text-indigo-600 hover:text-indigo-900"><EditIcon /></button>
                                    <button onClick={() => setItemToDelete(item)} className="text-red-600 hover:text-red-900"><DeleteIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalState.isOpen && modalState.deduction && (
                <DeductionModal 
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState({isOpen: false, deduction: null})}
                    onSave={handleSave}
                    deduction={modalState.deduction}
                    glAccounts={glAccounts}
                />
            )}
            <ConfirmationModal 
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title={`Delete ${itemToDelete?.name}?`}
                message="Are you sure you want to delete this deduction? This action cannot be undone."
            />
        </div>
    );
};

const AllowancesTab: React.FC<{orgDomain: string, theme: Organisation['theme']}> = ({ orgDomain, theme }) => {
    const [allowances, setAllowances] = useState<Allowance[]>([]);
    const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<{isOpen: boolean, allowance: Partial<Allowance> | null}>({isOpen: false, allowance: null});
    const [itemToDelete, setItemToDelete] = useState<Allowance | null>(null);

     useEffect(() => {
        const glAccountsPath = 'modules/FI/ChartOfAccounts/20000/Subcategories/21000/Details';
        const qGl = query(collection(db, glAccountsPath), orderBy('name'));
        const unsubGl = onSnapshot(qGl, snapshot => { setGlAccounts(snapshot.docs.map(d => ({id: d.id, ...d.data()} as GlAccount))); });

        const allowancesPath = `organisations/${orgDomain}/allowances`;
        const qAllowances = query(collection(db, allowancesPath), orderBy('name'));
        const unsubAllowances = onSnapshot(qAllowances, snapshot => {
            setAllowances(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Allowance)));
            setLoading(false);
        });

        return () => { unsubGl(); unsubAllowances(); };
    }, [orgDomain]);

    const handleSave = async (allowanceToSave: Partial<Allowance>) => { 
        const collectionRef = collection(db, `organisations/${orgDomain}/allowances`);
        try {
            const { id, ...data } = allowanceToSave;
            if (id) {
                await updateDoc(doc(collectionRef, id), data);
            } else {
                await addDoc(collectionRef, data);
            }
            setModalState({ isOpen: false, allowance: null });
        } catch(e) { console.error(e); }
    };
    
    const handleDelete = async () => { 
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, `organisations/${orgDomain}/allowances`, itemToDelete.id));
            setItemToDelete(null);
        } catch(e) { console.error(e); }
    };

    if (loading) return <div className="flex justify-center items-center p-4"><div className="w-6 h-6 border-2 border-slate-300 border-dashed rounded-full animate-spin"></div></div>;

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Allowances</h3>
                <Button onClick={() => setModalState({isOpen: true, allowance: { name: '', type: 'Flatrate', settlementGlAccountId: '' }})} className="!w-auto text-sm">+ Add Allowance</Button>
            </div>
            <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Settlement GL Account</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {allowances.map(item => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.type}{item.type === 'Percentage' && ' of Gross'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.settlementGlAccountName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => setModalState({isOpen: true, allowance: item })} className="text-indigo-600 hover:text-indigo-900"><EditIcon /></button>
                                    <button onClick={() => setItemToDelete(item)} className="text-red-600 hover:text-red-900"><DeleteIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modalState.isOpen && modalState.allowance && (
                <AllowanceModal 
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState({isOpen: false, allowance: null})}
                    onSave={handleSave}
                    allowance={modalState.allowance}
                    glAccounts={glAccounts}
                />
            )}
            <ConfirmationModal 
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title={`Delete ${itemToDelete?.name}?`}
                message="Are you sure you want to delete this allowance? This action cannot be undone."
            />
        </div>
    );
};

const DeductionModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (d: Partial<MandatoryDeduction>) => void, deduction: Partial<MandatoryDeduction>, glAccounts: GlAccount[]}> = 
({ isOpen, onClose, onSave, deduction, glAccounts }) => {
    const [data, setData] = useState<Partial<MandatoryDeduction>>(deduction);

    const handleChange = (field: keyof MandatoryDeduction, value: any) => setData(p => ({...p, [field]: value}));
    const handleBracketChange = (index: number, field: keyof DeductionBracket, value: any) => {
        const newBrackets = [...(data.brackets || [])];
        (newBrackets[index] as any)[field] = value === null ? null : Number(value);
        setData(p => ({...p, brackets: newBrackets}));
    };
    const addBracket = () => setData(p => ({...p, brackets: [...(p.brackets || []), {from: 0, to: 0, rate: 0}]}));
    const removeBracket = (index: number) => setData(p => ({...p, brackets: p.brackets?.filter((_, i) => i !== index)}));

    const handleSubmit = () => {
        const glAccount = glAccounts.find(acc => acc.id === data.settlementGlAccountId);
        onSave({...data, settlementGlAccountName: glAccount?.name || ''});
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={deduction.id ? 'Edit Deduction' : 'Add Deduction'} size="3xl">
            <div className="space-y-4">
                <Input id="deductionName" label="Name" value={data.name || ''} onChange={e => handleChange('name', e.target.value)} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input as="select" id="deductionType" label="Type" value={data.type || 'Flatrate'} onChange={e => handleChange('type', e.target.value)}>
                        <option value="Flatrate">Flat Rate</option>
                        <option value="Percentage">Percentage</option>
                    </Input>
                    <Input as="select" id="deductionGlAccount" label="Settlement GL Account" value={data.settlementGlAccountId || ''} onChange={e => handleChange('settlementGlAccountId', e.target.value)} required>
                        <option value="">Select Account...</option>
                        {glAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </Input>
                </div>
                {data.type === 'Percentage' && (
                    <div className="p-4 border rounded-md space-y-4">
                        <Input as="select" id="deductionPercentageOf" label="Percentage Of" value={data.percentageOf || 'Gross'} onChange={e => handleChange('percentageOf', e.target.value)}>
                            <option value="Gross">Gross Salary</option>
                        </Input>
                        <div className="flex items-center">
                            <input type="checkbox" id="hasBrackets" checked={data.hasBrackets || false} onChange={e => handleChange('hasBrackets', e.target.checked)} className="h-4 w-4 rounded" />
                            <label htmlFor="hasBrackets" className="ml-2 block text-sm text-gray-900">Use Brackets?</label>
                        </div>
                        {data.hasBrackets && (
                            <div className="space-y-2">
                                {data.brackets?.map((bracket, index) => (
                                    <div key={index} className="grid grid-cols-7 gap-2 items-center">
                                        <Input id={`bracket_from_${index}`} label="From" type="number" containerClassName="col-span-2" value={bracket.from} onChange={e => handleBracketChange(index, 'from', e.target.value)} />
                                        <Input id={`bracket_to_${index}`} label="To" type="number" containerClassName="col-span-2" value={bracket.to ?? ''} onChange={e => handleBracketChange(index, 'to', e.target.value === '' ? null : e.target.value)} placeholder="Infinity" />
                                        <Input id={`bracket_rate_${index}`} label="Rate (%)" type="number" containerClassName="col-span-2" value={bracket.rate} onChange={e => handleBracketChange(index, 'rate', e.target.value)} />
                                        <button type="button" onClick={() => removeBracket(index)} className="mt-6 text-red-500 col-span-1">&times;</button>
                                    </div>
                                ))}
                                <Button type="button" onClick={addBracket} variant="secondary" className="!w-auto text-xs">+ Add Bracket</Button>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-end pt-4"><Button onClick={handleSubmit}>Save</Button></div>
            </div>
        </Modal>
    );
};

const AllowanceModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (d: Partial<Allowance>) => void, allowance: Partial<Allowance>, glAccounts: GlAccount[]}> = 
({ isOpen, onClose, onSave, allowance, glAccounts }) => {
    const [data, setData] = useState<Partial<Allowance>>(allowance);
    const handleChange = (field: keyof Allowance, value: any) => setData(p => ({...p, [field]: value}));
    const handleSubmit = () => {
        const glAccount = glAccounts.find(acc => acc.id === data.settlementGlAccountId);
        onSave({...data, settlementGlAccountName: glAccount?.name || ''});
    }

    return (
         <Modal isOpen={isOpen} onClose={onClose} title={allowance.id ? 'Edit Allowance' : 'Add Allowance'} size="2xl">
            <div className="space-y-4">
                <Input id="allowanceName" label="Name" value={data.name || ''} onChange={e => handleChange('name', e.target.value)} required />
                 <div className="grid grid-cols-2 gap-4">
                    <Input as="select" id="allowanceType" label="Type" value={data.type || 'Flatrate'} onChange={e => handleChange('type', e.target.value)}>
                        <option value="Flatrate">Flat Rate</option>
                        <option value="Percentage">Percentage</option>
                    </Input>
                    <Input as="select" id="allowanceGlAccount" label="Settlement GL Account" value={data.settlementGlAccountId || ''} onChange={e => handleChange('settlementGlAccountId', e.target.value)} required>
                        <option value="">Select Account...</option>
                        {glAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </Input>
                </div>
                {data.type === 'Percentage' && (
                     <Input as="select" id="allowancePercentageOf" label="Percentage Of" value={data.percentageOf || 'Gross'} onChange={e => handleChange('percentageOf', e.target.value)}>
                        <option value="Gross">Gross Salary</option>
                    </Input>
                )}
                <div className="flex justify-end pt-4"><Button onClick={handleSubmit}>Save</Button></div>
            </div>
        </Modal>
    );
};

export default HrAdminPage;
