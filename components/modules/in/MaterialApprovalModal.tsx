import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../types';
import Modal from '../../common/Modal';
import Button from '../../Button';
import Input from '../../Input';
import ConfirmationModal from '../../common/ConfirmationModal';

const { Timestamp } = firebase.firestore;

interface MaterialApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialMasterData & { type?: 'EXTENSION' | 'REMOVAL' | 'NEW_MATERIAL', materialName?: string, materialId?: string };
  currentUser: AppUser;
  organisation: Organisation;
  theme: Organisation['theme'];
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div className="py-2">
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm text-slate-900">{value || children || 'N/A'}</dd>
    </div>
);

const MaterialApprovalModal: React.FC<MaterialApprovalModalProps> = ({ isOpen, onClose, material, currentUser, organisation, theme }) => {
    const [loadingAction, setLoadingAction] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejection, setShowRejection] = useState(false);
    const [error, setError] = useState('');
    const [confirmState, setConfirmState] = useState({ isOpen: false, onConfirm: () => {}, title: '', message: '' });
    const [locationData, setLocationData] = useState<any>(null);

    const requestType = material.type || 'NEW_MATERIAL';
    const collectionPath = requestType === 'NEW_MATERIAL' ? 'masterData' : 'extensions';

    // Fetch location details
    useEffect(() => {
        const fetchLocation = async () => {
            if (requestType === 'NEW_MATERIAL') {
                // For new materials, check sub-collection - Standardizing to compat
                const requestDetailsRef = db.doc(`organisations/${organisation.domain}/modules/IN/masterData/${material.id}/requests/requestDetails`);
                try {
                    const docSnap = await requestDetailsRef.get();
                    if (docSnap.exists) {
                        setLocationData(docSnap.data());
                    } else {
                         setLocationData({
                            allocationLevel4Name: material.allocationLevel4Name,
                            allocationLevel5Name: material.allocationLevel5Name,
                            allocationLevel4Id: material.allocationLevel4Id,
                            allocationLevel5Id: material.allocationLevel5Id,
                            allocationLevel1Id: material.allocationLevel1Id,
                            allocationLevel2Id: material.allocationLevel2Id,
                            allocationLevel3Id: material.allocationLevel3Id,
                        });
                    }
                } catch (e) { console.error("Error fetching location details", e); }
            } else {
                // For extensions/removals, location is on the document itself
                setLocationData({
                    allocationLevel4Name: material.allocationLevel4Name,
                    allocationLevel5Name: material.allocationLevel5Name,
                    allocationLevel4Id: material.allocationLevel4Id,
                    allocationLevel5Id: material.allocationLevel5Id,
                    // Need full hierarchy IDs for path construction
                    allocationLevel1Id: material.allocationLevel1Id,
                    allocationLevel2Id: material.allocationLevel2Id,
                    allocationLevel3Id: material.allocationLevel3Id
                });
            }
        };
        if (isOpen) {
            fetchLocation();
        }
    }, [isOpen, material.id, organisation.domain, requestType, material]);

    const handleApprove = async (level: 1 | 2 | 3) => {
        setLoadingAction(true);
        setError('');

        const docRef = db.doc(`organisations/${organisation.domain}/modules/IN/${collectionPath}/${material.id}`);

        try {
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists) throw new Error("Request document not found.");
                
                const currentData = docSnap.data() as any;
                
                const updatePayload: any = {};
                updatePayload[`approver${level}`] = true;
                updatePayload[`approver${level}By`] = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
                updatePayload[`approver${level}At`] = Timestamp.now();

                const isFinalApproval = level === 3 && currentData.approver1 && currentData.approver2;
                
                if (isFinalApproval) {
                    updatePayload.status = 'Approved';
                    updatePayload.approvedBy = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
                    updatePayload.approvedAt = Timestamp.now();

                    if (requestType === 'NEW_MATERIAL') {
                        // --- Logic for NEW MATERIAL ---
                        const requestDetailsRef = db.doc(`organisations/${organisation.domain}/modules/IN/masterData/${material.id}/requests/requestDetails`);
                        const detailsDoc = await transaction.get(requestDetailsRef);
                        const locData = detailsDoc.exists ? detailsDoc.data() : currentData;

                        const materialTypeCode = currentData.materialTypeCode;
                        const counterRef = db.doc(`modules/IN/SpareTypes/${materialTypeCode}/counters/materialCounter`);
                        const counterDoc = await transaction.get(counterRef);
                        const newCount = (counterDoc.data()?.count || 0) + 1;
                        const newMaterialCode = `${materialTypeCode}-${newCount.toString().padStart(5, '0')}`;
                        
                        updatePayload.materialCode = newMaterialCode;
                        
                        // Update main doc location for indexing
                        updatePayload.allocationLevel4Id = locData.allocationLevel4Id;
                        updatePayload.allocationLevel4Name = locData.allocationLevel4Name;
                        updatePayload.allocationLevel5Id = locData.allocationLevel5Id;
                        updatePayload.allocationLevel5Name = locData.allocationLevel5Name;

                        // Create Warehouse Inventory Record
                        if (locData.allocationLevel5Id) {
                            const warehousePath = `organisations/${organisation.domain}/level_1/${locData.allocationLevel1Id}/level_2/${locData.allocationLevel2Id}/level_3/${locData.allocationLevel3Id}/level_4/${locData.allocationLevel4Id}/level_5/${locData.allocationLevel5Id}/materials`;
                            const newMaterialInWarehouseRef = db.doc(`${warehousePath}/${material.id}`);

                            const warehouseMaterialPayload = {
                                documentId: material.id,
                                materialNumber: newMaterialCode,
                                materialCode: newMaterialCode,
                                dateAdded: Timestamp.now(),
                                whoAdded: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                                inventoryData: currentData.inventoryData || {},
                                procurementData: currentData.procurementData || {},
                                procurementComponentName: currentData.procurementComponentName,
                                allocationLevel4Name: locData.allocationLevel4Name,
                                allocationLevel5Name: locData.allocationLevel5Name,
                                allocationLevel1Id: locData.allocationLevel1Id,
                                allocationLevel2Id: locData.allocationLevel2Id,
                                allocationLevel3Id: locData.allocationLevel3Id,
                                allocationLevel4Id: locData.allocationLevel4Id,
                                allocationLevel5Id: locData.allocationLevel5Id,
                                storageLocationName: currentData.storageLocationName,
                                storageLocationId: currentData.storageLocationId,
                            };
                            transaction.set(newMaterialInWarehouseRef, warehouseMaterialPayload);
                        }
                        transaction.set(counterRef, { count: newCount }, { merge: true });

                    } else if (requestType === 'EXTENSION') {
                         const warehousePath = `organisations/${organisation.domain}/level_1/${currentData.allocationLevel1Id}/level_2/${currentData.allocationLevel2Id}/level_3/${currentData.allocationLevel3Id}/level_4/${currentData.allocationLevel4Id}/level_5/${currentData.allocationLevel5Id}/materials`;
                         const originalMasterId = currentData.materialId;
                         const warehouseDocRef = db.doc(`${warehousePath}/${originalMasterId}`);
                         
                         const warehouseMaterialPayload = {
                            documentId: originalMasterId,
                            materialNumber: currentData.materialCode,
                            materialCode: currentData.materialCode,
                            dateAdded: Timestamp.now(),
                            whoAdded: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                            inventoryData: currentData.inventoryData || {},
                            procurementData: currentData.procurementData || {},
                            procurementComponentName: currentData.materialName || 'Unknown',
                            allocationLevel4Name: currentData.allocationLevel4Name,
                            allocationLevel5Name: currentData.allocationLevel5Name,
                            allocationLevel1Id: currentData.allocationLevel1Id,
                            allocationLevel2Id: currentData.allocationLevel2Id,
                            allocationLevel3Id: currentData.allocationLevel3Id,
                            allocationLevel4Id: currentData.allocationLevel4Id,
                            allocationLevel5Id: currentData.allocationLevel5Id,
                        };
                        transaction.set(warehouseDocRef, warehouseMaterialPayload);

                    } else if (requestType === 'REMOVAL') {
                         const originalMasterId = currentData.materialId;
                         const warehousePath = `organisations/${organisation.domain}/level_1/${currentData.allocationLevel1Id}/level_2/${currentData.allocationLevel2Id}/level_3/${currentData.allocationLevel3Id}/level_4/${currentData.allocationLevel4Id}/level_5/${currentData.allocationLevel5Id}/materials`;
                         const warehouseDocRef = db.doc(`${warehousePath}/${originalMasterId}`);
                         transaction.delete(warehouseDocRef);
                    }
                }
                
                transaction.update(docRef, updatePayload);
            });
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to approve.');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            setError('A reason is required for rejection.');
            return;
        }
        setLoadingAction(true);
        setError('');
        
        const docRef = db.doc(`organisations/${organisation.domain}/modules/IN/${collectionPath}/${material.id}`);

        try {
            const updatePayload: any = {
                status: 'Rejected',
                rejectionReason,
                rejectedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                rejectedAt: Timestamp.now(),
            };
            await docRef.update(updatePayload);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to reject.');
        } finally {
            setLoadingAction(false);
        }
    };

    const openConfirm = (level: 1 | 2 | 3) => {
        let actionText = "approve this request";
        if (requestType === 'EXTENSION') actionText = "approve extending this material to the new warehouse";
        if (requestType === 'REMOVAL') actionText = "approve removing this material from the warehouse";

        setConfirmState({
            isOpen: true,
            onConfirm: () => handleApprove(level),
            title: `Confirm Approval Level ${level}`,
            message: `Are you sure you want to ${actionText}?`
        });
    };

    const ApprovalButton: React.FC<{ level: 1 | 2 | 3, canApprove: boolean }> = ({ level, canApprove }) => (
        <Button onClick={() => openConfirm(level)} disabled={!canApprove || loadingAction} isLoading={loadingAction}>
            Approve Level {level}
        </Button>
    );

    const ApprovalStatus: React.FC<{ level: 1 | 2 | 3 }> = ({ level }) => {
        const approved = (material as any)[`approver${level}`];
        const approver = (material as any)[`approver${level}By`];
        const approvedAt = (material as any)[`approver${level}At`];
        return (
            <div className={`p-3 border rounded-md ${approved ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-semibold text-slate-700">Approver {level}</h4>
                {approved && approver && approvedAt ? (
                    <div className="text-xs text-slate-600 mt-1">
                        <p><strong>By:</strong> {approver.name}</p>
                        <p><strong>At:</strong> {approvedAt.toDate().toLocaleString()}</p>
                    </div>
                ) : <p className="text-xs text-slate-500 mt-1">Pending...</p>}
            </div>
        );
    };

    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Request: ${requestType === 'NEW_MATERIAL' ? 'New Material' : requestType} - ${material.materialCode || 'Pending Code'}`} size="4xl">
            <div className="space-y-6">
                {requestType !== 'NEW_MATERIAL' && (
                    <div className={`p-3 rounded-md text-center font-bold mb-4 ${requestType === 'EXTENSION' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>
                        {requestType === 'EXTENSION' ? 'REQUEST TO EXTEND MATERIAL TO NEW WAREHOUSE' : 'REQUEST TO REMOVE MATERIAL FROM WAREHOUSE'}
                    </div>
                )}
            
                <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <DetailItem label="Status" value={material.status} />
                    <DetailItem label="Created By" value={`${material.createdBy.name} on ${material.createdAt.toDate().toLocaleDateString()}`} />
                    <DetailItem label="Item Name" value={material.procurementComponentName || material.materialName} />
                    {requestType === 'NEW_MATERIAL' && <DetailItem label="Material Type" value={material.materialTypeName} />}
                    {requestType === 'NEW_MATERIAL' && <DetailItem label="Storage Location" value={material.storageLocationName} />}
                </dl>
                
                <div className="pt-4 border-t">
                    <h4 className="text-md font-medium text-slate-800 mb-2">Target Location</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <DetailItem label="Department" value={locationData?.allocationLevel4Name || material.allocationLevel4Name || 'Loading...'} />
                        <DetailItem label="Section" value={locationData?.allocationLevel5Name || material.allocationLevel5Name || 'Loading...'} />
                    </dl>
                </div>
                
                {requestType === 'NEW_MATERIAL' && (
                <div className="pt-4 border-t">
                    <h4 className="text-md font-medium text-slate-800 mb-2">Attributes</h4>
                    <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                        {Object.entries(material.attributes || {}).map(([key, value]) => (
                            <DetailItem key={key} label={key} value={String(value)} />
                        ))}
                    </dl>
                </div>
                )}
                
                {material.status === 'Pending Approval' && (
                    <div className="pt-4 border-t">
                        <h4 className="text-md font-medium text-slate-800 mb-2">Approval Workflow</h4>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <ApprovalStatus level={1} />
                            <ApprovalStatus level={2} />
                            <ApprovalStatus level={3} />
                        </div>
                        <div className="flex justify-end gap-2">
                           {!material.approver1 && <ApprovalButton level={1} canApprove={true} />}
                           {material.approver1 && !material.approver2 && <ApprovalButton level={2} canApprove={true} />}
                           {material.approver1 && material.approver2 && !material.approver3 && <ApprovalButton level={3} canApprove={true} />}
                        </div>
                        
                        {!showRejection && <div className="flex justify-start pt-4"><Button type="button" onClick={() => setShowRejection(true)} variant="secondary" className="!w-auto !bg-red-100 !text-red-800">Reject</Button></div>}
                        {showRejection && (
                            <div className="mt-4 p-4 border-t">
                                <Input id="rejectionReason" as="textarea" label="Rejection Reason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} required />
                                <div className="flex justify-end gap-2 mt-2">
                                    <Button type="button" variant="secondary" onClick={() => setShowRejection(false)}>Cancel</Button>
                                    <Button type="button" onClick={handleReject} isLoading={loadingAction}>Confirm Rejection</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {material.status === 'Rejected' && (
                    <div className="p-3 bg-red-50 text-red-800 rounded-md">
                        <p><strong>Rejected By:</strong> {material.rejectedBy?.name} on {material.rejectedAt?.toDate().toLocaleDateString()}</p>
                        <p><strong>Reason:</strong> {material.rejectionReason}</p>
                    </div>
                )}

                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>
        </Modal>
        <ConfirmationModal
            isOpen={confirmState.isOpen}
            onClose={() => setConfirmState(p => ({...p, isOpen: false}))}
            onConfirm={confirmState.onConfirm}
            title={confirmState.title}
            message={confirmState.message}
            isLoading={loadingAction}
        />
      </>
    );
};

export default MaterialApprovalModal;