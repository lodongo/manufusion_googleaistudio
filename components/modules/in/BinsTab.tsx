
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation, MaterialMasterData } from '../../../types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Input from '../../Input';

interface Bin {
    id: string;
    isEmpty: boolean;
    materialId?: string;
    materialCode?: string;
    partNumber?: string;
    currentQty?: number;
    minQty?: number;
    maxQty?: number;
    materialTypeName?: string;
    floor?: number;
    shelf?: number;
    column?: number;
    row?: number;
    position?: number;
}

interface BinsTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    onViewMaterial: (id: string, path?: string) => void;
}

const BinsTab: React.FC<BinsTabProps> = ({ organisation, theme, onViewMaterial }) => {
    const [warehouses, setWarehouses] = useState<HierarchyNode[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [bins, setBins] = useState<Bin[]>([]);
    // Use 'any' type to avoid strict type checks for the partial warehouse material data
    const [warehouseMaterials, setWarehouseMaterials] = useState<Record<string, any>>({});
    
    const [loading, setLoading] = useState(false);
    const [loadingBins, setLoadingBins] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');

    useEffect(() => {
        const fetchWarehouses = async () => {
            setLoading(true);
            try {
                const snap = await db.collectionGroup('level_5')
                    .where('sectionType', '>=', 'Capital Inventory')
                    .where('sectionType', '<', 'Capital Inventory\uf8ff')
                    .get();
                
                const nodes = snap.docs
                    .filter(d => d.ref.path.includes(organisation.domain))
                    .map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode));
                
                setWarehouses(nodes.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (e) {
                console.error("Error fetching warehouses", e);
            } finally {
                setLoading(false);
            }
        };
        fetchWarehouses();
    }, [organisation.domain]);

    useEffect(() => {
        if (!selectedWarehouseId) {
            setBins([]);
            setWarehouseMaterials({});
            return;
        }
        const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
        if (!warehouse?.path) return;

        setLoadingBins(true);
        
        // 1. Fetch Bins
        const binsRef = db.collection(`${warehouse.path}/bins`);
        const unsubBins = binsRef.onSnapshot(snap => {
            const loadedBins = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bin));
            setBins(loadedBins);
            setLoadingBins(false);
        });

        // 2. Fetch Materials in this warehouse to get real-time stock/order stats
        const materialsRef = db.collection(`${warehouse.path}/materials`);
        const unsubMaterials = materialsRef.onSnapshot(snap => {
            const matMap: Record<string, any> = {};
            snap.forEach(doc => {
                // The doc ID in the warehouse materials subcollection is the materialId
                // We capture the document path here to pass it to the detail view
                
                // Explicitly cast to any to avoid type issues with unknown
                const data = doc.data() as any;
                
                matMap[doc.id] = { 
                    id: doc.id, 
                    path: doc.ref.path, 
                    ...data 
                };
            });
            setWarehouseMaterials(matMap);
        });

        return () => {
            unsubBins();
            unsubMaterials();
        };
    }, [selectedWarehouseId, warehouses]);

    // Reverse Mapping: Determine which material is in which bin based on Material Data
    const binToMaterialMap = useMemo(() => {
        const map: Record<string, any> = {};
        Object.values(warehouseMaterials).forEach((mat: any) => {
            const binId = mat.inventoryData?.bin || mat.bin;
            if (binId) {
                map[binId] = mat;
            }
        });
        return map;
    }, [warehouseMaterials]);

    const filteredBins = useMemo(() => {
        return bins.filter(bin => {
            const matInBin = binToMaterialMap[bin.id];
            
            const matchesSearch = !searchTerm || 
                bin.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                matInBin?.materialCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                matInBin?.procurementComponentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (matInBin?.oemPartNumber && matInBin.oemPartNumber.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesFloor = floorFilter === 'all' || bin.floor === Number(floorFilter);

            return matchesSearch && matchesFloor;
        });
    }, [bins, searchTerm, floorFilter, binToMaterialMap]);

    const uniqueFloors = useMemo(() => {
        const floors = new Set(bins.map(b => b.floor));
        return Array.from(floors).sort((a, b) => Number(a ?? 0) - Number(b ?? 0));
    }, [bins]);

    const BinCard: React.FC<{ bin: Bin }> = ({ bin }) => {
        const matData = binToMaterialMap[bin.id];
        const isOccupied = !!matData;
        
        // Data sources from Material Record
        const currentQty = matData?.inventoryData?.issuableQuantity ?? 0;
        const minQty = matData?.inventoryData?.minStockLevel ?? 0;
        const maxQty = matData?.inventoryData?.maxStockLevel ?? 0;
        const orderedQty = matData?.inventoryData?.orderedQuantity ?? 0;
        const uom = matData?.inventoryData?.inventoryUom || 'Units';
        const materialCode = matData?.materialCode || '';
        const partNumber = matData?.oemPartNumber || matData?.ocmPartNumber || '';
        const componentName = matData?.procurementComponentName || 'Unknown Item';

        // Styling Logic
        const occupiedStyle = "bg-green-50 border-green-300 shadow-lg shadow-green-100/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer z-10 relative";
        const emptyStyle = "bg-red-50 border-red-200 shadow-sm opacity-90 cursor-default";

        const containerClasses = isOccupied ? occupiedStyle : emptyStyle;

        return (
            <div 
                onClick={() => isOccupied && onViewMaterial(matData.id, matData.path)}
                className={`p-3 rounded-xl border flex flex-col text-sm h-full relative overflow-hidden ${containerClasses}`}
            >
                {/* Header: Bin ID */}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-black/5">
                    <span className="font-mono font-bold text-xs text-slate-600">{bin.id}</span>
                    {isOccupied && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                </div>
                
                {!isOccupied ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[80px] text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        <span className="text-xs font-bold uppercase tracking-wider text-red-400">Empty Bin</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Material Info */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-white border border-green-200 text-green-800 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm truncate max-w-full">
                                    {materialCode}
                                </span>
                            </div>
                            {partNumber && <p className="text-[10px] text-slate-500 truncate">PN: {partNumber}</p>}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 text-center bg-white/60 p-2 rounded-lg">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Current</p>
                                <p className="font-bold text-lg text-slate-800 leading-tight">{currentQty}</p>
                                <p className="text-[9px] text-slate-400">{uom}</p>
                            </div>
                            <div className="flex flex-col justify-center gap-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400">Min</span>
                                    <span className="font-semibold text-slate-600">{minQty}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400">Max</span>
                                    <span className="font-semibold text-slate-600">{maxQty}</span>
                                </div>
                            </div>
                        </div>

                        {/* On Order Status */}
                        {orderedQty > 0 && (
                            <div className="flex items-center justify-center gap-1 text-[10px] bg-blue-100 text-blue-700 py-1 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 00-2-2V8m-9 4h4" /></svg>
                                <span className="font-bold">+{orderedQty} On Order</span>
                            </div>
                        )}
                        
                        <div className="text-[9px] text-slate-400 text-center pt-1 truncate" title={componentName}>
                            {componentName}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center">Loading warehouses...</div>;

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Warehouse</label>
                    <select 
                        value={selectedWarehouseId} 
                        onChange={e => setSelectedWarehouseId(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm"
                    >
                        <option value="">Choose a warehouse...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search Bins</label>
                    <Input 
                        id="binSearchInput"
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Bin ID, Part Number, Material..." 
                        disabled={!selectedWarehouseId}
                        label=""
                        containerClassName="mb-0"
                    />
                </div>
                <div className="w-32">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter Floor</label>
                     <select 
                        value={floorFilter} 
                        onChange={e => setFloorFilter(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm"
                        disabled={!selectedWarehouseId}
                    >
                        <option value="all">All Floors</option>
                        {uniqueFloors.map(f => <option key={f} value={f}>Floor {f}</option>)}
                    </select>
                </div>
            </div>

            {selectedWarehouseId && (
                <div className="flex-1 overflow-y-auto bg-white p-6 border rounded-lg min-h-[400px]">
                    {loadingBins ? (
                        <div className="text-center py-12 text-slate-500">Loading bin layout...</div>
                    ) : filteredBins.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">No bins found matching criteria.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredBins.map(bin => <BinCard key={bin.id} bin={bin} />)}
                        </div>
                    )}
                </div>
            )}
             {!selectedWarehouseId && (
                <div className="text-center py-12 text-slate-400 bg-white border rounded-lg border-dashed">
                    Select a warehouse to view bin layout.
                </div>
            )}
        </div>
    );
};

export default BinsTab;
