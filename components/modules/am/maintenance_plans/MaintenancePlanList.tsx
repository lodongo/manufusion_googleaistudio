
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation, AppUser } from '../../../../types';
import type { MaintenancePlan } from '../../../../types/am_types';
import Button from '../../../Button';
import 'firebase/compat/firestore';

interface MaintenancePlanListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    onSelectPlan: (plan: MaintenancePlan) => void;
    onCreatePlan: () => void;
    currentUser: AppUser;
}

export const MaintenancePlanList: React.FC<MaintenancePlanListProps> = ({ organisation, theme, onSelectPlan, onCreatePlan, currentUser }) => {
    const [plans, setPlans] = useState<MaintenancePlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const plansRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('maintenancePlans');
        const q = plansRef.orderBy('createdAt', 'desc');
        const unsubscribe = q.onSnapshot(snapshot => {
            setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenancePlan)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching plans:", error);
            setLoading(false);
        });
        return unsubscribe;
    }, [organisation.domain]);

    const getStatusColor = (status: string) => {
         switch(status) {
             case 'OPEN': return 'bg-blue-100 text-blue-800';
             case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
             case 'COMPLETED': return 'bg-green-100 text-green-800';
             case 'CANCELLED': return 'bg-red-100 text-red-800';
             default: return 'bg-gray-100 text-gray-800';
         }
    }

    if (loading) return <div className="p-8 text-center">Loading plans...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Maintenance Plans</h3>
                <Button onClick={onCreatePlan} className="!w-auto">Create Plan</Button>
            </div>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Plan ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {plans.map(plan => (
                            <tr key={plan.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                                    <button 
                                        onClick={() => onSelectPlan(plan)} 
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                                    >
                                        {plan.planId}
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{plan.planName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {plan.allocationLevel3Name ? (
                                        <div className="flex flex-col">
                                            <span>{plan.allocationLevel3Name}</span>
                                            <span className="text-xs text-slate-400">{plan.allocationLevel4Name}</span>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {plan.scheduledStartDate} <span className="text-slate-400">to</span> {plan.scheduledEndDate}
                                    {plan.week && <div className="text-xs text-slate-400">Wk {plan.week}, {plan.year}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(plan.status)}`}>
                                        {plan.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {plans.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No maintenance plans found. Create one to get started.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};