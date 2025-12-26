
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeSession, StockTakeCountSheet, CountSheetItem } from '../../../types/in_types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Button from '../../Button';
import Modal from '../../common/Modal';
import StockTakeSettleModal from './StockTakeSettleModal';
import Input from '../../Input';

const { Timestamp } = firebase.firestore;

interface StockTakeReviewProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

// -- Modal for posting quantity --
const PostQuantityModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: CountSheetItem & { varianceQty: number };
    onConfirm: (qtyToPost: number) => void;
}> = ({ isOpen, onClose, item, onConfirm }) => {
    const [qty, setQty] = useState<number>(0);
    
    useEffect(() => {
        if (isOpen) {
            // Default to the Counted Quantity
            setQty(item.countedQuantity || 0);
        }
    }, [isOpen, item]);

    const variance = qty - (item.systemQuantity || 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Post Inventory Adjustment" size="sm">
            <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
                    <p><strong>Material:</strong> {item.materialName}</p>
                    <p><strong>System Quantity:</strong> {item.systemQuantity}</p>
                    <p><strong>Counted Quantity:</strong> {item.countedQuantity}</p>
                </div>
                <Input 
                    id="postQty"
                    label="Confirm Counted Quantity" 
                    type="number" 
                    value={qty} 
                    onChange={e => setQty(Number(e.target.value))}
                />
                <div className="text-xs text-slate-500">
                    <p className="mb-1">This will update the system stock level to <strong>{qty}</strong>.</p>
                    <p>Resulting Variance Adjustment: <span className={variance < 0 ? 'text-red-600 font-bold' : variance > 0 ? 'text-green-600 font-bold' : 'text-slate-600'}>{variance > 0 ? '+' : ''}{variance}</span></p>
                </div>
                <div className="flex justify-end pt-2 gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onConfirm(qty)}>Post Adjustment</Button>
                </div>
            </div>
        </Modal>
    );
};


const ReviewDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    sheet: StockTakeCountSheet;
    warehousePath: string;
    onUpdate: () => void;
    currentUser: AppUser;
    organisation: Organisation;
}> = ({ isOpen, onClose, sheet, warehousePath, onUpdate, currentUser, organisation }) => {
    const [loading, setLoading] = useState(false);
    const [itemsWithVariance, setItemsWithVariance] = useState<(CountSheetItem & { varianceQty: number; varianceValue: number })[]>([]);
    const [totalVarianceValue, setTotalVarianceValue] = useState(0);
    
    // Single Item Action State
    const [itemToPost, setItemToPost] = useState<(CountSheetItem & { varianceQty: number; index: number }) | null>(null);
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [itemToSettle, setItemToSettle] = useState<CountSheetItem | null>(null);

    useEffect(() => {
        if (sheet && sheet.items) {
            const calculated = sheet.items.map(item => {
                const counted = item.countedQuantity !== undefined ? item.countedQuantity : (item.systemQuantity || 0);
                const system = item.systemQuantity || 0;
                const varianceQty = counted - system;
                const varianceValue = varianceQty * (item.unitCost || 0);
                return { ...item, varianceQty, varianceValue };
            });
            setItemsWithVariance(calculated);
            setTotalVarianceValue(calculated.reduce((acc, i) => acc + i.varianceValue, 0));
        }
    }, [sheet]);

    const handlePostItem = async (finalCountedQty: number) => {
        if (!itemToPost) return;
        if (finalCountedQty < 0) { alert("Quantity cannot be negative."); return; }

        setLoading(true);
        try {
            await db.runTransaction(async (transaction) => {
                const sheetRef = db.doc(`${warehousePath}/stockTakeSessions/${sheet.sessionId}/countSheets/${sheet.id}`);
                const sheetDoc = await transaction.get(sheetRef);
                if (!sheetDoc.exists) throw new Error("Sheet not found.");
                
                const currentItems = sheetDoc.data()!.items as CountSheetItem[];
                const currentItem = currentItems[itemToPost.index];

                // Calculate Variance for the movement log
                const systemQty = currentItem.systemQuantity || 0;
                const variance = finalCountedQty - systemQty;

                // Create Movement
                const matRef = db.doc(`${warehousePath}/materials/${currentItem.materialId}`);
                const movementsRef = db.collection(`${warehousePath}/materialMovements`);
                const newMovementRef = movementsRef.doc();
                
                const movementData = {
                    movementId: `ADJ-${sheet.piNumber}-${currentItem.materialCode}-${Date.now()}`,
                    type: 'ADJUSTMENT',
                    materialId: currentItem.materialId,
                    materialCode: currentItem.materialCode,
                    materialName: currentItem.materialName,
                    quantity: variance, // Log the difference
                    unitPrice: currentItem.unitCost || 0,
                    totalValue: variance * (currentItem.unitCost || 0),
                    warehousePath: warehousePath,
                    reason: `Stock Take ${sheet.piNumber}`,
                    date: Timestamp.now(),
                    createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
                };
                
                // Update Material Master with absolute counted value
                transaction.update(matRef, { 
                        'inventoryData.issuableQuantity': finalCountedQty,
                        'inventoryData.availableNetQuantity': finalCountedQty
                });
                transaction.set(newMovementRef, movementData);
                
                // Update item state in the sheet
                // postedQuantity tracks the variance amount we have processed
                currentItem.postedQuantity = variance;
                
                // Determine status
                // We consider it posted if we've processed the adjustment
                currentItem.status = 'POSTED';
                
                // Also auto-settle if value difference is 0 (e.g. qty variance but 0 cost, or variance 0)
                const value = variance * (currentItem.unitCost || 0);
                
                if (Math.abs(value) < 0.01) {
                     currentItem.status = 'SETTLED';
                     currentItem.settledQuantity = variance; // Settled amount matches variance processed
                }
                
                // Update the items array in the sheet doc
                transaction.update(sheetRef, { items: currentItems });
            });

            alert("Inventory updated to counted quantity.");
            setItemToPost(null);
            onUpdate(); 
        } catch (e: any) {
            console.error(e);
            alert("Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleSettlementComplete = async (journalId: string) => {
        setSettleModalOpen(false);
        setItemToSettle(null);
        onUpdate(); // Refresh to show updated settled quantities
    }
    
    const handleForceClose = async () => {
         if (!confirm("Are you sure you want to force close this PI document? This will mark it as Settled.")) return;
         setLoading(true);
         try {
             await db.doc(`${warehousePath}/stockTakeSessions/${sheet.sessionId}/countSheets/${sheet.id}`).update({
                 status: 'SETTLED',
                 settlementStatus: 'Completed'
             });
             onClose();
         } catch(e: any) {
             alert("Error closing sheet: " + e.message);
         } finally {
             setLoading(false);
         }
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Review Batch: ${sheet.batchName}`} size="7xl">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded border">
                    <div>
                        <p className="text-sm font-bold text-slate-700">PI Number: {sheet.piNumber}</p>
                        <p className="text-xs text-slate-500">Sheet Status: {sheet.status}</p>
                    </div>
                    <div className="text-right">
                         <p className="text-sm font-bold text-slate-700">Total Variance Value</p>
                         <p className={`text-lg font-bold ${totalVarianceValue < 0 ? 'text-red-600' : totalVarianceValue > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                             {totalVarianceValue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                         </p>
                    </div>
                </div>

                <div className="overflow-auto max-h-[60vh] border rounded">
                    <table className="min-w-full text-sm text-left divide-y divide-slate-200">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3">Material</th>
                                <th className="p-3 text-right">System</th>
                                <th className="p-3 text-right">Counted</th>
                                <th className="p-3 text-right">Variance</th>
                                <th className="p-3 text-right bg-blue-50">Posted (Var)</th>
                                <th className="p-3 text-right bg-green-50">Settled (Var)</th>
                                <th className="p-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {itemsWithVariance.map((item, idx) => {
                                const posted = item.postedQuantity || 0;
                                const settled = item.settledQuantity || 0;
                                
                                // Logic: Can Post if not yet posted. 
                                // Note: postedQuantity now stores the variance that was posted.
                                // If varianceQty != posted, it means we haven't posted the full adjustment yet (or at all).
                                const varianceQty = item.varianceQty;
                                const canPost = item.status !== 'POSTED' && item.status !== 'SETTLED' && item.status !== 'PARTIALLY_POSTED';
                                
                                // Can Settle if posted but not fully settled
                                const canSettle = item.status === 'POSTED' || item.status === 'PARTIALLY_POSTED';

                                return (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3">
                                        <div className="font-medium">{item.materialName}</div>
                                        <div className="text-xs font-mono opacity-75">{item.materialCode}</div>
                                    </td>
                                    <td className="p-3 text-right">{item.systemQuantity}</td>
                                    <td className="p-3 text-right font-bold">{item.countedQuantity ?? '-'}</td>
                                    <td className={`p-3 text-right font-bold ${item.varianceQty < 0 ? 'text-red-600' : item.varianceQty > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                        {item.varianceQty > 0 ? '+' : ''}{item.varianceQty}
                                    </td>
                                    <td className="p-3 text-right bg-blue-50 font-mono text-blue-700">
                                        {item.postedQuantity !== undefined ? item.postedQuantity : '-'}
                                    </td>
                                    <td className="p-3 text-right bg-green-50 font-mono text-green-700">
                                        {item.settledQuantity !== undefined ? item.settledQuantity : '-'}
                                    </td>
                                    <td className="p-3 text-center space-x-2">
                                        {canPost && (
                                            <Button 
                                                onClick={() => setItemToPost({ ...item, index: idx })} 
                                                className="!w-auto !py-1 !px-2 text-xs bg-blue-600 hover:bg-blue-700"
                                                disabled={loading}
                                            >
                                                Post
                                            </Button>
                                        )}
                                        {canSettle && (
                                            <Button 
                                                onClick={() => { setItemToSettle(item); setSettleModalOpen(true); }} 
                                                className="!w-auto !py-1 !px-2 text-xs bg-green-600 hover:bg-green-700"
                                                disabled={loading}
                                            >
                                                Settle
                                            </Button>
                                        )}
                                        {item.status === 'SETTLED' && (
                                            <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded">Settled</span>
                                        )}
                                        {item.varianceQty === 0 && item.status !== 'SETTLED' && !canPost && (
                                            <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded">Matched</span>
                                        )}
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between pt-4 border-t">
                    {sheet.status !== 'SETTLED' && (
                        <Button variant="secondary" className="!w-auto !bg-red-100 !text-red-800" onClick={handleForceClose}>Force Close Document</Button>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={loading} className="ml-auto !w-auto">Close</Button>
                </div>
            </div>
        </Modal>

        {itemToPost && (
            <PostQuantityModal
                isOpen={!!itemToPost}
                onClose={() => setItemToPost(null)}
                item={itemToPost}
                onConfirm={handlePostItem}
            />
        )}

        {settleModalOpen && itemToSettle && (
             <StockTakeSettleModal 
                isOpen={settleModalOpen}
                onClose={() => setSettleModalOpen(false)}
                sheet={sheet}
                itemsToSettle={[itemToSettle]}
                organisation={organisation}
                currentUser={currentUser}
                onSettled={handleSettlementComplete}
             />
        )}
        </>
    );
};

const StockTakeReview: React.FC<StockTakeReviewProps> = ({ organisation, theme, currentUser }) => {
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<HierarchyNode | null>(null);
    const [sessions, setSessions] = useState<StockTakeSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [sheets, setSheets] = useState<StockTakeCountSheet[]>([]);
    const [loading, setLoading] = useState(false);
    const [closingSession, setClosingSession] = useState(false);
    
    // Store only the ID, derive object
    const [reviewSheetId, setReviewSheetId] = useState<string | null>(null);
    
    const reviewSheet = useMemo(() => 
        sheets.find(s => s.id === reviewSheetId) || null
    , [sheets, reviewSheetId]);

    const selectedSession = useMemo(() => 
        sessions.find(s => s.id === selectedSessionId)
    , [sessions, selectedSessionId]);

    useEffect(() => {
        const fetchWarehouses = async () => {
             const groupQ = db.collectionGroup('level_5').where('sectionType', '>=', 'Capital Inventory').where('sectionType', '<', 'Capital Inventory\uf8ff');
             const snap = await groupQ.get();
             const nodes = snap.docs
                .filter(d => d.ref.path.includes(organisation.domain))
                .map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode));
             setHierarchy(nodes);
        };
        fetchWarehouses();
    }, [organisation.domain]);

    useEffect(() => {
        if (!warehouseId) { setSessions([]); return; }
        const whNode = hierarchy.find(n => n.id === warehouseId);
        setSelectedWarehouse(whNode || null);
        
        if (whNode && whNode.path) {
            const sessionsRef = db.collection(`${whNode.path}/stockTakeSessions`);
            const q = sessionsRef.orderBy('createdAt', 'desc');
            const unsub = q.onSnapshot((snap) => {
                const allSessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTakeSession));
                // Filter out completed/closed sessions from this view
                setSessions(allSessions.filter(s => s.status !== 'COMPLETED'));
            });
            return () => unsub();
        }
    }, [warehouseId, hierarchy]);

    useEffect(() => {
        if (!selectedSessionId || !selectedWarehouse?.path) { setSheets([]); return; }
        setLoading(true);
        
        const sheetsRef = db.collection(`${selectedWarehouse.path}/stockTakeSessions/${selectedSessionId}/countSheets`);
        const unsub = sheetsRef.onSnapshot((snap) => {
            const allSheets = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTakeCountSheet));
            // Include partially posted status in filter
            const reviewable = allSheets.filter(s => ['COUNTED', 'POSTED', 'SETTLED', 'PARTIAL', 'PARTIALLY_POSTED'].includes(s.status));
            setSheets(reviewable);
            setLoading(false);
        });
        return () => unsub();
    }, [selectedSessionId, selectedWarehouse]);

    const canCloseSession = useMemo(() => {
        if (!selectedSession || sheets.length === 0) return false;
        
        const allSheetsSettled = sheets.every(s => s.status === 'SETTLED');
        // Check if session batching is complete (items counted/batched == items in scope)
        const allItemsBatched = (selectedSession.totalItemsCounted || 0) >= (selectedSession.totalItemsInScope || 1);
        
        return allSheetsSettled && allItemsBatched;
    }, [selectedSession, sheets]);

    const handleCloseSession = async () => {
        if (!selectedSession || !selectedWarehouse?.path) return;
        if (!confirm("Confirm closing this session? It will be moved to Historical views.")) return;
        
        setClosingSession(true);
        try {
            await db.doc(`${selectedWarehouse.path}/stockTakeSessions/${selectedSession.id}`).update({
                status: 'COMPLETED'
            });
            alert("Session Closed.");
            setSelectedSessionId(''); // Reset selection as it disappears from list
        } catch (e) {
            console.error("Error closing session:", e);
            alert("Failed to close session.");
        } finally {
            setClosingSession(false);
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border">
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Warehouse</label>
                    <select 
                        value={warehouseId} 
                        onChange={e => { setWarehouseId(e.target.value); setSelectedSessionId(''); }} 
                        className="w-full p-2 border rounded-md text-sm"
                    >
                        <option value="">Select Warehouse...</option>
                        {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Active Session</label>
                    <select 
                        value={selectedSessionId} 
                        onChange={e => setSelectedSessionId(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm"
                        disabled={!warehouseId}
                    >
                        <option value="">Select Session...</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.configName} ({s.startDate})</option>)}
                    </select>
                 </div>
             </div>

             {selectedSessionId && (
                 <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                     <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                         <h3 className="font-bold text-slate-700">Batches for Review</h3>
                         {canCloseSession && (
                             <Button 
                                onClick={handleCloseSession} 
                                isLoading={closingSession}
                                className="!w-auto !bg-green-600 hover:!bg-green-700"
                             >
                                Close Session (Complete)
                             </Button>
                         )}
                     </div>
                     {loading ? <div className="p-8 text-center">Loading sheets...</div> : 
                      sheets.length === 0 ? <div className="p-8 text-center text-slate-500">No counted batches found.</div> : (
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Batch Name</th>
                                    <th className="px-4 py-3 text-left">PI Number</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {sheets.map(sheet => (
                                    <tr key={sheet.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{sheet.batchName}</td>
                                        <td className="px-4 py-3 font-mono text-slate-500">{sheet.piNumber}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                sheet.status === 'SETTLED' ? 'bg-green-100 text-green-800' : 
                                                sheet.status === 'POSTED' ? 'bg-purple-100 text-purple-800' : 
                                                sheet.status === 'PARTIALLY_POSTED' ? 'bg-orange-100 text-orange-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {sheet.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button onClick={() => setReviewSheetId(sheet.id)} className="!w-auto !py-1 !px-3 text-xs">
                                                Review
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      )}
                 </div>
             )}
             
             {reviewSheet && selectedWarehouse && (
                 <ReviewDetailModal 
                    isOpen={!!reviewSheet}
                    onClose={() => setReviewSheetId(null)}
                    sheet={reviewSheet}
                    warehousePath={selectedWarehouse.path!}
                    currentUser={currentUser}
                    organisation={organisation}
                    onUpdate={() => {}} 
                 />
             )}
        </div>
    );
};

export default StockTakeReview;
