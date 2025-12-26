import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import type {
  Module,
  AppUser,
  Organisation,
  OrgPillarConfig,
  AssessmentPeriod,
  Assessment,
  FullPillar,
  FullStage,
  FullTheme,
  Question,
  Answer,
  EvidenceItem,
} from '../../types';
import Button from '../Button';
import { HierarchyNode } from '../org/HierarchyNodeModal';
import Modal from '../common/Modal';
import Input from '../Input';

const { Timestamp } = firebase.firestore;

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- ICONS ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 01-1.414 1.414L13 9.414V13H5.5z" />
    <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
  </svg>
);
const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" /><path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" /></svg>;
const ModuleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>;
const AssessmentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

// --- TYPES LOCAL ---
interface ModulePageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToAdmin: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

interface ExtendedAssessment extends Assessment {
    name?: string; // Custom name for the version
    type?: 'Self-Assessment' | 'Moderation' | 'Baseline';
    parentAssessmentId?: string;
    isActive: boolean;
    allocationLevel4Id: string;
    allocationLevel4Name: string;
    allocationLevel3Id?: string; 
    allocationLevel2Id?: string;
    createdAt: any;
    pillarId: string;
    pillarName: string;
    scoresByStage?: Record<string, number>;
}

// --- SCORE CALCULATION HELPER (0-5 Scale) ---
const calculateLiveScores = (
  answersMap: Map<string, Answer>,
  fullPillar: FullPillar | null
) => {
  if (!fullPillar) return { overall: 0, stages: {}, themes: {} };

  const scoresByTheme: Record<string, number> = {};
  const scoresByStage: Record<string, number> = {};
  let pillarSum = 0;
  let stageCount = 0;

  fullPillar.stages.forEach((stage) => {
    let stageSum = 0;
    let themeCount = 0;

    stage.themes.forEach((theme) => {
      let qualifiedCount = 0;
      const totalQuestions = theme.questions.length;

      theme.questions.forEach((q) => {
        const ans = answersMap.get(q.id);
        if (ans?.isQualified) {
          qualifiedCount++;
        }
      });

      // Theme Score (0-5 scale)
      // FIX: Ensure exact precision before aggregation
      const themeScore = totalQuestions > 0 ? (qualifiedCount / totalQuestions) * 5 : 0;
      scoresByTheme[theme.id] = themeScore;

      stageSum += themeScore;
      themeCount++;
    });

    // Stage Score (Average of Theme Scores)
    const stageScore = themeCount > 0 ? stageSum / themeCount : 0;
    scoresByStage[stage.id] = stageScore;

    pillarSum += stageScore;
    stageCount++;
  });

  // Overall Pillar Score (Average of Stage Scores)
  const overall = stageCount > 0 ? pillarSum / stageCount : 0;

  return {
    overall,
    stages: scoresByStage,
    themes: scoresByTheme,
  };
};

