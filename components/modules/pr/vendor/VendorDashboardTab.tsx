
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { Vendor, SrmAssessment } from '../../../../types/pr_types';
import type { Organisation } from '../../../../types';

const VendorDashboardTab: React.FC<{ vendor: Vendor; organisation: Organisation; theme: Organisation['theme'] }> = ({ vendor, organisation, theme }) => {
    const [latestAssessment, setLatestAssessment] = useState<SrmAssessment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatestAssessment = async () => {
            try {
                const assessmentsRef = collection(db, `organisations/${organisation.domain}/modules/PR/assessments`);
                const q = query(
                    assessmentsRef,
                    where('vendorId', '==', vendor.id),
                    where('status', '==', 'Completed'),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    setLatestAssessment({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SrmAssessment);
                }
            } catch (error) {
                console.error("Error fetching latest assessment:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLatestAssessment();
    }, [vendor.id, organisation.domain]);

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };
    
    const getBgColor = (score: number) => {
        if (score >= 75) return 'bg-green-100 text-green-800';
        if (score >= 50) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</h4>
                    <p className="text-2xl font-bold text-slate-800 mt-2">{vendor.status}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Risk Rating</h4>
                    <p className={`text-2xl font-bold mt-2 ${vendor.riskRating === 'HIGH' ? 'text-red-600' : vendor.riskRating === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}`}>{vendor.riskRating || 'N/A'}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Spend YTD</h4>
                    <p className="text-2xl font-bold text-slate-800 mt-2">$0.00</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Last SRM Assessment</h3>
                {loading ? (
                    <p className="text-slate-500">Loading assessment data...</p>
                ) : latestAssessment ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{latestAssessment.name}</h4>
                                <p className="text-sm text-slate-500">Completed on {latestAssessment.completedAt?.toDate().toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <div className={`text-3xl font-extrabold ${getScoreColor(latestAssessment.percentage)}`}>{latestAssessment.percentage.toFixed(1)}%</div>
                                <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded uppercase mt-1 ${latestAssessment.result === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {latestAssessment.result}
                                </span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Category Breakdown</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {latestAssessment.categories.map(cat => {
                                    // Calculate category percentage if stored, otherwise approx from questions
                                    // Assuming SrmAssessment struct has question scores. 
                                    // For summary, if category aggregate isn't stored, we might need to calc.
                                    // However, simpler is just to show what we have.
                                    // Let's assume we can calculate it on the fly or it was stored.
                                    // Since previous implementation of SrmAssessment type didn't explicitly have cat score, we iterate.
                                    
                                    let catTotal = 0;
                                    let catMax = 0;
                                    cat.questions.forEach(q => {
                                         if (q.score > 0) { // Assuming 0 is unscored/skip logic handled elsewhere
                                             catTotal += q.score;
                                             catMax += q.maxScore;
                                         }
                                    });
                                    const catPercent = catMax > 0 ? (catTotal / catMax) * 100 : 0;

                                    return (
                                        <div key={cat.id} className="p-3 border rounded-md">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-medium text-slate-700 truncate" title={cat.name}>{cat.name}</span>
                                                <span className={`text-sm font-bold ${getScoreColor(catPercent)}`}>{catPercent.toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full ${catPercent >= 75 ? 'bg-green-500' : catPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${catPercent}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 italic bg-slate-50 rounded-lg border border-dashed">
                        No completed assessments found for this vendor.
                    </div>
                )}
            </div>
        </div>
    );
};

export default VendorDashboardTab;
