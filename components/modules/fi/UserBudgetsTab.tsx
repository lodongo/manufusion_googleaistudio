
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../../../services/firebase';
import type { AppUser, Organisation } from '../../../types';
import type { BudgetTemplateMetadata, BudgetDetailDocument, BudgetLineItemVersionData } from '../../../types/fi_types';
import Button from '../../Button';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { levelInfo } from '../../org/HierarchyNodeModal';
import BudgetEntryModal from './BudgetEntryModal';

const { Timestamp } = firebase.firestore;

const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);


const BudgetTemplateListView: React.FC<{
    groupedTemplates: Record<number, BudgetTemplateMetadata[]>;
    onSelectTemplate: (template: BudgetTemplateMetadata) => void;
    loading: boolean;
}> = ({ groupedTemplates, onSelectTemplate, loading }) => {
    if (loading) {
        return <div className="p-8 text-center">Loading templates...</div>;
    }
    const sortedYears = useMemo(() => Object.keys(groupedTemplates).map(Number).sort((a, b) => b - a), [groupedTemplates]);

    return (
        <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md">
            <h3 className="text-lg font-semibold text-slate-700">Budget Templates Overview</h3>
            <div className="mt-4 space-y-4">
                {sortedYears.length > 0 ? sortedYears.map(year => (
                    <div key={year} className="p-4 border rounded-lg bg-slate-50">
                        <h4 className="font-bold text-slate-800">FY {year}</h4>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedTemplates[year].map(t => (
                                <button key={t.id} onClick={() => onSelectTemplate(t)} className="w-full text-left p-3 bg-white border rounded-md hover:bg-slate-50 focus:ring-2 focus:ring-offset-1 shadow-sm hover:shadow-md transition-shadow">
                                    <p className="font-semibold text-slate-800">{t.level2Name}</p>
                                    <div className="flex items-center gap-2 mt-2 text-sm">
                                        <span className="font-mono bg-slate-200 px-2 py-0.5 rounded">V{t.latestVersion}</span>
                                        <span className="font-medium text-slate-600">{t.versions.find(v => v.version === t.latestVersion)?.type || 'Budget'}</span>
                                        <span className={`font-medium ${t.versions.find(v => v.version === t.latestVersion)?.status === 'Open' ? 'text-green-600' : 'text-red-600'}`}>{t.versions.find(v => v.version === t.latestVersion)?.status || 'N/A'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-slate-500 py-4">No budget templates available for your organization.</p>
                )}
            </div>
        </div>
    );
};

interface BudgetLineItemRow {
    id: string; // detailId
    name: string;
    path: string;
    periods: {
        [periodId: string]: {
            budget: number;
            actuals: number;
            previousYearActual: number;
        }
    };
    totalBudget: number;
    totalActuals: number;
    totalPrevious: number;
}
const BudgetDetailView: React.FC<{
    template: BudgetTemplateMetadata;
    onBack: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}> = ({ template, onBack, organisation, theme, currentUser }) => {
    const [drilldownPath, setDrilldownPath] = useState<{ id: string; name: string; level: number }[]>([]);
    const [displayNodes, setDisplayNodes] = useState<{ id: string; name: string; level: number; path: string }[]>([]);
    const [summaryTotals, setSummaryTotals] = useState<any[]>([]); // For levels < 5
    const [detailedData, setDetailedData] = useState<any>({}); // For level 5, structured
    const [loading, setLoading] = useState(true);
    const [openGlCategories, setOpenGlCategories] = useState<Record<string, boolean>>({});
    const [openGlSubcategories, setOpenGlSubcategories] = useState<Record<string, boolean>>({});
    const [modalState, setModalState] = useState<{ isOpen: boolean, period: string, glAccountPath: string, currentValues: any, version: number } | null>(null);
    
    const isBudgetOpen = useMemo(() => template.versions.find(v => v.version === template.latestVersion)?.status === 'Open', [template]);

    const currentLevel = drilldownPath.length + 2;
    const isFinalLevel = currentLevel === 5;

    const basePath = `organisations/${organisation.domain}/modules/FI/budgetTemplates/${template.id}`;
    let currentPath = basePath;
    drilldownPath.forEach(p => { currentPath += `/level_${p.level}/${p.id}`; });

    useEffect(() => {
        setLoading(true);
        setDetailedData({});
        setSummaryTotals([]);
        let unsubscribe: (() => void) | null = null;
        let unsubscribeNodes: (() => void) | null = null;

        const fetchData = async () => {
            if (isFinalLevel) {
                const detailsGroupRef = db.collectionGroup('GL Details');
                const q = detailsGroupRef.where(firebase.firestore.FieldPath.documentId(), '>=', currentPath).where(firebase.firestore.FieldPath.documentId(), '<', `${currentPath}\uf8ff`);
                
                unsubscribe = q.onSnapshot(async (snapshot) => {
                    setLoading(true); // Ensure loading is true while processing
                    const structured: any = {};
                    const catNamePromises = new Map<string, Promise<firebase.firestore.DocumentSnapshot>>();
                    const subCatNamePromises = new Map<string, Promise<firebase.firestore.DocumentSnapshot>>();
                    
                    snapshot.docs.forEach(doc => {
                        const pathParts = doc.ref.path.split('/');
                        const catId = pathParts[pathParts.length - 5];
                        const subCatId = pathParts[pathParts.length - 3];
                        
                        if (!structured[catId]) {
                            structured[catId] = { id: catId, subcategories: {} };
                            if (!catNamePromises.has(catId)) {
                                catNamePromises.set(catId, doc.ref.parent.parent!.parent.parent!.get());
                            }
                        }
                        if (!structured[catId].subcategories[subCatId]) {
                            structured[catId].subcategories[subCatId] = { id: subCatId, details: [] };
                            if (!subCatNamePromises.has(subCatId)) {
                                subCatNamePromises.set(subCatId, doc.ref.parent.parent!.get());
                            }
                        }
                        const data = doc.data() as BudgetDetailDocument;
                        const versionData = data.versions?.[`v${template.latestVersion}`] || {};
                        const periods: BudgetLineItemRow['periods'] = {};
                        let totalBudget = 0, totalActuals = 0, totalPrevious = 0;
                        for (let p = 1; p <= 12; p++) {
                            const pId = `P${p.toString().padStart(2, '0')}`;
                            const pData = versionData[pId] || { budget: 0, actuals: 0, previousYearActual: 0 };
                            periods[pId] = { budget: pData.budget, actuals: pData.actuals, previousYearActual: pData.previousYearActual };
                            totalBudget += pData.budget;
                            totalActuals += pData.actuals;
                            totalPrevious += pData.previousYearActual;
                        }
                        structured[catId].subcategories[subCatId].details.push({ id: doc.id, name: data.name, path: doc.ref.path, periods, totalBudget, totalActuals, totalPrevious });
                    });

                    const catDocs = await Promise.all(Array.from(catNamePromises.values()));
                    const subCatDocs = await Promise.all(Array.from(subCatNamePromises.values()));
                    const catNames = new Map(catDocs.map(d => [d.id, d.data()?.name]));
                    const subCatNames = new Map(subCatDocs.map(d => [d.id, d.data()?.name]));

                    for (const catId in structured) {
                        structured[catId].name = catNames.get(catId) || catId;
                        let catTotals = { budget: Array(12).fill(0), actuals: Array(12).fill(0), previous: Array(12).fill(0) };
                        for (const subCatId in structured[catId].subcategories) {
                            structured[catId].subcategories[subCatId].name = subCatNames.get(subCatId) || subCatId;
                            structured[catId].subcategories[subCatId].details.sort((a: any, b: any) => a.id.localeCompare(b.id));
                            
                            const subTotals = { budget: Array(12).fill(0), actuals: Array(12).fill(0), previous: Array(12).fill(0) };
                            structured[catId].subcategories[subCatId].details.forEach((detail: BudgetLineItemRow) => {
                                for(let i=0; i<12; i++) {
                                    const pId = `P${(i+1).toString().padStart(2, '0')}`;
                                    subTotals.budget[i] += (detail.periods[pId]?.budget || 0);
                                    subTotals.actuals[i] += (detail.periods[pId]?.actuals || 0);
                                    subTotals.previous[i] += (detail.periods[pId]?.previousYearActual || 0);
                                }
                            });
                            structured[catId].subcategories[subCatId].totals = subTotals;
                            
                            for(let i=0; i<12; i++) {
                                catTotals.budget[i] += (Number(subTotals.budget[i]) || 0);
                                catTotals.actuals[i] += (Number(subTotals.actuals[i]) || 0);
                                catTotals.previous[i] += (Number(subTotals.previous[i]) || 0);
                            }
                            structured[catId].totals = catTotals;
                        }
                    }
                    setDetailedData(structured);
                    setLoading(false);
                }, () => setLoading(false));
            } else {
                // Fetch summary totals and child nodes for levels < 5
                const detailsGroupRef = db.collectionGroup('GL Details');
                const q = detailsGroupRef.where(firebase.firestore.FieldPath.documentId(), '>=', currentPath).where(firebase.firestore.FieldPath.documentId(), '<', `${currentPath}\uf8ff`);
                const detailsSnapshot = await q.get();
                const totals = new Map<string, {name: string, budget: number, actuals: number, previous: number}>();
    
                for (const detailDoc of detailsSnapshot.docs) {
                    const data = detailDoc.data() as BudgetDetailDocument;
                    const versionData = data.versions?.[`v${template.latestVersion}`] || {};
                    const pathParts = detailDoc.ref.path.split('/');
                    const catId = pathParts[pathParts.length - 5];
                    
                    if(!totals.has(catId)) {
                        const catDoc = await detailDoc.ref.parent.parent!.parent.parent!.get();
                        totals.set(catId, {name: catDoc.data()?.name || catId, budget: 0, actuals: 0, previous: 0});
                    }
                    
                    const catEntry = totals.get(catId)!;
                    for (const periodId in versionData) {
                        catEntry.budget += Number(versionData[periodId]?.budget || 0);
                        catEntry.actuals += Number(versionData[periodId]?.actuals || 0);
                        catEntry.previous += Number(versionData[periodId]?.previousYearActual || 0);
                    }
                }
                setSummaryTotals(Array.from(totals.values()).sort((a,b) => a.name.localeCompare(b.name)));
    
                const nextLevel = currentLevel + 1;
                if (nextLevel <= 5) {
                    const nodesRef = db.collection(`${currentPath}/level_${nextLevel}`);
                    unsubscribeNodes = nodesRef.orderBy('name').onSnapshot((snapshot) => {
                        setDisplayNodes(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, level: nextLevel, path: doc.ref.path })));
                        setLoading(false);
                    }, () => setLoading(false));
                } else {
                    setDisplayNodes([]);
                    setLoading(false);
                }
            }
        };
        fetchData();
        return () => {
            if (unsubscribe) unsubscribe();
            if (unsubscribeNodes) unsubscribeNodes();
        };
    }, [drilldownPath, template.id, organisation.domain, isFinalLevel, currentPath, currentLevel, template.latestVersion]);

    const handleNodeClick = (node: { id: string; name: string; level: number; }) => setDrilldownPath(prev => [...prev, node]);
    const handleBreadcrumbClick = (index: number) => setDrilldownPath(prev => prev.slice(0, index + 1));
    const toggleGlCategory = (catId: string) => setOpenGlCategories(prev => ({...prev, [catId]: !prev[catId]}));
    const toggleGlSubcategory = (subCatId: string) => setOpenGlSubcategories(prev => ({ ...prev, [subCatId]: !prev[subCatId] }));

    const handleOpenModal = (period: string, path: string, budget: number, actuals: number, previous: number) => {
        setModalState({
            isOpen: true,
            period,
            glAccountPath: path,
            currentValues: { budget, actuals, previous },
            version: template.latestVersion
        });
    };

    const handleSaveBudgetEntry = async (updates: Record<string, number>) => {
        if (!modalState) return;
        const { glAccountPath, version } = modalState;
        const detailDocRef = db.doc(glAccountPath);
        const updatesForFirestore: Record<string, any> = {};
        for (const periodId in updates) {
            const newBudgetValue = updates[periodId];
            updatesForFirestore[`versions.v${version}.${periodId}.budget`] = newBudgetValue;
            updatesForFirestore[`versions.v${version}.${periodId}.updatedAt`] = Timestamp.now();
            updatesForFirestore[`versions.v${version}.${periodId}.updatedBy`] = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
        }
        await detailDocRef.update(updatesForFirestore);
    };

    return (
      <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md space-y-4">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-slate-800">Budget for {template.level2Name} - FY{template.financialYear} (V{template.latestVersion})</h3>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 p-2 bg-slate-100 border rounded-md overflow-x-auto mt-2">
                    <button onClick={() => setDrilldownPath([])} className="hover:underline flex-shrink-0" style={{color: theme.colorPrimary}}>{levelInfo[2].name}: {template.level2Name}</button>
                    {drilldownPath.map((p, i) => (
                        <React.Fragment key={p.id}>
                            <span className="text-slate-400 flex-shrink-0">&gt;</span>
                            <button onClick={() => handleBreadcrumbClick(i)} className="hover:underline flex-shrink-0" style={{color: theme.colorPrimary}}>{p.name}</button>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <Button onClick={onBack} variant="secondary" className="!w-auto">Back to List</Button>
        </div>
        
        {loading ? <div className="text-center p-8">Loading...</div> : 
         isFinalLevel ? (
            <div className="space-y-2">
                {Object.keys(detailedData).sort().map(catId => {
                    const catData = detailedData[catId];
                    return (
                    <div key={catId} className="border rounded-md">
                        <div onClick={() => toggleGlCategory(catId)} className="flex items-center p-2 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                            <ChevronDownIcon className={openGlCategories[catId] ? 'rotate-180' : ''} />
                            <h4 className="font-semibold ml-2 flex-grow">{catData.name}</h4>
                            <p className="text-xs font-mono pr-2">Total: {catData.totals.budget.reduce((a:number,b:number) => a+b, 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                        </div>
                        {openGlCategories[catId] && <div className="pl-4 border-t">
                            {Object.keys(catData.subcategories).sort().map(subCatId => {
                                const subCatData = catData.subcategories[subCatId];
                                return (
                                <div key={subCatId} className="border-l">
                                    <div onClick={() => toggleGlSubcategory(subCatId)} className="flex items-center p-2 hover:bg-slate-50 cursor-pointer">
                                        <ChevronDownIcon className={openGlSubcategories[subCatId] ? 'rotate-180' : ''} />
                                        <h5 className="font-medium ml-2 flex-grow">{subCatData.name}</h5>
                                        <p className="text-xs font-mono pr-2">Total: {subCatData.totals.budget.reduce((a:number,b:number) => a+b, 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                                    </div>
                                    {openGlSubcategories[subCatId] && (
                                        <div className="overflow-x-auto border-t">
                                            {!subCatData.details ? <p className="p-2 text-xs">Loading...</p> :
                                            <table className="min-w-full text-xs">
                                                <thead className="bg-slate-200"><tr>
                                                    <th className="p-2 text-left sticky left-0 bg-slate-200 z-10 pl-4">GL Account</th>
                                                    {Array.from({length:12}).map((_,i) => <th key={i} className="p-2 text-right">P{i+1}</th>)}
                                                    <th className="p-2 text-right sticky right-0 bg-slate-200 z-10 border-l">Total</th>
                                                </tr></thead>
                                                <tbody>
                                                {subCatData.details.map((detail: BudgetLineItemRow) => (
                                                    <tr key={detail.id} className="border-b bg-white">
                                                        <td className="p-2 sticky left-0 bg-white z-10 pl-4">{detail.name} ({detail.id})</td>
                                                        {Object.entries(detail.periods).sort(([pA], [pB]) => pA.localeCompare(pB)).map(([periodId, values]) => (
                                                            <td key={periodId} className="p-2 text-right font-mono">
                                                                {isBudgetOpen ? <button onClick={() => handleOpenModal(periodId, detail.path, values.budget, values.actuals, values.previousYearActual)} className="w-full text-right hover:bg-blue-100 rounded p-1">{values.budget.toLocaleString(undefined, {minimumFractionDigits:2})}</button> : values.budget.toLocaleString(undefined, {minimumFractionDigits:2})}
                                                            </td>
                                                        ))}
                                                        <td className="p-2 text-right font-mono font-bold sticky right-0 bg-white z-10 border-l">
                                                            {isBudgetOpen ? <button onClick={() => handleOpenModal('Total', detail.path, detail.totalBudget, detail.totalActuals, detail.totalPrevious)} className="w-full text-right hover:bg-blue-100 rounded p-1">{detail.totalBudget.toLocaleString(undefined, {minimumFractionDigits:2})}</button> : detail.totalBudget.toLocaleString(undefined, {minimumFractionDigits:2})}
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                            }
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>}
                    </div>
                )})}
            </div>
         ) : (
            <>
                {summaryTotals.length > 0 && (
                    <div className="overflow-x-auto bg-white border rounded-lg">
                        <table className="min-w-full text-sm">
                             <thead className="bg-slate-100"><tr>
                                <th className="p-2 text-left font-semibold text-slate-700">GL Category</th>
                                <th className="p-2 text-right font-semibold text-slate-700">Budget Total</th>
                                <th className="p-2 text-right font-semibold text-slate-700">Actuals Total</th>
                                <th className="p-2 text-right font-semibold text-slate-700">Prev. Year Total</th>
                            </tr></thead>
                            <tbody>
                                {summaryTotals.map(total => (
                                    <tr key={total.name} className="border-b">
                                        <td className="p-2 font-medium">{total.name}</td>
                                        <td className="p-2 text-right font-mono">{total.budget.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                                        <td className="p-2 text-right font-mono">{total.actuals.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                                        <td className="p-2 text-right font-mono">{total.previous.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="space-y-2 pt-4">
                    <h4 className="font-semibold text-slate-700">{levelInfo[currentLevel + 1].name}s</h4>
                    {displayNodes.length > 0 ? (
                        displayNodes.map(node => (
                            <button key={node.id} onClick={() => handleNodeClick(node)} className="w-full p-3 text-left bg-white border rounded-md hover:bg-slate-50">
                                {node.name}
                            </button>
                        ))
                    ) : <p className="text-slate-500 text-center p-4">No sub-items found.</p>}
                </div>
            </>
         )
        }
        {modalState?.isOpen && (
            <BudgetEntryModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState(null)}
                onSave={handleSaveBudgetEntry}
                period={modalState.period}
                currentValues={modalState.currentValues}
                glAccountPath={modalState.glAccountPath}
                currentUser={currentUser}
                organisation={organisation}
            />
        )}
      </div>
    );
};

interface BudgetsTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
  currentUser: AppUser;
}

const UserBudgetsTab: React.FC<BudgetsTabProps> = ({ organisation, theme, currentUser }) => {
    const [templates, setTemplates] = useState<BudgetTemplateMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplateMetadata | null>(null);

    useEffect(() => {
        const templatesRef = db.collection(`organisations/${organisation.domain}/modules/FI/budgetTemplates`);
        const q = templatesRef.where('status', '==', 'Enabled').orderBy('financialYear', 'desc');
        const unsubscribe = q.onSnapshot(snap => {
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetTemplateMetadata)));
            setLoading(false);
        });
        return unsubscribe;
    }, [organisation.domain]);

    const groupedTemplates = useMemo(() => {
        return templates.reduce((acc, t) => {
            (acc[t.financialYear] = acc[t.financialYear] || []).push(t);
            return acc;
        }, {} as Record<number, BudgetTemplateMetadata[]>);
    }, [templates]);

    const handleSelectTemplate = (template: BudgetTemplateMetadata) => {
        setSelectedTemplate(template);
        setView('detail');
    };

    if (view === 'detail' && selectedTemplate) {
        return (
            <BudgetDetailView 
                template={selectedTemplate}
                onBack={() => setView('list')}
                organisation={organisation}
                currentUser={currentUser}
                theme={theme}
            />
        );
    }

    return (
        <BudgetTemplateListView
            groupedTemplates={groupedTemplates}
            onSelectTemplate={handleSelectTemplate}
            loading={loading}
        />
    );
};

export default UserBudgetsTab;