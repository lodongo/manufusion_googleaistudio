

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Vendor, AssessmentCategory, AssessmentQuestion, SrmAssessment } from '../../../../types/pr_types';
import type { Organisation, AppUser } from '../../../../types';
import Button from '../../../Button';
import Input from '../../../Input';
import Modal from '../../../common/Modal';
import LineChart from '../../../common/LineChart';

// Chevron Icon
const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

const VendorSRMTab: React.FC<{ vendor: Vendor; organisation: Organisation; currentUser: AppUser; theme: Organisation['theme'] }> = ({ vendor, organisation, currentUser, theme }) => {
    const [assessments, setAssessments] = useState<SrmAssessment[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Create Modal State
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newForm, setNewForm] = useState({ name: '', type: 'Routine', reason: '', startDate: '', endDate: '', passMark: 75 });
    const [generating, setGenerating] = useState(false);

    // Scoring View State (Full Screen)
    const [isScoringMode, setIsScoringMode] = useState(false);
    const [activeAssessment, setActiveAssessment] = useState<SrmAssessment | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({}); // QuestionID -> Score (0=Unscored, -1=N/A, 1-5=Score)
    const [savingScore, setSavingScore] = useState(false);
    
    // Collapsible Categories State
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

    // Updated path: Store assessments in /organisations/$orgId/modules/PR/assessments
    const assessmentsRef = collection(db, `organisations/${organisation.domain}/modules/PR/assessments`);

    useEffect(() => {
        const fetchAssessments = async () => {
            setLoading(true);
            // Filter by vendorId
            const q = query(assessmentsRef, where('vendorId', '==', vendor.id), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SrmAssessment)));
            setLoading(false);
        };
        fetchAssessments();
    }, [organisation.domain, vendor.id]);

    const activeSRM = useMemo(() => assessments.find(a => a.status === 'In Progress'), [assessments]);

    const toggleCategory = (catId: string) => {
        setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const handleCreate = async () => {
        if (!newForm.name || !newForm.startDate || !newForm.endDate) return;
        setGenerating(true);
        try {
            // 1. Fetch Global Template
            const templateRef = collection(db, `modules/PR/assessmentTemplates/master/categories`);
            const catsSnap = await getDocs(query(templateRef, orderBy('order')));
            
            const categories = await Promise.all(catsSnap.docs.map(async catDoc => {
                const catData = catDoc.data() as AssessmentCategory;
                const qsRef = collection(catDoc.ref, 'questions');
                const qsSnap = await getDocs(query(qsRef, orderBy('order')));
                
                return {
                    id: catDoc.id,
                    name: catData.name,
                    weight: catData.weight_percent,
                    questions: qsSnap.docs.map(qDoc => {
                        const qData = qDoc.data() as AssessmentQuestion;
                        return {
                            id: qDoc.id,
                            text: qData.question_text,
                            score: 0,
                            maxScore: 5,
                            scores: qData.scores, // Capture who scores this
                            question_type: qData.question_type, // Capture type
                            notes: ''
                        };
                    })
                };
            }));

            // 2. Create Assessment with Vendor ID
            const assessmentData: Omit<SrmAssessment, 'id'> = {
                vendorId: vendor.id,
                vendorName: vendor.legalName,
                name: newForm.name,
                type: newForm.type as any,
                triggerReason: newForm.reason,
                startDate: newForm.startDate,
                endDate: newForm.endDate,
                passMark: Number(newForm.passMark),
                status: 'In Progress',
                score: 0,
                maxScore: 100,
                percentage: 0,
                result: 'Fail',
                categories: categories,
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now()
            };

            await addDoc(assessmentsRef, assessmentData);
            
            // Refresh list
            const q = query(assessmentsRef, where('vendorId', '==', vendor.id), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SrmAssessment)));

            setCreateModalOpen(false);
            setNewForm({ name: '', type: 'Routine', reason: '', startDate: '', endDate: '', passMark: 75 });

        } catch (e) {
            console.error("Failed to create assessment", e);
            alert("Error creating assessment.");
        } finally {
            setGenerating(false);
        }
    };

    const openScoring = (assessment: SrmAssessment) => {
        setActiveAssessment(assessment);
        // Initialize local score state
        const initialScores: Record<string, number> = {};
        assessment.categories.forEach(c => c.questions.forEach(q => initialScores[q.id] = q.score));
        setScores(initialScores);
        setIsScoringMode(true);
        // Reset collapsed state
        setCollapsedCategories({});
        window.scrollTo(0, 0);
    };

    // --- Live Calculation Logic ---
    const metrics = useMemo(() => {
        if (!activeAssessment) return null;

        let totalQuestions = 0;
        let answeredQuestions = 0;

        let totalWeightedScore = 0;
        let totalPossibleWeight = 0;

        const breakdown = {
            total: { achieved: 0, max: 0 },
            organisation: { achieved: 0, max: 0 },
            supplier: { achieved: 0, max: 0 },
            both: { achieved: 0, max: 0 }
        };

        const categoryMetrics = activeAssessment.categories.map(cat => {
            let catAchieved = 0;
            let catMax = 0;
            
            // Breakdown for THIS category
            const catSpecificBreakdown = {
                organisation: { achieved: 0, max: 0 },
                supplier: { achieved: 0, max: 0 },
                both: { achieved: 0, max: 0 }
            };

            cat.questions.forEach(q => {
                const score = scores[q.id] !== undefined ? scores[q.id] : 0;
                const type = (q.scores || 'both') as 'organisation' | 'supplier' | 'both';
                
                // Count for progress (exclude N/A from total count if preferred, here we count all inputs)
                if (score !== 0) answeredQuestions++; 
                totalQuestions++;

                // Calculation:
                // -1 is N/A: Do not add to max, do not add to achieved.
                // 0 is Unscored: Add to max (potential), add 0 to achieved.
                // >0 is Scored: Add to max, add to achieved.
                if (score !== -1) {
                    const points = 5; // Max score per question
                    const valueToAdd = score > 0 ? score : 0;

                    catMax += points;
                    catAchieved += valueToAdd;

                    // Global Breakdown
                    breakdown.total.achieved += valueToAdd;
                    breakdown.total.max += points;

                    if (type === 'organisation') {
                        breakdown.organisation.achieved += valueToAdd;
                        breakdown.organisation.max += points;
                        catSpecificBreakdown.organisation.achieved += valueToAdd;
                        catSpecificBreakdown.organisation.max += points;
                    } else if (type === 'supplier') {
                        breakdown.supplier.achieved += valueToAdd;
                        breakdown.supplier.max += points;
                        catSpecificBreakdown.supplier.achieved += valueToAdd;
                        catSpecificBreakdown.supplier.max += points;
                    } else {
                        breakdown.both.achieved += valueToAdd;
                        breakdown.both.max += points;
                        catSpecificBreakdown.both.achieved += valueToAdd;
                        catSpecificBreakdown.both.max += points;
                    }
                }
            });

            // Calculate Category % Contribution
            // If all questions are N/A (catMax=0), category score is 0.
            const catPercent = catMax > 0 ? (catAchieved / catMax) : 0;
            
            // Add weight to total possible ONLY if there were applicable questions
            if (catMax > 0) {
                 totalWeightedScore += (catPercent * cat.weight);
                 totalPossibleWeight += cat.weight;
            }

            return { 
                ...cat, 
                achieved: catAchieved, 
                max: catMax, 
                percent: catPercent * 100,
                breakdown: {
                    organisation: catSpecificBreakdown.organisation.max > 0 ? (catSpecificBreakdown.organisation.achieved / catSpecificBreakdown.organisation.max) * 100 : 0,
                    supplier: catSpecificBreakdown.supplier.max > 0 ? (catSpecificBreakdown.supplier.achieved / catSpecificBreakdown.supplier.max) * 100 : 0,
                    both: catSpecificBreakdown.both.max > 0 ? (catSpecificBreakdown.both.achieved / catSpecificBreakdown.both.max) * 100 : 0,
                    hasOrg: catSpecificBreakdown.organisation.max > 0,
                    hasSup: catSpecificBreakdown.supplier.max > 0,
                    hasBoth: catSpecificBreakdown.both.max > 0
                }
            };
        });

        // Final normalization over applicable weights
        const finalPercentage = totalPossibleWeight > 0 ? (totalWeightedScore / totalPossibleWeight) * 100 : 0;
        const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

        return {
            overallScore: finalPercentage,
            progress,
            categoryMetrics,
            breakdown: {
                total: breakdown.total.max > 0 ? (breakdown.total.achieved / breakdown.total.max) * 100 : 0,
                organisation: breakdown.organisation.max > 0 ? (breakdown.organisation.achieved / breakdown.organisation.max) * 100 : 0,
                supplier: breakdown.supplier.max > 0 ? (breakdown.supplier.achieved / breakdown.supplier.max) * 100 : 0,
                both: breakdown.both.max > 0 ? (breakdown.both.achieved / breakdown.both.max) * 100 : 0,
            }
        };

    }, [activeAssessment, scores]);


    const saveScores = async (finalize = false) => {
        if (!activeAssessment || !metrics) return;
        setSavingScore(true);

        const updatedCategories = activeAssessment.categories.map(cat => {
            const updatedQuestions = cat.questions.map(q => ({
                ...q,
                score: scores[q.id] || 0
            }));
            return { ...cat, questions: updatedQuestions };
        });

        const result = metrics.overallScore >= activeAssessment.passMark ? 'Pass' : 'Fail';

        const updateData: Partial<SrmAssessment> = {
            categories: updatedCategories,
            score: metrics.overallScore, // Storing percentage as score for simplicity in this view context
            percentage: metrics.overallScore,
            result: result
        };

        if (finalize) {
            updateData.status = 'Completed';
            updateData.completedAt = Timestamp.now();
        }

        await updateDoc(doc(assessmentsRef, activeAssessment.id), updateData);
        
        // Refresh local list
        setAssessments(prev => prev.map(a => a.id === activeAssessment.id ? { ...a, ...updateData } : a));
        
        if (finalize) {
            setIsScoringMode(false);
            setActiveAssessment(null);
        } else {
            alert("Draft Saved.");
        }
        setSavingScore(false);
    };
    
    // Chart Data for History
    const chartData = useMemo(() => {
        return assessments
            .filter(a => a.status === 'Completed')
            .sort((a,b) => a.createdAt.seconds - b.createdAt.seconds)
            .map(a => ({
                date: a.createdAt.toDate(),
                rate: a.percentage
            }));
    }, [assessments]);

    // --- Scoring View Component ---
    if (isScoringMode && activeAssessment && metrics) {
        const isReadOnly = activeAssessment.status === 'Completed';

        return (
            <div className="flex flex-col h-full bg-slate-100 -m-6 md:-m-8">
                {/* Sticky Header */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-md">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setIsScoringMode(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                    </button>
                                    <h2 className="text-2xl font-bold text-slate-800">{activeAssessment.name}</h2>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">{activeAssessment.type}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1 ml-9">Pass Mark: {activeAssessment.passMark}% | Due: {activeAssessment.endDate}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-3xl font-extrabold text-slate-900">{metrics.overallScore.toFixed(1)}%</div>
                                <div className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${metrics.overallScore >= activeAssessment.passMark ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {metrics.overallScore >= activeAssessment.passMark ? 'Passing' : 'Failing'}
                                </div>
                            </div>
                        </div>

                        {/* Score Cards Row */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                            <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Score</span>
                                <div className="text-lg font-bold text-slate-800">{metrics.breakdown.total.toFixed(0)}%</div>
                            </div>
                            <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                                <span className="text-[10px] text-blue-600 uppercase font-bold">Organisation</span>
                                <div className="text-lg font-bold text-blue-800">{metrics.breakdown.organisation.toFixed(0)}%</div>
                            </div>
                            <div className="bg-green-50 p-2 rounded border border-green-200 text-center">
                                <span className="text-[10px] text-green-600 uppercase font-bold">Supplier</span>
                                <div className="text-lg font-bold text-green-800">{metrics.breakdown.supplier.toFixed(0)}%</div>
                            </div>
                            <div className="bg-purple-50 p-2 rounded border border-purple-200 text-center">
                                <span className="text-[10px] text-purple-600 uppercase font-bold">Joint (Both)</span>
                                <div className="text-lg font-bold text-purple-800">{metrics.breakdown.both.toFixed(0)}%</div>
                            </div>
                             <div className="bg-white p-2 rounded border border-slate-200 flex flex-col justify-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold mb-1">Completion</span>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div className="bg-slate-800 h-2 rounded-full transition-all duration-300" style={{ width: `${metrics.progress}%` }}></div>
                                </div>
                                <div className="text-right text-[10px] font-bold text-slate-600 mt-1">{metrics.progress}%</div>
                            </div>
                        </div>

                        {/* Action Bar */}
                        {!isReadOnly && (
                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                <Button variant="secondary" onClick={() => saveScores(false)} isLoading={savingScore} className="!w-auto !py-1.5">Save Draft</Button>
                                <Button 
                                    onClick={() => saveScores(true)} 
                                    isLoading={savingScore} 
                                    disabled={metrics.progress < 100}
                                    className={`!w-auto !py-1.5 ${metrics.progress < 100 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    style={{ backgroundColor: theme.colorPrimary }}
                                >
                                    Finalize Scorecard
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full space-y-8">
                     {/* Category Blocks */}
                     {metrics.categoryMetrics.map((cat) => (
                         <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                             {/* Category Header */}
                             <div 
                                className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => toggleCategory(cat.id)}
                            >
                                 <div className="flex items-center gap-3">
                                     <ChevronDownIcon className={collapsedCategories[cat.id] ? '-rotate-90' : ''} />
                                     <div>
                                         <h3 className="font-bold text-lg text-slate-800">{cat.name}</h3>
                                         <p className="text-xs text-slate-500">Weight: {cat.weight}%</p>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-6">
                                     <div className="flex gap-4 text-xs">
                                         {cat.breakdown.hasOrg && (
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-600 font-bold">{cat.breakdown.organisation.toFixed(0)}%</span>
                                                <span className="text-[10px] text-slate-400 uppercase">Org</span>
                                            </div>
                                         )}
                                         {cat.breakdown.hasSup && (
                                            <div className="flex flex-col items-center">
                                                <span className="text-green-600 font-bold">{cat.breakdown.supplier.toFixed(0)}%</span>
                                                <span className="text-[10px] text-slate-400 uppercase">Sup</span>
                                            </div>
                                         )}
                                         {cat.breakdown.hasBoth && (
                                            <div className="flex flex-col items-center">
                                                <span className="text-purple-600 font-bold">{cat.breakdown.both.toFixed(0)}%</span>
                                                <span className="text-[10px] text-slate-400 uppercase">Joint</span>
                                            </div>
                                         )}
                                     </div>
                                     <div className="flex flex-col w-32 text-right">
                                         <span className="text-lg font-extrabold text-slate-800">{cat.percent.toFixed(0)}%</span>
                                         <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                             <div 
                                                className={`h-1.5 rounded-full ${cat.percent < 50 ? 'bg-red-500' : cat.percent < 75 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                                style={{ width: `${cat.percent}%` }}
                                            ></div>
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             {/* Questions List */}
                             {!collapsedCategories[cat.id] && (
                                 <div className="divide-y divide-slate-100">
                                     {cat.questions.map((q) => {
                                         const scoresType = q.scores || 'both';
                                         const questionType = q.question_type || 'situational';

                                         // Visual Style based on SCORER (Background Tint)
                                         let bgClass = 'bg-white';
                                         let badgeClass = 'bg-slate-100 text-slate-600';
                                         let badgeText = 'Joint';

                                         if (scoresType === 'organisation') {
                                             bgClass = 'bg-blue-50/30';
                                             badgeClass = 'bg-blue-100 text-blue-700';
                                             badgeText = 'Organisation';
                                         } else if (scoresType === 'supplier') {
                                             bgClass = 'bg-green-50/30';
                                             badgeClass = 'bg-green-100 text-green-700';
                                             badgeText = 'Supplier';
                                         } else if (scoresType === 'both') {
                                             bgClass = 'bg-purple-50/30';
                                             badgeClass = 'bg-purple-100 text-purple-700';
                                             badgeText = 'Joint';
                                         }

                                         // Visual Style based on TYPE (Left Border)
                                         let borderClass = 'border-l-4 border-slate-300'; // Default / Situational
                                         let typeBadge = null;

                                         if (questionType === 'strategic') {
                                             borderClass = 'border-l-4 border-amber-400';
                                             typeBadge = <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase ml-2 border border-amber-200">Strategic</span>;
                                         }

                                         const currentScore = scores[q.id] !== undefined ? scores[q.id] : 0;

                                         return (
                                             <div key={q.id} className={`p-4 ${borderClass} ${bgClass}`}>
                                                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                     <div className="flex-1">
                                                         <div className="flex items-center mb-1">
                                                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badgeClass}`}>{badgeText}</span>
                                                             {typeBadge}
                                                         </div>
                                                         <p className="text-sm font-medium text-slate-800">{q.text}</p>
                                                     </div>
                                                     
                                                     {/* Scoring Controls */}
                                                     <div className="flex items-center gap-1 shrink-0">
                                                         <button
                                                             onClick={() => !isReadOnly && setScores(p => ({...p, [q.id]: -1}))}
                                                             className={`w-8 h-8 rounded text-[10px] font-bold border transition-all ${currentScore === -1 ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                                                             disabled={isReadOnly}
                                                             title="Not Applicable (Excluded from calc)"
                                                         >
                                                             N/A
                                                         </button>
                                                         {[1, 2, 3, 4, 5].map(val => (
                                                             <button 
                                                                 key={val}
                                                                 onClick={() => !isReadOnly && setScores(p => ({...p, [q.id]: val}))}
                                                                 className={`w-9 h-9 rounded-md text-sm font-bold border transition-all ${
                                                                     currentScore === val 
                                                                     ? (val < 3 ? 'bg-red-500 text-white border-red-600' : val === 3 ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-green-500 text-white border-green-600')
                                                                     : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                                                                 }`}
                                                                 disabled={isReadOnly}
                                                             >
                                                                 {val}
                                                             </button>
                                                         ))}
                                                     </div>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             )}
                         </div>
                     ))}
                </div>
            </div>
        );
    }

    // --- Default View ---
    return (
        <div className="space-y-8">
            {/* Active SRM Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Active Assessment</h3>
                {activeSRM ? (
                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div>
                            <h4 className="font-bold text-blue-900">{activeSRM.name}</h4>
                            <p className="text-sm text-blue-700">{activeSRM.type} {activeSRM.triggerReason ? `- ${activeSRM.triggerReason}` : ''}</p>
                            <p className="text-xs text-blue-600 mt-1">Due: {activeSRM.endDate}</p>
                        </div>
                        <Button onClick={() => openScoring(activeSRM)} className="!w-auto">Open Scorecard</Button>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed">
                        <p className="text-slate-500 mb-4">No active assessment in progress.</p>
                        <Button onClick={() => setCreateModalOpen(true)} className="!w-auto">Create New Assessment</Button>
                    </div>
                )}
            </div>

            {/* Trends */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                 <h3 className="text-lg font-bold text-slate-800 mb-4">Performance Trend</h3>
                 {chartData.length > 0 ? (
                     <LineChart data={chartData} themeColor={theme.colorPrimary} />
                 ) : <p className="text-center text-slate-400 py-12">Not enough data for trends.</p>}
            </div>

            {/* History */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Historical SRMs</h3>
                <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Assessment Name</th>
                                <th className="px-4 py-3 text-center">Type</th>
                                <th className="px-4 py-3 text-center">Date</th>
                                <th className="px-4 py-3 text-right">Score</th>
                                <th className="px-4 py-3 text-center">Result</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {assessments.filter(a => a.status === 'Completed').map(ass => (
                                <tr key={ass.id}>
                                    <td className="px-4 py-3 font-medium">{ass.name}</td>
                                    <td className="px-4 py-3 text-center">{ass.type}</td>
                                    <td className="px-4 py-3 text-center">{ass.createdAt.toDate().toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-right font-bold">{ass.percentage.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${ass.result === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {ass.result}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                         <button onClick={() => openScoring(ass)} className="text-blue-600 hover:underline text-xs">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Start New SRM Assessment">
                <div className="space-y-4">
                    <Input label="Assessment Name" value={newForm.name} onChange={e => setNewForm({...newForm, name: e.target.value})} placeholder="e.g. Q3 2025 Evaluation" required id="aName"/>
                    <div className="grid grid-cols-2 gap-4">
                         <Input as="select" label="Type" value={newForm.type} onChange={e => setNewForm({...newForm, type: e.target.value})} id="aType">
                             <option value="Routine">Routine</option>
                             <option value="Triggered">Triggered</option>
                         </Input>
                         {newForm.type === 'Triggered' && <Input label="Reason" value={newForm.reason} onChange={e => setNewForm({...newForm, reason: e.target.value})} required id="aReason"/>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="date" label="Start Date" value={newForm.startDate} onChange={e => setNewForm({...newForm, startDate: e.target.value})} required id="aStart"/>
                        <Input type="date" label="End Date" value={newForm.endDate} onChange={e => setNewForm({...newForm, endDate: e.target.value})} required id="aEnd"/>
                    </div>
                    <Input type="number" label="Pass Mark (%)" value={newForm.passMark} onChange={e => setNewForm({...newForm, passMark: Number(e.target.value)})} required id="aPass"/>
                    
                    <div className="flex justify-end pt-4 gap-2">
                         <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                         <Button onClick={handleCreate} isLoading={generating}>Create & Load Template</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default VendorSRMTab;
