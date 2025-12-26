
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { MaterialMasterData, Organisation } from '../../../../types';
import Button from '../../../Button';

const WarehousedTab: React.FC<{ material: MaterialMasterData; organisation: Organisation; onSwitchToWarehouse?: (id: string, path: string) => void; theme: Organisation['theme'] }> = ({ material, organisation, onSwitchToWarehouse, theme }) => {
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const q = db.collectionGroup('materials')
            .where('documentId', '==', material.id);
            
        const unsub = q.onSnapshot(snapshot => {
            const locs = snapshot.docs
                .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(doc => {
                    const data = doc.data();
                    
                    return {
                        id: doc.id,
                        path: doc.ref.path,
                        warehouseName: data.allocationLevel5Name || 'Unknown Section',
                        deptName: data.allocationLevel4Name || 'Unknown Dept',
                        qty: data.inventoryData?.issuableQuantity || 0,
                        status: data.inventoryData?.stockStatus || 'Unrestricted',
                        bin: data.inventoryData?.bin || data.bin || 'Unassigned'
                    };
                });
            setLocations(locs);
            setLoading(false);
        });
        return () => unsub();
    }, [material.id, organisation.domain]);

    if (loading) return <div className="p-8 text-center">Loading locations...</div>;

    return (
        <div className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Warehouse Locations</h3>
            {locations.length === 0 ? (
                <p className="text-slate-500 italic">This material is defined in Master Data but not currently stocked in any warehouse.</p>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Department</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Section / Warehouse</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Bin</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Quantity</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {locations.map(loc => (
                                <tr key={loc.path} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-700">{loc.deptName}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{loc.warehouseName}</td>
                                    <td className="px-4 py-3 font-mono text-slate-600">{loc.bin}</td>
                                    <td className="px-4 py-3 text-right font-bold">{loc.qty}</td>
                                    <td className="px-4 py-3 text-center">{loc.status}</td>
                                    <td className="px-4 py-3 text-right">
                                        <Button 
                                            onClick={() => onSwitchToWarehouse && onSwitchToWarehouse(material.id, loc.path)}
                                            className="!w-auto !py-1 !px-3 text-xs"
                                        >
                                            Manage
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default WarehousedTab;
