
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeCountSheet, CountSheetItem } from '../../../types/in_types';
import type { PostingRule } from '../../../types/fi_types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Button from '../../Button';
import Input from '../../Input';
import Modal from '../../common/Modal';

const { Timestamp } = firebase.firestore;

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface StockTakeSettleModalProps {
    isOpen: boolean;
    onClose: () => void;
    sheet: StockTakeCountSheet;
    itemsToSettle: CountSheetItem[]; // Specific items passed from parent
    organisation: Organisation;
    onSettled: (journalId: string) => void;
    currentUser: AppUser;
}

interface RuleAllocationConfig {
    id: string;
    ruleId: string;
    amount: number;
    l4Id: string;
    l5Id: string;
}

const StockTakeSettleModal: React.FC<StockTakeSettleModalProps> = ({ isOpen, onClose, sheet, itemsToSettle, organisation, onSettled, currentUser }) => {
    const [posting, setPosting] = useState(false);
    const [allocations, setAllocations] = useState<RuleAllocationConfig[]>([]);
    const [postingRules, setPostingRules] = useState<PostingRule[]>([]);
    const [hierarchy, setHierarchy] = useState<{ l4: HierarchyNode[], l5: HierarchyNode[] }>({ l4: [], l5: [] });
    const [loading, setLoading] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Calculate total "Value to Settle" based on the UNSETTLED portion of the POSTED amount.
    // Logic: Value = (Posted Qty - Settled Qty) * Unit Cost
    const totalToSettle = itemsToSettle.reduce((acc, item) => {
        const posted = item.postedQuantity || 0;
        const settled = item.settledQuantity || 0;
        const pendingSettleQty = posted - settled;
        return acc + (pendingSettleQty * (item.unitCost || 0));
    }, 0);
    
    const isGain = totalToSettle > 0;
    const absValueToSettle = Math.abs(totalToSettle);
    const isZeroValue = absValueToSettle < 0.01;

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const basePath = `organisations/${organisation.domain}`;
                const [l4Snap, l5Snap, rulesSnap] = await Promise.all([
                    db.collectionGroup('level_4').get(),
                    db.collectionGroup('level_5').get(),
                    db.collection(`organisations/${organisation.domain}/modules/FI/postingRules`).where('enabled', '==', true).get()
                ]);

                setHierarchy({
                    l4: l4Snap.docs.filter(d => d.ref.path.startsWith(basePath)).map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)).sort((a,b) => a.name.localeCompare(b.name)),
                    l5: l5Snap.docs.filter(d => d.ref.path.startsWith(basePath)).map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)).sort((a,b) => a.name.localeCompare(b.name))
                });
                
                setPostingRules(rulesSnap.docs.map(d => ({id: d.id, ...d.data()} as PostingRule)));

                // Add initial allocation row if there is value to settle
                if (!isZeroValue) {
                    setAllocations([{
                        id: uuidv4(),
                        ruleId: '',
                        amount: absValueToSettle,
                        l4Id: '',
                        l5Id: ''
                    }]);
                }

            } catch (err) {
                console.error("Error loading settlement data", err);
                setValidationError("Failed to load configuration data.");
            } finally {
                setLoading(false);
            }
        };
        if (isOpen) loadData();
    }, [isOpen, organisation.domain, absValueToSettle, isZeroValue]);

    const addAllocation = () => {
        setAllocations(prev => [...prev, {
            id: uuidv4(),
            ruleId: '',
            amount: 0,
            l4Id: '',
            l5Id: ''
        }]);
    };

    const removeAllocation = (id: string) => {
        setAllocations(prev => prev.filter(a => a.id !== id));
    };

    const updateAllocation = (id: string, field: keyof RuleAllocationConfig, value: any) => {
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const difference = absValueToSettle - totalAllocated;

    const handlePost = async () => {
        setValidationError(null);

        if (!isZeroValue) {
            if (Math.abs(difference) > 0.01) { 
                setValidationError(`Allocated amount must match total variance. Difference: ${difference.toFixed(2)}`); 
                return; 
            }
            if (allocations.length === 0) {
                 setValidationError("Please add at least one settlement rule.");
                 return;
            }
            
            for (const alloc of allocations) {
                if (!alloc.ruleId) { setValidationError("All rows must have a Rule selected."); return; }
                const rule = postingRules.find(r => r.id === alloc.ruleId);
                if (rule?.costCenterRequired && (!alloc.l4Id || !alloc.l5Id)) {
                    setValidationError(`Rule "${rule.name}" requires a Department and Section.`);
                    return;
                }
                if (alloc.amount <= 0) { setValidationError("Allocation amounts must be greater than 0."); return; }
            }
        }
        
        if (itemsToSettle.length === 0) {
             setValidationError("No items available to settle.");
             return;
        }

        setPosting(true);
        try {
            const batch = db.batch(); 
            const journalIds: string[] = [];

            if (!isZeroValue) {
                const counterRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/counters`);
                
                for (const alloc of allocations) {
                    const rule = postingRules.find(r => r.id === alloc.ruleId)!;

                    const newJournalId = await db.runTransaction(async (t) => {
                         const doc = await t.get(counterRef);
                         const count = (doc.data()?.journalCounter || 0) + 1;
                         t.set(counterRef, { journalCounter: count }, { merge: true });
                         return `JN${count.toString().padStart(8, '0')}`;
                    });
                    journalIds.push(newJournalId);

                    const parseAccount = (path: string) => {
                        if (!path) return { cat: '', sub: '', det: '' };
                        const parts = path.split('/');
                        if (parts.length < 8) return { cat: '', sub: '', det: '' };
                        return { cat: parts[3], sub: parts[5], det: parts[7] };
                    };
                    
                    const dr = parseAccount(rule.debitAccountPath);
                    const cr = parseAccount(rule.creditAccountPath);

                    // Create Lines
                    const lines = [
                        { 
                            type: 'Debit', 
                            l4Id: alloc.l4Id, 
                            l5Id: alloc.l5Id, 
                            glCategoryId: dr.cat, glSubcategoryId: dr.sub, glDetailId: dr.det, 
                            glDetailName: rule.debitAccountName ? rule.debitAccountName.split(' (')[0] : 'Debit', 
                            amount: alloc.amount 
                        },
                        { 
                            type: 'Credit', 
                            l4Id: '', 
                            l5Id: '', 
                            glCategoryId: cr.cat, glSubcategoryId: cr.sub, glDetailId: cr.det, 
                            glDetailName: rule.creditAccountName ? rule.creditAccountName.split(' (')[0] : 'Credit', 
                            amount: alloc.amount 
                        }
                    ];

                    const journalRef = db.collection(`organisations/${organisation.domain}/modules/FI/journals`).doc(newJournalId);
                    
                    const journalData = {
                            id: newJournalId,
                            code: newJournalId,
                            journalId: newJournalId,
                            date: Timestamp.now(),
                            reference: sheet.piNumber,
                            description: `Stock Take Settlement - ${sheet.batchName} - ${rule.name}`,
                            lines: lines,
                            amount: alloc.amount,
                            createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                            itemsSettled: itemsToSettle.map(item => ({
                                materialName: item.materialName,
                                materialCode: item.materialCode,
                                settledValue: (item.postedQuantity! - (item.settledQuantity || 0)) * (item.unitCost || 0)
                            }))
                    };
                    batch.set(journalRef, journalData);
                }
            }

            // Update Sheet Items to reflect settlement
            const sheetQuery = db.collectionGroup('countSheets').where('id', '==', sheet.id);
            const sheetSnap = await sheetQuery.get();
            
            if (!sheetSnap.empty) {
                const sheetDoc = sheetSnap.docs[0];
                const currentSheetData = sheetDoc.data() as StockTakeCountSheet;
                const currentItems = currentSheetData.items;
                
                itemsToSettle.forEach(settleItem => {
                    const idx = currentItems.findIndex(i => i.materialId === settleItem.materialId);
                    if (idx > -1) {
                        const posted = currentItems[idx].postedQuantity || 0;
                        // We are settling the difference between posted and previously settled
                        currentItems[idx].settledQuantity = posted; 
                        
                        // Update item status if fully posted and settled
                        const variance = (currentItems[idx].countedQuantity ?? 0) - (currentItems[idx].systemQuantity || 0);
                        if (posted === variance && (currentItems[idx].status === 'POSTED' || currentItems[idx].status === 'PARTIALLY_POSTED')) {
                             currentItems[idx].status = 'SETTLED';
                        }
                    }
                });
                
                // Check overall status
                const allSettled = currentItems.every(i => {
                    const variance = (i.countedQuantity ?? i.systemQuantity) - i.systemQuantity;
                    return i.status === 'SETTLED' || Math.abs(variance) < 0.0001;
                });
                
                batch.update(sheetDoc.ref, { 
                    items: currentItems,
                    status: allSettled ? 'SETTLED' : currentSheetData.status 
                });
            }

            await batch.commit();

            alert(isZeroValue ? "Marked as Settled." : `Posted ${journalIds.length} Journal(s).`);
            onSettled(journalIds.join(', '));
            onClose();

        } catch (error: any) {
            console.error("Settlement failed", error);
            setValidationError(`Failed to settle: ${error.message}`);
        } finally {
            setPosting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Settle Variance: ${sheet.piNumber}`} size="5xl">
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded border flex justify-between items-center">
                    <div>
                        <p className="text-sm text-slate-500 uppercase font-bold">Items Selected</p>
                        <p className="text-2xl font-bold text-slate-800">{itemsToSettle.length}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase font-bold">Net Variance Value</p>
                        <p className={`text-2xl font-bold ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                            {isGain ? '+' : ''}{totalToSettle.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                        </p>
                        <p className="text-xs text-slate-400">{isGain ? 'Inventory Gain' : 'Inventory Loss'}</p>
                    </div>
                    <div className="text-right">
                         <p className="text-sm text-slate-500 uppercase font-bold">To Allocate (Abs)</p>
                         <p className="text-xl font-mono">{absValueToSettle.toFixed(2)}</p>
                    </div>
                </div>
                
                {/* Items List Preview */}
                <div className="max-h-40 overflow-y-auto border rounded text-xs">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 sticky top-0">
                            <tr>
                                <th className="p-2">Material</th>
                                <th className="p-2 text-right">Posted Qty</th>
                                <th className="p-2 text-right">Prev. Settled</th>
                                <th className="p-2 text-right">Settle Now</th>
                                <th className="p-2 text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsToSettle.map((item, i) => {
                                const posted = item.postedQuantity || 0;
                                const settled = item.settledQuantity || 0;
                                const settleNow = posted - settled;
                                const val = settleNow * (item.unitCost || 0);
                                return (
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{item.materialName}</td>
                                        <td className="p-2 text-right">{posted}</td>
                                        <td className="p-2 text-right">{settled}</td>
                                        <td className="p-2 text-right font-bold">{settleNow}</td>
                                        <td className="p-2 text-right">{val.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {isZeroValue ? (
                    <div className="p-4 bg-green-50 text-green-800 rounded text-center border border-green-200">
                        <p className="font-bold">Zero Value Settlement</p>
                        <p className="text-sm">The net value to settle is zero. You can mark these items as settled without posting a financial journal.</p>
                    </div>
                ) : (
                    <div className="border rounded p-4 bg-slate-50">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700">Allocation Rules</h4>
                            <Button variant="secondary" className="!w-auto !py-1 !px-3 text-xs" onClick={addAllocation}>+ Add Rule</Button>
                        </div>

                        <div className="space-y-2">
                            {allocations.map((alloc, idx) => {
                                const rule = postingRules.find(r => r.id === alloc.ruleId);
                                const requireCC = rule?.costCenterRequired || false;
                                
                                const l4Node = hierarchy.l4.find(n => n.id === alloc.l4Id);
                                const filteredL5 = l4Node ? hierarchy.l5.filter(n => n.path.startsWith(l4Node.path)) : [];

                                return (
                                    <div key={alloc.id} className="flex items-start gap-2 p-3 bg-white border rounded-lg shadow-sm">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Settling Rule</label>
                                            <select 
                                                className="w-full p-1.5 border rounded text-sm"
                                                value={alloc.ruleId}
                                                onChange={e => updateAllocation(alloc.id, 'ruleId', e.target.value)}
                                            >
                                                <option value="">Select Rule...</option>
                                                {postingRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                            {rule && <p className="text-xs text-slate-400 mt-1 truncate">{rule.debitAccountName} / {rule.creditAccountName}</p>}
                                        </div>
                                        
                                        <div className="w-1/4">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department {requireCC && '*'}</label>
                                            <select 
                                                className="w-full p-1.5 border rounded text-sm disabled:bg-slate-100"
                                                value={alloc.l4Id}
                                                onChange={e => updateAllocation(alloc.id, 'l4Id', e.target.value)}
                                            >
                                                <option value="">Select Dept...</option>
                                                {hierarchy.l4.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="w-1/4">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost Center {requireCC && '*'}</label>
                                            <select 
                                                className="w-full p-1.5 border rounded text-sm disabled:bg-slate-100"
                                                value={alloc.l5Id}
                                                onChange={e => updateAllocation(alloc.id, 'l5Id', e.target.value)}
                                                disabled={!alloc.l4Id}
                                            >
                                                <option value="">Select Section...</option>
                                                {filteredL5.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="w-32">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-1.5 border rounded text-sm text-right font-mono"
                                                value={alloc.amount}
                                                onChange={e => updateAllocation(alloc.id, 'amount', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        
                                        <button onClick={() => removeAllocation(alloc.id)} className="mt-6 text-red-500 hover:text-red-700 p-1">&times;</button>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <p className="text-sm text-slate-600">
                                Allocated: <strong>{totalAllocated.toFixed(2)}</strong> / {absValueToSettle.toFixed(2)}
                            </p>
                            <p className={`text-sm font-bold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                {Math.abs(difference) < 0.01 ? 'Balanced' : `Remaining: ${difference.toFixed(2)}`}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handlePost} isLoading={posting} disabled={!isZeroValue && (Math.abs(difference) > 0.01 || allocations.length === 0)}>
                        {isZeroValue ? "Mark as Settled" : "Post Settlement"}
                    </Button>
                </div>
                {validationError && <div className="mt-2 text-right text-sm text-red-600 font-medium">{validationError}</div>}
            </div>
        </Modal>
    );
};

export default StockTakeSettleModal;
