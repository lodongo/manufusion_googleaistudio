import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeSession, StockTakeCountSheet, CountSheetItem } from '../../../types/in_types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Button from '../../Button';
import Input from '../../Input';
import CreateSessionModal from './CreateSessionModal';

const { Timestamp } = firebase.firestore;

interface StockTakeSessionsProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const ProgressBar: React.FC<{ label: string; value: number | undefined; total: number | undefined; color: string }> = ({ label, value, total, color }) => {
    const safeValue = value || 0;
    const safeTotal = total || 0;
    const percent = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
    
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-800">{safeValue} / {safeTotal} ({percent}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

const StockTakeSessions: React.FC<StockTakeSessionsProps> = ({ organisation, theme, currentUser }) => {
    const [sessions, setSessions] = useState<StockTakeSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Warehouse Context
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<HierarchyNode | null>(null);

    // Detailed View State
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sessionSheets, setSessionSheets] = useState<StockTakeCountSheet[]>([]);
    
    // Batch Creation State
    const [batchSize, setBatchSize] = useState(50);
    const [generatingBatch, setGeneratingBatch] = useState(false);
    const [closingSession, setClosingSession] = useState(false);

    // Derived Active Session
    const activeSession = useMemo(() => {
        return sessions.find(s => s.id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    // Fetch Warehouses
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

    // Listen for sessions in selected warehouse
    useEffect(() => {
        if (!warehouseId) {
            setSessions([]);
            return;
        }
        const whNode = hierarchy.find(n => n.id === warehouseId);
        setSelectedWarehouse(whNode || null);
        
        if (whNode && whNode.path) {
            setLoading(true);
            const sessionsRef = db.collection(`${whNode.path}/stockTakeSessions`);
            const q = sessionsRef.where('status', 'in', ['ACTIVE', 'PAUSED']).orderBy('createdAt', 'desc');
            const unsub = q.onSnapshot((snap) => {
                const loadedSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockTakeSession));
                setSessions(loadedSessions);
                setLoading(false);
            });
            return () => unsub();
        }
    }, [warehouseId, hierarchy]);

    // Listen for sheets if a session is active
    useEffect(() => {
        if (!activeSession) {
            setSessionSheets([]);
            return;
        }
        
        const sheetsRef = db.collection(`${activeSession.warehousePath}/stockTakeSessions/${activeSession.id}/countSheets`);
        const q = sheetsRef.orderBy('createdAt', 'desc');
        
        const unsub = q.onSnapshot((snap) => {
            setSessionSheets(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTakeCountSheet)));
        });
        return () => unsub();
    }, [activeSession?.id, activeSession?.warehousePath]);

    const handleGenerateBatch = async () => {
        if (!activeSession) return;
        if (batchSize <= 0) { alert("Batch size must be greater than 0"); return; }
        
        setGeneratingBatch(true);
        try {
            // Refresh session data to ensure processedMaterialIds is current
            const sessionDocRef = db.doc(`${activeSession.warehousePath}/stockTakeSessions/${activeSession.id}`);
            const sessionSnap = await sessionDocRef.get();
            
            if (!sessionSnap.exists) throw new Error("Session not found.");
            const freshSession = sessionSnap.data() as StockTakeSession;
            
            const scopeIds = freshSession.scopeMaterialIds || [];
            const processedIds = new Set(freshSession.processedMaterialIds || []);
            
            const availableIds = scopeIds.filter(id => !processedIds.has(id));
            
            if (availableIds.length === 0) {
                alert("All items in scope have already been batched.");
                return;
            }

            let idsToBatch = availableIds;
            if (activeSession.type === 'CYCLE') {
                 idsToBatch = [...availableIds].sort(() => 0.5 - Math.random());
            }
            idsToBatch = idsToBatch.slice(0, batchSize);

            const itemsForSheet: CountSheetItem[] = [];
            const materialsRef = db.collection(`${activeSession.warehousePath}/materials`);
            
            // Fetch material details in chunks
            for (let i = 0; i < idsToBatch.length; i += 10) {
                const chunk = idsToBatch.slice(i, i + 10);
                if (chunk.length === 0) break;
                
                const qMat = materialsRef.where('documentId', 'in', chunk);
                const snap = await qMat.get();
                
                snap.forEach(doc => {
                    const d = doc.data();
                    itemsForSheet.push({
                        materialId: d.documentId,
                        materialCode: d.materialNumber,
                        materialName: d.procurementComponentName || d.materialNumber,
                        binLocation: d.inventoryData?.bin || 'No Bin',
                        systemQuantity: d.inventoryData?.issuableQuantity || 0,
                        uom: d.inventoryData?.inventoryUom || 'Unit',
                        unitCost: d.procurementData?.standardPrice || 0
                    });
                });
            }

            if (itemsForSheet.length === 0) {
                alert("Could not retrieve material details for selected batch IDs. Please check warehouse inventory consistency.");
                return;
            }

            const batchRef = db.batch();
            
            const newSheetRef = db.collection(`${activeSession.warehousePath}/stockTakeSessions/${activeSession.id}/countSheets`).doc();
            const piNumber = `PI-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
            
            const sheetData: StockTakeCountSheet = {
                id: newSheetRef.id,
                piNumber,
                sessionId: activeSession.id,
                batchName: `Batch ${sessionSheets.length + 1} (${new Date().toLocaleDateString()})`,
                scheduledDate: new Date().toISOString().split('T')[0],
                status: 'CREATED',
                items: itemsForSheet,
                createdAt: Timestamp.now(),
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }
            };
            
            batchRef.set(newSheetRef, sheetData);

            // Update session processed tracking
            // We construct the new list based on the fresh read
            const updatedProcessedList = [...(freshSession.processedMaterialIds || []), ...idsToBatch];
            
            batchRef.update(sessionDocRef, { 
                processedMaterialIds: updatedProcessedList,
                totalItemsCounted: updatedProcessedList.length
            });

            await batchRef.commit();
            
        } catch (error) {
            console.error("Error generating batch:", error);
            alert("Failed to generate batch.");
        } finally {
            setGeneratingBatch(false);
        }
    };

    const handleCloseSession = async () => {
        if (!activeSession) return;
        if (!confirm("Are you sure you want to close this session? This will move it to history.")) return;
        setClosingSession(true);
        try {
            await db.doc(`${activeSession.warehousePath}/stockTakeSessions/${activeSession.id}`).update({
                status: 'COMPLETED'
            });
            setActiveSessionId(null);
            alert("Session closed successfully.");
        } catch(e) {
            console.error(e);
            alert("Failed to close session.");
        } finally {
            setClosingSession(false);
        }
    };

    // Stats for Active Session View
    const sessionStats = useMemo(() => {
        if (!activeSession) return null;
        const total = activeSession.totalItemsInScope || 0;
        // Use processedMaterialIds.length as source of truth for batched count if available, fallback to field
        const processed = activeSession.processedMaterialIds ? activeSession.processedMaterialIds.length : (activeSession.totalItemsCounted || 0);
        
        const remaining = Math.max(0, total - processed);
        const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        const endDate = new Date(activeSession.endDate);
        const today = new Date();
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24)));
        
        const suggestedBatch = daysRemaining > 0 ? Math.ceil(remaining / daysRemaining) : remaining;

        const sheetsTotal = sessionSheets.length;
        const sheetsCounted = sessionSheets.filter(s => ['COUNTED', 'POSTED', 'SETTLED'].includes(s.status)).length;
        const sheetsPosted = sessionSheets.filter(s => ['POSTED', 'SETTLED', 'PARTIALLY_POSTED'].includes(s.status)).length;
        const sheetsSettled = sessionSheets.filter(s => s.status === 'SETTLED').length;
        
        // Determine if can be auto-closed or button enabled
        const allBatched = remaining === 0;
        const allSheetsSettled = sheetsTotal > 0 && sheetsTotal === sheetsSettled;
        const canClose = allBatched && allSheetsSettled;
        
        return { total, processed, remaining, progress, daysRemaining, suggestedBatch, sheetsTotal, sheetsCounted, sheetsPosted, sheetsSettled, canClose };
    }, [activeSession, sessionSheets]);
    
    useEffect(() => {
        if (sessionStats && sessionStats.suggestedBatch > 0) {
            setBatchSize(Math.min(sessionStats.suggestedBatch, 100)); 
        } else if (sessionStats && sessionStats.remaining > 0) {
            setBatchSize(sessionStats.remaining);
        }
    }, [sessionStats?.suggestedBatch, sessionStats?.remaining]);

    const handlePrintSheet = (sheet: StockTakeCountSheet) => {
        alert("PDF printing is temporarily disabled.");
    };

    if (!warehouseId) {
        return (
             <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Stock Take Sessions</h3>
                     <div className="flex gap-2">
                         <select 
                             value={warehouseId} 
                             onChange={e => setWarehouseId(e.target.value)} 
                             className="p-2 border rounded-md text-sm min-w-[200px]"
                         >
                             <option value="">Select Warehouse...</option>
                             {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                         </select>
                     </div>
                 </div>
                 <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
                     <p className="text-slate-500">Please select a warehouse to view sessions.</p>
                 </div>
             </div>
        );
    }

    if (activeSession) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveSessionId(null)} className="text-sm hover:underline text-blue-600">&larr; Back to Sessions</button>
                        <h3 className="text-xl font-bold text-slate-800">{activeSession.configName} ({activeSession.id})</h3>
                    </div>
                    <Button 
                        onClick={handleCloseSession} 
                        isLoading={closingSession} 
                        variant={sessionStats?.canClose ? 'primary' : 'secondary'}
                        className={`!w-auto ${sessionStats?.canClose ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                    >
                        {sessionStats?.canClose ? 'Complete & Close Session' : 'Force Close Session'}
                    </Button>
                </div>
                
                {/* Progress Dashboard */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Batching Progress</h4>
                            <div className="flex justify-between text-xs font-medium mb-1">
                                <span>Items Batched</span>
                                <span>{sessionStats?.processed} / {sessionStats?.total} ({sessionStats?.progress}%)</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{width: `${sessionStats?.progress}%`}}></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-center mt-4">
                                <div className="p-2 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500 uppercase">Remaining Items</p>
                                    <p className="text-xl font-bold">{sessionStats?.remaining}</p>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500 uppercase">Days Left</p>
                                    <p className="text-xl font-bold">{sessionStats?.daysRemaining}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                             <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Execution Progress</h4>
                             <div className="space-y-3">
                                <ProgressBar label="Counted" value={sessionStats?.sheetsCounted} total={sessionStats?.sheetsTotal} color="bg-indigo-500" />
                                <ProgressBar label="Posted" value={sessionStats?.sheetsPosted} total={sessionStats?.sheetsTotal} color="bg-purple-500" />
                                <ProgressBar label="Settled" value={sessionStats?.sheetsSettled} total={sessionStats?.sheetsTotal} color="bg-green-500" />
                             </div>
                        </div>
                    </div>
                </div>
                
                {/* Action Area */}
                {(sessionStats?.remaining || 0) > 0 ? (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-blue-900">Generate Count Batch</h4>
                        <p className="text-sm text-blue-700">Create a new PI document. Suggested size: {sessionStats?.suggestedBatch}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-900">Batch Size:</span>
                        <Input 
                            id="batchSize"
                            type="number" 
                            value={batchSize} 
                            onChange={e => setBatchSize(Number(e.target.value))} 
                            containerClassName="!mb-0 w-24" 
                            min={1} 
                            max={sessionStats?.remaining}
                            label=""
                        />
                        <Button onClick={handleGenerateBatch} isLoading={generatingBatch} className="!w-auto bg-blue-600 hover:bg-blue-700">Create PI Document</Button>
                    </div>
                </div>
                ) : (
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
                         <div className="text-green-800 font-bold text-xl mb-2">✓ 100% Batched</div>
                        <p className="text-green-700">All items in scope have been assigned. {sessionStats?.canClose ? 'Ready to Close.' : 'Complete counting/posting to close.'}</p>
                    </div>
                )}

                {/* Sheets List */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Generated PI Documents</div>
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">PI Number</th>
                                <th className="px-4 py-3 text-left">Batch Name</th>
                                <th className="px-4 py-3 text-center">Items</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {sessionSheets.map(sheet => (
                                <tr key={sheet.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-mono font-medium text-blue-600">{sheet.piNumber}</td>
                                    <td className="px-4 py-3">{sheet.batchName}</td>
                                    <td className="px-4 py-3 text-center">{sheet.items.length}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                            sheet.status === 'SETTLED' ? 'bg-green-100 text-green-800' :
                                            sheet.status === 'POSTED' ? 'bg-purple-100 text-purple-800' :
                                            sheet.status === 'COUNTED' ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {sheet.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handlePrintSheet(sheet)} className="text-blue-600 hover:underline text-xs mr-2">Print PDF</button>
                                    </td>
                                </tr>
                            ))}
                            {sessionSheets.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No count sheets generated yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Stock Take Sessions</h3>
                    <p className="text-sm text-slate-500">Manage active count sessions for <strong>{selectedWarehouse?.name}</strong>.</p>
                </div>
                <div className="flex gap-2 items-center">
                     <select 
                        value={warehouseId} 
                        onChange={e => setWarehouseId(e.target.value)} 
                        className="p-2 border rounded-md text-sm min-w-[200px]"
                    >
                        <option value="">Select Warehouse...</option>
                        {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    <Button onClick={() => setIsModalOpen(true)} disabled={!warehouseId} className="!w-auto">Create Session</Button>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    {loading ? <div className="p-8 text-center">Loading sessions...</div> : 
                    sessions.length === 0 ? <div className="p-8 text-center text-slate-500">No active sessions found for this warehouse.</div> : (
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Session Name / ID</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Type</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Dates</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-500">Progress</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {sessions.map(session => {
                                const total = session.totalItemsInScope || 0;
                                // Fix 0% display bug by checking array length directly if available, fallback to field
                                const processed = session.processedMaterialIds ? session.processedMaterialIds.length : (session.totalItemsCounted || 0);
                                const progress = total > 0 
                                    ? Math.round((processed / total) * 100) 
                                    : 0;
                                
                                return (
                                <tr key={session.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{session.configName || 'Unnamed Session'}</div>
                                        <div className="text-xs text-slate-500 font-mono">{session.id}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${session.type === 'FULL' ? 'bg-purple-100 text-purple-800' : session.type === 'CYCLE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {session.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        <div>{session.startDate}</div>
                                        <div className="text-xs text-slate-400">to {session.endDate}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{width: `${progress}%`}}></div>
                                            </div>
                                            <span className="text-xs font-bold">{progress}%</span>
                                        </div>
                                        <div className="text-[10px] text-center text-slate-400">{processed} / {total} batched</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => setActiveSessionId(session.id)} className="text-blue-600 hover:underline text-sm font-medium">Manage</button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    )}
            </div>
            
            {isModalOpen && selectedWarehouse && (
                <CreateSessionModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    organisation={organisation}
                    currentUser={currentUser}
                    warehouseNode={selectedWarehouse}
                />
            )}
        </div>
    );
};

export default StockTakeSessions;