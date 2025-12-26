
// components/modules/fi_memssetup.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { Module } from '../../../types';
import type { AccountCategory, AccountSubcategory, AccountDetail, JournalClass } from '../../../types/fi_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import Modal from '../../common/Modal';
import Input from '../../Input';
import { defaultChartOfAccounts } from '../../../constants/chart_of_accounts';
import ModuleRightsManager from '../../admin/ModuleRightsManager';
import { GLOBAL_JOURNAL_CLASSES } from '../../../constants/mems-global-journal-classes';
import JournalClassModal from './JournalClassModal';
import CurrenciesTab from './CurrenciesTab';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

// --- Modals ---

interface AccountCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AccountCategory, 'id' | 'enabled'>, id: string) => Promise<void>;
  category?: AccountCategory | null;
}

const AccountCategoryModal: React.FC<AccountCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [id, setId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!category;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && category) {
                setFormData({ name: category.name, description: category.description });
                setId(category.id);
            } else {
                setFormData({ name: '', description: '' });
                setId('');
            }
        }
    }, [isOpen, category, isEditing]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, id);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Account Category' : 'Add Account Category'}>
            <div className="space-y-4">
                <Input id="id" label="Account Number (e.g., 10000)" type="number" value={id} onChange={e => setId(e.target.value)} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea id="description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Category'}</Button>
            </div>
        </Modal>
    );
};

interface AccountSubcategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AccountSubcategory, 'id' | 'enabled'>, id: string) => Promise<void>;
  subcategory?: AccountSubcategory | null;
}

const AccountSubcategoryModal: React.FC<AccountSubcategoryModalProps> = ({ isOpen, onClose, onSave, subcategory }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [id, setId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!subcategory;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && subcategory) {
                setFormData({ name: subcategory.name, description: subcategory.description });
                setId(subcategory.id);
            } else {
                setFormData({ name: '', description: '' });
                setId('');
            }
        }
    }, [isOpen, subcategory, isEditing]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, id);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Sub-Account' : 'Add Sub-Account'}>
            <div className="space-y-4">
                <Input id="id" label="Account Number (e.g., 11100)" type="number" value={id} onChange={e => setId(e.target.value)} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea id="description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Sub-Account'}</Button>
            </div>
        </Modal>
    );
};

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AccountDetail, 'id' | 'enabled'>, id: string) => Promise<void>;
  detail?: AccountDetail | null;
}

const AccountDetailModal: React.FC<AccountDetailModalProps> = ({ isOpen, onClose, onSave, detail }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [id, setId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!detail;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && detail) {
                setFormData({ name: detail.name, description: detail.description });
                setId(detail.id);
            } else {
                setFormData({ name: '', description: '' });
                setId('');
            }
        }
    }, [isOpen, detail, isEditing]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, id);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Detail Account' : 'Add Detail Account'}>
            <div className="space-y-4">
                <Input id="id" label="Account Number (e.g., 11110)" type="number" value={id} onChange={e => setId(e.target.value)} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea id="description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Detail Account'}</Button>
            </div>
        </Modal>
    );
};


// --- Main Tab Component ---
type ItemToDelete = { type: 'category'; data: AccountCategory } |
                  { type: 'subcategory'; data: AccountSubcategory; parentId: string } |
                  { type: 'detail'; data: AccountDetail; parentId: string; grandParentId: string };

