import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../types';
import CoreDetailsTab from './material_details/CoreDetailsTab';

interface MasterDataDetailViewProps {
  materialId: string;
  onBack: () => void;
  currentUser: AppUser;
  organisation: Organisation;
  theme: Organisation['theme'];
}

interface WarehouseLocation {
    id: string; // doc id
    path: string;
    departmentName: string;
    sectionName: string;
    bin: string;
    quantity: number;
    type: 'Created' | 'Extended';
    sectionId: string;
}

const MasterDataDetailView: React.FC<MasterDataDetailViewProps> = ({ materialId, onBack, currentUser, organisation, theme }) => {
    const [material, setMaterial] = useState<MaterialMasterData | null>(null);
    const [locations, setLocations] = useState<WarehouseLocation[]>([]);
    const [activeTab, setActiveTab] = useState<'details' | 'warehouses'>('details');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Master Data - Standardizing to compat
                const masterSnap = await db.doc(`organisations/${organisation.domain}/modules/IN/masterData/${materialId}`).get();
                
                if (!masterSnap.exists) {
                    setError("Material Master record not found.");
                    setLoading(false);
                    return;
                }

                const masterData = { id: masterSnap.id, ...masterSnap.data() } as MaterialMasterData;
                setMaterial(masterData);

                // 2. Fetch Warehouse Locations via Collection Group
                const q = db.collectionGroup('materials').where('documentId', '==', materialId);

                const unsub = q.onSnapshot((snapshot) => {
                    const locs: WarehouseLocation[] = [];
                    
                    snapshot.docs.forEach(doc => {
                        // Ensure it belongs to this organisation
                        if (doc.ref.path.startsWith(`organisations/${organisation.domain}`)) {
                            const data = doc.data();
                            const originSectionId = masterData.allocationLevel5Id;
                            const currentSectionId = data.allocationLevel5Id;
                            
                            // Determine if Created or Extended
                            const type = (originSectionId && currentSectionId && originSectionId === currentSectionId) 
                                ? 'Created' 
                                : 'Extended';

                            locs.push({
                                id: doc.id,
                                path: doc.ref.path,
                                departmentName: data.allocationLevel4Name || 'Unknown Dept',
                                sectionName: data.allocationLevel5Name || 'Unknown Section',
                                sectionId: currentSectionId,
                                bin: data.inventoryData?.bin || data.bin || 'Unassigned',
                                quantity: data.inventoryData?.issuableQuantity || 0,
                                type
                            });
                        }
                    });
                    
                    setLocations(locs.sort((a, b) => (a.sectionName || '').localeCompare(b.sectionName || '')));
                });

                return () => unsub();

            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [materialId, organisation.domain]);

    if (loading) return <div className="p-8 text-center">Loading master data details...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!material) return null;

    const TabButton: React.FC<{ id: string, label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id as any)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors duration-200 ${
                activeTab === id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeTab === id ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white rounded-lg shadow-md min-h-[500px] flex flex-col">
             {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-lg">
                <div>
                    <button onClick={onBack} className="text-sm hover:underline mb-2" style={{ color: theme.colorPrimary }}>&larr; Back to Registry</button>
                    <h1 className="text-2xl font-bold text-slate-800">Master Data Details</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-lg font-mono font-medium text-slate-600">{material.materialCode}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-lg text-slate-700">{material.procurementComponentName}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${material.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {material.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{material.materialTypeName}</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="border-b border-slate-200 px-6 bg-slate-50">
                <nav className="-mb-px flex space-x-6">
                    <TabButton id="details" label="Master Data Details" />
                    <TabButton id="warehouses" label="Warehouses" />
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white">
                {activeTab === 'details' && (
                    <CoreDetailsTab material={material} />
                )}

                {activeTab === 'warehouses' && (
                    <div className="p-6">
                         <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Warehouse Inventory</h3>
                            <p className="text-sm text-slate-500">Locations where this material number exists.</p>
                        </div>
                        
                        {locations.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed rounded-lg bg-slate-50">
                                <p className="text-slate-500">This material is not currently stocked in any warehouse.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden border rounded-lg">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Department</th>
                                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Section / Warehouse</th>
                                            <th className="px-6 py-3 text-center font-medium text-slate-500 uppercase">Origin Type</th>
                                            <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Bin</th>
                                            <th className="px-6 py-3 text-right font-medium text-slate-500 uppercase">Current Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {locations.map((loc) => (
                                            <tr key={loc.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 text-slate-700">{loc.departmentName}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{loc.sectionName}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${loc.type === 'Created' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                        {loc.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-slate-600">{loc.bin}</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                    {loc.quantity} <span className="font-normal text-xs text-slate-500">{material.inventoryData?.inventoryUom}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MasterDataDetailView;