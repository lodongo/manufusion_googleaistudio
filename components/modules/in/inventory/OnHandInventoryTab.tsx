import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collectionGroup, query, onSnapshot, doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import type { AppUser, Organisation } from '../../../../types';
import Input from '../../../Input';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import { v4 as uuidv4 } from 'uuid';

interface OnHandInventoryTabProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
    organisation: Organisation;
    onViewMaterial: (materialId: string, path?: string) => void;
    currencyConfig: { local: string; base: string; rate: number };
}

interface InventoryTemplate {
    id: string;
    name: string;
    viewType: 'onHand';
    columns: string[];
}

const COLUMNS = [
    { id: 'code', label: 'Material Code' },
    { id: 'name', label: 'Material Name' },
    { id: 'type', label: 'Type' },
    { id: 'location', label: 'Department / Section' },
    { id: 'storage', label: 'Storage Loc' },
    { id: 'bin', label: 'Bin' },
    { id: 'issuable', label: 'Issuable' },
    { id: 'reserved', label: 'Reserved' },
    { id: 'netAvailable', label: 'Net Available' },
    { id: 'onOrder', label: 'On Order' },
    { id: 'minStock', label: 'Min' },
    { id: 'maxStock', label: 'Max' },
    { id: 'reorderPoint', label: 'Reorder Pt' },
    { id: 'safetyStock', label: 'Safety' },
    { id: 'unitCost', label: 'Unit Cost' },
    { id: 'totalValue', label: 'Total Value' },
    { id: 'buyerPlanner', label: 'Buyer' },
    { id: 'criticality', label: 'Class' },
];

const DEFAULT_COLS = ['code', 'name', 'location', 'storage', 'bin', 'issuable', 'reserved', 'netAvailable', 'unitCost', 'totalValue'];

