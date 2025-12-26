import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation } from '../../../types';
// FIX: Add missing import for BudgetConfig type.
import type { AccountCategory, AccountSubcategory, AccountDetail, OrgGLAccount, BudgetConfig } from '../../../types/fi_types';
import Button from '../../Button';

// Icons
const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

// Combined types for state
interface DetailWithFullPath extends AccountDetail { fullPath: string; }
interface SubcategoryWithDetails extends AccountSubcategory { details: DetailWithFullPath[]; }
interface CategoryWithSubcategories extends AccountCategory { subcategories: SubcategoryWithDetails[]; }

const GLAccountsTab: React.FC<{ organisation: Organisation }> = ({ organisation }) => {
    // FIX: Rename state to structuredCoa to match usage.
    const [structuredCoa, setStructuredCoa] = useState<CategoryWithSubcategories[]>([]);
    const [initialOrgGlAccountPaths, setInitialOrgGlAccountPaths] = useState<Set<string>>(new Set());
    const [selectedAccountPaths, setSelectedAccountPaths] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const orgGlAccountsRef = db.collection(`organisations/${organisation.domain}/modules/FI/GLAccounts`);
        const budgetConfigRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/budgetConfig`);

        const fetchData = async () => {
            try {
                setLoading(true);

                // FIX: Corrected Promise.all to fix variable usage before declaration and constant assignment errors
                const [orgAccountsSnap, budgetConfigSnap] = await Promise.all([
                    orgGlAccountsRef.get(),
                    budgetConfigRef.get()
                ]);

                const adoptedAccountPaths = new Set(orgAccountsSnap.docs.map(doc => doc.data().globalPath as string));
                
                const budgetablePaths = budgetConfigSnap.exists
                    ? new Set((budgetConfigSnap.data() as BudgetConfig).budgetableGlAccountPaths || [])
                    : new Set<string>();
                
                setInitialOrgGlAccountPaths(budgetablePaths);
                setSelectedAccountPaths(new Set(budgetablePaths));

                if (adoptedAccountPaths.size === 0) {
                    setStructuredCoa([]);
                    setLoading(false);
                    return;
                }

                const globalCoaRef = db.collection('modules/FI/ChartOfAccounts');
                const categoriesSnap = await globalCoaRef.where('enabled', '==', true).get();
                const categoriesData = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory));

                const structuredData = await Promise.all(categoriesData.map(async (cat) => {
                    const subcategoriesRef = globalCoaRef.doc(cat.id).collection('Subcategories');
                    const subcategoriesSnap = await subcategoriesRef.where('enabled', '==', true).get();
                    const subcategoriesData = subcategoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountSubcategory));

                    const subcategoriesWithDetails = await Promise.all(subcategoriesData.map(async (sub) => {
                        const detailsRef = subcategoriesRef.doc(sub.id).collection('Details');
                        const detailsSnap = await detailsRef.where('enabled', '==', true).get();
                        const detailsData = detailsSnap.docs
                            .map(d => {
                                const fullPath = `modules/FI/ChartOfAccounts/${cat.id}/Subcategories/${sub.id}/Details/${d.id}`;
                                return { id: d.id, ...d.data(), fullPath } as DetailWithFullPath;
                            })
                            .filter(d => adoptedAccountPaths.has(d.fullPath)); // Only include adopted accounts
                        return { ...sub, details: detailsData };
                    }));

                    return { ...cat, subcategories: subcategoriesWithDetails.filter(s => s.details.length > 0) };
                }));

                const finalData = structuredData.filter(c => c.subcategories.length > 0);
                finalData.forEach(c => c.subcategories.sort((a,b) => (a.id || '').localeCompare(b.id || '')));
                
                setStructuredCoa(finalData.sort((a, b) => (a.id || '').localeCompare(b.id || '')));
            } catch (error) { console.error("Failed to load Chart of Accounts data:", error); } 
            finally { setLoading(false); }
        };

        fetchData();
    }, [organisation.domain]);
    
    const toggleCategory = (id: string) => setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSubcategory = (id: string) => setOpenSubcategories(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSelectOne = (path: string) => {
        setSelectedAccountPaths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    const handleSelectAllInSubcategory = (subcategory: SubcategoryWithDetails) => {
        const allPaths = subcategory.details.map(d => d.fullPath);
        const areAllSelected = allPaths.length > 0 && allPaths.every(p => selectedAccountPaths.has(p));
        
        setSelectedAccountPaths(prev => {
            const newSet = new Set(prev);
            if (areAllSelected) {
                allPaths.forEach(p => newSet.delete(p));
            } else {
                allPaths.forEach(p => newSet.add(p));
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        const orgGlAccountsRef = db.collection(`organisations/${organisation.domain}/modules/FI/GLAccounts`);
        const batch = db.batch();

        const toAddPaths = [...selectedAccountPaths].filter(path => !initialOrgGlAccountPaths.has(path));
        const toDeletePaths = [...initialOrgGlAccountPaths].filter(path => !selectedAccountPaths.has(path));
        
        const allOrgAccountsSnap = await orgGlAccountsRef.get();
        allOrgAccountsSnap.forEach(doc => {
            const data = doc.data() as OrgGLAccount;
            if(toDeletePaths.includes(data.globalPath)) {
                batch.delete(doc.ref);
            }
        });

        toAddPaths.forEach(path => {
            let detail: DetailWithFullPath | undefined;
            for (const cat of structuredCoa) {
                for (const sub of cat.subcategories) {
                    detail = sub.details.find(d => d.fullPath === path);
                    if (detail) break;
                }
                if (detail) break;
            }

            if (detail) {
                const docRef = orgGlAccountsRef.doc(); 
                const payload: OrgGLAccount = { id: docRef.id, globalPath: path, name: detail.name, code: detail.id };
                batch.set(docRef, payload);
            }
        });
        
        await batch.commit();

        setInitialOrgGlAccountPaths(new Set(selectedAccountPaths));
        setSaving(false);
        alert('Adopted GL Accounts saved successfully!');
    };

    const isDirty = useMemo(() => {
        if (initialOrgGlAccountPaths.size !== selectedAccountPaths.size) return true;
        for (const path of initialOrgGlAccountPaths) {
            if (!selectedAccountPaths.has(path)) return true;
        }
        return false;
    }, [initialOrgGlAccountPaths, selectedAccountPaths]);
    
    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Adopt Global GL Accounts</h3>
                <Button onClick={handleSave} isLoading={saving} disabled={!isDirty}>Save Changes</Button>
            </div>
             <p className="text-sm text-gray-600 mb-4">Select which accounts from the global Chart of Accounts this organization will use. Only enabled accounts are shown.</p>

            <div className="space-y-1">
                {structuredCoa.map(category => (
                    <div key={category.id} className="border border-slate-200 rounded-lg">
                        <div onClick={() => toggleCategory(category.id)} className="flex items-center p-3 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                            <ChevronDownIcon className={openCategories[category.id] ? 'rotate-180' : ''} />
                            <h4 className="font-bold text-slate-800 ml-2">{category.id} - {category.name}</h4>
                        </div>
                        {openCategories[category.id] && (
                            <div className="pl-6 border-t border-slate-200">
                                {category.subcategories.map(sub => {
                                    const allPathsInSub = sub.details.map(d => d.fullPath);
                                    const areAllSelected = allPathsInSub.length > 0 && allPathsInSub.every(p => selectedAccountPaths.has(p));
                                    const isIndeterminate = !areAllSelected && allPathsInSub.some(p => selectedAccountPaths.has(p));
                                    return (
                                    <div key={sub.id} className="border-l border-slate-200">
                                        <div className="flex items-center p-2 hover:bg-slate-50 cursor-pointer">
                                            <div className="flex items-center" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={areAllSelected}
                                                    ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                                                    onChange={() => handleSelectAllInSubcategory(sub)}
                                                />
                                            </div>
                                            <div onClick={() => toggleSubcategory(sub.id)} className="flex items-center flex-grow ml-3">
                                                <ChevronDownIcon className={openSubcategories[sub.id] ? 'rotate-180' : ''} />
                                                <h5 className="font-semibold text-slate-700 ml-2">{sub.id} - {sub.name}</h5>
                                            </div>
                                        </div>
                                        {openSubcategories[sub.id] && (
                                            <div className="pl-8 pb-2">
                                                {sub.details.map(detail => (
                                                    <div key={detail.id} className="py-2 flex items-start">
                                                        <label className="flex items-start space-x-3 cursor-pointer">
                                                            <input type="checkbox" 
                                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                checked={selectedAccountPaths.has(detail.fullPath)}
                                                                onChange={() => handleSelectOne(detail.fullPath)}
                                                            />
                                                            <div>
                                                                <span className="font-medium text-slate-800">{detail.id} - {detail.name}</span>
                                                                <p className="text-xs text-slate-500">{detail.description}</p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GLAccountsTab;