// --- SCORE VISUAL COMPONENT ---
const ScoreBadge = ({ score }: { score: number }) => {
    let colorClass = 'bg-red-100 text-red-800 border-red-200';
    if (score >= 4.0) colorClass = 'bg-green-100 text-green-800 border-green-200';
    else if (score >= 2.5) colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';

    return (
        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded border text-xs font-bold ${colorClass}`}>
            {score.toFixed(2)}
        </span>
    );
};

// --- MATURITY OVERVIEW COMPONENTS ---

const ModuleScoreRow: React.FC<{ pillar: OrgPillarConfig, data: any, stages: {id: string, name: string}[] }> = ({ pillar, data, stages }) => {
    const [expanded, setExpanded] = useState(false);
    const score = data?.score || 0;

    return (
        <div className="border-b border-slate-100 last:border-0">
            <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 flex-1 mr-4 overflow-hidden">
                     <div className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}>
                        <span className="text-[10px]">▶</span>
                     </div>
                     <span className="text-sm font-medium text-slate-700 whitespace-normal break-words">{pillar.name}</span>
                </div>
                <ScoreBadge score={score} />
            </div>
            {expanded && (
                <div className="bg-slate-50 p-3 pl-8 grid gap-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Stage Breakdown</div>
                    {stages.map((stage: any) => {
                        const stageScore = data?.stages?.[stage.id] || 0;
                        return (
                            <div key={stage.id} className="flex justify-between items-center text-xs border-b border-slate-200 last:border-0 pb-1 last:pb-0">
                                <span className="text-slate-600 mr-4 whitespace-normal break-words flex-1">{stage.name}</span>
                                <span className={`font-mono font-bold flex-shrink-0 ${stageScore >= 4 ? 'text-green-600' : stageScore >= 2.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {stageScore.toFixed(1)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const HierarchyNodeItem: React.FC<{ node: any, level: number, pillars: OrgPillarConfig[], pillarsStages: any }> = ({ node, level, pillars, pillarsStages }) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && Object.keys(node.children).length > 0;

    return (
        <div className={`mb-3 border rounded-lg bg-white shadow-sm overflow-hidden ${level > 2 ? 'ml-4 border-l-4 border-l-indigo-50' : ''}`}>
            <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3 flex-1 mr-4">
                     <span className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}>
                        ▶
                     </span>
                     <div className="flex flex-col overflow-hidden">
                         <span className="font-bold text-slate-800 whitespace-normal break-words text-sm md:text-base">{node.name}</span>
                         <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{level === 2 ? 'Entity' : level === 3 ? 'Site' : 'Department'}</span>
                     </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Overall</div>
                    <ScoreBadge score={node.overall || 0} />
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-200">
                    {/* Modules Section */}
                    <div className="p-2 bg-white">
                        <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Modules Performance</div>
                        <div className="border rounded-md bg-white">
                            {pillars.map(p => (
                                <ModuleScoreRow 
                                    key={p.id} 
                                    pillar={p} 
                                    data={node.scores?.[p.id]} 
                                    stages={pillarsStages[p.id] || []} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Children Section */}
                    {hasChildren && (
                        <div className="p-2 bg-slate-50 border-t border-slate-200">
                            <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                {level === 2 ? 'Sites' : 'Departments'}
                            </div>
                            <div>
                                {Object.values(node.children).map((child: any) => (
                                    <HierarchyNodeItem 
                                        key={child.id} 
                                        node={child} 
                                        level={level + 1} 
                                        pillars={pillars} 
                                        pillarsStages={pillarsStages} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const MaturityOverview: React.FC<{ organisation: Organisation, theme: Organisation['theme'] }> = ({ organisation, theme }) => {
    const [data, setData] = useState<any>({});
    const [loading, setLoading] = useState(true);
    
    // Fetch pillars for labels
    const [pillarsConfig, setPillarsConfig] = useState<OrgPillarConfig[]>([]);
    const [pillarsStages, setPillarsStages] = useState<Record<string, { id: string, name: string }[]>>({});

    useEffect(() => {
        const fetchMeta = async () => {
             const pRef = collection(db, `organisations/${organisation.domain}/modules/MAT/pillars`);
             const pSnap = await getDocs(query(pRef, where('enabled', '==', true)));
             const pillars = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrgPillarConfig));
             setPillarsConfig(pillars);
             
             // Fetch stages for each pillar to display detailed breakdown
             const stagesMap: Record<string, { id: string, name: string }[]> = {};
             for (const p of pillars) {
                 const sRef = collection(db, `modules/MAT/pillars/${p.id}/stages`);
                 const sSnap = await getDocs(query(sRef, orderBy('code')));
                 stagesMap[p.id] = sSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
             }
             setPillarsStages(stagesMap);
        }
        fetchMeta();
    }, [organisation.domain]);

    useEffect(() => {
        const fetchData = async () => {
            if (pillarsConfig.length === 0) return; // Wait for config

            setLoading(true);
            // 1. Build Hierarchy Skeleton
            const hierarchy: any = {};
            const l2Snap = await db.collectionGroup('level_2').get();
            const l2Nodes = l2Snap.docs.filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`)).map(d => ({id: d.id, name: d.data().name, path: d.ref.path}));
            
            for(const l2 of l2Nodes) {
                 hierarchy[l2.id] = { ...l2, children: {}, scores: {} };
                 const l3Snap = await db.collection(l2.path + '/level_3').get();
                 for (const l3Doc of l3Snap.docs) {
                     hierarchy[l2.id].children[l3Doc.id] = { id: l3Doc.id, name: l3Doc.data().name, path: l3Doc.ref.path, children: {}, scores: {} };
                     const l4Snap = await db.collection(l3Doc.ref.path + '/level_4').get();
                     for (const l4Doc of l4Snap.docs) {
                          hierarchy[l2.id].children[l3Doc.id].children[l4Doc.id] = { id: l4Doc.id, name: l4Doc.data().name, path: l4Doc.ref.path, assessments: [] };
                     }
                 }
            }

            // 2. Fetch Assessments & Aggregate
            const assessmentsRef = collection(db, `organisations/${organisation.domain}/modules/MAT/assessments`);
            const assSnap = await getDocs(assessmentsRef);
            
            assSnap.docs.forEach(doc => {
                const ass = doc.data() as ExtendedAssessment;
                // Only consider Active or Moderation assessments
                if (ass.isActive || ass.type === 'Moderation') {
                    for(const l2Id in hierarchy) {
                        for(const l3Id in hierarchy[l2Id].children) {
                            if (hierarchy[l2Id].children[l3Id].children[ass.allocationLevel4Id]) {
                                hierarchy[l2Id].children[l3Id].children[ass.allocationLevel4Id].assessments.push(ass);
                            }
                        }
                    }
                }
            });

            // Helper to aggregate scores
            const aggregateLevel = (node: any, children: any[]) => {
                const scoresByPillar: Record<string, { sum: number, count: number, stageSums: Record<string, {sum: number, count: number}> }> = {};
                
                children.forEach(child => {
                     if (child.assessments) {
                         // L4 Logic: Filter best assessment per pillar (Priority: Moderation, then newest Active)
                         const bestAssMap: Record<string, ExtendedAssessment> = {};
                         
                         child.assessments.sort((a: ExtendedAssessment, b: ExtendedAssessment) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                         child.assessments.forEach((a: ExtendedAssessment) => {
                             // If we have a moderation, use it. Else use active self-assessment.
                             if (!bestAssMap[a.pillarId] || (a.type === 'Moderation' && bestAssMap[a.pillarId].type !== 'Moderation')) {
                                 bestAssMap[a.pillarId] = a;
                             }
                         });
                         
                         // Normalize L4 scores for uniformity
                         const normalizedScores: Record<string, any> = {};
                         Object.values(bestAssMap).forEach(ass => {
                             normalizedScores[ass.pillarId] = {
                                 score: ass.overallScore || 0,
                                 stages: ass.scoresByStage || {}
                             };
                         });
                         child.scores = normalizedScores;

                         // Calculate L4 Overall
                         let l4Sum = 0; let l4Count = 0;
                         Object.values(normalizedScores).forEach((s:any) => { l4Sum += s.score; l4Count++; });
                         child.overall = l4Count > 0 ? l4Sum / l4Count : 0;
                         
                         // Add to parent aggregation
                         Object.entries(normalizedScores).forEach(([pId, data]: [string, any]) => {
                             if (!scoresByPillar[pId]) scoresByPillar[pId] = { sum: 0, count: 0, stageSums: {} };
                             scoresByPillar[pId].sum += data.score;
                             scoresByPillar[pId].count += 1;
                             
                             if (data.stages) {
                                 Object.entries(data.stages).forEach(([sId, sScore]: [string, number]) => {
                                     if (!scoresByPillar[pId].stageSums[sId]) scoresByPillar[pId].stageSums[sId] = { sum: 0, count: 0 };
                                     scoresByPillar[pId].stageSums[sId].sum += sScore;
                                     scoresByPillar[pId].stageSums[sId].count += 1;
                                 });
                             }
                         });

                     } else {
                         // L3/L2 Logic: Aggregate from already aggregated child.scores
                         if (child.scores) {
                             Object.entries(child.scores).forEach(([pId, pData]: [string, any]) => {
                                 if (!scoresByPillar[pId]) scoresByPillar[pId] = { sum: 0, count: 0, stageSums: {} };
                                 scoresByPillar[pId].sum += pData.score;
                                 scoresByPillar[pId].count += 1;
                                 
                                 if (pData.stages) {
                                     Object.entries(pData.stages).forEach(([sId, sScore]: [string, number]) => {
                                         if (!scoresByPillar[pId].stageSums[sId]) scoresByPillar[pId].stageSums[sId] = { sum: 0, count: 0 };
                                         scoresByPillar[pId].stageSums[sId].sum += sScore;
                                         scoresByPillar[pId].stageSums[sId].count += 1;
                                     });
                                 }
                             });
                         }
                     }
                });

                // Calculate averages for this node (L3 or L2)
                const finalScores: Record<string, any> = {};
                let totalScore = 0;
                let totalPillars = 0;

                Object.entries(scoresByPillar).forEach(([pId, data]) => {
                    // Standard Average of child nodes
                    const pScore = data.count > 0 ? data.sum / data.count : 0;
                    
                    const sScores: Record<string, number> = {};
                    Object.entries(data.stageSums).forEach(([sId, sData]) => {
                         sScores[sId] = sData.count > 0 ? sData.sum / sData.count : 0;
                    });
                    
                    finalScores[pId] = {
                        score: pScore,
                        stages: sScores
                    };
                    totalScore += pScore;
                    totalPillars++;
                });
                
                node.scores = finalScores;
                node.overall = totalPillars > 0 ? totalScore / totalPillars : 0;
            };

            // Rollup L4 -> L3
            for(const l2Id in hierarchy) {
                for(const l3Id in hierarchy[l2Id].children) {
                    const l3 = hierarchy[l2Id].children[l3Id];
                    aggregateLevel(l3, Object.values(l3.children));
                }
                // Rollup L3 -> L2
                aggregateLevel(hierarchy[l2Id], Object.values(hierarchy[l2Id].children));
            }
            
            setData(hierarchy);
            setLoading(false);
        };
        
        fetchData();
    }, [organisation.domain, pillarsConfig]);

    const handleExportExcel = () => {
        alert("Excel export is temporarily disabled.");
    };

    if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

    return (
        <div className="p-6 overflow-y-auto h-full bg-slate-50">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Maturity Overview</h3>
                <Button onClick={handleExportExcel} className="!w-auto !py-2 !px-4 flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    <DownloadIcon /> Export Report
                </Button>
            </div>
            <div className="space-y-2">
                {Object.values(data).map((l2: any) => (
                    <HierarchyNodeItem 
                        key={l2.id} 
                        node={l2} 
                        level={2} 
                        pillars={pillarsConfig} 
                        pillarsStages={pillarsStages} 
                    />
                ))}
            </div>
        </div>
    );
};


// --- CREATE ASSESSMENT MODAL ---
interface CreateAssessmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (type: 'Self-Assessment' | 'Moderation' | 'Baseline', name: string, sourceAssessmentId?: string) => void;
    pillar: OrgPillarConfig;
    node: HierarchyNode;
    availableHistory: ExtendedAssessment[];
}

const CreateAssessmentModal: React.FC<CreateAssessmentModalProps> = ({ isOpen, onClose, onConfirm, pillar, node, availableHistory }) => {
    const [mode, setMode] = useState<'new' | 'copy' | 'moderation'>('new');
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [customName, setCustomName] = useState('');

    // Filter for valid sources
    const copySources = availableHistory.filter(a => a.pillarId === pillar.id).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const moderationSources = availableHistory.filter(a => a.pillarId === pillar.id && a.isActive && a.type !== 'Moderation');

    const handleConfirm = () => {
        if (mode === 'new') {
            onConfirm('Self-Assessment', customName);
        } else if (mode === 'copy') {
            if (!selectedSourceId) return;
            onConfirm('Self-Assessment', customName, selectedSourceId);
        } else if (mode === 'moderation') {
            if (!selectedSourceId) return;
            onConfirm('Moderation', customName, selectedSourceId);
        }
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Assessment">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    You are creating an assessment for <strong>{pillar.name}</strong> in <strong>{node.name}</strong>.
                </p>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Version Name / Label (Optional)</label>
                    <Input 
                        value={customName} 
                        onChange={(e) => setCustomName(e.target.value)} 
                        placeholder="e.g. Q1 2025 Audit, Shift A Review"
                        className="mt-1"
                        label=""
                        id="customName"
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input type="radio" name="mode" value="new" checked={mode === 'new'} onChange={() => setMode('new')} />
                        <div>
                            <span className="block font-semibold text-sm">New Self-Assessment</span>
                            <span className="block text-xs text-slate-500">Start a blank assessment for the current period.</span>
                        </div>
                    </label>

                    <label className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input type="radio" name="mode" value="copy" checked={mode === 'copy'} onChange={() => setMode('copy')} />
                        <div className="flex-1">
                            <span className="block font-semibold text-sm">Create From Previous (Copy)</span>
                            <span className="block text-xs text-slate-500">Copy answers from an existing assessment as a baseline.</span>
                            {mode === 'copy' && (
                                <select 
                                    className="mt-2 w-full text-sm border-slate-300 rounded-md"
                                    value={selectedSourceId}
                                    onChange={e => setSelectedSourceId(e.target.value)}
                                >
                                    <option value="">Select source version...</option>
                                    {copySources.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name ? `${a.name} - ` : ''}{a.periodName} ({a.overallScore?.toFixed(1)}) - {new Date(a.createdAt?.seconds * 1000).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </label>

                    <label className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input type="radio" name="mode" value="moderation" checked={mode === 'moderation'} onChange={() => setMode('moderation')} />
                        <div className="flex-1">
                            <span className="block font-semibold text-sm">Create Moderation</span>
                            <span className="block text-xs text-slate-500">Create a moderation copy of an active self-assessment.</span>
                             {mode === 'moderation' && (
                                <select 
                                    className="mt-2 w-full text-sm border-slate-300 rounded-md"
                                    value={selectedSourceId}
                                    onChange={e => setSelectedSourceId(e.target.value)}
                                >
                                    <option value="">Select active assessment...</option>
                                    {moderationSources.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name ? `${a.name} - ` : ''}{a.periodName} ({a.overallScore?.toFixed(1)})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </label>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleConfirm} disabled={(mode === 'copy' || mode === 'moderation') && !selectedSourceId}>
                        Create
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


// --- HIERARCHY SIDEBAR ---
interface SidebarProps {
    organisation: Organisation;
    currentUser: AppUser;
    pillars: OrgPillarConfig[];
    periods: AssessmentPeriod[];
    selectedAssessmentId: string | null;
    onSelectAssessment: (assessment: ExtendedAssessment, pillar: OrgPillarConfig) => void;
    onOpenCreateModal: (pillar: OrgPillarConfig, node: HierarchyNode, existing: ExtendedAssessment[]) => void;
    theme: Organisation['theme'];
}

const HierarchySidebar: React.FC<SidebarProps> = ({ 
    organisation, 
    currentUser, 
    pillars, 
    periods, 
    selectedAssessmentId, 
    onSelectAssessment, 
    onOpenCreateModal,
    theme
}) => {
    const [hierarchy, setHierarchy] = useState<Record<string, HierarchyNode[]>>({});
    const [assessmentsByNode, setAssessmentsByNode] = useState<Record<string, ExtendedAssessment[]>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    // Fetch Hierarchy
    useEffect(() => {
        const fetchHierarchy = async () => {
            setLoading(true);
            try {
                const levels = [1, 2, 3, 4];
                const data: Record<string, HierarchyNode[]> = {};
                for(const l of levels) {
                     const snap = await db.collectionGroup(`level_${l}`).get();
                     data[`l${l}`] = snap.docs
                        .filter(d => d.ref.path.includes(organisation.domain))
                        .map(d => ({ id: d.id, ...d.data(), path: d.ref.path } as HierarchyNode))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                setHierarchy(data);
            } catch(e) { console.error(e); } 
            finally { setLoading(false); }
        };
        fetchHierarchy();
    }, [organisation.domain]);

    // Function to fetch assessments for a specific L4 node
    const fetchNodeAssessments = async (nodeId: string) => {
        const ref = collection(db, `organisations/${organisation.domain}/modules/MAT/assessments`);
        const q = query(ref, where('allocationLevel4Id', '==', nodeId));
        const snap = await getDocs(q);
        const nodeAssessments = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtendedAssessment));
        setAssessmentsByNode(prev => ({ ...prev, [nodeId]: nodeAssessments }));
    };

    const toggle = async (id: string, node?: HierarchyNode, level?: number) => {
        const isNowOpen = !expanded[id];
        setExpanded(p => ({...p, [id]: isNowOpen}));
        
        if (isNowOpen && level === 4 && node) {
            await fetchNodeAssessments(node.id!);
        }
    };

    const activePeriod = useMemo(() => {
        const now = new Date();
        return periods.find(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            return now >= start && now <= end && p.status === 'Open';
        });
    }, [periods]);

    const renderNode = (node: HierarchyNode, level: number) => {
        const children = hierarchy[`l${level + 1}`]?.filter(c => c.path?.startsWith(node.path || ''));
        const hasChildren = children && children.length > 0;
        const isOpen = expanded[node.id!];
        const isL4 = level === 4;

        return (
            <div key={node.id} className="ml-3 border-l border-slate-200 pl-2">
                <div 
                    className={`flex items-center py-1.5 px-2 rounded cursor-pointer transition-colors text-sm ${isOpen && isL4 ? 'bg-slate-100 font-semibold text-slate-800' : 'hover:bg-slate-50 text-slate-600'}`}
                    onClick={(e) => { e.stopPropagation(); toggle(node.id!, node, level); }}
                >
                    <span className="mr-1.5 text-slate-400 text-xs w-4 text-center">
                         {(hasChildren || isL4) ? (isOpen ? '▼' : '▶') : '•'}
                    </span>
                    <span className="mr-1.5 opacity-75">{isL4 ? <FolderIcon /> : <FolderIcon />}</span>
                    <span className="truncate select-none" title={node.name}>{node.name}</span>
                </div>
                
                {isOpen && children && (
                    <div>{children.map(child => renderNode(child, level + 1))}</div>
                )}

                {/* Render Modules (Pillars) under Level 4 */}
                {isOpen && isL4 && (
                    <div className="ml-6 mt-1 space-y-1">
                        {pillars.map(pillar => {
                            const pillarKey = `${node.id}_${pillar.id}`;
                            const isPillarOpen = expanded[pillarKey];
                            const nodeAssessments = assessmentsByNode[node.id!] || [];
                            const pillarAssessments = nodeAssessments.filter(a => a.pillarId === pillar.id).sort((a,b) => (a.isActive === b.isActive) ? (b.createdAt?.seconds - a.createdAt?.seconds) : (a.isActive ? -1 : 1));
                            
                            return (
                                <div key={pillarKey}>
                                    <div 
                                        className="flex items-center justify-between py-1 px-2 rounded cursor-pointer hover:bg-indigo-50 text-sm text-slate-700 group"
                                        onClick={(e) => { e.stopPropagation(); toggle(pillarKey); }}
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <span className="mr-1.5 text-slate-400 text-xs w-4 text-center">{isPillarOpen ? '▼' : '▶'}</span>
                                            <ModuleIcon />
                                            <span className="truncate" title={pillar.name}>{pillar.name}</span>
                                        </div>
                                        {activePeriod && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onOpenCreateModal(pillar, node, nodeAssessments); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-opacity"
                                                title="Create Assessment"
                                            >
                                                <PlusIcon />
                                            </button>
                                        )}
                                    </div>

                                    {/* Render Assessments under Pillar */}
                                    {isPillarOpen && (
                                        <div className="ml-6 border-l border-indigo-100 pl-2 space-y-1 my-1">
                                            {pillarAssessments.length === 0 && <div className="text-xs text-slate-400 italic px-2 py-1">No assessments.</div>}
                                            {pillarAssessments.map(ass => (
                                                <div key={ass.id} className="group relative">
                                                    <div 
                                                        className={`flex items-center py-1 px-2 rounded cursor-pointer text-xs ${selectedAssessmentId === ass.id ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}
                                                        onClick={() => onSelectAssessment(ass, pillar)}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${ass.isActive ? 'bg-green-50' : 'bg-gray-300'}`}></span>
                                                        <div className="flex flex-col truncate">
                                                            <span className="flex items-center gap-1">
                                                                {ass.name ? <span className="font-bold mr-1">{ass.name}</span> : null}
                                                                {ass.periodName} 
                                                                {ass.type === 'Moderation' && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded ml-1">MOD</span>}
                                                            </span>
                                                            <span className="text-[10px] opacity-60">
                                                                Score: {ass.overallScore?.toFixed(1)} {ass.isActive && <span className="text-green-600 font-bold">(Active)</span>}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="w-64 p-4 text-xs text-slate-500">Loading organization...</div>;

    return (
        <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 h-full flex flex-col">
             <div className="p-3 border-b border-slate-100 bg-slate-50">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Organization</h3>
             </div>
             <div className="flex-1 overflow-y-auto p-2">
                 {hierarchy['l1']?.map(l1 => renderNode(l1, 1))}
             </div>
        </div>
    );
};

// --- QUESTION ITEM ---
const QuestionItem: React.FC<{
  question: Question;
  answer: Answer | undefined;
  onAnswerChange: (questionId: string, updatedAnswer: Partial<Answer>) => void;
  assessmentId: string;
  currentUser: AppUser;
  theme: Organisation['theme'];
  readOnly: boolean;
}> = ({ question, answer, onAnswerChange, assessmentId, currentUser, theme, readOnly }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleGuidelineToggle = (guideline: string) => {
    if (readOnly) return;
    const newChecked = answer?.checkedGuidelines?.includes(guideline)
      ? answer.checkedGuidelines.filter((g) => g !== guideline)
      : [...(answer?.checkedGuidelines || []), guideline];
    onAnswerChange(question.id, { checkedGuidelines: newChecked });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const filePath = `organisations/${currentUser.domain}/MAT/assessments/${assessmentId}/evidence/${question.id}/${uuidv4()}-${file.name}`;
      const fileStorageRef = storageRef(storage, filePath);
      const snapshot = await uploadBytes(fileStorageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const newEvidenceItem: EvidenceItem = {
        name: file.name,
        url,
        storagePath: filePath,
        uploadedBy: `${currentUser.firstName} ${currentUser.lastName}`,
        uploadedAt: Timestamp.now(),
        comment: '',
      };
      onAnswerChange(question.id, {
        evidence: [...(answer?.evidence || []), newEvidenceItem],
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceItem: EvidenceItem) => {
    if (readOnly) return;
    if (!evidenceItem.storagePath) return;
    if (!window.confirm(`Are you sure you want to delete "${evidenceItem.name}"?`))
      return;

    try {
      const fileRef = storageRef(storage, evidenceItem.storagePath);
      await deleteObject(fileRef);
      const newEvidence = (answer?.evidence || []).filter((e) => e.url !== evidenceItem.url);
      onAnswerChange(question.id, { evidence: newEvidence });
    } catch (error) {
      console.error('Deletion failed:', error);
    }
  };

  const handleEvidenceCommentChange = (index: number, comment: string) => {
    if (readOnly) return;
    const newEvidence = [...(answer?.evidence || [])];
    if (newEvidence[index]) {
      newEvidence[index] = { ...newEvidence[index], comment };
      onAnswerChange(question.id, { evidence: newEvidence });
    }
  };

  const isGuidelineComplete = answer?.checkedGuidelines?.length === question.audit_guidelines.length;
  const canQualify = isGuidelineComplete;

  useEffect(() => {
      if (!readOnly && !canQualify && answer?.isQualified) {
           onAnswerChange(question.id, { isQualified: false });
      }
  }, [canQualify, answer?.isQualified, question.id, readOnly]);

  return (
    <div className={`p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200 ${readOnly ? 'bg-slate-50' : ''}`}>
      <div className="flex justify-between items-start">
        <p className="font-semibold text-slate-800 text-sm">
            <span className="font-mono text-slate-500 mr-2">{question.code}</span>
            {question.text}
        </p>
      </div>

      <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Guidelines</p>
        {question.audit_guidelines.map((guideline) => (
          <label
            key={guideline}
            className={`flex items-start space-x-2 text-sm text-slate-700 ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={answer?.checkedGuidelines?.includes(guideline) || false}
              onChange={() => handleGuidelineToggle(guideline)}
              disabled={readOnly}
            />
            <span className={!readOnly ? "group-hover:text-slate-900 transition-colors" : ""}>{guideline}</span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments</label>
        <textarea
          value={answer?.comments || ''}
          onChange={(e) => onAnswerChange(question.id, { comments: e.target.value })}
          rows={2}
          placeholder={readOnly ? "No comments." : "Add observations or notes here..."}
          className="mt-1 w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
          disabled={readOnly}
        />
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidence (Optional)</p>
             {!readOnly && (
             <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors"
                >
                {isUploading ? 'Uploading...' : <><UploadIcon /> Add Evidence</>}
            </button>
             )}
        </div>
        
        <div className="mt-2 space-y-2">
          {(answer?.evidence || []).map((item, index) => (
            <div
              key={item.url}
              className="p-2 border border-slate-200 rounded-md bg-slate-50 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline truncate"
                >
                  {item.name}
                </a>
                {!readOnly && (
                <button
                  onClick={() => handleDeleteEvidence(item)}
                  className="text-red-500 text-xs px-2 py-1 rounded hover:bg-red-100 transition-colors"
                >
                  Remove
                </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Description/Comment for this file..."
                value={item.comment || ''}
                onChange={(e) => handleEvidenceCommentChange(index, e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white focus:border-blue-400 focus:outline-none disabled:bg-slate-100"
                disabled={readOnly}
              />
            </div>
          ))}
          {(answer?.evidence || []).length === 0 && readOnly && <p className="text-xs text-slate-400 italic">No evidence attached.</p>}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      </div>

      <div
        className={`mt-5 pt-4 border-t flex items-center justify-end space-x-3 transition-opacity duration-300 ${
          !canQualify ? 'opacity-60 grayscale' : 'opacity-100'
        }`}
      >
        <div className={`flex items-center px-4 py-2 rounded-full ${readOnly ? 'bg-slate-200' : 'bg-slate-100'}`}>
            <label
            htmlFor={`qualify-${question.id}`}
            className={`text-sm font-bold mr-3 ${answer?.isQualified ? 'text-green-700' : 'text-slate-600'}`}
            >
            {answer?.isQualified ? 'QUALIFIED' : 'Mark as Qualified'}
            </label>
            <input
            id={`qualify-${question.id}`}
            type="checkbox"
            className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
            checked={answer?.isQualified || false}
            onChange={(e) =>
                onAnswerChange(question.id, { isQualified: e.target.checked })
            }
            disabled={!canQualify || readOnly}
            />
        </div>
      </div>
    </div>
  );
};

// --- THEME ITEM ---
const ThemeItem: React.FC<{
  theme: FullTheme;
  assessmentId: string;
  isActive: boolean;
  onToggle: () => void;
  score: number; // 0-5 scale
  answers: Map<string, Answer>;
  onAnswerChange: (questionId: string, updatedAnswer: Partial<Answer>) => void;
  currentUser: AppUser;
  appTheme: Organisation['theme'];
  readOnly: boolean;
}> = ({
  theme,
  assessmentId,
  isActive,
  onToggle,
  score,
  answers,
  onAnswerChange,
  currentUser,
  appTheme,
  readOnly
}) => {
  const displayScore = score.toFixed(1);

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className={`w-full flex justify-between items-center p-4 transition-colors ${isActive ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="text-left">
            <span className="text-xs font-mono text-slate-500 block">{theme.code}</span>
            <h3 className="font-semibold text-slate-800">{theme.name}</h3>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Score</p>
                <p className="font-bold text-lg" style={{ color: appTheme.colorPrimary }}>{displayScore} <span className="text-sm text-slate-400">/ 5</span></p>
            </div>
            <div className={`p-1 rounded-full bg-slate-200 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}>
                 <ChevronDownIcon />
            </div>
        </div>
      </button>
      {isActive && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="space-y-4">
                {theme.questions.length > 0 ? (
                    theme.questions.map((question) => (
                    <QuestionItem
                        key={question.id}
                        question={question}
                        answer={answers.get(question.id)}
                        onAnswerChange={onAnswerChange}
                        assessmentId={assessmentId}
                        currentUser={currentUser}
                        theme={appTheme}
                        readOnly={readOnly}
                    />
                    ))
                ) : (
                    <p className="text-sm text-slate-500 text-center italic py-4">
                    No questions defined for this theme.
                    </p>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

// --- ASSESSMENT VIEW (SCORING INTERFACE) ---
const AssessmentView: React.FC<{
  assessment: ExtendedAssessment;
  pillar: OrgPillarConfig;
  organisation: Organisation;
  currentUser: AppUser;
  theme: Organisation['theme'];
  onUpdateAssessment: (updated: ExtendedAssessment) => void;
  onCreateVersion: (type: 'Moderation' | 'Self-Assessment', sourceAssessment: ExtendedAssessment) => void;
}> = ({ assessment, pillar, organisation, currentUser, theme, onUpdateAssessment, onCreateVersion }) => {
  const [fullPillar, setFullPillar] = useState<FullPillar | null>(null);
  const [answersMap, setAnswersMap] = useState<Map<string, Answer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const baseCollection = `organisations/${organisation.domain}/modules/MAT/assessments`;

  // Fetch Pillar Structure and Answers
  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Pillar Structure
            const pillarDoc = await getDoc(doc(db, 'modules', 'MAT', 'pillars', pillar.id));
            const pillarData = { id: pillarDoc.id, ...pillarDoc.data() } as FullPillar;
            
            const stagesRef = collection(pillarDoc.ref, 'stages');
            const stagesSnap = await getDocs(query(stagesRef, orderBy('code')));
            
            const stagesWithThemes = await Promise.all(stagesSnap.docs.map(async (stageDoc) => {
                const stageData = { id: stageDoc.id, ...stageDoc.data() } as FullStage;
                const themesRef = collection(stageDoc.ref, 'themes');
                const themesSnap = await getDocs(query(themesRef, orderBy('code')));
                const themesWithQuestions = await Promise.all(themesSnap.docs.map(async (themeDoc) => {
                    const themeData = { id: themeDoc.id, ...themeDoc.data() } as FullTheme;
                    const questionsRef = collection(themeDoc.ref, 'questions');
                    const questionsSnap = await getDocs(query(questionsRef, orderBy('code')));
                    return { ...themeData, questions: questionsSnap.docs.map(q => ({ id: q.id, ...q.data() } as Question)) } as FullTheme;
                }));
                return { ...stageData, themes: themesWithQuestions } as FullStage;
            }));
            pillarData.stages = stagesWithThemes;
            setFullPillar(pillarData);

            // 2. Fetch Answers
            const ansSnap = await getDocs(collection(db, `${baseCollection}/${assessment.id}/answers`));
            const newMap = new Map<string, Answer>();
            ansSnap.forEach(d => newMap.set(d.id, d.data() as Answer));
            setAnswersMap(newMap);

        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [pillar.id, assessment.id, organisation.domain, baseCollection]);

  const liveScores = useMemo(() => calculateLiveScores(answersMap, fullPillar), [answersMap, fullPillar]);
  
  // Global Read Only (Assessment Closed/Locked)
  const isGlobalReadOnly = !assessment.isActive && assessment.type !== 'Moderation';

  const handleAnswerChange = useCallback(async (questionId: string, updatedAnswer: Partial<Answer>) => {
      if (!fullPillar) return;
      // Optimistic update
      const newMap = new Map<string, Answer>(answersMap);
      const existing = newMap.get(questionId) || {} as Answer;
      const merged = { ...existing, ...updatedAnswer, id: questionId };
      newMap.set(questionId, merged);
      setAnswersMap(newMap);

      // DB Update
      try {
          const { overall, stages, themes } = calculateLiveScores(newMap, fullPillar);
          const batch = writeBatch(db);
          
          batch.set(doc(db, `${baseCollection}/${assessment.id}/answers`, questionId), merged, { merge: true });
          batch.update(doc(db, baseCollection, assessment.id), {
              overallScore: overall,
              scoresByStage: stages,
              scoresByTheme: themes,
              updatedAt: Timestamp.now()
          });
          await batch.commit();
          // Notify parent to update sidebar score if needed
          onUpdateAssessment({ ...assessment, overallScore: overall });
      } catch(e) {
          console.error("Save failed", e);
      }
  }, [answersMap, fullPillar, assessment, baseCollection, onUpdateAssessment]);

  const handleMakeActive = async () => {
      setIsUpdatingStatus(true);
      try {
          // Deactivate others
          const q = query(collection(db, baseCollection), where('allocationLevel4Id', '==', assessment.allocationLevel4Id), where('pillarId', '==', pillar.id), where('isActive', '==', true));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach(d => batch.update(d.ref, { isActive: false }));
          
          // Activate current
          const currentRef = doc(db, baseCollection, assessment.id);
          batch.update(currentRef, { isActive: true });
          
          await batch.commit();
          onUpdateAssessment({ ...assessment, isActive: true });
          alert("Assessment set as Active.");
      } catch(e) {
          console.error(e);
      } finally {
          setIsUpdatingStatus(false);
      }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin"/></div>;

  return (
      <div className="flex flex-col h-full bg-slate-50">
          <div className="bg-white border-b border-slate-200 p-4 shadow-sm sticky top-0 z-10">
              <div className="flex justify-between items-start mb-2">
                  <div>
                      <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-slate-800">{pillar.name}</h2>
                          <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase ${assessment.type === 'Moderation' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{assessment.type || 'Self-Assessment'}</span>
                          {assessment.isActive && <span className="bg-green-100 text-green-800 px-2 py-0.5 text-xs rounded font-bold uppercase">Active</span>}
                      </div>
                      <p className="text-sm text-slate-500">{assessment.allocationLevel4Name} | {assessment.periodName} {assessment.name ? `| ${assessment.name}` : ''}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">Score</p>
                      <p className="text-2xl font-bold text-slate-800">{liveScores.overall.toFixed(1)} <span className="text-sm text-slate-400">/ 5</span></p>
                  </div>
              </div>
              
              {/* Actions Toolbar */}
              <div className="flex gap-2 mt-2 pt-2 border-t">
                  {!assessment.isActive && (
                      <Button onClick={handleMakeActive} isLoading={isUpdatingStatus} className="!w-auto !py-1 !px-3 !text-xs bg-green-600 hover:bg-green-700">Set as Active</Button>
                  )}
                  <Button onClick={() => onCreateVersion('Self-Assessment', assessment)} className="!w-auto !py-1 !px-3 !text-xs bg-gray-600 hover:bg-gray-700 flex items-center"><CopyIcon /> <span className="ml-1">Copy as New</span></Button>
                  {assessment.type !== 'Moderation' && (
                      <Button onClick={() => onCreateVersion('Moderation', assessment)} className="!w-auto !py-1 !px-3 !text-xs bg-purple-600 hover:bg-purple-700">Create Moderation</Button>
                  )}
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {fullPillar?.stages.map((stage, index) => {
                  const isStageActive = activeStageId === stage.id;
                  const stageScore = liveScores.stages[stage.id] || 0;
                  
                  // 80% Logic: 
                  // Previous stage must be >= 4.0 (80% of 5) to EDIT current stage.
                  // However, user can still VIEW current stage (expand accordion), but questions will be read-only.
                  let isStageInputLocked = false;
                  if (index > 0) {
                       const prevStage = fullPillar.stages[index - 1];
                       const prevScore = liveScores.stages[prevStage.id] || 0;
                       if (prevScore < 4.0) isStageInputLocked = true;
                  }

                  // Combine Global Read Only (e.g. closed assessment) with Stage Logic
                  const isContentReadOnly = isGlobalReadOnly || isStageInputLocked;

                  return (
                    <div key={stage.id} className={`border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden ${isStageInputLocked ? 'border-l-4 border-l-slate-300' : ''}`}>
                        <button
                            onClick={() => setActiveStageId(isStageActive ? null : stage.id)}
                            className={`w-full flex justify-between items-center p-5 transition-colors ${isStageActive ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'} cursor-pointer`}
                        >
                            <div className="text-left flex items-center gap-3">
                                {isStageInputLocked && <LockIcon />}
                                <div>
                                    <span className="text-xs font-mono text-slate-500 block mb-1">{stage.code}</span>
                                    <h2 className="text-lg font-bold text-slate-800">{stage.name}</h2>
                                    {isStageInputLocked && <span className="text-xs text-red-500 font-medium">Read-Only: Previous stage score below 80% (4.0)</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stage Score</p>
                                    <p className="font-bold text-lg" style={{ color: isStageInputLocked ? '#999' : theme.colorPrimary }}>{stageScore.toFixed(1)}</p>
                                </div>
                                <div className={`p-2 rounded-full bg-slate-100 transition-transform duration-300 ${isStageActive ? 'rotate-180' : ''}`}>
                                    <ChevronDownIcon />
                                </div>
                            </div>
                        </button>
                        
                        {isStageActive && (
                            <div className="p-5 bg-slate-50/50 border-t border-slate-200 space-y-4">
                            {stage.themes.map((themeItem) => (
                                <ThemeItem
                                key={themeItem.id}
                                theme={themeItem}
                                assessmentId={assessment.id}
                                isActive={activeThemeId === themeItem.id}
                                onToggle={() => setActiveThemeId(activeThemeId === themeItem.id ? null : themeItem.id)}
                                score={liveScores.themes[themeItem.id] || 0}
                                answers={answersMap}
                                onAnswerChange={handleAnswerChange}
                                currentUser={currentUser}
                                appTheme={theme}
                                readOnly={isContentReadOnly}
                                />
                            ))}
                            </div>
                        )}
                    </div>
                  );
              })}
          </div>
      </div>
  );
};


// --- MAIN PAGE CONTAINER ---
const MatUserPage: React.FC<ModulePageProps> = ({
  module,
  currentUser,
  onSwitchToAdmin,
  onBackToDashboard,
  theme,
  organisation,
}) => {
  const canSeeAdminLink = currentUser.accessLevel && currentUser.accessLevel >= 3;
  
  const [pillars, setPillars] = useState<OrgPillarConfig[]>([]);
  const [periods, setPeriods] = useState<AssessmentPeriod[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<{ assessment: ExtendedAssessment, pillar: OrgPillarConfig } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'assessment' | 'overview'>('assessment');

  // Modal State
  const [createModal, setCreateModal] = useState<{ isOpen: boolean, pillar?: OrgPillarConfig, node?: HierarchyNode, history: ExtendedAssessment[] }>({ isOpen: false, history: [] });

  // Fetch Config
  useEffect(() => {
    const fetchData = async () => {
        try {
            const pRef = collection(db, `organisations/${organisation.domain}/modules/MAT/pillars`);
            const pSnap = await getDocs(query(pRef, where('enabled', '==', true)));
            setPillars(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrgPillarConfig)));

            const perRef = collection(db, `organisations/${organisation.domain}/modules/MAT/periods`);
            const perSnap = await getDocs(query(perRef));
            setPeriods(perSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentPeriod)));
            setLoadingConfig(false);
        } catch(e) { console.error(e); setLoadingConfig(false); }
    };
    fetchData();
  }, [organisation.domain]);

  const getOpenPeriod = () => {
    const now = new Date();
    return periods.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return now >= start && now <= end && p.status === 'Open';
    });
  };
  const openPeriod = getOpenPeriod();

  const handleCreateAssessment = async (pillar: OrgPillarConfig, node: HierarchyNode, type: 'Self-Assessment' | 'Moderation' | 'Baseline', name: string, parentAssessmentId?: string) => {
    if (!openPeriod && type === 'Self-Assessment') { alert("No open assessment period found."); return; }
    if (!currentUser.allocationLevel4Id && !node.id) { alert("Missing department info."); return; }

    setIsProcessing(true);
    const baseCollection = `organisations/${organisation.domain}/modules/MAT/assessments`;

    try {
        let newAssessment: any = {};
        let newId = '';

        // If copying or moderating, fetch source first
        let parentAssessment: ExtendedAssessment | undefined;
        if (parentAssessmentId) {
             const parentDoc = await getDoc(doc(db, baseCollection, parentAssessmentId));
             if(parentDoc.exists()) parentAssessment = { id: parentDoc.id, ...parentDoc.data() } as ExtendedAssessment;
        }

        if (type === 'Moderation' && parentAssessment) {
             newId = `${parentAssessment.id}_MOD`;
             newAssessment = {
                ...parentAssessment,
                id: newId,
                name: name || parentAssessment.name,
                type: 'Moderation',
                parentAssessmentId: parentAssessment.id,
                isActive: false, // Moderations aren't "active" until finalized or reporting chooses them
                status: 'In Progress',
                createdAt: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
             };
        } else if (type === 'Self-Assessment' && parentAssessment) {
             // Copy as new
             const cleanL4 = (node.code || node.id).replace(/[^a-zA-Z0-9]/g, '');
             newId = `${cleanL4}_${pillar.code}_${openPeriod?.id || 'ADHOC'}_${Date.now()}`;
             newAssessment = {
                ...parentAssessment,
                id: newId,
                name: name,
                periodId: openPeriod?.id || parentAssessment.periodId,
                periodName: openPeriod?.name || parentAssessment.periodName,
                isActive: true,
                type: 'Self-Assessment',
                status: 'In Progress',
                createdAt: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
             };
             
             // Deactivate existing for same pillar/node
             const q = query(collection(db, baseCollection), where('allocationLevel4Id', '==', node.id), where('pillarId', '==', pillar.id), where('isActive', '==', true));
             const snap = await getDocs(q);
             const batch = writeBatch(db);
             snap.forEach(d => batch.update(d.ref, { isActive: false }));
             await batch.commit();

        } else {
             // New Blank or Baseline
             const cleanL4 = (node.code || node.id).replace(/[^a-zA-Z0-9]/g, '');
             newId = `${cleanL4}_${pillar.code}_${openPeriod?.id}_${Date.now()}`;
             newAssessment = {
                name: name,
                periodId: openPeriod?.id,
                periodName: openPeriod?.name,
                pillarId: pillar.id,
                pillarName: pillar.name,
                allocationLevel4Id: node.id,
                allocationLevel4Name: node.name,
                isActive: true,
                type: type,
                status: 'Not Started',
                overallScore: 0,
                createdAt: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
             };
             // Deactivate existing active
             if (type === 'Self-Assessment') {
                 const q = query(collection(db, baseCollection), where('allocationLevel4Id', '==', node.id), where('pillarId', '==', pillar.id), where('isActive', '==', true));
                 const snap = await getDocs(q);
                 const batch = writeBatch(db);
                 snap.forEach(d => batch.update(d.ref, { isActive: false }));
                 await batch.commit();
             }
        }

        const batch = writeBatch(db);
        const newRef = doc(db, baseCollection, newId);
        batch.set(newRef, newAssessment);

        // If Copying (Moderation or Clone), copy answers
        if (parentAssessment) {
             const answersRef = collection(db, `${baseCollection}/${parentAssessment.id}/answers`);
             const answersSnap = await getDocs(answersRef);
             answersSnap.forEach(ansDoc => {
                 batch.set(doc(db, `${baseCollection}/${newId}/answers`, ansDoc.id), ansDoc.data());
             });
        }

        await batch.commit();
        
        // Automatically select it
        setSelectedAssessment({ assessment: { id: newId, ...newAssessment } as ExtendedAssessment, pillar });
        setViewMode('assessment');

    } catch (e: any) {
        console.error(e);
        alert(`Error: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col bg-slate-50">
        {/* Top Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex-shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-4">
              <div>
                  <h1 className="text-2xl font-bold text-slate-900">{module.name}</h1>
                  <p className="text-xs text-slate-500">Maturity Assessment Dashboard</p>
              </div>
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  <button 
                    onClick={() => setViewMode('assessment')} 
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'assessment' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Assessments
                  </button>
                  <button 
                    onClick={() => setViewMode('overview')} 
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'overview' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Maturity Overview
                  </button>
              </div>
          </div>
          <div className="flex items-center space-x-4">
              {canSeeAdminLink && (
                <button onClick={onSwitchToAdmin} className="px-3 py-1.5 text-white rounded hover:opacity-90 text-xs font-medium shadow-sm" style={{ backgroundColor: theme.colorPrimary }}>Admin</button>
              )}
              <button onClick={onBackToDashboard} className="text-xs hover:underline font-medium" style={{ color: theme.colorPrimary }}>&larr; Dashboard</button>
          </div>
      </div>

      {/* Main Layout */}
      {viewMode === 'overview' ? (
          <MaturityOverview organisation={organisation} theme={theme} />
      ) : (
          <div className="flex flex-1 overflow-hidden">
             {/* Left Sidebar: Hierarchy & Selection */}
             <HierarchySidebar 
                organisation={organisation} 
                currentUser={currentUser}
                pillars={pillars}
                periods={periods}
                selectedAssessmentId={selectedAssessment?.assessment.id || null}
                onSelectAssessment={(assessment, pillar) => setSelectedAssessment({ assessment, pillar })}
                onOpenCreateModal={(pillar, node, history) => setCreateModal({isOpen: true, pillar, node, history})}
                theme={theme}
             />
    
             {/* Right Main Body: Assessment Form */}
             <div className="flex-1 bg-white relative">
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
                        <div className="text-slate-600 font-medium animate-pulse">Processing...</div>
                    </div>
                )}
                
                {selectedAssessment ? (
                    <AssessmentView 
                        assessment={selectedAssessment.assessment} 
                        pillar={selectedAssessment.pillar} 
                        organisation={organisation}
                        currentUser={currentUser}
                        theme={theme}
                        onUpdateAssessment={(updated) => setSelectedAssessment({ ...selectedAssessment, assessment: updated })}
                        onCreateVersion={(type, source) => handleCreateAssessment(selectedAssessment.pillar, { id: source.allocationLevel4Id, name: source.allocationLevel4Name } as any, type, `${source.name ? source.name + ' ' : ''}(${type === 'Moderation' ? 'Mod' : 'Copy'})`, source.id)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <AssessmentIcon />
                        <h3 className="mt-4 text-lg font-medium text-slate-600">Select an Assessment</h3>
                        <p className="text-sm max-w-md text-center mt-2">
                            Expand the hierarchy on the left to find your department, select a maturity module, and choose a version to start or continue.
                        </p>
                    </div>
                )}
             </div>
          </div>
      )}

      {/* Create Assessment Modal */}
      {createModal.isOpen && createModal.pillar && createModal.node && (
          <CreateAssessmentModal 
            isOpen={createModal.isOpen}
            onClose={() => setCreateModal({isOpen: false, history: []})}
            pillar={createModal.pillar}
            node={createModal.node}
            availableHistory={createModal.history}
            onConfirm={(type, name, sourceId) => handleCreateAssessment(createModal.pillar!, createModal.node!, type, name, sourceId)}
          />
      )}
    </div>
  );
};

export default MatUserPage;