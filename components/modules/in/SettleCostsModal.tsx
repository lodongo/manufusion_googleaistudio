
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { SalesOrder } from '../../../types/in_types';
import type { PostingRule } from '../../../types/fi_types';
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

interface SettleCostsModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesOrder: SalesOrder;
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

const SettleCostsModal: React.FC<SettleCostsModalProps> = ({ isOpen, onClose, salesOrder, organisation, onSettled, currentUser }) => {
    const [posting, setPosting] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [settleQuantities, setSettleQuantities] = useState<Record<number, number>>({});
    const [validationError, setValidationError] = useState<string | null>(null);
    
    const [postingRules, setPostingRules] = useState<PostingRule[]>([]);
    const [allocations, setAllocations] = useState<RuleAllocationConfig[]>([]);

    const toggleItemSelection = (index: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(index)) newSet.delete(index); else newSet.add(index);
        setSelectedItems(newSet);
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const rulesSnap = await db.collection(`organisations/${organisation.domain}/modules/FI/postingRules`).where('enabled', '==', true).get();
                setPostingRules(rulesSnap.docs.map(d => ({id: d.id, ...d.data()} as PostingRule)));

                const initialQtys: Record<number, number> = {};
                const itemsToSelect = new Set<number>();
                
                salesOrder.items.forEach((item, index) => {
                    const remaining = item.issuedQuantity - (item.settledQuantity || 0);
                    if (remaining > 0) {
                        initialQtys[index] = remaining;
                        itemsToSelect.add(index);
                    }
                });
                setSettleQuantities(initialQtys);
                setSelectedItems(itemsToSelect); // Auto-select all pending items

            } catch (err) {
                console.error("Error loading settlement data", err);
                setValidationError("Failed to load configuration data.");
            }
        };
        if (isOpen) loadData();
    }, [isOpen, organisation.domain, salesOrder]);

    // Calculate total cost of currently selected items
    const totalSelectedCost = useMemo(() => {
        let sum = 0;
        Array.from(selectedItems).forEach((index) => {
            const i = index as number;
            sum += (settleQuantities[i] || 0) * salesOrder.items[i].unitCost;
        });
        return sum;
    }, [selectedItems, settleQuantities, salesOrder.items]);

    const addAllocation = () => {
        setAllocations(prev => [...prev, {
            id: uuidv4(),
            ruleId: '',
            amount: 0,
            l4Id: salesOrder.allocationLevel4Id || '',
            l5Id: salesOrder.allocationLevel5Id || ''
        }]);
    };

    const removeAllocation = (id: string) => {
        setAllocations(prev => prev.filter(a => a.id !== id));
    };

    const updateAllocation = (id: string, field: keyof RuleAllocationConfig, value: any) => {
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    // Auto-distribute amount when allocations change count or total cost changes
    useEffect(() => {
        if (totalSelectedCost > 0) {
             if (allocations.length === 1) {
                 updateAllocation(allocations[0].id, 'amount', totalSelectedCost);
             } else if (allocations.length === 0 && totalSelectedCost > 0) {
                 // Automatically add a row if none exists and cost is present
                 // Wait a tick to avoid state update loop
                 setTimeout(() => addAllocation(), 0);
             }
        }
    }, [totalSelectedCost, allocations.length]);

    const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const difference = totalSelectedCost - totalAllocated;

    const handlePost = async () => {
        setValidationError(null);

        if (selectedItems.size === 0) { 
            setValidationError("Please select items to settle."); 
            return; 
        }
        if (Math.abs(difference) > 0.01) { 
            setValidationError(`Allocated amount must match total cost. Difference: ${difference.toFixed(2)}`); 
            return; 
        }
        if (allocations.length === 0) {
             setValidationError("Please add at least one settlement rule.");
             return;
        }

        // Validate each allocation
        for (const alloc of allocations) {
            if (!alloc.ruleId) { setValidationError("All rows must have a Rule selected."); return; }
            const rule = postingRules.find(r => r.id === alloc.ruleId);
            if (!rule) { setValidationError("Selected rule invalid."); return; }
            
            if (rule.costCenterRequired && (!alloc.l4Id || !alloc.l5Id)) {
                setValidationError(`Rule "${rule.name}" requires a Department and Section. Please check the Sales Order location data.`);
                return;
            }
            if (alloc.amount <= 0) { setValidationError("Allocation amounts must be greater than 0."); return; }
        }

        setPosting(true);
        try {
            const batch = db.batch(); 
            const counterRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/counters`);
            
            const journalIds: string[] = [];

            // Generate a Journal for EACH allocation rule
            for (const alloc of allocations) {
                const rule = postingRules.find(r => r.id === alloc.ruleId)!;

                // Get new Journal ID within transaction for safety on counter
                const newJournalId = await db.runTransaction(async (t) => {
                     const doc = await t.get(counterRef);
                     const count = (doc.data()?.journalCounter || 0) + 1;
                     t.set(counterRef, { journalCounter: count }, { merge: true });
                     return `JN${count.toString().padStart(8, '0')}`;
                });
                journalIds.push(newJournalId);

                // Parse accounts
                const parseAccount = (path: string) => {
                    if (!path) return { cat: '', sub: '', det: '' };
                    const parts = path.split('/');
                    // Expected: modules/FI/ChartOfAccounts/{cat}/{subcat}/Details/{id}
                    // Defensive check
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
                        glCategoryId: dr.cat, glSubcategoryId: dr.sub, glDetailId: dr.det, glDetailName: rule.debitAccountName ? rule.debitAccountName.split(' (')[0] : 'Debit', 
                        amount: alloc.amount 
                    },
                    { 
                        type: 'Credit', 
                        l4Id: '', 
                        l5Id: '', 
                        glCategoryId: cr.cat, glSubcategoryId: cr.sub, glDetailId: cr.det, glDetailName: rule.creditAccountName ? rule.creditAccountName.split(' (')[0] : 'Credit', 
                        amount: alloc.amount 
                    }
                ];

                const journalRef = db.collection(`organisations/${organisation.domain}/modules/FI/journals`).doc(newJournalId);
                
                const journalData = {
                        id: newJournalId,
                        code: newJournalId,
                        journalId: newJournalId,
                        date: Timestamp.now(),
                        reference: salesOrder.code,
                        description: `Settlement for SO ${salesOrder.code} - Rule: ${rule.name}`,
                        lines: lines,
                        amount: alloc.amount,
                        createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                        itemsSettled: Array.from(selectedItems).map(idx => {
                            const i = idx as number;
                            const item = salesOrder.items[i];
                            return {
                                materialName: item.materialName,
                                quantity: 0, 
                                cost: 0 
                            };
                        })
                };
                batch.set(journalRef, journalData);
            }

            // Update Sales Order Items (Settled Qty)
            const soRef = db.doc(`organisations/${organisation.domain}/modules/IN/salesOrders/${salesOrder.id}`);
            const updatedItems = [...salesOrder.items];
            const settledMaterials: { materialId: string, quantity: number, reservationId?: string, warehousePath?: string }[] = [];

            Array.from(selectedItems).forEach((idx) => {
                const index = idx as number;
                const item = updatedItems[index];
                const settledNow = settleQuantities[index];
                
                updatedItems[index] = { 
                    ...item, 
                    settledQuantity: (item.settledQuantity || 0) + settledNow 
                };
                
                settledMaterials.push({ 
                    materialId: item.materialId, 
                    quantity: settledNow, 
                    reservationId: item.reservationId, 
                    warehousePath: item.warehousePath 
                });
            });

            const allFullySettled = updatedItems.every(i => i.settledQuantity === i.quantity);
            const newStatus = allFullySettled ? 'SETTLED' : salesOrder.status; 

            batch.update(soRef, { items: updatedItems, status: newStatus });
            
            // Update Movements with Journal IDs
            const journalIdsString = journalIds.join(', ');
            for (const mat of settledMaterials) {
                if (!mat.warehousePath) continue;
                const movementsRef = db.collection(`${mat.warehousePath}/materialMovements`);
                const movQuery = movementsRef.where('salesOrderCode', '==', salesOrder.code).where('materialId', '==', mat.materialId).where('type', '==', 'ISSUE');
                const movSnap = await movQuery.get();
                
                movSnap.forEach(doc => {
                     const data = doc.data();
                     if (!data.journalEntryId) {
                         batch.update(doc.ref, { journalEntryId: journalIdsString });
                     }
                });
            }

            await batch.commit();
            alert(`Posted ${journalIds.length} Journal(s). Costs Settled.`);
            onSettled(journalIds.join(', '));
            onClose();

        } catch (error: any) {
            console.error("Settlement failed", error);
            setValidationError(`Failed to settle costs: ${error.message || "Unknown error"}`);
            alert(`Failed to settle costs: ${error.message}`);
        } finally {
            setPosting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settle Costs" size="5xl">
            <div className="space-y-6">
                {/* Item Selection Area */}
                <div className="border rounded p-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-slate-700">1. Select Items to Settle</h4>
                        <p className="font-mono font-bold text-lg">Total Selected: ${totalSelectedCost.toFixed(2)}</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto border bg-white rounded">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0 z-10">
                                <tr className="text-left border-b">
                                    <th className="p-2">Item</th>
                                    <th className="p-2 text-center">Total Issued</th>
                                    <th className="p-2 text-center">Prev Settled</th>
                                    <th className="p-2 text-center">Remaining</th>
                                    <th className="p-2 text-center w-32">Settle Qty</th>
                                    <th className="p-2 text-center">Cost</th>
                                    <th className="p-2 text-center">Select</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesOrder.items.map((item, index: number) => {
                                    const remaining = item.issuedQuantity - (item.settledQuantity || 0);
                                    if (remaining <= 0) return null;
                                    const currentCost = (settleQuantities[index] || 0) * item.unitCost;
                                    return (
                                        <tr key={index} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="p-2">{item.materialName}</td>
                                            <td className="p-2 text-center">{item.issuedQuantity}</td>
                                            <td className="p-2 text-center">{item.settledQuantity || 0}</td>
                                            <td className="p-2 text-center font-bold text-blue-600">{remaining}</td>
                                            <td className="p-2 text-center">
                                                <Input 
                                                    id={`settleQty-${index}`}
                                                    label="" 
                                                    type="number" 
                                                    value={settleQuantities[index]} 
                                                    max={remaining} 
                                                    min={0}
                                                    onChange={e => setSettleQuantities(p => ({...p, [index]: Math.min(Number(e.target.value), remaining)}))}
                                                    disabled={!selectedItems.has(index)}
                                                    className="text-center !py-1 !h-8"
                                                    containerClassName="!mb-0"
                                                />
                                            </td>
                                            <td className="p-2 text-center text-slate-600">${currentCost.toFixed(2)}</td>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedItems.has(index)} 
                                                    onChange={() => toggleItemSelection(index)} 
                                                    className="h-5 w-5 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Rule Allocation Area */}
                <div className="border rounded p-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-700">2. Allocate Costs to Rules</h4>
                        <Button variant="secondary" className="!w-auto !py-1 !px-3 text-xs" onClick={addAllocation}>+ Add Rule</Button>
                    </div>

                    <div className="space-y-2">
                        {allocations.length === 0 && <p className="text-center text-slate-400 italic py-4">No rules added. Click "+ Add Rule" to begin.</p>}
                        
                        {allocations.map((alloc, idx) => {
                            const rule = postingRules.find(r => r.id === alloc.ruleId);
                            const requireCC = rule?.costCenterRequired || false;

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
                                        <input 
                                            className="w-full p-1.5 border rounded text-sm bg-slate-100 text-slate-600"
                                            value={salesOrder.allocationLevel4Name || 'N/A'}
                                            disabled
                                        />
                                    </div>

                                    <div className="w-1/4">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost Center {requireCC && '*'}</label>
                                        <input 
                                            className="w-full p-1.5 border rounded text-sm bg-slate-100 text-slate-600"
                                            value={salesOrder.allocationLevel5Name || 'N/A'}
                                            disabled
                                        />
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
                            Allocated: <strong>${totalAllocated.toFixed(2)}</strong> / ${totalSelectedCost.toFixed(2)}
                        </p>
                        <p className={`text-sm font-bold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.abs(difference) < 0.01 ? 'Balanced' : `Remaining: ${difference.toFixed(2)}`}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4 gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handlePost} isLoading={posting} disabled={Math.abs(difference) > 0.01 || allocations.length === 0}>
                        Post Settlement
                    </Button>
                </div>
                {validationError && <div className="mt-2 text-right text-sm text-red-600 font-medium">{validationError}</div>}
            </div>
        </Modal>
    );
};

export default SettleCostsModal;
