
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, Organisation } from '../../types';
import type { HierarchyNode } from './HierarchyNodeModal';
import Button from '../Button';
import Input from '../Input';
import type { SpareType, StorageLocation } from '../../types/in_types';
import ConfirmationModal from '../common/ConfirmationModal';

interface WarehouseConfigurationProps {
  warehouseNode: HierarchyNode;
  onBack: () => void;
  currentUserProfile: AppUser;
  theme: Organisation['theme'];
  onViewMaterial: (materialPath: string) => void;
}

interface FloorConfig {
    shelfCount: number;
}
interface StructureConfig {
  floorCount: number;
  floors: FloorConfig[];
  columnCountPerShelf: number;
  rowCountPerColumn: number; // up to 26
  positionCountPerRow: number;
}

interface Bin {
    id: string; // The bin code e.g., AB-04-C-03
    floor: number;
    shelf: number;
    column: number;
    row: number;
    position: number;
    isEmpty: boolean;
    materialTypeId: string;
    materialTypeName: string;
    storageLocationTypeId: string;
    storageLocationTypeName: string;
    materialId?: string;
    materialCode?: string;
    partNumber?: string;
    currentQty?: number;
    minQty?: number;
    maxQty?: number;
}

interface PermittedTypesConfig {
    permittedMaterialTypeIds: string[];
    permittedLocationTypeIds: string[];
}

