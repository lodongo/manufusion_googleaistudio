import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { AppUser, Organisation, MaterialMasterData, InventoryData, ProcurementData } from '../../../types';
import { ConfigurationProgress } from './material_details/Shared';
import MaterialDashboardTab from './material_details/MaterialDashboardTab';
import MaterialAnalyticsTab from './material_details/MaterialAnalyticsTab';
import MasterDataInfoTab from './material_details/MasterDataInfoTab';
import WarehousedTab from './material_details/WarehousedTab';
import BinningTab from './material_details/BinningTab';
import InventoryDataTab from './material_details/InventoryDataTab';
import ProcurementDataTab from './material_details/ProcurementDataTab';
import MaterialClassificationTab from './material_details/MaterialClassificationTab';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface MaterialDetailPageProps {
  materialId?: string;
  materialPath?: string;
  onBack: () => void;
  currentUser: AppUser;
  organisation: Organisation;
  theme: Organisation['theme'];
  onNavigateToMaterial?: (id: string, path?: string, tab?: string) => void;
  currencyConfig: { local: string; base: string; rate: number };
  initialTab?: string;
}

type TabId = 'dashboard' | 'analytics' | 'masterDataInfo' | 'warehoused' | 'binning' | 'inventoryData' | 'procurementData' | 'materialClassification';

