// components/modules/fi/PostingRulesTab.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation } from '../../../types';
import type { PostingRule } from '../../../types/fi_types';
import Button from '../../Button';
import PostingRuleModal from './PostingRuleModal';
import ConfirmationModal from '../../common/ConfirmationModal';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface PostingRulesTabProps {
    organisation: Organisation;
}

const PostingRulesTab: React.FC<PostingRulesTabProps> = ({ organisation }) => {
    const [rules, setRules] = useState<PostingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<{isOpen: boolean, ruleToEdit: PostingRule | null}>({isOpen: false, ruleToEdit: null});
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, ruleToDelete: PostingRule | null}>({isOpen: false, ruleToDelete: null});

    const orgId = organisation.domain;
    const rulesCollectionRef = db.collection(`organisations/${orgId}/modules/FI/postingRules`);

    useEffect(() => {
        const unsubRules = rulesCollectionRef.orderBy('code').onSnapshot(snapshot => {
            setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostingRule)));
            setLoading(false);
        });

        return () => unsubRules();
    }, [orgId, rulesCollectionRef]);

    const handleSave = async (data: Partial<PostingRule>) => {
        if (data.id) { // Editing existing rule
            const docRef = rulesCollectionRef.doc(data.id);
            const { id, ...updateData } = data;
            await docRef.update(updateData);
        } else { // Creating new rule
            const counterRef = db.doc(`organisations/${orgId}/modules/FI/settings/counters`);
            
            const newCode = await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const newCount = (counterDoc.data()?.postingRuleCounter || 0) + 1;
                transaction.set(counterRef, { postingRuleCounter: newCount }, { merge: true });
                return `RULE${String(newCount).padStart(5, '0')}`;
            });

            const newDocRef = rulesCollectionRef.doc();
            const completeData: PostingRule = {
                ...(data as Omit<PostingRule, 'id' | 'code'>),
                id: newDocRef.id,
                code: newCode,
            };
            await newDocRef.set(completeData);
        }
        setModalState({isOpen: false, ruleToEdit: null});
    };

    const handleDelete = async () => {
        if (!confirmModal.ruleToDelete) return;
        await rulesCollectionRef.doc(confirmModal.ruleToDelete.id).delete();
        setConfirmModal({ isOpen: false, ruleToDelete: null });
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Posting Rules</h3>
                <Button onClick={() => setModalState({ isOpen: true, ruleToEdit: null })}>Add New Rule</Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Define standard accounting entries by linking a Journal Class to specific Debit and Credit GL accounts for this organization.</p>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rule Name</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Journal Class</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Accounts (Dr / Cr)</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">CC Req.</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rules.length > 0 ? (
                      rules.map(rule => (
                        <tr key={rule.id}>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap font-mono">{rule.code}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap font-semibold">{rule.name}</p>
                            <p className="text-gray-600 whitespace-no-wrap text-xs">{rule.description}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap">{rule.journalClassName}</p>
                            <p className="text-gray-600 whitespace-no-wrap text-xs font-mono">{rule.journalClassCode}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap"><b>Dr:</b> {rule.debitAccountName}</p>
                            <p className="text-gray-900 whitespace-no-wrap"><b>Cr:</b> {rule.creditAccountName}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">
                            {rule.costCenterRequired ? (
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-600 rounded-full">✓</span>
                            ) : null}
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">
                            <div className="inline-flex space-x-2">
                              <button onClick={() => setModalState({ isOpen: true, ruleToEdit: rule })} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                              <button onClick={() => setConfirmModal({ isOpen: true, ruleToDelete: rule })} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-gray-500">No posting rules defined yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {modalState.isOpen && <PostingRuleModal isOpen={modalState.isOpen} onClose={() => setModalState({isOpen: false, ruleToEdit: null})} onSave={handleSave} ruleToEdit={modalState.ruleToEdit} />}
            <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({isOpen: false, ruleToDelete: null})} onConfirm={handleDelete} title={`Delete Rule: ${confirmModal.ruleToDelete?.name}?`} message="Are you sure you want to delete this posting rule?" />
        </div>
    );
};

export default PostingRulesTab;