const numToShelfLetters = (num: number): string => {
    let letters = '';
    while (num > 0) {
      const remainder = (num - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      num = Math.floor((num - 1) / 26);
    }
    return letters;
};

const WarehouseConfiguration: React.FC<WarehouseConfigurationProps> = ({ warehouseNode, onBack, currentUserProfile, theme, onViewMaterial }) => {
  const [activeTab, setActiveTab] = useState('structure');
  const [loading, setLoading] = useState({
    structure: true,
    masterData: true,
    types: true,
    bins: false,
  });
  const [saving, setSaving] = useState(false);
  
  // State for config documents
  const [structureConfig, setStructureConfig] = useState<StructureConfig>({
    floorCount: 1,
    floors: [{ shelfCount: 1 }],
    columnCountPerShelf: 1,
    rowCountPerColumn: 1,
    positionCountPerRow: 1
  });
  const [permittedTypesConfig, setPermittedTypesConfig] = useState<PermittedTypesConfig>({
      permittedMaterialTypeIds: [],
      permittedLocationTypeIds: []
  });
  
  // Master Data
  const [spareTypes, setSpareTypes] = useState<SpareType[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  
  // Bins Creation State
  const [generationFloor, setGenerationFloor] = useState<string>('');
  const [generationShelf, setGenerationShelf] = useState<string>('');
  const [generatedForSelectedShelf, setGeneratedForSelectedShelf] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmGeneration, setConfirmGeneration] = useState(false);
  const [binConfig, setBinConfig] = useState<{ materialTypeId: string; locationTypeId: string }>({ materialTypeId: '', locationTypeId: '' });
  
  // Bins View State
  const [viewedBins, setViewedBins] = useState<Bin[]>([]);
  const [loadingViewedBins, setLoadingViewedBins] = useState(false);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const [binSearchTerm, setBinSearchTerm] = useState('');
  const [warehouseMaterials, setWarehouseMaterials] = useState<Record<string, any>>({});


  const warehouseDocPath = useMemo(() => warehouseNode.path, [warehouseNode.path]);
  const basePath = useMemo(() => warehouseDocPath ? `${warehouseDocPath}/warehouseConfiguration` : '', [warehouseDocPath]);

  // Fetch all configurations
  useEffect(() => {
    if (!basePath || !warehouseDocPath) {
        setLoading({ structure: false, masterData: false, bins: false, types: false });
        return;
    }

    const structureDocRef = db.doc(`${basePath}/structure`);
    const typesDocRef = db.doc(`${basePath}/types`);

    const unsubStructure = structureDocRef.onSnapshot((docSnap) => {
        const defaults = { floorCount: 1, floors: [{ shelfCount: 1 }], columnCountPerShelf: 1, rowCountPerColumn: 1, positionCountPerRow: 1 };
        if (docSnap.exists) {
            const data = docSnap.data() as Partial<StructureConfig>;
            const count = data.floorCount || 1;
            const floors = Array.from({ length: count }, (_, i) => data.floors?.[i] || { shelfCount: 1 });
            setStructureConfig({ ...defaults, ...data, floorCount: count, floors });
        } else {
            setStructureConfig(defaults);
        }
        setLoading(p => ({ ...p, structure: false }));
    });

    const unsubTypes = typesDocRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
            setPermittedTypesConfig(docSnap.data() as PermittedTypesConfig);
        } else {
            setPermittedTypesConfig({ permittedMaterialTypeIds: [], permittedLocationTypeIds: [] });
        }
        setLoading(p => ({ ...p, types: false }));
    });

    return () => { unsubStructure(); unsubTypes(); };
  }, [basePath, warehouseDocPath]);

  // Fetch bin count for the selected shelf
  useEffect(() => {
    if (!warehouseDocPath || !generationFloor || !generationShelf) {
        setGeneratedForSelectedShelf(0);
        return;
    }
    
    const fetchShelfCount = async () => {
        setLoading(p => ({...p, bins: true}));
        const binsCollectionRef = db.collection(`${warehouseDocPath}/bins`);
        const floorNum = Number(generationFloor);
        const shelfNum = Number(generationShelf);
        const q = binsCollectionRef.where('floor', '==', floorNum).where('shelf', '==', shelfNum);
        const snapshot = await q.get();
        setGeneratedForSelectedShelf(snapshot.size);
        setLoading(p => ({...p, bins: false}));
    };

    fetchShelfCount();
  }, [warehouseDocPath, generationFloor, generationShelf]);


  // Fetch master data for materials tab and bin creation
  useEffect(() => {
    setLoading(p => ({ ...p, masterData: true }));

    const spareTypesRef = db.collection('modules/IN/SpareTypes');
    const qSpareTypes = spareTypesRef.orderBy('name');
    const unsubSpareTypes = qSpareTypes.onSnapshot((snapshot) => {
        setSpareTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpareType)));
    });

    const storageLocationsRef = db.collection('modules/IN/StorageLocations');
    const qStorageLocations = storageLocationsRef.orderBy('name');
    const unsubStorageLocations = qStorageLocations.onSnapshot((snapshot) => {
        setStorageLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorageLocation)));
    });
    
    Promise.all([qSpareTypes.get(), qStorageLocations.get()]).finally(() => setLoading(p => ({...p, masterData: false})));

    return () => { unsubSpareTypes(); unsubStorageLocations(); };
  }, []);

  // Fetch bins and materials for Bins View tab
  useEffect(() => {
    if (activeTab === 'binsView' && warehouseDocPath) {
        setLoadingViewedBins(true);
        const binsCollectionRef = db.collection(`${warehouseDocPath}/bins`);
        let q;
        if (selectedFloorFilter === 'all') {
            q = binsCollectionRef.orderBy(firebase.firestore.FieldPath.documentId());
        } else {
            q = binsCollectionRef.where('floor', '==', Number(selectedFloorFilter)).orderBy(firebase.firestore.FieldPath.documentId());
        }

        const unsubscribeBins = q.onSnapshot((snapshot) => {
            setViewedBins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bin)));
            setLoadingViewedBins(false);
        }, (error) => {
            console.error("Error fetching bins:", error);
            setLoadingViewedBins(false);
        });

        // Fetch materials for real-time inventory data
        const materialsCollectionRef = db.collection(`${warehouseDocPath}/materials`);
        const unsubscribeMaterials = materialsCollectionRef.onSnapshot((snapshot) => {
             const matMap: Record<string, any> = {};
             snapshot.forEach(doc => {
                 matMap[doc.id] = doc.data();
             });
             setWarehouseMaterials(matMap);
        }, (error) => {
            console.error("Error fetching warehouse materials:", error);
        });

        return () => {
             unsubscribeBins();
             unsubscribeMaterials();
        };
    }
  }, [activeTab, selectedFloorFilter, warehouseDocPath]);

  const filteredBins = useMemo(() => {
    return viewedBins.filter(bin => {
        const floorMatch = selectedFloorFilter === 'all' || bin.floor === Number(selectedFloorFilter);
        const searchMatch = !binSearchTerm ||
            bin.id.toLowerCase().includes(binSearchTerm.toLowerCase()) ||
            bin.materialCode?.toLowerCase().includes(binSearchTerm.toLowerCase());
        return floorMatch && searchMatch;
    });
  }, [viewedBins, selectedFloorFilter, binSearchTerm]);


  const handleFloorCountChange = (count: number) => {
      const newCount = Math.max(1, count);
      setStructureConfig(prev => {
          const newFloors = Array.from({ length: newCount }, (_, i) => prev.floors[i] || { shelfCount: 1 });
          return { ...prev, floorCount: newCount, floors: newFloors };
      });
  };

  const handleShelfCountChange = (floorIndex: number, count: number) => {
      const newCount = Math.max(1, count);
      setStructureConfig(prev => {
          const newFloors = [...prev.floors];
          newFloors[floorIndex] = { ...newFloors[floorIndex], shelfCount: newCount };
          return { ...prev, floors: newFloors };
      });
  };
  
  const handleSaveStructure = async () => {
      setSaving(true);
      try {
          const docRef = db.doc(`${basePath}/structure`);
          await docRef.set(structureConfig);
          alert(`Structure saved!`);
      } catch (error) {
          console.error(`Error saving structure:`, error);
          alert(`Failed to save structure.`);
      } finally {
          setSaving(false);
      }
  };

  const handlePermittedTypeToggle = (type: 'materials' | 'locations', id: string) => {
      const key = type === 'materials' ? 'permittedMaterialTypeIds' : 'permittedLocationTypeIds';
      setPermittedTypesConfig(prev => ({
          ...prev,
          [key]: prev[key].includes(id) ? prev[key].filter(i => i !== id) : [...prev[key], id]
      }));
  };

  const handleSavePermittedTypes = async () => {
    setSaving(true);
    try {
        const docRef = db.doc(`${basePath}/types`);
        await docRef.set(permittedTypesConfig);
        alert('Permitted types saved!');
    } catch (error) {
        console.error('Error saving permitted types:', error);
        alert('Failed to save permitted types.');
    } finally {
        setSaving(false);
    }
  };

  const totalCapacity = useMemo(() => {
    return structureConfig.floors.reduce((total, floor) => {
        return total + (floor.shelfCount * structureConfig.columnCountPerShelf * structureConfig.rowCountPerColumn * structureConfig.positionCountPerRow);
    }, 0);
  }, [structureConfig]);

  const handleGenerateBinsForShelf = async () => {
    if (!generationFloor || !generationShelf) {
        alert("Please select a floor and a shelf to generate bins for.");
        setConfirmGeneration(false);
        return;
    }
    if (!binConfig.materialTypeId || !binConfig.locationTypeId) {
        alert("Please select both a material type and a storage location type.");
        setConfirmGeneration(false);
        return;
    }
    if (!warehouseDocPath) { alert("Cannot generate bins without a valid warehouse path."); return; }

    setIsGenerating(true);
    const binsCollectionRef = db.collection(`${warehouseDocPath}/bins`);
    const BATCH_SIZE = 450; // Firestore batch write limit is 500
    
    const floorIndex = Number(generationFloor) - 1;
    const floorNum = Number(generationFloor);
    const shelfNum = Number(generationShelf);
    
    try {
        let batch = db.batch();
        let writeCount = 0;
        
        const floorLetter = String.fromCharCode(65 + floorIndex);
        const shelfLetters = numToShelfLetters(shelfNum);

        const selectedMaterial = spareTypes.find(st => st.id === binConfig.materialTypeId);
        const selectedLocation = storageLocations.find(sl => sl.id === binConfig.locationTypeId);

        if (!selectedMaterial || !selectedLocation) {
            throw new Error("Selected material or location type not found.");
        }
        
        for (let c = 0; c < structureConfig.columnCountPerShelf; c++) {
            const colNum = c + 1;
            const colPadded = String(colNum).padStart(2, '0');

            for (let r = 0; r < structureConfig.rowCountPerColumn; r++) {
                const rowNum = r + 1;
                const rowLetter = String.fromCharCode(65 + r);

                for (let p = 0; p < structureConfig.positionCountPerRow; p++) {
                    const posNum = p + 1;
                    const posPadded = String(posNum).padStart(2, '0');
                    
                    const binCode = `${floorLetter}${shelfLetters}-${colPadded}-${rowLetter}-${posPadded}`;
                    
                    const binData: Omit<Bin, 'id'> = {
                        floor: floorNum, shelf: shelfNum, column: colNum, row: rowNum, position: posNum,
                        isEmpty: true,
                        materialTypeId: selectedMaterial.id,
                        materialTypeName: selectedMaterial.name,
                        storageLocationTypeId: selectedLocation.id,
                        storageLocationTypeName: selectedLocation.name,
                        materialId: '',
                        materialCode: '',
                        partNumber: '',
                        currentQty: 0,
                        minQty: 0,
                        maxQty: 0,
                    };
                    
                    const docRef = binsCollectionRef.doc(binCode);
                    batch.set(docRef, binData);
                    writeCount++;

                    if (writeCount >= BATCH_SIZE) {
                        await batch.commit();
                        batch = db.batch();
                        writeCount = 0;
                    }
                }
            }
        }
        
        if (writeCount > 0) { await batch.commit(); }

        const q = binsCollectionRef.where('floor', '==', floorNum).where('shelf', '==', shelfNum);
        const snapshot = await q.get();
        setGeneratedForSelectedShelf(snapshot.size);
        
        alert(`Successfully generated all bins for Shelf ${shelfLetters} on Floor ${floorLetter}.`);

    } catch (error) {
        console.error("Error generating bins:", error);
        alert('Failed to generate bins for the selected shelf.');
    } finally {
        setIsGenerating(false);
        setConfirmGeneration(false);
    }
  };

  const handleViewMaterialInBin = (assetId: string) => {
      // Correct path construction for inventory materials inside a warehouse
      const materialPath = `${warehouseNode.path}/materials/${assetId}`;
      onViewMaterial(materialPath);
  };

  const TabButton: React.FC<{ tabId: string; label: string }> = ({ tabId, label }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab !== tabId && 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  const renderStructureTab = () => {
    if (loading.structure) return <div className="p-8 text-center">Loading structure configuration...</div>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input id="floorCount" label="Number of Floors" type="number" value={structureConfig.floorCount} onChange={e => handleFloorCountChange(Number(e.target.value))} min={1} />
            <Input id="columnCountPerShelf" label="Columns per Shelf" type="number" value={structureConfig.columnCountPerShelf} onChange={e => setStructureConfig(p => ({...p, columnCountPerShelf: Math.max(1, Number(e.target.value))}))} min={1} />
            <Input id="rowCountPerColumn" label="Rows per Column (Max 26)" type="number" value={structureConfig.rowCountPerColumn} onChange={e => setStructureConfig(p => ({...p, rowCountPerColumn: Math.min(26, Math.max(1, Number(e.target.value))) }))} min={1} max={26} />
            <Input id="positionCountPerRow" label="Positions per Row" type="number" value={structureConfig.positionCountPerRow} onChange={e => setStructureConfig(p => ({...p, positionCountPerRow: Math.max(1, Number(e.target.value))}))} min={1} />
        </div>
        <div className="pt-4 border-t">
            <h4 className="font-semibold text-lg text-slate-700">Shelves per Floor</h4>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {structureConfig.floors.map((floor, index) => (
                    <Input id={`shelfCount-${index}`} key={index} label={`Shelves on Floor ${String.fromCharCode(65 + index)}`} type="number" value={floor.shelfCount} onChange={e => handleShelfCountChange(index, Number(e.target.value))} min={1} />
                ))}
            </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => handleSaveStructure()} isLoading={saving}>Save Structure</Button>
        </div>
      </div>
    );
  };
  
  const renderCapacityTab = () => {
      const binsPerColumn = structureConfig.rowCountPerColumn * structureConfig.positionCountPerRow;
      const binsPerRow = structureConfig.positionCountPerRow;

      return (
        <div className="space-y-6 text-center">
            <div className="p-6 bg-slate-100 rounded-lg">
                <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Total Warehouse Capacity</h4>
                <p className="text-5xl font-bold text-slate-800 mt-2">{totalCapacity.toLocaleString()}</p>
                <p className="text-slate-600">Total Bins</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-4 bg-slate-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Bins per Column</h4>
                    <p className="text-3xl font-bold text-slate-700 mt-1">{binsPerColumn.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Rows per Column</h4>
                    <p className="text-3xl font-bold text-slate-700 mt-1">{structureConfig.rowCountPerColumn.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Positions per Row</h4>
                    <p className="text-3xl font-bold text-slate-700 mt-1">{binsPerRow.toLocaleString()}</p>
                 </div>
            </div>
        </div>
      );
  };

  const renderMaterialsTab = () => {
    if (loading.masterData || loading.types) return <div className="p-8 text-center">Loading...</div>;

    const renderSelectorList = (title: string, data: (SpareType | StorageLocation)[], selectedIds: string[], type: 'materials' | 'locations') => (
       <div>
          <h4 className="font-semibold text-lg text-slate-700 mb-2">{title}</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto p-4 border rounded-lg bg-slate-50">
              {data.map(item => (
                  <label key={item.id} className="flex items-center space-x-3 p-2 bg-white rounded-md border has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300 cursor-pointer">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handlePermittedTypeToggle(type, item.id)} className="h-4 w-4 rounded" />
                      <div>
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                  </label>
              ))}
          </div>
       </div>
    );

    return (
        <div className="space-y-8">
            <p className="text-sm text-slate-600">Select all material types and storage location types that are permitted to be stored in this warehouse. These selections will be available when creating bins.</p>
            {renderSelectorList('Permitted Material Types', spareTypes, permittedTypesConfig.permittedMaterialTypeIds, 'materials')}
            {renderSelectorList('Permitted Storage Location Types', storageLocations, permittedTypesConfig.permittedLocationTypeIds, 'locations')}
            <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSavePermittedTypes} isLoading={saving}>Save Permitted Types</Button>
            </div>
        </div>
    );
  };
  
  const renderBinsCreationTab = () => {
    if (loading.structure || loading.masterData || loading.types) return <div className="p-8 text-center">Loading...</div>;
    
    const permittedMaterials = spareTypes.filter(st => permittedTypesConfig.permittedMaterialTypeIds.includes(st.id));
    const permittedLocations = storageLocations.filter(sl => permittedTypesConfig.permittedLocationTypeIds.includes(sl.id));

    if (permittedMaterials.length === 0 || permittedLocations.length === 0) {
        return <p className="text-center text-yellow-700 font-semibold p-4 bg-yellow-50 rounded-md">Please configure and save at least one Material Type and one Storage Location Type in the "Type of Materials" tab before generating bins.</p>
    }

    const selectedFloorIndex = Number(generationFloor) - 1;
    const shelfCountForFloor = generationFloor ? structureConfig.floors[selectedFloorIndex]?.shelfCount : 0;
    const shelfOptions = Array.from({ length: shelfCountForFloor }, (_, i) => i + 1);

    const capacityForSelectedShelf = structureConfig.columnCountPerShelf * structureConfig.rowCountPerColumn * structureConfig.positionCountPerRow;
    const isShelfFull = capacityForSelectedShelf > 0 && generatedForSelectedShelf >= capacityForSelectedShelf;

    return (
        <div className="space-y-6">
             <div className="p-6 bg-slate-100 rounded-lg">
                <h4 className="text-lg font-semibold text-slate-700 mb-2">Generate Bins Sequentially by Shelf</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input as="select" id="genFloor" label="1. Select Floor" value={generationFloor} onChange={e => { setGenerationFloor(e.target.value); setGenerationShelf(''); }}>
                        <option value="">Select a Floor...</option>
                        {Array.from({ length: structureConfig.floorCount }, (_, i) => i + 1).map(floorNum => (
                             <option key={floorNum} value={floorNum}>Floor {String.fromCharCode(64 + floorNum)}</option>
                        ))}
                    </Input>
                    <Input as="select" id="genShelf" label="2. Select Shelf" value={generationShelf} onChange={e => setGenerationShelf(e.target.value)} disabled={!generationFloor}>
                        <option value="">Select a Shelf...</option>
                        {shelfOptions.map(shelfNum => (
                            <option key={shelfNum} value={shelfNum}>Shelf {numToShelfLetters(shelfNum)}</option>
                        ))}
                    </Input>
                </div>
            </div>
            
            {generationShelf && (
                <div className="space-y-4 pt-4 border-t">
                     <div className="p-4 bg-slate-50 rounded-lg text-center">
                        <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Status for Shelf {numToShelfLetters(Number(generationShelf))}</h4>
                        <p className="text-4xl font-bold text-slate-800 mt-2">{generatedForSelectedShelf.toLocaleString()} / {capacityForSelectedShelf.toLocaleString()}</p>
                        <p className="text-slate-600">Bins Generated</p>
                    </div>

                    {isShelfFull ? (
                         <p className="text-center text-green-700 font-semibold p-4 bg-green-50 rounded-md">All bins have been generated for this shelf.</p>
                    ) : (
                        <div>
                             <h4 className="font-semibold text-lg text-slate-700">Configure Bins for this Shelf</h4>
                             <p className="text-sm text-slate-500 mb-4">All bins generated for this shelf will be assigned the following types. This can be changed later.</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input as="select" id="matType" label="Material Type" value={binConfig.materialTypeId} onChange={e => setBinConfig(p => ({...p, materialTypeId: e.target.value}))} required>
                                    <option value="">Select...</option>
                                    {permittedMaterials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </Input>
                                <Input as="select" id="locType" label="Storage Location Type" value={binConfig.locationTypeId} onChange={e => setBinConfig(p => ({...p, locationTypeId: e.target.value}))} required>
                                    <option value="">Select...</option>
                                    {permittedLocations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </Input>
                            </div>
                            <div className="text-center pt-6">
                                <Button onClick={() => setConfirmGeneration(true)} disabled={isGenerating} isLoading={isGenerating}>Generate Bins for Shelf {numToShelfLetters(Number(generationShelf))}</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <ConfirmationModal 
                isOpen={confirmGeneration} 
                onClose={() => setConfirmGeneration(false)} 
                onConfirm={handleGenerateBinsForShelf} 
                title="Confirm Bin Generation" 
                message={`This will generate all ${capacityForSelectedShelf} bins for Shelf ${numToShelfLetters(Number(generationShelf))} on Floor ${String.fromCharCode(64 + Number(generationFloor))}. Existing bins on this shelf will be overwritten. Are you sure?`} 
                isLoading={isGenerating} 
            />
        </div>
    );
  };
  
  const renderBinsViewTab = () => {
    if (loadingViewedBins) return <div className="p-8 text-center">Loading bins...</div>;
    const floorOptions = Array.from({ length: structureConfig.floorCount }, (_, i) => i + 1);
    
    const BinCard: React.FC<{ bin: Bin }> = ({ bin }) => {
        const containerClasses = bin.isEmpty
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800';
        const emptyTextClass = 'text-red-700';
        const monoBgClass = bin.isEmpty ? 'bg-red-100' : 'bg-green-100';
        
        // Retrieve real-time material data from warehouseMaterials state
        const materialData = bin.materialId ? warehouseMaterials[bin.materialId] : undefined;
        
        const currentQty = materialData?.inventoryData?.issuableQuantity ?? bin.currentQty ?? 0;
        const minQty = materialData?.inventoryData?.minStockLevel ?? bin.minQty ?? 0;
        const maxQty = materialData?.inventoryData?.maxStockLevel ?? bin.maxQty ?? 0;
        const reservedQty = materialData?.inventoryData?.reservedQuantity ?? 0;
        const orderedQty = materialData?.inventoryData?.orderedQuantity ?? 0;
        
        const cardContent = (
            <>
                <h4 className="font-bold font-mono text-slate-800 text-center mb-2 text-base">{bin.id}</h4>
                <div className="space-y-1 flex-grow">
                    <p><strong>Type:</strong> <span className="font-medium">{bin.materialTypeName}</span></p>
                    <div className="pt-2 border-t mt-2" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                        {bin.isEmpty ? (
                            <div className="flex items-center justify-center h-full min-h-[4rem]">
                                <p className={`font-semibold text-center ${emptyTextClass}`}>EMPTY</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                 <p><strong>Material:</strong> <span className={`font-mono text-xs ${monoBgClass} p-1 rounded`}>{bin.materialCode || 'N/A'}</span></p>
                                 <p><strong>Part No:</strong> {bin.partNumber || 'N/A'}</p>
                            </div>
                        )}
                    </div>
                    {!bin.isEmpty && (
                         <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t mt-2" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                            <div>
                                <p className="text-xs text-slate-500">Min</p>
                                <p className="font-semibold">{minQty}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Current</p>
                                <p className="font-semibold text-lg" style={{color: theme.colorPrimary}}>{currentQty}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Max</p>
                                <p className="font-semibold">{maxQty}</p>
                            </div>
                            <div className="col-span-3 flex justify-around pt-2 border-t border-dashed border-slate-300">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Ordered</p>
                                    <p className="font-semibold text-sm text-blue-600">{orderedQty}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Reserved</p>
                                    <p className="font-semibold text-sm text-orange-600">{reservedQty}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );

        if (!bin.isEmpty && bin.materialId) {
            return (
                <button
                    type="button"
                    onClick={() => handleViewMaterialInBin(bin.materialId!)}
                    className={`border rounded-lg shadow-sm p-3 flex flex-col text-sm text-left w-full transition-all duration-150 ease-in-out hover:shadow-md hover:-translate-y-px ${containerClasses}`}
                >
                    {cardContent}
                </button>
            );
        }

        return (
            <div className={`border rounded-lg shadow-sm p-3 flex flex-col text-sm ${containerClasses}`}>
                {cardContent}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                <Input as="select" id="floorFilter" label="Filter by Floor" value={selectedFloorFilter} onChange={e => setSelectedFloorFilter(e.target.value)}>
                    <option value="all">All Floors</option>
                    {floorOptions.map(f => <option key={f} value={f}>{`Floor ${String.fromCharCode(64 + f)}`}</option>)}
                </Input>
                <Input id="binSearch" label="Search Bin/Material Code" value={binSearchTerm} onChange={e => setBinSearchTerm(e.target.value)} containerClassName="md:col-span-2"/>
            </div>
            {filteredBins.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredBins.map(bin => <BinCard key={bin.id} bin={bin} />)}
                 </div>
            ) : (
                <p className="text-center text-slate-500 py-8">No bins found for the current filter.</p>
            )}
        </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'structure': return renderStructureTab();
      case 'capacity': return renderCapacityTab();
      case 'materials': return renderMaterialsTab();
      case 'binsCreation': return renderBinsCreationTab();
      case 'binsView': return renderBinsViewTab();
      default: return null;
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm">
      <button onClick={onBack} className="text-sm hover:underline mb-4" style={{ color: theme.colorPrimary }}>&larr; Back to Hierarchy</button>
      <h2 className="text-2xl font-bold text-slate-800">Warehouse Configuration</h2>
      <p className="text-slate-600 mb-6">{warehouseNode.name} ({warehouseNode.code})</p>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          <TabButton tabId="structure" label="Structure" />
          <TabButton tabId="capacity" label="Capacity" />
          <TabButton tabId="materials" label="Type of Materials" />
          <TabButton tabId="binsCreation" label="Bins Creation" />
          <TabButton tabId="binsView" label="Bins View" />
        </nav>
      </div>
      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
};

export default WarehouseConfiguration;