export const MaterialDetailPage: React.FC<MaterialDetailPageProps> = ({ materialId, materialPath, onBack, currentUser, organisation, theme, onNavigateToMaterial, currencyConfig, initialTab }) => {
    const [material, setMaterial] = useState<MaterialMasterData | null>(null);
    const [warehouseMaterialPath, setWarehouseMaterialPath] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>((initialTab as TabId) || 'dashboard');
    
    // Extract warehouse path part if in warehouse view (removes "/materials/docId")
    const warehousePath = warehouseMaterialPath ? warehouseMaterialPath.split('/').slice(0, -2).join('/') : null;

    const viewMode = materialPath ? 'warehouse' : 'master';

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab as TabId);
        }
    }, [initialTab]);

    useEffect(() => {
        const fetchMaterial = async () => {
            setLoading(true);
            setError('');
            try {
                let masterData: MaterialMasterData;
                
                if (materialPath) {
                    // Fetch Warehouse Record
                    const docRef = db.doc(materialPath);
                    const snap = await docRef.get();
                    
                    if (snap.exists) {
                        const whData = snap.data();
                        
                        // Fetch Master Record
                        const masterRef = db.doc(`organisations/${organisation.domain}/modules/IN/masterData/${whData.documentId}`);
                        const masterSnap = await masterRef.get();
                        
                        if (masterSnap.exists) {
                            masterData = { id: masterSnap.id, ...masterSnap.data() } as MaterialMasterData;
                            
                            // MERGE LOGIC: Warehouse Data overrides Master Data for specific fields
                            const mergedInventoryData = {
                                ...masterData.inventoryData,
                                ...whData.inventoryData,
                                minStockLevel: whData.inventoryData?.minStockLevel ?? masterData.inventoryData?.minStockLevel,
                                maxStockLevel: whData.inventoryData?.maxStockLevel ?? masterData.inventoryData?.maxStockLevel,
                                reorderPointQty: whData.inventoryData?.reorderPointQty ?? masterData.inventoryData?.reorderPointQty,
                                safetyStockQty: whData.inventoryData?.safetyStockQty ?? masterData.inventoryData?.safetyStockQty,
                                stockLevelDetermination: whData.inventoryData?.stockLevelDetermination ?? masterData.inventoryData?.stockLevelDetermination
                            };

                            const mergedProcurementData = {
                                ...masterData.procurementData,
                                ...whData.procurementData
                            };

                            masterData.inventoryData = mergedInventoryData;
                            masterData.procurementData = mergedProcurementData;
                            
                            if (masterData.inventoryData) {
                                masterData.inventoryData.bin = whData.inventoryData?.bin || whData.bin; 
                            }
                            
                            setWarehouseMaterialPath(materialPath);
                        } else {
                            throw new Error("Master data record not found.");
                        }
                    } else {
                         throw new Error("Warehouse material record not found.");
                    }
                } else if (materialId) {
                     const masterRef = db.doc(`organisations/${organisation.domain}/modules/IN/masterData/${materialId}`);
                     const masterSnap = await masterRef.get();
                     if(masterSnap.exists) {
                         masterData = { id: masterSnap.id, ...masterSnap.data() } as MaterialMasterData;
                     } else {
                         throw new Error("Material not found.");
                     }
                } else {
                    throw new Error("No material identifier provided.");
                }
                setMaterial(masterData!);
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMaterial();
    }, [materialId, materialPath, organisation.domain]);

    const handleInventoryUpdate = (newData: InventoryData) => {
        setMaterial(prev => prev ? ({ ...prev, inventoryData: newData }) : null);
    };

    const handleProcurementUpdate = (newData: ProcurementData) => {
        setMaterial(prev => prev ? ({ ...prev, procurementData: newData }) : null);
    };

    const TabButton: React.FC<{ tabId: TabId; label: string }> = ({ tabId, label }) => (
        <button
          onClick={() => setActiveTab(tabId)}
          className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
            activeTab === tabId ? '' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
          {label}
        </button>
    );

    if (loading) return <div className="p-8 text-center">Loading material details...</div>;
    if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-b-lg">{error} <br/><button onClick={onBack} className="underline mt-4">Go Back</button></div>;
    if (!material) return null;

    const invMandatory = ['inventoryUom', 'inventoryValuationMethod', 'stockLevelDetermination'];
    if (material.inventoryData?.stockLevelDetermination === 'Manual') {
        invMandatory.push('minStockLevel', 'maxStockLevel', 'reorderPointQty', 'safetyStockQty');
    }
    const invCompleted = invMandatory.filter(f => (material.inventoryData as any)?.[f] !== undefined && (material.inventoryData as any)?.[f] !== '').length;
    
    const procMandatory = ['procurementType', 'standardPrice', 'orderUnit', 'purchasingProcessingDays', 'plannedDeliveryDays', 'grProcessingDays'];
    const procCompleted = procMandatory.filter(f => (material.procurementData as any)?.[f] !== undefined && (material.procurementData as any)?.[f] !== '').length;

    const critMandatory = ['criticalityRiskHSE', 'criticalityProductionImpact', 'criticalityImpactQuality', 'criticalityStandbyAvailable', 'criticalityFailureFrequency', 'criticalityRepairTime'];
    const critCompleted = critMandatory.filter(f => (material.inventoryData as any)?.[f] !== undefined).length; 

    let totalFields = invMandatory.length + procMandatory.length + critMandatory.length;
    let totalCompleted = invCompleted + procCompleted + critCompleted;
    
    const handleSwitchToWarehouse = (id: string, path: string) => {
        if (onNavigateToMaterial) {
            onNavigateToMaterial(id, path);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md min-h-screen">
            <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-20">
                <div>
                    <button onClick={onBack} className="text-sm hover:underline mb-2" style={{ color: theme.colorPrimary }}>&larr; Back</button>
                    <h1 className="text-2xl font-bold text-slate-800">{material.procurementComponentName}</h1>
                    <div className="flex items-center gap-3 mt-1">
                         <p className="text-slate-500 font-mono">{material.materialCode}</p>
                         <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">{viewMode === 'master' ? 'Master Record' : 'Warehouse View'}</span>
                    </div>
                </div>
                {viewMode === 'warehouse' && (
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Config Status</p>
                            <div className="w-32">
                                <ConfigurationProgress total={totalFields} completed={totalCompleted} label="" color={theme.colorSecondary} />
                            </div>
                        </div>
                        <div className="text-right border-l pl-6">
                            <p className="text-sm text-slate-500">Stock On Hand</p>
                            <p className="text-3xl font-bold" style={{color: theme.colorPrimary}}>{material.inventoryData?.issuableQuantity || 0} <span className="text-sm font-normal text-slate-400">{material.inventoryData?.inventoryUom}</span></p>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="border-b border-slate-200 overflow-x-auto bg-slate-50">
                <nav className="-mb-px flex space-x-6 px-6">
                    <TabButton tabId="dashboard" label="Dashboard" />
                    <TabButton tabId="masterDataInfo" label="Master Data Info" />
                    
                    {viewMode === 'master' ? (
                        <TabButton tabId="warehoused" label="Warehoused" />
                    ) : (
                        <>
                            <TabButton tabId="binning" label="Binning" />
                            <TabButton tabId="inventoryData" label="Inventory Data" />
                            <TabButton tabId="procurementData" label="Procurement Data" />
                            <TabButton tabId="materialClassification" label="Material Classification" />
                        </>
                    )}
                    
                    <TabButton tabId="analytics" label="Analytics & Forecasting" />
                </nav>
            </div>

            <div className="bg-white min-h-[500px]">
                {activeTab === 'dashboard' && <MaterialDashboardTab material={material} organisation={organisation} warehousePath={warehousePath} currencyConfig={currencyConfig} />}
                {activeTab === 'masterDataInfo' && <MasterDataInfoTab material={material} />}
                
                 {activeTab === 'warehoused' && viewMode === 'master' && (
                    <WarehousedTab 
                        material={material} 
                        organisation={organisation} 
                        theme={theme} 
                        onSwitchToWarehouse={handleSwitchToWarehouse}
                    />
                )}
                
                {viewMode === 'warehouse' && (
                    <>
                        {activeTab === 'binning' && <BinningTab material={material} organisation={organisation} theme={theme} warehouseMaterialPath={warehouseMaterialPath} />}
                        {activeTab === 'inventoryData' && <InventoryDataTab material={material} warehouseMaterialPath={warehouseMaterialPath} onUpdate={handleInventoryUpdate} />}
                        {activeTab === 'procurementData' && <ProcurementDataTab material={material} warehouseMaterialPath={warehouseMaterialPath} onUpdate={handleProcurementUpdate} organisation={organisation} currencyConfig={currencyConfig} />}
                        {activeTab === 'materialClassification' && (
                            <MaterialClassificationTab 
                                material={material} 
                                warehouseMaterialPath={warehouseMaterialPath} 
                                organisation={organisation} 
                                currencyConfig={currencyConfig}
                                theme={theme}
                            />
                        )}
                    </>
                )}

                {activeTab === 'analytics' && (
                    <MaterialAnalyticsTab 
                        material={material} 
                        organisation={organisation} 
                        warehousePath={warehouseMaterialPath}
                        currencyConfig={currencyConfig} 
                        theme={theme}
                        onUpdate={handleInventoryUpdate} 
                    />
                )}
            </div>
        </div>
    );
};
