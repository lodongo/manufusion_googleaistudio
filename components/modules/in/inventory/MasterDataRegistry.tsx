

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, onSnapshot, orderBy, doc, getDocs, where, addDoc, Timestamp, setDoc, deleteDoc } from 'firebase/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../../types';
import Input from '../../../Input';
import Button from '../../../Button';
import Modal from '../../../common/Modal';
import { v4 as uuidv4 } from 'uuid';

interface MasterDataRegistryProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
    organisation: Organisation;
    onViewMaterial: (materialId: string) => void;
}

interface InventoryTemplate {
    id: string;
    name: string;
    viewType: 'masterData';
    columns: string[];
}

const COLUMNS = [
    { id: 'materialCode', label: 'Material Code' },
    { id: 'procurementComponentName', label: 'Component Name' },
    { id: 'materialTypeName', label: 'Material Type' },
    { id: 'procurementCategoryName', label: 'Category' },
    { id: 'procurementSubcategoryName', label: 'Subcategory' },
    { id: 'source', label: 'Source' },
    { id: 'partNumber', label: 'OEM/OCM Part No.' },
    { id: 'oemName', label: 'OEM Name' },
    { id: 'warehouseStatus', label: 'Warehouse Status' },
    { id: 'status', label: 'Master Status' },
    { id: 'actions', label: 'Actions' },
];

const DEFAULT_COLS = ['materialCode', 'procurementComponentName', 'materialTypeName', 'partNumber', 'warehouseStatus', 'actions'];

