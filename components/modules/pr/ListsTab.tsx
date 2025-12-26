
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import type { ProcurementListEntry } from '../../../types/pr_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import ListEntryModal from './ListEntryModal';
import { defaultIncoterms, defaultPaymentTerms, defaultReturnPolicies } from '../../../constants/pr_lists_defaults';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

type ListType = 'Incoterms' | 'PaymentTerms' | 'ReturnPolicies';

const ListsTab: React.FC = () => {
    const [activeList, setActiveList] = useState<ListType>('PaymentTerms');
    const [entries, setEntries] = useState<ProcurementListEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ProcurementListEntry | null>(null);

    const collectionPath = `modules/PR/Lists/${activeList}/Entries`;

    useEffect(() => {
        setLoading(true);
        const ref = collection(db, collectionPath);
        const q = query(ref, orderBy('acronym'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementListEntry)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [activeList, collectionPath]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            let dataToSeed: ProcurementListEntry[] = [];
            if (activeList === 'Incoterms') dataToSeed = defaultIncoterms;
            else if (activeList === 'PaymentTerms') dataToSeed = defaultPaymentTerms;
            else if (activeList === 'ReturnPolicies') dataToSeed = defaultReturnPolicies;

            dataToSeed.forEach(entry => {
                const docRef = doc(db, collectionPath, entry.id);
                batch.set(docRef, entry);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error seeding data:", error);
            alert("Failed to seed data.");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSave = async (data: ProcurementListEntry) => {
        const docRef = doc(db, collectionPath, data.id);
        await setDoc(docRef, data, { merge: true });
    };

    const handleDelete = async () => {
        if (!selectedEntry) return;
        await deleteDoc(doc(db, collectionPath, selectedEntry.id));
        setIsConfirmModalOpen(false);
        setSelectedEntry(null);
    };

    const listTitles: Record<ListType, string> = {
        PaymentTerms: 'Payment Terms',
        Incoterms: 'Incoterms',
        ReturnPolicies: 'Return Policies'
    };

    const TabButton: React.FC<{ type: ListType }> = ({ type }) => (
        <button
            onClick={() => setActiveList(type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeList === type ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
            {listTitles[type]}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-6">
                    <TabButton type="PaymentTerms" />
                    <TabButton type="Incoterms" />
                    <TabButton type="ReturnPolicies" />
                </nav>
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{listTitles[activeList]}</h3>
                    <p className="mt-1 text-sm text-gray-600">Manage default options for {listTitles[activeList].toLowerCase()} used in procurement.</p>
                </div>
                <div className="flex gap-2">
                    {entries.length === 0 && (
                        <Button variant="secondary" onClick={handleSeedData} isLoading={isSeeding} className="!w-auto">
                            Seed Defaults
                        </Button>
                    )}
                    <Button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }} className="!w-auto">
                        + Add {activeList.slice(0, -1)}
                    </Button>
                </div>
            </div>
          
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full leading-normal">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acronym</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                            ) : entries.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">No entries found.</td></tr>
                            ) : (
                                entries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-4 bg-white text-sm font-mono text-slate-600">{entry.id}</td>
                                        <td className="px-5 py-4 bg-white text-sm font-bold text-slate-900">{entry.acronym}</td>
                                        <td className="px-5 py-4 bg-white text-sm text-slate-800">{entry.fullAcronym}</td>
                                        <td className="px-5 py-4 bg-white text-sm text-center font-mono">{entry.value ?? '-'}</td>
                                        <td className="px-5 py-4 bg-white text-sm text-center">{entry.unit || '-'}</td>
                                        <td className="px-5 py-4 bg-white text-sm text-slate-500 max-w-xs truncate" title={entry.description}>{entry.description}</td>
                                        <td className="px-5 py-4 bg-white text-sm text-center">
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${entry.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {entry.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 bg-white text-sm text-center">
                                            <div className="inline-flex space-x-2">
                                                <button onClick={() => { setSelectedEntry(entry); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors">
                                                    <EditIcon />
                                                </button>
                                                <button onClick={() => { setSelectedEntry(entry); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors">
                                                    <DeleteIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ListEntryModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSave} 
                entryToEdit={selectedEntry} 
                title={listTitles[activeList]}
            />

            <ConfirmationModal 
                isOpen={isConfirmModalOpen} 
                onClose={() => setIsConfirmModalOpen(false)} 
                onConfirm={handleDelete} 
                title={`Delete ${listTitles[activeList].slice(0, -1)}?`}
                message={`Are you sure you want to permanently delete "${selectedEntry?.fullAcronym}"? This action cannot be undone.`}
                confirmButtonText="Delete"
            />
        </div>
    );
};

export default ListsTab;
