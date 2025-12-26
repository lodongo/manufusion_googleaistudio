
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation } from '../../../types';
import type { StockTakeCountSheet } from '../../../types/in_types';
import Button from '../../Button';
import Modal from '../../common/Modal';

const { Timestamp } = firebase.firestore;

const CountSheetEntryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    sheet: StockTakeCountSheet;
    warehousePath: string;
    onSave: (id: string, counts: Record<string, number>, counterName: string) => void;
}> = ({ isOpen, onClose, sheet, warehousePath, onSave }) => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [counterName, setCounterName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && sheet) {
            const initialCounts: Record<string, number> = {};
            sheet.items.forEach(item => {
                initialCounts[item.materialId] = item.countedQuantity !== undefined ? item.countedQuantity : 0;
            });
            setCounts(initialCounts);
            setCounterName(sheet.countedBy || '');
            setError(null);
        }
    }, [isOpen, sheet]);

    const handleCountChange = (matId: string, val: string) => {
        setCounts(prev => ({...prev, [matId]: Number(val)}));
    };

    const handleSave = async () => {
        if (!counterName) { setError("Please enter the name of the person who counted."); return; }
        setSaving(true);
        setError(null);
        
        try {
             const sheetRef = db.doc(`${warehousePath}/stockTakeSessions/${sheet.sessionId}/countSheets/${sheet.id}`);
             
             const updatedItems = sheet.items.map(item => ({
                 ...item,
                 countedQuantity: counts[item.materialId]
             }));

             await sheetRef.update({
                 status: 'COUNTED',
                 items: updatedItems,
                 countedBy: counterName,
                 countedAt: Timestamp.now()
             });
             
             onClose();
        } catch (e: any) {
            console.error("Count submission error:", e);
            setError("Failed to submit counts: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Enter Counts: ${sheet.piNumber}`} size="4xl">
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded flex justify-between items-center">
                    <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="font-bold">{sheet.status}</p>
                    </div>
                    <div>
                         <p className="text-xs text-slate-500">Batch</p>
                         <p className="font-bold">{sheet.batchName}</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500">Counted By</label>
                        <input 
                            type="text" 
                            value={counterName} 
                            onChange={e => setCounterName(e.target.value)} 
                            className="border rounded p-1 text-sm w-48"
                            placeholder="Enter Name"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[60vh] border rounded">
                    <table className="min-w-full text-sm divide-y divide-slate-200">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 text-left">Bin</th>
                                <th className="px-4 py-2 text-left">Item Code</th>
                                <th className="px-4 py-2 text-left">Description</th>
                                <th className="px-4 py-2 text-right">Counted Qty</th>
                                <th className="px-4 py-2 text-left">UoM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {sheet.items.map(item => (
                                <tr key={item.materialId}>
                                    <td className="px-4 py-2 font-mono text-xs">{item.binLocation || 'N/A'}</td>
                                    <td className="px-4 py-2 font-mono text-xs text-blue-600">{item.materialCode}</td>
                                    <td className="px-4 py-2">{item.materialName}</td>
                                    <td className="px-4 py-2 text-right">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            className="w-24 border rounded p-1 text-right bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={counts[item.materialId]}
                                            onChange={e => handleCountChange(item.materialId, e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 text-xs">{item.uom}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

                <div className="flex justify-end pt-4 border-t gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={saving}>Submit Counts</Button>
                </div>
            </div>
        </Modal>
    );
};

interface CountsTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

const CountsTab: React.FC<CountsTabProps> = ({ organisation, theme }) => {
    const [activeSheets, setActiveSheets] = useState<StockTakeCountSheet[]>([]);
    const [loadingSheets, setLoadingSheets] = useState(true);
    const [sheetToCount, setSheetToCount] = useState<StockTakeCountSheet | null>(null);
    const [sheetWarehousePath, setSheetWarehousePath] = useState<string | null>(null);

    useEffect(() => {
        setLoadingSheets(true);
        const sheetsRef = db.collectionGroup('countSheets');
        const q = sheetsRef.where('status', 'in', ['CREATED', 'PRINTED']);
        
        const unsub = q.onSnapshot((snap) => {
            const sheets: StockTakeCountSheet[] = [];
            snap.docs.forEach(doc => {
                if (doc.ref.path.startsWith(`organisations/${organisation.domain}`)) {
                    const pathParts = doc.ref.path.split('/');
                    const sessionIndex = pathParts.indexOf('stockTakeSessions');
                    if (sessionIndex > 0) {
                        const warehousePath = pathParts.slice(0, sessionIndex).join('/');
                        
                        sheets.push({
                            id: doc.id,
                            ...doc.data(),
                            warehousePath: warehousePath
                        } as StockTakeCountSheet & { warehousePath: string });
                    }
                }
            });
            setActiveSheets(sheets.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            setLoadingSheets(false);
        });
        
        return () => unsub();
    }, [organisation.domain]);

    return (
        <div className="space-y-6">
             <div>
                 <h3 className="text-lg font-bold text-slate-800 mb-4">Active Count Tasks</h3>
                 <p className="text-sm text-slate-600 mb-4">Below are the active stock count sheets assigned for counting. Click "Enter Counts" to submit data.</p>
                 
                 {loadingSheets ? <p>Loading...</p> : activeSheets.length === 0 ? (
                     <p className="text-slate-500 italic bg-white p-8 rounded border border-dashed text-center">No active count sheets found pending entry.</p>
                 ) : (
                     <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                         <table className="min-w-full divide-y divide-slate-200 text-sm">
                             <thead className="bg-slate-50">
                                 <tr>
                                     <th className="px-4 py-3 text-left">PI Number</th>
                                     <th className="px-4 py-3 text-left">Batch Name</th>
                                     <th className="px-4 py-3 text-center">Items</th>
                                     <th className="px-4 py-3 text-center">Status</th>
                                     <th className="px-4 py-3 text-right">Action</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-200">
                                 {activeSheets.map(sheet => (
                                     <tr key={sheet.id} className="hover:bg-slate-50">
                                         <td className="px-4 py-3 font-mono text-blue-600">{sheet.piNumber}</td>
                                         <td className="px-4 py-3">{sheet.batchName}</td>
                                         <td className="px-4 py-3 text-center">{sheet.items.length}</td>
                                         <td className="px-4 py-3 text-center">
                                             <span className={`px-2 py-1 rounded text-xs font-bold ${sheet.status === 'PRINTED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{sheet.status}</span>
                                         </td>
                                         <td className="px-4 py-3 text-right">
                                             <Button className="!w-auto !py-1 !px-3 text-xs" onClick={() => {
                                                 setSheetToCount(sheet);
                                                 setSheetWarehousePath((sheet as any).warehousePath);
                                             }}>Enter Counts</Button>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 )}
             </div>
             
             {sheetToCount && sheetWarehousePath && (
                 <CountSheetEntryModal 
                    isOpen={!!sheetToCount}
                    onClose={() => setSheetToCount(null)}
                    sheet={sheetToCount}
                    warehousePath={sheetWarehousePath}
                    onSave={() => {}} 
                 />
             )}
        </div>
    );
};

export default CountsTab;
