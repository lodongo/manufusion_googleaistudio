
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { Organisation, AppUser } from '../../../types';
import type { StockTakeSession } from '../../../types/in_types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

const { Timestamp } = firebase.firestore;

interface CreateSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    currentUser: AppUser;
    warehouseNode: HierarchyNode; 
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ isOpen, onClose, organisation, currentUser, warehouseNode }) => {
    const [loading, setLoading] = useState(false);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [error, setError] = useState('');
    
    // Form State
    const [sessionName, setSessionName] = useState('');
    const [type, setType] = useState<'FULL' | 'CYCLE' | 'ADHOC'>('FULL');
    const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'>('MONTHLY');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [adhocInput, setAdhocInput] = useState('');

    const [warehouseInventory, setWarehouseInventory] = useState<any[]>([]); 

    useEffect(() => {
        if (!isOpen) return;
        
        // Reset Form
        setSessionName('');
        setType('FULL');
        setFrequency('MONTHLY');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate(new Date().toISOString().split('T')[0]);
        setAdhocInput('');
        setError('');
        setWarehouseInventory([]);

        // Load Inventory Snapshot immediately to determine scope options
        if (warehouseNode.path) {
            setLoadingInventory(true);
            const materialsRef = db.collection(`${warehouseNode.path}/materials`);
            materialsRef.get().then(snap => {
                const items = snap.docs.map(doc => {
                    const d = doc.data();
                    return {
                        materialId: d.documentId,
                        materialCode: d.materialNumber,
                        materialName: d.procurementComponentName || d.materialNumber,
                        bin: d.inventoryData?.bin || 'No Bin',
                    };
                });
                setWarehouseInventory(items);
                setLoadingInventory(false);
            }).catch(err => {
                console.error("Error loading inventory:", err);
                setError("Failed to load warehouse inventory.");
                setLoadingInventory(false);
            });
        }
    }, [isOpen, warehouseNode.path]);

    const handleCreate = async () => {
        if (!sessionName) { setError("Session Name is required."); return; }
        
        if (warehouseInventory.length === 0 && type !== 'ADHOC') {
             // We allow creating ADHOC even if inventory list fails to load, but warn for others
             if (warehouseInventory.length === 0) {
                setError("Warning: No inventory items found in this warehouse. Cannot proceed with Full/Cycle count.");
                return;
             }
        }

        setLoading(true);
        setError('');

        try {
            let scopeMaterialIds: string[] = [];

            if (type === 'FULL' || type === 'CYCLE') {
                scopeMaterialIds = warehouseInventory.map(i => i.materialId);
            } else if (type === 'ADHOC') {
                if (!adhocInput.trim()) {
                    throw new Error("Please enter item codes or bins for Adhoc count.");
                }
                const terms = adhocInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
                const matchedItems = warehouseInventory.filter(item => 
                    terms.includes(item.materialCode?.toUpperCase()) || 
                    terms.includes(item.bin?.toUpperCase())
                );
                
                if (matchedItems.length === 0) {
                    throw new Error("No items found matching the entered codes/bins.");
                }
                
                // Unique IDs
                scopeMaterialIds = Array.from(new Set(matchedItems.map(i => i.materialId)));
            }
            
            if (scopeMaterialIds.length === 0) {
                 throw new Error("Scope is empty. No items selected for this session.");
            }

            // Create Session Document
            const batchWrite = db.batch();
            const sessionRef = db.collection(`${warehouseNode.path}/stockTakeSessions`).doc();
            
            const sessionData: StockTakeSession = {
                id: sessionRef.id,
                configId: 'MANUAL_CREATION',
                configName: sessionName,
                type: type,
                frequency: frequency,
                status: 'ACTIVE',
                warehousePath: warehouseNode.path!,
                warehouseName: warehouseNode.name,
                startDate,
                endDate,
                totalItemsInScope: scopeMaterialIds.length,
                totalItemsCounted: 0, // None batched yet
                scopeMaterialIds: scopeMaterialIds,
                processedMaterialIds: [], // Empty initially
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now(),
            };
            
            batchWrite.set(sessionRef, sessionData);
            
            await batchWrite.commit();
            alert("Session created successfully! You can now generate print batches from the session dashboard.");
            onClose();

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to create session.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Stock Take Session" size="lg">
            <div className="space-y-4">
                <Input id="sessionName" label="Session Name" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="e.g. Annual Count 2024" required />
                
                <div className="grid grid-cols-2 gap-4">
                    <Input id="sessionType" as="select" label="Type" value={type} onChange={e => setType(e.target.value as any)} required>
                        <option value="FULL">Full Count</option>
                        <option value="CYCLE">Cycle Count</option>
                        <option value="ADHOC">Adhoc Count</option>
                    </Input>
                    <Input id="frequency" as="select" label="Frequency" value={frequency} onChange={e => setFrequency(e.target.value as any)} required>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="ANNUALLY">Annually</option>
                    </Input>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input id="startDate" label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    <Input id="endDate" label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                </div>

                {type === 'ADHOC' && (
                    <Input 
                        id="adhocInput"
                        as="textarea" 
                        label="Enter Item Codes or Bins (comma separated)" 
                        value={adhocInput} 
                        onChange={e => setAdhocInput(e.target.value)} 
                        rows={3} 
                        placeholder="e.g. ITEM001, BIN-A-01"
                    />
                )}

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
                
                <div className="flex justify-end pt-4 gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleCreate} isLoading={loading}>Create Session</Button>
                </div>
            </div>
        </Modal>
    );
};

export default CreateSessionModal;
