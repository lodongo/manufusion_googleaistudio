
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation } from '../../../types';
import type { JournalEntry } from '../../../types/fi_types';
import Modal from '../../common/Modal';
import Button from '../../Button';

interface JournalsTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

const JournalDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    journal: JournalEntry;
}> = ({ isOpen, onClose, journal }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Journal Entry: ${journal.code || journal.journalId || journal.id}`} size="5xl">
             <div className="space-y-6">
                 {/* Header Info */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded border">
                     <div>
                         <p className="text-xs text-slate-500 uppercase font-bold">Journal ID</p>
                         <p className="font-mono text-sm">{journal.code || journal.journalId || 'N/A'}</p>
                     </div>
                     <div>
                         <p className="text-xs text-slate-500 uppercase font-bold">Date</p>
                         <p className="text-sm">{journal.date?.toDate().toLocaleString()}</p>
                     </div>
                     <div>
                         <p className="text-xs text-slate-500 uppercase font-bold">Reference</p>
                         <p className="text-sm">{journal.reference}</p>
                     </div>
                     <div>
                         <p className="text-xs text-slate-500 uppercase font-bold">Created By</p>
                         <p className="text-sm">{journal.createdBy?.name || 'System'}</p>
                     </div>
                     <div className="col-span-2 md:col-span-4">
                         <p className="text-xs text-slate-500 uppercase font-bold">Description</p>
                         <p className="text-sm">{journal.description}</p>
                     </div>
                 </div>

                 {/* Lines Table */}
                 <div>
                     <h4 className="font-bold text-slate-700 mb-2">Lines</h4>
                     <div className="overflow-x-auto border rounded">
                         <table className="min-w-full text-sm text-left">
                             <thead className="bg-slate-100">
                                 <tr>
                                     <th className="p-2">Type</th>
                                     <th className="p-2">Account</th>
                                     <th className="p-2">Cost Center (L4/L5)</th>
                                     <th className="p-2 text-right">Amount</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y">
                                 {(journal.lines || []).map((line: any, idx: number) => (
                                     <tr key={idx}>
                                         <td className="p-2">
                                             <span className={`px-2 py-0.5 rounded text-xs font-bold ${line.type === 'Debit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                 {line.type}
                                             </span>
                                         </td>
                                         <td className="p-2">
                                             <p className="font-medium">{line.glDetailName || 'Unknown Account'}</p>
                                             <p className="text-xs text-slate-500">{line.glDetailId}</p>
                                         </td>
                                         <td className="p-2 text-xs">
                                             {line.l4Id ? `Dept: ${line.l4Id}` : '-'}
                                             {line.l5Id ? ` / Sect: ${line.l5Id}` : ''}
                                         </td>
                                         <td className="p-2 text-right font-mono">
                                             {Number(line.amount).toFixed(2)}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                             <tfoot className="bg-slate-50 font-bold">
                                 <tr>
                                     <td colSpan={3} className="p-2 text-right">Total</td>
                                     <td className="p-2 text-right">{Number(journal.amount).toFixed(2)}</td>
                                 </tr>
                             </tfoot>
                         </table>
                     </div>
                 </div>
                 
                 {/* Settled Items (if any) */}
                 {journal.itemsSettled && journal.itemsSettled.length > 0 && (
                     <div>
                         <h4 className="font-bold text-slate-700 mb-2">Settled Items</h4>
                         <ul className="list-disc list-inside text-sm text-slate-600">
                             {journal.itemsSettled.map((item: any, i: number) => (
                                 <li key={i}>{item.materialName} - Qty: {item.quantity} {item.cost ? `($${Number(item.cost).toFixed(2)})` : ''}</li>
                             ))}
                         </ul>
                     </div>
                 )}

                 <div className="flex justify-end pt-4 border-t">
                     <Button onClick={onClose}>Close</Button>
                 </div>
             </div>
        </Modal>
    );
};

const JournalsTab: React.FC<JournalsTabProps> = ({ organisation, theme }) => {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);

  useEffect(() => {
    const journalsRef = db.collection(`organisations/${organisation.domain}/modules/FI/journals`);
    const q = journalsRef.orderBy('date', 'desc');

    const unsubscribe = q.onSnapshot(snapshot => {
      const fetchedJournals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      setJournals(fetchedJournals);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching journals:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organisation.domain]);

  if (loading) return <div className="p-8 text-center">Loading journals...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Financial Journals</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Journal ID</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Ref</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Description</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Created By</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {journals.map(journal => (
              <tr key={journal.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                    <button onClick={() => setSelectedJournal(journal)} className="hover:underline text-left w-full">
                        {journal.code || journal.journalId || journal.id?.substring(0,8)}
                    </button>
                </td>
                <td className="px-4 py-3">{journal.date?.toDate().toLocaleDateString()} {journal.date?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td className="px-4 py-3 font-mono text-xs">{journal.reference}</td>
                <td className="px-4 py-3 text-slate-700 truncate max-w-xs">{journal.description}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{Number(journal.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{journal.createdBy?.name || 'System'}</td>
                <td className="px-4 py-3 text-center">
                    {/* Action column reserved for future use, e.g. Reverse, Print */}
                </td>
              </tr>
            ))}
            {journals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No journal entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {selectedJournal && (
          <JournalDetailModal 
            isOpen={!!selectedJournal} 
            onClose={() => setSelectedJournal(null)} 
            journal={selectedJournal} 
          />
      )}
    </div>
  );
};

export default JournalsTab;