const MasterDataRegistry: React.FC<MasterDataRegistryProps> = ({ currentUser, theme, organisation, onViewMaterial }) => {
    const [masterData, setMasterData] = useState<MaterialMasterData[]>([]);
    const [loading, setLoading] = useState(true);
    const [globalSearch, setGlobalSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'materialCode', direction: 'asc' });

    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLS);
    const [templates, setTemplates] = useState<InventoryTemplate[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    // Warehouse Context Selection
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [sections, setSections] = useState<{ id: string, name: string }[]>([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [warehouseMaterials, setWarehouseMaterials] = useState<Set<string>>(new Set()); // Set of Material IDs present in selected warehouse
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 1. Fetch Master Data
    useEffect(() => {
        setLoading(true);
        const masterDataRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);
        const q = query(masterDataRef, where('status', '==', 'Approved'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMasterData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialMasterData)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching master data: ", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [organisation.domain]);

    // 2. Fetch Departments (L4) based on User's L3
    useEffect(() => {
        if (currentUser.allocationLevel1Id && currentUser.allocationLevel2Id && currentUser.allocationLevel3Id) {
            const l3Path = `organisations/${organisation.domain}/level_1/${currentUser.allocationLevel1Id}/level_2/${currentUser.allocationLevel2Id}/level_3/${currentUser.allocationLevel3Id}`;
            const l4Ref = collection(db, `${l3Path}/level_4`);
            
            getDocs(query(l4Ref, orderBy('name'))).then(snap => {
                setDepartments(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
            });
        }
    }, [currentUser, organisation.domain]);

    // 3. Fetch Sections (L5) when Dept changes
    useEffect(() => {
        if (!selectedDept || !currentUser.allocationLevel3Id) {
            setSections([]);
            setSelectedSection('');
            return;
        }
        const l4Path = `organisations/${organisation.domain}/level_1/${currentUser.allocationLevel1Id}/level_2/${currentUser.allocationLevel2Id}/level_3/${currentUser.allocationLevel3Id}/level_4/${selectedDept}`;
        const l5Ref = collection(db, `${l4Path}/level_5`);
        
        getDocs(query(l5Ref, orderBy('name'))).then(snap => {
            setSections(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
        });
    }, [selectedDept, currentUser, organisation.domain]);

    // 4. Fetch Existing Materials in Selected Warehouse
    useEffect(() => {
        if (!selectedSection || !selectedDept) {
            setWarehouseMaterials(new Set());
            return;
        }

        const warehousePath = `organisations/${organisation.domain}/level_1/${currentUser.allocationLevel1Id}/level_2/${currentUser.allocationLevel2Id}/level_3/${currentUser.allocationLevel3Id}/level_4/${selectedDept}/level_5/${selectedSection}/materials`;
        
        const unsubscribe = onSnapshot(collection(db, warehousePath), (snap) => {
            const existingIds = new Set<string>(snap.docs.map(d => {
                const data = d.data();
                // Use documentId field if available (which links to master data), otherwise fallback to doc ID
                return (data.documentId || d.id) as string; 
            }));
            setWarehouseMaterials(existingIds);
        });

        return () => unsubscribe();
    }, [selectedSection, selectedDept, currentUser, organisation.domain]);

    // 5. Handle Extension or Removal Request
    const handleRequestChange = async (material: MaterialMasterData, type: 'EXTENSION' | 'REMOVAL') => {
        if (!selectedSection || !selectedDept) {
            alert("Please select a Department and Section first.");
            return;
        }

        if (!confirm(`Are you sure you want to request ${type === 'EXTENSION' ? 'extension to' : 'removal from'} the selected warehouse? This will require approval.`)) return;

        setProcessingId(material.id);
        try {
            const deptName = departments.find(d => d.id === selectedDept)?.name;
            const sectName = sections.find(s => s.id === selectedSection)?.name;

            const payload = {
                type,
                status: 'Pending Approval',
                materialId: material.id,
                materialCode: material.materialCode,
                materialName: material.procurementComponentName,
                
                // Target Location
                allocationLevel1Id: currentUser.allocationLevel1Id,
                allocationLevel1Name: currentUser.allocationLevel1Name,
                allocationLevel2Id: currentUser.allocationLevel2Id,
                allocationLevel2Name: currentUser.allocationLevel2Name,
                allocationLevel3Id: currentUser.allocationLevel3Id,
                allocationLevel3Name: currentUser.allocationLevel3Name,
                allocationLevel4Id: selectedDept,
                allocationLevel4Name: deptName,
                allocationLevel5Id: selectedSection,
                allocationLevel5Name: sectName,

                // Snapshot of material data for the warehouse record (minimal needed for display/creation)
                inventoryData: material.inventoryData || {},
                procurementData: material.procurementData || {},
                attributes: material.attributes || {},

                approver1: false,
                approver2: false,
                approver3: false,
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now(),
            };

            await addDoc(collection(db, `organisations/${organisation.domain}/modules/IN/extensions`), payload);
            alert(`Request for ${type.toLowerCase()} submitted successfully.`);
        } catch (error) {
            console.error("Error submitting request:", error);
            alert("Failed to submit request.");
        } finally {
            setProcessingId(null);
        }
    };

    const getValue = (item: any, colId: string) => {
        switch(colId) {
            case 'materialCode': return item.materialCode || '';
            case 'procurementComponentName': return item.procurementComponentName || '';
            case 'materialTypeName': return item.materialTypeName || '';
            case 'procurementCategoryName': return item.procurementCategoryName || '';
            case 'procurementSubcategoryName': return item.procurementSubcategoryName || '';
            case 'source': return item.source || '';
            case 'partNumber': return item.oemPartNumber || item.ocmPartNumber || '';
            case 'oemName': return item.oemName || '';
            case 'status': return item.status || '';
            case 'warehouseStatus': 
                if (!selectedSection) return <span className="text-slate-400 italic">Select Warehouse</span>;
                return warehouseMaterials.has(item.id) 
                    ? <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded text-xs">Stocked</span> 
                    : <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs">Not Stocked</span>;
            case 'actions':
                if (!selectedSection) return null;
                const isStocked = warehouseMaterials.has(item.id);
                return (
                    <Button 
                        variant={isStocked ? "secondary" : "primary"} 
                        className={`!py-1 !px-2 text-xs !w-auto ${isStocked ? '!bg-red-50 !text-red-700 border-red-200 hover:!bg-red-100' : ''}`}
                        onClick={() => handleRequestChange(item, isStocked ? 'REMOVAL' : 'EXTENSION')}
                        disabled={!!processingId}
                    >
                        {processingId === item.id ? '...' : (isStocked ? 'Remove' : 'Extend')}
                    </Button>
                );
            default: return '';
        }
    };

    const filteredData = useMemo(() => {
        let processed = masterData.filter(item => {
            const searchLower = globalSearch.toLowerCase();
            return !globalSearch || 
                getValue(item, 'materialCode').toString().toLowerCase().includes(searchLower) || 
                getValue(item, 'procurementComponentName').toString().toLowerCase().includes(searchLower) ||
                getValue(item, 'partNumber').toString().toLowerCase().includes(searchLower);
        });

        if (sortConfig.key) {
            processed.sort((a, b) => {
                const aValue = getValue(a, sortConfig.key);
                const bValue = getValue(b, sortConfig.key);
                if (React.isValidElement(aValue)) return 0;
                
                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();
                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return processed;
    }, [masterData, globalSearch, sortConfig, warehouseMaterials, selectedSection]);

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!currentUser.uid) return;
            const templatesRef = collection(db, `users/${currentUser.uid}/settings/inventoryTemplates/masterData`);
            const snap = await getDocs(templatesRef);
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryTemplate)));
        };
        fetchTemplates();
    }, [currentUser.uid]);

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return;
        const newTemplate: InventoryTemplate = { id: uuidv4(), name: newTemplateName, viewType: 'masterData', columns: visibleColumns };
        await setDoc(doc(db, `users/${currentUser.uid}/settings/inventoryTemplates/masterData/${newTemplate.id}`), newTemplate);
        setTemplates([...templates, newTemplate]);
        setNewTemplateName('');
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-b-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex justify-between items-center gap-4">
                    <h2 className="text-xl font-semibold text-slate-800">Master Data Registry <span className="text-sm font-normal text-slate-500 ml-2">({filteredData.length} approved items)</span></h2>
                    <div className="flex gap-2">
                        <Input id="globalSearch" label="" placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} containerClassName="mb-0 w-64" />
                        <Button onClick={() => setIsSettingsOpen(true)} variant="secondary" className="!w-auto flex items-center gap-2">Columns</Button>
                    </div>
                </div>

                {/* Warehouse Context Selector */}
                <div className="p-4 bg-slate-50 border rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <Input id="departmentSelect" as="select" label="Department (Level 4)" value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedSection(''); }}>
                        <option value="">Select Department...</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Input>
                    <Input id="sectionSelect" as="select" label="Warehouse / Section (Level 5)" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedDept}>
                        <option value="">Select Warehouse...</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Input>
                </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg bg-white max-h-[70vh]">
                {loading ? <div className="text-center py-10">Loading data...</div> : (
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
                                        if (colId === 'materialCode') displayValue = <button onClick={() => onViewMaterial(item.id)} className="font-mono text-blue-600 hover:underline">{value}</button>;
                                        return <td key={colId} className="px-6 py-3 whitespace-nowrap text-sm text-slate-700">{displayValue}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

             <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Table Settings (Master Data)">
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
                                    <button onClick={async () => { await deleteDoc(doc(db, `users/${currentUser.uid}/settings/inventoryTemplates/masterData/${t.id}`)); setTemplates(p => p.filter(x => x.id !== t.id)); }} className="text-blue-400 hover:text-red-500">&times;</button>
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

export default MasterDataRegistry;
