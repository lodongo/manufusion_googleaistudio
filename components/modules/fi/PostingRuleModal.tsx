
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { PostingRule, JournalClass, AccountCategory, AccountSubcategory, AccountDetail } from '../../../types/fi_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface PostingRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<PostingRule>) => Promise<void>;
  ruleToEdit?: PostingRule | null;
}

const PostingRuleModal: React.FC<PostingRuleModalProps> = ({ isOpen, onClose, onSave, ruleToEdit }) => {
    const [formData, setFormData] = useState<Partial<PostingRule>>({ costCenterRequired: false, enabled: true });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    
    // Data for dropdowns
    const [journalClasses, setJournalClasses] = useState<JournalClass[]>([]);
    const [coa, setCoa] = useState<{ categories: AccountCategory[], subcategories: Record<string, AccountSubcategory[]>, details: Record<string, AccountDetail[]> }>({ categories: [], subcategories: {}, details: {} });
    const [debitSelection, setDebitSelection] = useState({ category: '', subcategory: '' });
    const [creditSelection, setCreditSelection] = useState({ category: '', subcategory: '' });

    // State for search functionality
    const [journalClassSearch, setJournalClassSearch] = useState('');
    const [debitAccountSearch, setDebitAccountSearch] = useState('');
    const [creditAccountSearch, setCreditAccountSearch] = useState('');

    const isEditing = !!ruleToEdit;

    useEffect(() => {
        if (!isOpen) return;

        const unsubJournals = onSnapshot(query(collection(db, 'modules/FI/journals'), orderBy('code')), snap => {
            setJournalClasses(snap.docs.map(doc => doc.data() as JournalClass));
        });

        const coaRef = collection(db, 'modules/FI/ChartOfAccounts');
        const unsubCoa = onSnapshot(query(coaRef, orderBy('__name__')), snap => {
            setCoa(prev => ({...prev, categories: snap.docs.map(d => ({id: d.id, ...d.data()} as AccountCategory))}));
        });
        
        return () => { unsubJournals(); unsubCoa(); };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: ruleToEdit?.name || '',
                description: ruleToEdit?.description || '',
                journalClassCode: ruleToEdit?.journalClassCode || '',
                debitAccountPath: ruleToEdit?.debitAccountPath || '',
                creditAccountPath: ruleToEdit?.creditAccountPath || '',
                costCenterRequired: ruleToEdit?.costCenterRequired ?? false,
                enabled: ruleToEdit?.enabled ?? true,
            });
            // Reset search terms
            setJournalClassSearch('');
            setDebitAccountSearch('');
            setCreditAccountSearch('');
        }
    }, [isOpen, ruleToEdit]);
    
    const fetchSubcategories = useCallback(async (categoryId: string) => {
        if (!categoryId || coa.subcategories[categoryId]) return;
        const ref = collection(db, `modules/FI/ChartOfAccounts/${categoryId}/Subcategories`);
        const snap = await getDocs(query(ref, orderBy('__name__')));
        const subcats = snap.docs.map(d => ({id: d.id, ...d.data()} as AccountSubcategory));
        setCoa(prev => ({ ...prev, subcategories: { ...prev.subcategories, [categoryId]: subcats } }));
    }, [coa.subcategories]);

    const fetchDetails = useCallback(async (categoryId: string, subcategoryId: string) => {
        if (!categoryId || !subcategoryId || coa.details[subcategoryId]) return;
        const ref = collection(db, `modules/FI/ChartOfAccounts/${categoryId}/Subcategories/${subcategoryId}/Details`);
        const snap = await getDocs(query(ref, orderBy('__name__')));
        const dets = snap.docs.map(d => ({id: d.id, ...d.data()} as AccountDetail));
        setCoa(prev => ({ ...prev, details: { ...prev.details, [subcategoryId]: dets } }));
    }, [coa.details]);

    useEffect(() => { if (debitSelection.category) fetchSubcategories(debitSelection.category); }, [debitSelection.category, fetchSubcategories]);
    useEffect(() => { if (debitSelection.category && debitSelection.subcategory) fetchDetails(debitSelection.category, debitSelection.subcategory); }, [debitSelection.subcategory, debitSelection.category, fetchDetails]);
    useEffect(() => { if (creditSelection.category) fetchSubcategories(creditSelection.category); }, [creditSelection.category, fetchSubcategories]);
    useEffect(() => { if (creditSelection.category && creditSelection.subcategory) fetchDetails(creditSelection.category, creditSelection.subcategory); }, [creditSelection.subcategory, creditSelection.category, fetchDetails]);

    const handleSave = async () => {
        setIsLoading(true);
        const journalClass = journalClasses.find(jc => jc.code === formData.journalClassCode);
        
        // Find debit account details
        const debitCat = coa.categories.find(c => c.id === debitSelection.category);
        const debitSub = coa.subcategories[debitSelection.category]?.find(s => s.id === debitSelection.subcategory);
        const debitDetail = coa.details[debitSelection.subcategory]?.find(d => formData.debitAccountPath?.endsWith(d.id));

        // Find credit account details
        const creditCat = coa.categories.find(c => c.id === creditSelection.category);
        const creditSub = coa.subcategories[creditSelection.category]?.find(s => s.id === creditSelection.subcategory);
        const creditDetail = coa.details[creditSelection.subcategory]?.find(d => formData.creditAccountPath?.endsWith(d.id));

        const dataToSave: Partial<PostingRule> = {
            ...formData,
            journalClassName: journalClass?.name || '',
            debitAccountName: debitDetail ? `${debitDetail.name} (${debitDetail.id})` : '',
            creditAccountName: creditDetail ? `${creditDetail.name} (${creditDetail.id})` : '',
        };
        
        if (isEditing && ruleToEdit) {
            dataToSave.id = ruleToEdit.id;
        }

        await onSave(dataToSave);
        setIsLoading(false);
        onClose();
    };

    const handleJournalClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedCode = e.target.value;
        const selectedClass = journalClasses.find(jc => jc.code === selectedCode);
        setFormData(p => ({
            ...p,
            journalClassCode: selectedCode,
            description: selectedClass ? selectedClass.description : ''
        }));
    };

    const filteredJournalClasses = useMemo(() => {
        if (!journalClassSearch) return journalClasses;
        const lowerSearch = journalClassSearch.toLowerCase();
        return journalClasses.filter(jc => 
            jc.name.toLowerCase().includes(lowerSearch) || 
            jc.code.toLowerCase().includes(lowerSearch)
        );
    }, [journalClasses, journalClassSearch]);

    const filteredDebitDetails: AccountDetail[] = useMemo(() => {
        const details = coa.details[debitSelection.subcategory] || [];
        if (!debitAccountSearch) return details;
        const lowerSearch = debitAccountSearch.toLowerCase();
        return details.filter(d => d.name.toLowerCase().includes(lowerSearch) || d.id.toLowerCase().includes(lowerSearch));
    }, [coa.details, debitSelection.subcategory, debitAccountSearch]);
    
    const filteredCreditDetails: AccountDetail[] = useMemo(() => {
        const details = coa.details[creditSelection.subcategory] || [];
        if (!creditAccountSearch) return details;
        const lowerSearch = creditAccountSearch.toLowerCase();
        return details.filter(d => d.name.toLowerCase().includes(lowerSearch) || d.id.toLowerCase().includes(lowerSearch));
    }, [coa.details, creditSelection.subcategory, creditAccountSearch]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Posting Rule' : 'Add New Posting Rule'} size="5xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="code" label="Rule Code" value={ruleToEdit?.code || 'SYSTEM GENERATED'} disabled />
                    <Input id="name" label="Rule Name" value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required containerClassName="md:col-span-2"/>
                </div>
                 <Input as="textarea" id="description" label="Description" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={2} />
                
                <div>
                    <Input id="journalClassSearch" label="Search Journal Class" value={journalClassSearch} onChange={e => setJournalClassSearch(e.target.value)} placeholder="Type to filter..." />
                    <Input as="select" id="journalClassCode" label="Journal Class" value={formData.journalClassCode || ''} onChange={handleJournalClassChange} required>
                        <option value="">Select...</option>
                        {filteredJournalClasses.map(jc => <option key={jc.code} value={jc.code}>{jc.name} ({jc.code})</option>)}
                    </Input>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-md space-y-2">
                        <h4 className="font-medium">Debit Account</h4>
                        <Input as="select" id="debitCategory" label="Category" value={debitSelection.category} onChange={e => setDebitSelection({category: e.target.value, subcategory: ''})}>
                            <option value="">Select...</option>
                            {coa.categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                        </Input>
                        <Input as="select" id="debitSubcategory" label="Subcategory" value={debitSelection.subcategory} onChange={e => setDebitSelection(p => ({...p, subcategory: e.target.value}))} disabled={!debitSelection.category}>
                            <option value="">Select...</option>
                            {(coa.subcategories[debitSelection.category] || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                        </Input>
                        <Input id="debitAccountSearch" label="Search Detail Account" value={debitAccountSearch} onChange={e => setDebitAccountSearch(e.target.value)} placeholder="Type to filter..." disabled={!debitSelection.subcategory}/>
                        <Input as="select" id="debitAccountPath" label="Detail Account" value={formData.debitAccountPath || ''} onChange={e => setFormData(p => ({...p, debitAccountPath: e.target.value}))} disabled={!debitSelection.subcategory} required>
                            <option value="">Select...</option>
                            {filteredDebitDetails.map(d => <option key={d.id} value={`modules/FI/ChartOfAccounts/${debitSelection.category}/Subcategories/${debitSelection.subcategory}/Details/${d.id}`}>{d.name} ({d.id})</option>)}
                        </Input>
                    </div>

                    <div className="p-4 border rounded-md space-y-2">
                        <h4 className="font-medium">Credit Account</h4>
                        <Input as="select" id="creditCategory" label="Category" value={creditSelection.category} onChange={e => setCreditSelection({category: e.target.value, subcategory: ''})}>
                            <option value="">Select...</option>
                            {coa.categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                        </Input>
                        <Input as="select" id="creditSubcategory" label="Subcategory" value={creditSelection.subcategory} onChange={e => setCreditSelection(p => ({...p, subcategory: e.target.value}))} disabled={!creditSelection.category}>
                            <option value="">Select...</option>
                            {(coa.subcategories[creditSelection.category] || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                        </Input>
                        <Input id="creditAccountSearch" label="Search Detail Account" value={creditAccountSearch} onChange={e => setCreditAccountSearch(e.target.value)} placeholder="Type to filter..." disabled={!creditSelection.subcategory}/>
                        <Input as="select" id="creditAccountPath" label="Detail Account" value={formData.creditAccountPath || ''} onChange={e => setFormData(p => ({...p, creditAccountPath: e.target.value}))} disabled={!creditSelection.subcategory} required>
                            <option value="">Select...</option>
                            {filteredCreditDetails.map(d => <option key={d.id} value={`modules/FI/ChartOfAccounts/${creditSelection.category}/Subcategories/${creditSelection.subcategory}/Details/${d.id}`}>{d.name} ({d.id})</option>)}
                        </Input>
                    </div>
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                    <label htmlFor="costCenterRequired" className="font-medium text-gray-700">Cost Center Required?</label>
                    <input type="checkbox" id="costCenterRequired" checked={formData.costCenterRequired} onChange={e => setFormData(p => ({...p, costCenterRequired: e.target.checked}))} className="h-4 w-4 rounded" />
                </div>
                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} isLoading={isLoading}>Save Rule</Button>
                </div>
            </div>
        </Modal>
    );
};

export default PostingRuleModal;
