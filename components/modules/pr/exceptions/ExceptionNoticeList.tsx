

import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { ExceptionNotice } from '../../../../types/pr_types';

interface ExceptionNoticeListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

const ExceptionNoticeList: React.FC<ExceptionNoticeListProps> = ({ organisation, theme }) => {
    const [exceptions, setExceptions] = useState<ExceptionNotice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ref = collection(db, `organisations/${organisation.domain}/modules/PR/exceptionNotices`);
        const q = query(ref, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setExceptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExceptionNotice)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching exceptions: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain]);

    if (loading) return <div className="p-8 text-center">Loading exceptions...</div>;

    return (
        <div className="bg-white p-6 rounded-b-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">Procurement Exception Notices</h2>
            
            {exceptions.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No exceptions logged.</p>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Notice ID</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Quote Ref</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Supplier</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Reason</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Justification</th>
                                <th className="px-6 py-3 text-right font-medium text-slate-500 uppercase">Value</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {exceptions.map(ex => (
                                <tr key={ex.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono font-bold text-red-600">{ex.noticeNumber}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{ex.quoteNumber}</td>
                                    <td className="px-6 py-4 text-slate-900 font-medium">{ex.supplierName}</td>
                                    <td className="px-6 py-4 text-slate-600">{ex.awardReason}</td>
                                    <td className="px-6 py-4 text-slate-600 italic max-w-xs truncate" title={ex.justification}>{ex.justification}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        ${(ex.quoteValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ExceptionNoticeList;