const OnHandInventoryTab: React.FC<OnHandInventoryTabProps> = ({ currentUser, theme, organisation, onViewMaterial, currencyConfig }) => {
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ department: '', section: '', storageLocation: '' });
    const [globalSearch, setGlobalSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLS);
    const [templates, setTemplates] = useState<InventoryTemplate[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    
    const [filterOptions, setFilterOptions] = useState({
        departments: [] as { id: string, name: string }[],
        sections: [] as { id: string, name: string }[],
        storageLocations: [] as { id: string, name: string }[],
    });

    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');

    useEffect(() => {
        setLoading(true);
        const materialsQuery = query(collectionGroup(db, 'materials'));
        const unsubscribe = onSnapshot(materialsQuery, (snapshot) => {
            const fetchedInventory: any[] = [];
            const departmentsMap = new Map<string, string>();
            const sectionsMap = new Map<string, string>();
            const storageLocationsMap = new Map<string, string>();

            snapshot.forEach(doc => {
                if (doc.ref.path.startsWith(`organisations/${organisation.domain}`)) {
                    const data = doc.data();
                    
                    const pathParts = doc.ref.path.split('/');
                    const l4Id = data.allocationLevel4Id || (pathParts.length > 9 ? pathParts[9] : '');
                    const l5Id = data.allocationLevel5Id || (pathParts.length > 11 ? pathParts[11] : '');

                    const item = { 
                        id: doc.id, 
                        path: doc.ref.path, 
                        ...data,
                        allocationLevel4Id: l4Id,
                        allocationLevel5Id: l5Id
                    };
                    
                    if (l4Id && data.allocationLevel4Name) departmentsMap.set(l4Id, data.allocationLevel4Name);
                    if (l5Id && data.allocationLevel5Name) sectionsMap.set(l5Id, data.allocationLevel5Name);
                    if (data.storageLocationId && data.storageLocationName) storageLocationsMap.set(data.storageLocationId, data.storageLocationName);

                    fetchedInventory.push(item);
                }
            });

            setInventory(fetchedInventory);
            setFilterOptions({
                departments: Array.from(departmentsMap, ([id, name]) => ({ id, name })).sort((a,b) => (a.name || '').localeCompare(b.name || '')),
                sections: Array.from(sectionsMap, ([id, name]) => ({ id, name })).sort((a,b) => (a.name || '').localeCompare(b.name || '')),
                storageLocations: Array.from(storageLocationsMap, ([id, name]) => ({ id, name })).sort((a,b) => (a.name || '').localeCompare(b.name || '')),
            });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [organisation.domain]);

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!currentUser.uid) return;
            const userTemplatesRef = collection(db, `users/${currentUser.uid}/settings/inventoryTemplates/onHand`);
            const snap = await getDocs(userTemplatesRef);
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryTemplate)));
        };
        fetchTemplates();
    }, [currentUser.uid]);

    const formatCurrency = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') {
            amount = val / (currencyConfig.rate || 1);
        }
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const currencySymbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;

    const getValue = (item: any, colId: string) => {
        const invData = item.inventoryData || {};
        const procData = item.procurementData || {};

        switch (colId) {
            case 'code': return item.materialNumber || item.documentNumber || item.materialCode || '';
            case 'name': return item.procurementComponentName || item.materialName || '';
            case 'type': return item.materialTypeName || item.materialTypeDescription || '';
            case 'location': 
                const dept = item.allocationLevel4Name || '';
                const sect = item.allocationLevel5Name || '';
                return dept && sect ? `${dept} / ${sect}` : dept || sect || '';
            case 'storage': return item.storageLocationName || '';
            case 'bin': return item.bin || invData.bin || '';
            case 'issuable': return invData.issuableQuantity ?? 0;
            case 'reserved': return invData.reservedQuantity ?? 0;
            case 'netAvailable': return procData.availableNetQuantity ?? invData.availableNetQuantity ?? 0;
            case 'onOrder': return invData.orderedQuantity ?? 0;
            case 'minStock': return invData.minStockLevel ?? 0;
            case 'maxStock': return invData.maxStockLevel ?? 0;
            case 'reorderPoint': return invData.reorderPointQty ?? 0;
            case 'safetyStock': return procData.safetyStockQty ?? invData.safetyStockQty ?? 0;
            case 'unitCost': return procData.standardPrice ?? item.unitCost ?? 0;
            case 'totalValue': return ((invData.issuableQuantity || 0) * (procData.standardPrice || 0));
            case 'buyerPlanner': return procData.buyerPlannerName || '';
            case 'criticality': return procData.criticalityClass || invData.criticalityClass || '';
            default: return '';
        }
    };

    const filteredData = useMemo(() => {
        let processed = inventory.filter(item => {
            const deptMatch = !filters.department || item.allocationLevel4Id === filters.department;
            const sectMatch = !filters.section || item.allocationLevel5Id === filters.section;
            const locMatch = !filters.storageLocation || item.storageLocationId === filters.storageLocation;
            
            const searchLower = globalSearch.toLowerCase();
            const searchMatch = !globalSearch || 
                getValue(item, 'code').toString().toLowerCase().includes(searchLower) || 
                getValue(item, 'name').toString().toLowerCase().includes(searchLower);

            return deptMatch && sectMatch && locMatch && searchMatch;
        });

        if (sortConfig.key) {
            processed.sort((a, b) => {
                const aValue = getValue(a, sortConfig.key);
                const bValue = getValue(b, sortConfig.key);
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();
                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return processed;
    }, [inventory, filters, globalSearch, sortConfig]);

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return;
        const newTemplate: InventoryTemplate = { id: uuidv4(), name: newTemplateName, viewType: 'onHand', columns: visibleColumns };
        await setDoc(doc(db, `users/${currentUser.uid}/settings/inventoryTemplates/onHand/${newTemplate.id}`), newTemplate);
        setTemplates([...templates, newTemplate]);
        setNewTemplateName('');
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-b-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-slate-800">On Hand Inventory <span className="text-sm font-normal text-slate-500 ml-2">({filteredData.length} items)</span></h2>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-md p-1">
                        <select 
                            value={viewCurrency} 
                            onChange={(e) => setViewCurrency(e.target.value as any)}
                            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-slate-700"
                        >
                            <option value="local">{currencyConfig.local} (Local)</option>
                            <option value="base">{currencyConfig.base} (Base)</option>
                        </select>
                    </div>
                    {viewCurrency === 'base' && <span className="text-xs text-slate-500">Rate: {currencyConfig.rate}</span>}
                </div>

                <div className="flex gap-2">
                    <Input id="globalSearch" label="" placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} containerClassName="mb-0 w-64" />
                    <Button onClick={() => setIsSettingsOpen(true)} variant="secondary" className="!w-auto flex items-center gap-2">Columns</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
                <Input id="departmentFilter" as="select" label="Department" value={filters.department} onChange={e => setFilters(p => ({ ...p, department: e.target.value, section: '' }))} containerClassName="mb-0">
                    <option value="">All Departments</option>
                    {filterOptions.departments.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </Input>
                <Input id="sectionFilter" as="select" label="Section" value={filters.section} onChange={e => setFilters(p => ({ ...p, section: e.target.value }))} disabled={!filters.department} containerClassName="mb-0">
                    <option value="">All Sections</option>
                    {filterOptions.sections.filter(s => inventory.some(i => i.allocationLevel4Id === filters.department && i.allocationLevel5Id === s.id)).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </Input>
                <Input id="storageLocationFilter" as="select" label="Storage Location" value={filters.storageLocation} onChange={e => setFilters(p => ({ ...p, storageLocation: e.target.value }))} containerClassName="mb-0">
                    <option value="">All Locations</option>
                    {filterOptions.storageLocations.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </Input>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg bg-white max-h-[70vh]">
                {loading ? <div className="text-center py-10">Loading...</div> : (
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                {visibleColumns.map(colId => {
                                    const colDef = COLUMNS.find(c => c.id === colId);
                                    return (
                                        <th key={colId} className="px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200" onClick={() => setSortConfig(p => ({ key: colId, direction: p.key === colId && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                            <div className="flex items-center gap-1">{colDef?.label} {sortConfig.key === colId && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredData.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-blue-50 transition-colors">
                                    {visibleColumns.map(colId => {
                                        const value = getValue(item, colId);
                                        let displayValue: React.ReactNode = value;
                                        if (['unitCost', 'totalValue'].includes(colId)) {
                                            displayValue = `${currencySymbol} ${formatCurrency(Number(value))}`;
                                        }
                                        else if (colId === 'code') displayValue = <button onClick={() => onViewMaterial(item.documentId || item.id, item.path)} className="font-mono text-blue-600 hover:underline">{value}</button>;
                                        return <td key={colId} className="px-6 py-3 whitespace-nowrap text-sm text-slate-700">{displayValue}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

             <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Table Settings">
                <div className="space-y-6">
                    <div className="space-y-2 border p-2 rounded max-h-60 overflow-y-auto">
                        {COLUMNS.map(col => (
                            <label key={col.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => setVisibleColumns(p => p.includes(col.id) ? p.filter(c => c !== col.id) : [...p, col.id])} className="rounded text-blue-600" />
                                <span className="text-sm text-slate-700">{col.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2 border-t pt-4">
                        <Input id="templateName" label="" placeholder="New Template Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} containerClassName="flex-grow mb-0" />
                        <Button onClick={handleSaveTemplate} className="!w-auto" disabled={!newTemplateName}>Save</Button>
                    </div>
                    {templates.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {templates.map(t => (
                                <div key={t.id} className="flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 text-sm">
                                    <button onClick={() => { setVisibleColumns(t.columns); setIsSettingsOpen(false); }} className="font-medium hover:underline mr-2">{t.name}</button>
                                    <button onClick={async () => { await deleteDoc(doc(db, `users/${currentUser.uid}/settings/inventoryTemplates/onHand/${t.id}`)); setTemplates(p => p.filter(x => x.id !== t.id)); }} className="text-blue-400 hover:text-red-500">&times;</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end"><Button onClick={() => setIsSettingsOpen(false)}>Done</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default OnHandInventoryTab;