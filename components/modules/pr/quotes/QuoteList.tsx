
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { ProcurementRFQ } from '../../../../types/pr_types';
import Button from '../../../Button';
import QuoteDetailModal from './QuoteDetailModal';

interface QuoteListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const QuoteList: React.FC<QuoteListProps> = ({ organisation, theme, currentUser }) => {
    const [rfqs, setRfqs] = useState<ProcurementRFQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRfq, setSelectedRfq] = useState<ProcurementRFQ | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        // Fetch from 'rfqs' collection instead of 'quotes'
        const rfqsRef = collection(db, `organisations/${organisation.domain}/modules/PR/rfqs`);
        const q = query(rfqsRef, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRfqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRFQ));
            setRfqs(fetchedRfqs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching RFQs: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain]);

    const getStatusChip = (status: ProcurementRFQ['status']) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-800';
            case 'OPEN': return 'bg-blue-100 text-blue-800';
            case 'AWARDED': return 'bg-green-100 text-green-800';
            case 'CLOSED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white p-6 rounded-b-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Request for Quotation (RFQ)</h2>
                <Button onClick={() => setIsCreateModalOpen(true)} className="!w-auto">Create RFQ</Button>
            </div>
            
            {loading ? <p className="text-center py-8">Loading RFQs...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                         <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">RFQ #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Items</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {rfqs.map(rfq => (
                                <tr key={rfq.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-700">{rfq.rfqNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{rfq.categoryName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{rfq.items?.length || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{rfq.createdAt?.toDate ? rfq.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(rfq.status)}`}>
                                            {rfq.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => setSelectedRfq(rfq)} 
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rfqs.length === 0 && <p className="text-center py-8 text-slate-500">No RFQs found.</p>}
                </div>
            )}

            {(isCreateModalOpen || selectedRfq) && (
                <QuoteDetailModal
                    isOpen={true}
                    onClose={() => { setIsCreateModalOpen(false); setSelectedRfq(null); }}
                    rfq={selectedRfq}
                    organisation={organisation}
                    currentUser={currentUser}
                    theme={theme}
                />
            )}
        </div>
    );
};

export default QuoteList;