const ChartOfAccountsTab: React.FC = () => {
    const [categories, setCategories] = useState<AccountCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, AccountSubcategory[]>>({});
    const [details, setDetails] = useState<Record<string, AccountDetail[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [modalState, setModalState] = useState<{
        categoryOpen: boolean; subcategoryOpen: boolean; detailOpen: boolean; confirmOpen: boolean;
        selectedCategory: AccountCategory | null; selectedSubcategory: AccountSubcategory | null; selectedDetail: AccountDetail | null;
        itemToDelete: ItemToDelete | null;
    }>({ categoryOpen: false, subcategoryOpen: false, detailOpen: false, confirmOpen: false, selectedCategory: null, selectedSubcategory: null, selectedDetail: null, itemToDelete: null });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({});
    
    const coaCollectionRef = db.collection('modules/FI/ChartOfAccounts');

    useEffect(() => {
        const q = coaCollectionRef.orderBy('__name__');
        const unsubscribe = q.onSnapshot((snapshot) => {
            if (snapshot.empty) setNeedsSeeding(true);
            else {
                setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountCategory)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const toggleCategory = useCallback((categoryId: string) => {
        const isOpen = !openCategories[categoryId];
        setOpenCategories(prev => ({ ...prev, [categoryId]: isOpen }));
        if (isOpen && !subcategories[categoryId]) {
            const subcategoriesRef = coaCollectionRef.doc(categoryId).collection('Subcategories');
            subcategoriesRef.orderBy('__name__').onSnapshot((snapshot) => {
                setSubcategories(prev => ({...prev, [categoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountSubcategory))}));
            });
        }
    }, [openCategories, subcategories]);

    const toggleSubcategory = useCallback((categoryId: string, subcategoryId: string) => {
        const isOpen = !openSubcategories[subcategoryId];
        setOpenSubcategories(prev => ({ ...prev, [subcategoryId]: isOpen }));
        if (isOpen && !details[subcategoryId]) {
            const detailsRef = coaCollectionRef.doc(categoryId).collection('Subcategories').doc(subcategoryId).collection('Details');
            detailsRef.orderBy('__name__').onSnapshot((snapshot) => {
                setDetails(prev => ({...prev, [subcategoryId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountDetail))}));
            });
        }
    }, [openSubcategories, details]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = db.batch();
            for (const category of defaultChartOfAccounts) {
                const categoryRef = coaCollectionRef.doc(category.code);
                batch.set(categoryRef, { name: category.name, description: category.description, enabled: true });
                for (const subcategory of category.subcategories) {
                    const subcategoryRef = categoryRef.collection('Subcategories').doc(subcategory.code);
                    batch.set(subcategoryRef, { name: subcategory.name, description: subcategory.description, enabled: subcategory.enabled });
                    for (const detail of subcategory.details) {
                        const detailRef = subcategoryRef.collection('Details').doc(detail.code);
                        batch.set(detailRef, { name: detail.name, description: detail.description, enabled: detail.enabled });
                    }
                }
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding Chart of Accounts:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveCategory = async (data: Omit<AccountCategory, 'id' | 'enabled'>, id: string) => {
        await coaCollectionRef.doc(id).set({ ...data, enabled: true });
    };
    const handleSaveSubcategory = async (data: Omit<AccountSubcategory, 'id'| 'enabled'>, id: string) => {
        if (!modalState.selectedCategory) return;
        const subcategoriesRef = coaCollectionRef.doc(modalState.selectedCategory.id).collection('Subcategories');
        await subcategoriesRef.doc(id).set({ ...data, enabled: true });
    };
    const handleSaveDetail = async (data: Omit<AccountDetail, 'id'| 'enabled'>, id: string) => {
        if (!modalState.selectedCategory || !modalState.selectedSubcategory) return;
        const detailsRef = coaCollectionRef.doc(modalState.selectedCategory.id).collection('Subcategories').doc(modalState.selectedSubcategory.id).collection('Details');
        await detailsRef.doc(id).set({ ...data, enabled: true });
    };

    const handleDelete = async () => {
        if (!modalState.itemToDelete) return;
        const batch = db.batch();
        try {
            if (modalState.itemToDelete.type === 'detail') {
                const { grandParentId, parentId, data } = modalState.itemToDelete;
                batch.delete(coaCollectionRef.doc(grandParentId).collection('Subcategories').doc(parentId).collection('Details').doc(data.id));
            } else if (modalState.itemToDelete.type === 'subcategory') {
                const { parentId, data } = modalState.itemToDelete;
                const detailsRef = coaCollectionRef.doc(parentId).collection('Subcategories').doc(data.id).collection('Details');
                const detailsSnap = await detailsRef.get();
                detailsSnap.forEach(doc => batch.delete(doc.ref));
                batch.delete(coaCollectionRef.doc(parentId).collection('Subcategories').doc(data.id));
            } else if (modalState.itemToDelete.type === 'category') {
                const { data } = modalState.itemToDelete;
                const subcategoriesRef = coaCollectionRef.doc(data.id).collection('Subcategories');
                const subcategoriesSnap = await subcategoriesRef.get();
                for (const subDoc of subcategoriesSnap.docs) {
                    const detailsRef = subDoc.ref.collection('Details');
                    const detailsSnap = await detailsRef.get();
                    detailsSnap.forEach(detailDoc => batch.delete(detailDoc.ref));
                    batch.delete(subDoc.ref);
                }
                batch.delete(coaCollectionRef.doc(data.id));
            }
            await batch.commit();
        } catch (error) { console.error("Delete failed:", error); } 
        finally { setModalState(p => ({ ...p, confirmOpen: false, itemToDelete: null })); }
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No Chart of Accounts data found. Populate the database with a comprehensive, universal set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Chart of Accounts</Button>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Chart of Accounts</h3>
                <Button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: null }))}>Add New Category</Button>
            </div>
            <div className="space-y-2">
                {categories.map(category => (
                    <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                            <button onClick={() => toggleCategory(category.id)} className="flex-1 flex items-center text-left focus:outline-none">
                                <h4 className="font-semibold text-gray-800">{category.id} - {category.name} ({(subcategories[category.id] || []).length})</h4>
                                <div className={`ml-4 ${openCategories[category.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: null }))} className="!py-1 !px-3 text-xs">Add Sub</Button>
                                <button onClick={() => setModalState(p => ({ ...p, categoryOpen: true, selectedCategory: category }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'category', data: category } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                            </div>
                        </div>
                        {openCategories[category.id] && (
                            <div className="bg-white divide-y divide-gray-200 pl-4">
                                {(subcategories[category.id] || []).map(sub => (
                                    <div key={sub.id} className="border-l border-gray-200">
                                        <div className="w-full flex justify-between items-center p-3 hover:bg-gray-50">
                                            <button onClick={() => toggleSubcategory(category.id, sub.id)} className="flex-1 flex items-center text-left focus:outline-none ml-4">
                                                <h5 className="font-medium text-gray-700">{sub.id} - {sub.name} ({(details[sub.id] || []).length})</h5>
                                                <div className={`ml-3 text-gray-400 ${openSubcategories[sub.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                                            </button>
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => setModalState(p => ({ ...p, detailOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedDetail: null }))} className="!py-1 !px-3 text-xs">Add Detail</Button>
                                                <button onClick={() => setModalState(p => ({ ...p, subcategoryOpen: true, selectedCategory: category, selectedSubcategory: sub }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'subcategory', data: sub, parentId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                        {openSubcategories[sub.id] && (
                                             <div className="bg-gray-50/50 divide-y divide-gray-200 pl-8 border-l border-gray-200 ml-4">
                                                {(details[sub.id] || []).map(detail => (
                                                    <div key={detail.id} className="p-2.5 flex justify-between items-start hover:bg-white">
                                                        <div className="flex-1">
                                                            <p className="font-normal text-gray-800">{detail.id} - {detail.name}</p>
                                                            <p className="text-sm text-gray-500">{detail.description}</p>
                                                        </div>
                                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                                            <button onClick={() => setModalState(p => ({ ...p, detailOpen: true, selectedCategory: category, selectedSubcategory: sub, selectedDetail: detail }))} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                                            <button onClick={() => setModalState(p => ({ ...p, confirmOpen: true, itemToDelete: { type: 'detail', data: detail, parentId: sub.id, grandParentId: category.id } }))} className="text-red-600 p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <AccountCategoryModal isOpen={modalState.categoryOpen} onClose={() => setModalState(p => ({...p, categoryOpen: false}))} onSave={handleSaveCategory} category={modalState.selectedCategory} />
            <AccountSubcategoryModal isOpen={modalState.subcategoryOpen} onClose={() => setModalState(p => ({...p, subcategoryOpen: false}))} onSave={handleSaveSubcategory} subcategory={modalState.selectedSubcategory} />
            <AccountDetailModal isOpen={modalState.detailOpen} onClose={() => setModalState(p => ({...p, detailOpen: false}))} onSave={handleSaveDetail} detail={modalState.selectedDetail} />
            <ConfirmationModal isOpen={modalState.confirmOpen} onClose={() => setModalState(p => ({...p, confirmOpen: false}))} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure? This will delete the account and all accounts nested under it. This action cannot be undone.`} />
        </div>
    );
};

// --- New Journal Classes Tab Component ---
const JournalClassesTab: React.FC = () => {
    const [journalClasses, setJournalClasses] = useState<JournalClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [modalState, setModalState] = useState<{ isOpen: boolean, classToEdit: JournalClass | null }>({ isOpen: false, classToEdit: null });
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, classToDelete: JournalClass | null }>({ isOpen: false, classToDelete: null });

    const collectionRef = db.collection('modules/FI/journals');

    useEffect(() => {
        const q = collectionRef.orderBy('code');
        const unsubscribe = q.onSnapshot((snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setJournalClasses(snapshot.docs.map(doc => doc.data() as JournalClass));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = db.batch();
            GLOBAL_JOURNAL_CLASSES.forEach(jc => {
                const docRef = collectionRef.doc(jc.code);
                batch.set(docRef, jc);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error seeding Journal Classes:", error);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSave = async (data: JournalClass) => {
        const docRef = collectionRef.doc(data.code);
        await docRef.set(data, { merge: true }); // Use setDoc with merge for both create and update
    };

    const handleDelete = async () => {
        if (!confirmModalState.classToDelete) return;
        await collectionRef.doc(confirmModalState.classToDelete.code).delete();
        setConfirmModalState({ isOpen: false, classToDelete: null });
    };

    // FIX: Simplified logic for grouping journal classes to improve readability and type safety.
    const groupedClasses = useMemo(() => {
        return journalClasses.reduce((acc, current) => {
            const category = current.code.split('.')[0];
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(current);
            return acc;
        }, {} as Record<string, JournalClass[]>);
    }, [journalClasses]);
    
    const categoryNames: Record<string, string> = { CORE: 'Core & Structural', VAL: 'Currency & Valuation', P2P: 'Procurement to Pay (P2P)', INV: 'Inventory & Material Management', O2C: 'Order to Cash (O2C)', FA: 'Fixed Assets & CAPEX', PRJ: 'Projects & Job Costing', MFG: 'Production & Manufacturing', PAY: 'Payroll & HR', TAX: 'Taxation & Compliance', CASH: 'Cash, Bank & Treasury', TRSY: 'Treasury, Financing & Investments', REV: 'Revenue (Specialized)', LEASE: 'Leases (IFRS 16 / ASC 842)', BANK: 'Banking/Financial Services', INS: 'Insurance', UTIL: 'Utilities & Energy', TEL: 'Telecom', AGR: 'Agriculture', MIN: 'Mining & Oil/Gas', OAG: 'Oil & Gas', RE: 'Real Estate / Construction', HC: 'Healthcare', EDU: 'Education / Nonprofit', NFP: 'Nonprofit', CON: 'Consolidation & Intercompany', AUT: 'Automation & IoT', STAT: 'Off-Book & Statistical' };
    
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const toggleCategory = (category: string) => setOpenCategories(prev => ({...prev, [category]: !prev[category]}));

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No Journal Classes found. Populate the database with the global standard set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Journal Classes</Button>
        </div>
    );
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Global Journal Classes</h3>
                <Button onClick={() => setModalState({ isOpen: true, classToEdit: null })}>Add New Class</Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
                This is a global catalog of standard journal entry classes used throughout MEMS for automated and manual postings. These ensure consistency and proper financial reporting across all modules.
            </p>
            <div className="space-y-2">
                {Object.entries(groupedClasses).map(([category, classes]) => (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => toggleCategory(category)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none">
                            <h4 className="font-semibold text-gray-800">{categoryNames[category] || category} ({Array.isArray(classes) ? classes.length : 0})</h4>
                            <div className={`${openCategories[category] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openCategories[category] && Array.isArray(classes) && (
                             <div className="bg-white divide-y divide-gray-200">
                                {classes.map(jc => (
                                    <div key={jc.code} className="p-4 ml-4 border-l-2 hover:bg-gray-50/50">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">{jc.name} <span className="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{jc.code}</span></p>
                                                <p className="text-sm text-gray-600 mt-1">{jc.description}</p>
                                                {jc.examples && (<p className="text-xs text-gray-500 mt-2"><em>Example: {jc.examples.join(', ')}</em></p>)}
                                            </div>
                                            <div className="ml-4 flex-shrink-0 text-right">
                                                <p className="text-xs font-semibold text-gray-500 uppercase">Normal Balance</p>
                                                <p className="text-sm font-medium text-gray-800">{jc.normalBalance}</p>
                                                <p className="text-xs font-semibold text-gray-500 uppercase mt-2">Statements</p>
                                                <div className="flex gap-1 justify-end mt-1 flex-wrap">
                                                    {jc.statementImpact.map(s => (<span key={s} className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">{s}</span>))}
                                                </div>
                                            </div>
                                             <div className="ml-4 flex-shrink-0 self-center">
                                                <button onClick={() => setModalState({ isOpen: true, classToEdit: jc })} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                                <button onClick={() => setConfirmModalState({ isOpen: true, classToDelete: jc })} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
             <JournalClassModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, classToEdit: null })}
                onSave={handleSave}
                classToEdit={modalState.classToEdit}
                allJournalClasses={journalClasses}
            />
            <ConfirmationModal 
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, classToDelete: null })}
                onConfirm={handleDelete}
                title={`Delete ${confirmModalState.classToDelete?.name}?`}
                message="Are you sure you want to delete this journal class? This action cannot be undone."
            />
        </div>
    );
};


// --- Main Page Component ---
interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
}

const FiMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const [activeTab, setActiveTab] = useState('chartOfAccounts');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chartOfAccounts', label: 'Chart of Accounts' },
    { id: 'journalClasses', label: 'Journal Classes' },
    { id: 'postingRules', label: 'Posting Rules' },
    { id: 'currencies', label: 'Currencies' },
    { id: 'rights', label: 'Rights' },
  ];

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
      switch (activeTab) {
        case 'dashboard':
            return <p>Dashboard for Finance setup will be here.</p>;
        case 'chartOfAccounts':
            return <ChartOfAccountsTab />;
        case 'journalClasses':
            return <JournalClassesTab />;
        case 'postingRules':
             return <div className="p-8 text-center text-slate-500">Posting rules functionality is under development.</div>;
        case 'currencies':
            return <CurrenciesTab />;
        case 'rights':
            return <ModuleRightsManager module={module} />;
        default:
            return null;
      }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="text-gray-500 font-semibold">Module Setup</p>
        </div>
        <button
            onClick={onBackToModules}
            className="text-sm text-blue-600 hover:underline"
        >
            &larr; Back to Module Management
        </button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                {tabs.map(tab => (
                  <TabButton key={tab.id} tabName={tab.id} label={tab.label} />
                ))}
            </nav>
        </div>
        
        <div className="mt-6">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default FiMemsSetupPage;
