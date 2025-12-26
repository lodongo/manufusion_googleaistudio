import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { doc, updateDoc, Timestamp, collection, addDoc, runTransaction } from 'firebase/firestore';
import type { Organisation, MaterialMasterData } from '../../../../types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { useAuth } from '../../../../context/AuthContext';

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

const BinningTab: React.FC<{ material: MaterialMasterData; organisation: Organisation; theme: Organisation['theme']; warehouseMaterialPath: string | null; }> = ({ material, organisation, theme, warehouseMaterialPath }) => {
    const { currentUserProfile } = useAuth();
    const [binnedLocation, setBinnedLocation] = useState<string | null>(null);
    const [availableBins, setAvailableBins] = useState<Bin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ action: 'bin' | 'unlink'; binId: string } | null>(null);

    const warehousePath = useMemo(() => {
        if (warehouseMaterialPath) {
            const parts = warehouseMaterialPath.split('/');
            return parts.slice(0, -2).join('/') + '/bins';
        }
        return null;
    }, [warehouseMaterialPath]);

    useEffect(() => {
        if (!warehousePath) {
            setError("Material allocation is incomplete. Cannot determine warehouse location.");
            setLoading(false);
            return;
        }

        const binsCollectionRef = db.collection(warehousePath);
        setLoading(true);
        setError('');

        const qBinned = binsCollectionRef.where("materialId", "==", material.id);
        const unsub = qBinned.onSnapshot(snapshot => {
            if (!snapshot.empty) {
                setBinnedLocation(snapshot.docs[0].id);
                setAvailableBins([]); 
                setLoading(false);
            } else {
                setBinnedLocation(null);
                const qAvailable = binsCollectionRef
                    .where("materialTypeId", "==", material.materialTypeCode)
                    .where("isEmpty", "==", true);
                    
                qAvailable.onSnapshot(availableSnapshot => {
                    setAvailableBins(availableSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bin)));
                    setLoading(false);
                }, err => {
                    setError("Failed to fetch available bins.");
                    setLoading(false);
                });
            }
        }, err => {
            setError("Failed to check binning status.");
            setLoading(false);
        });

        return () => unsub();
    }, [material.id, material.materialTypeCode, warehousePath]);
    
    const handleBinningAction = async () => {
        if (!confirmAction || !warehousePath || !warehouseMaterialPath) {
            setConfirmAction(null);
            return;
        }
        
        setIsSaving(true);
        setError('');
        
        const { action, binId } = confirmAction;
        const binRef = doc(db, `${warehousePath}/${binId}`);
        const materialInWarehouseRef = doc(db, warehouseMaterialPath);
        const orgDomain = warehouseMaterialPath.split('/')[1];
        const activityRef = collection(db, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);

        try {
            await runTransaction(db, async (transaction) => {
                if (action === 'bin') {
                    transaction.update(binRef, {
                        isEmpty: false,
                        materialId: material.id,
                        materialCode: material.materialCode,
                        partNumber: material.oemPartNumber || material.ocmPartNumber || '',
                        minQty: material.inventoryData?.minStockLevel || 0,
                        maxQty: material.inventoryData?.maxStockLevel || 0,
                        currentQty: 0
                    });
                    transaction.update(materialInWarehouseRef, { 
                        'inventoryData.bin': binId,
                        'bin': binId
                    });

                    // Log Activity
                    const newLogRef = doc(activityRef);
                    transaction.set(newLogRef, {
                        timestamp: Timestamp.now(),
                        userName: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`,
                        tab: 'Binning',
                        action: 'Material Binned',
                        details: `Assigned material to bin ${binId}.`
                    });
    
                } else { 
                    transaction.update(binRef, {
                        isEmpty: true,
                        materialId: '',
                        materialCode: '',
                        partNumber: '',
                        minQty: 0,
                        maxQty: 0,
                        currentQty: 0
                    });
                    transaction.update(materialInWarehouseRef, { 
                        'inventoryData.bin': '',
                        'bin': ''
                    });

                    // Log Activity
                    const newLogRef = doc(activityRef);
                    transaction.set(newLogRef, {
                        timestamp: Timestamp.now(),
                        userName: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`,
                        tab: 'Binning',
                        action: 'Material Unlinked',
                        details: `Removed material from bin ${binId}.`
                    });
                }
            });

        } catch (err: any) {
            console.error(err);
            setError(`Failed to ${action} material. Please try again.`);
        } finally {
            setIsSaving(false);
            setConfirmAction(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Checking binning status...</div>;
    }
    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-50 rounded-b-lg">{error}</div>;
    }

    return (
        <div className="p-6 space-y-4">
            {binnedLocation ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm text-green-700">This material is located in:</p>
                    <p className="text-3xl font-bold font-mono text-green-800 my-2">{binnedLocation}</p>
                    <Button
                        variant="secondary"
                        className="!w-auto !bg-yellow-100 !text-yellow-800"
                        onClick={() => setConfirmAction({ action: 'unlink', binId: binnedLocation })}
                    >
                        Unlink from Bin
                    </Button>
                </div>
            ) : (
                <div>
                    <h3 className="text-lg font-semibold text-slate-700">Available Bins</h3>
                    <p className="text-sm text-slate-500">
                        Showing empty bins matching material type: <span className="font-semibold">{material.materialTypeName}</span>
                    </p>
                    {availableBins.length > 0 ? (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">Bin Code</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {availableBins.map(bin => (
                                        <tr key={bin.id}>
                                            <td className="px-4 py-3 font-mono text-sm text-slate-700">{bin.id}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button 
                                                    onClick={() => setConfirmAction({ action: 'bin', binId: bin.id })}
                                                    className="!w-auto !py-1 !px-3 text-xs"
                                                >
                                                    Assign
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-slate-500 py-8 border rounded-lg mt-4">No empty bins available for this material type.</p>
                    )}
                </div>
            )}
            
            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleBinningAction}
                title={confirmAction?.action === 'bin' ? "Assign to Bin" : "Unlink from Bin"}
                message={confirmAction?.action === 'bin' 
                    ? `Are you sure you want to assign this material to bin ${confirmAction.binId}?` 
                    : "Are you sure you want to unlink this material from its current bin? The bin will become empty."}
                isLoading={isSaving}
            />
        </div>
    );
};

export default BinningTab;