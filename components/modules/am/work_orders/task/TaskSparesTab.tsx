
import React from 'react';
import type { WorkOrderTask } from '../../../../../types/am_types';
import type { MaterialMasterData } from '../../../../types';
import type { HierarchyNode } from '../../../../org/HierarchyNodeModal';
import Input from '../../../../Input';

interface TaskSparesTabProps {
    formData: Partial<WorkOrderTask>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<WorkOrderTask>>>;
    isLocked: boolean;
    hierarchyOptions: { l3: HierarchyNode[], l4: HierarchyNode[], l5: HierarchyNode[] };
    selectedHierarchy: { l3: string, l4: string, l5: string };
    setSelectedHierarchy: React.Dispatch<React.SetStateAction<{ l3: string, l4: string, l5: string }>>;
    inventory: MaterialMasterData[];
    spareSearch: string;
    setSpareSearch: (val: string) => void;
    handleAddSpare: (material: MaterialMasterData) => void;
    handleUpdateSpareWarehouse: (index: number, warehouseId: string) => void;
    handleEditSpare: (index: number, materialId: string) => void;
    handleUpdateSpareQty: (index: number, qty: number) => void;
    handleRemoveSpare: (index: number) => void;
    editingSpareIndex: number | null;
    setEditingSpareIndex: (index: number | null) => void;
    spareLocationOptions: {id: string, name: string, path: string, qty: number}[];
    loadingSpareLocs: boolean;
}

const TaskSparesTab: React.FC<TaskSparesTabProps> = ({ 
    formData, setFormData, isLocked, hierarchyOptions, selectedHierarchy, setSelectedHierarchy,
    inventory, spareSearch, setSpareSearch, handleAddSpare, handleUpdateSpareWarehouse, handleEditSpare,
    handleUpdateSpareQty, handleRemoveSpare, editingSpareIndex, setEditingSpareIndex, spareLocationOptions, loadingSpareLocs
}) => {
    // Helper to get name safely
    const getHierarchyName = (nodes: HierarchyNode[], id: string) => nodes.find(n => n.id === id)?.name || '...';

    return (
        <div className="space-y-6">
            {!isLocked && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-700 mb-3">Add Spare Part</h4>
                    
                    <div className="mb-4 text-sm text-slate-600 bg-white p-3 rounded border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                             <span className="text-slate-400 font-bold uppercase text-xs mr-2">Context:</span>
                             <span className="font-medium text-slate-800">{getHierarchyName(hierarchyOptions.l3, selectedHierarchy.l3)}</span>
                             <span className="mx-2 text-slate-400">/</span>
                             <span className="font-medium text-slate-800">{getHierarchyName(hierarchyOptions.l4, selectedHierarchy.l4)}</span>
                        </div>
                        <div className="flex-1 md:max-w-xs">
                             <select 
                                value={selectedHierarchy.l5} 
                                onChange={e => setSelectedHierarchy(p => ({...p, l5: e.target.value}))} 
                                className="w-full p-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Warehouse...</option>
                                {hierarchyOptions.l5.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <Input 
                            id="spareSearch" 
                            label="Search Material" 
                            value={spareSearch} 
                            onChange={e => setSpareSearch(e.target.value)} 
                            placeholder="Type code or name..." 
                            disabled={!selectedHierarchy.l5}
                        />
                        {inventory.length > 0 && (
                            <div className="mt-2 border rounded max-h-40 overflow-y-auto bg-white shadow-sm">
                                {inventory.filter(i => i.materialCode?.toLowerCase().includes(spareSearch.toLowerCase()) || i.procurementComponentName?.toLowerCase().includes(spareSearch.toLowerCase())).map(item => (
                                    <div key={item.id} className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm border-b last:border-0" onClick={() => handleAddSpare(item)}>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800">{item.procurementComponentName}</span>
                                            <span className="text-xs text-slate-500 font-mono">{item.materialCode}</span>
                                        </div>
                                        <span className="text-slate-600 font-bold text-xs bg-slate-100 px-2 py-1 rounded">
                                            {item.inventoryData?.issuableQuantity || 0} {item.inventoryData?.inventoryUom}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedHierarchy.l5 && inventory.length === 0 && spareSearch && (
                             <p className="text-xs text-slate-500 mt-2 italic">No materials found in selected warehouse.</p>
                        )}
                    </div>
                </div>
            )}

            <div>
                <h4 className="font-semibold text-slate-700 mb-2">Required Spares</h4>
                {(formData.requiredSpares || []).length === 0 ? <p className="text-slate-500 italic">No spares added.</p> : (
                    <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-3 font-semibold text-slate-600">Material</th>
                                <th className="p-3 font-semibold text-slate-600">Warehouse</th>
                                <th className="p-3 font-semibold text-slate-600 w-24 text-center">Qty</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {formData.requiredSpares?.map((s, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-3">
                                        <div className="font-medium text-slate-800">{s.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">{s.materialCode}</div>
                                    </td>
                                    {editingSpareIndex === i ? (
                                        <td className="p-3">
                                            {loadingSpareLocs ? <span className="text-xs text-slate-500">Loading locations...</span> : (
                                                <div className="flex items-center gap-1">
                                                    <select 
                                                        className="text-xs border rounded p-1 max-w-[150px]"
                                                        value={s.warehouseId}
                                                        onChange={(e) => handleUpdateSpareWarehouse(i, e.target.value)}
                                                        autoFocus
                                                    >
                                                        {spareLocationOptions.map(opt => (
                                                            <option key={opt.id} value={opt.id}>{opt.name} ({opt.qty})</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => setEditingSpareIndex(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                                                </div>
                                            )}
                                        </td>
                                    ) : (
                                        <td className="p-3 text-slate-600 group cursor-pointer" onClick={() => !isLocked && handleEditSpare(i, s.materialId)}>
                                            <div className="flex items-center gap-2">
                                                <span>{s.warehouseName}</span>
                                                {!isLocked && <span className="opacity-0 group-hover:opacity-100 text-blue-500 text-xs">Edit</span>}
                                            </div>
                                        </td>
                                    )}
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <input 
                                                type="number" 
                                                min="1" 
                                                value={s.quantity} 
                                                onChange={e => handleUpdateSpareQty(i, Number(e.target.value))} 
                                                className="w-16 p-1 border rounded text-center" 
                                                disabled={isLocked} 
                                            />
                                            <span className="text-xs text-slate-500">{s.uom}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {!isLocked && <button onClick={() => handleRemoveSpare(i)} className="text-red-400 hover:text-red-600 font-bold p-1">×</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskSparesTab;
