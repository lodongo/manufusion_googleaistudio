
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import Modal from '../../../common/Modal';
import Button from '../../../Button';
import Input from '../../../Input';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';

interface LocationData {
    allocationLevel3Id: string; 
    allocationLevel3Name: string;
    allocationLevel4Id: string; 
    allocationLevel4Name: string;
    allocationLevel5Id: string; 
    allocationLevel5Name: string;
}

interface ConvertWorkRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: LocationData) => void;
    currentData: {
        l1Id: string;
        l2Id: string;
        l3Id: string;
        l4Id: string;
        l5Id: string;
    };
    organisationDomain: string;
    isLoading?: boolean;
}

const ConvertWorkRequestModal: React.FC<ConvertWorkRequestModalProps> = ({ 
    isOpen, onClose, onConfirm, currentData, organisationDomain, isLoading 
}) => {
    const [l3Id, setL3Id] = useState(currentData.l3Id);
    const [l4Id, setL4Id] = useState(currentData.l4Id);
    const [l5Id, setL5Id] = useState(currentData.l5Id);
    
    const [l3Options, setL3Options] = useState<HierarchyNode[]>([]);
    const [l4Options, setL4Options] = useState<HierarchyNode[]>([]);
    const [l5Options, setL5Options] = useState<HierarchyNode[]>([]);

    const [loadingOptions, setLoadingOptions] = useState({ l3: false, l4: false, l5: false });

    // Fetch L3 Options (Site)
    useEffect(() => {
        if (!currentData.l1Id || !currentData.l2Id) return;
        const fetchL3 = async () => {
            setLoadingOptions(p => ({ ...p, l3: true }));
            try {
                const snap = await db.collection(`organisations/${organisationDomain}/level_1/${currentData.l1Id}/level_2/${currentData.l2Id}/level_3`).orderBy('name').get();
                setL3Options(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HierarchyNode)));
            } catch (e) { console.error(e); }
            setLoadingOptions(p => ({ ...p, l3: false }));
        };
        fetchL3();
    }, [organisationDomain, currentData.l1Id, currentData.l2Id]);

    // Fetch L4 Options when L3 changes
    useEffect(() => {
        if (!l3Id) { setL4Options([]); setL4Id(''); setL5Options([]); setL5Id(''); return; }
        const fetchL4 = async () => {
            setLoadingOptions(p => ({ ...p, l4: true }));
            try {
                const snap = await db.collection(`organisations/${organisationDomain}/level_1/${currentData.l1Id}/level_2/${currentData.l2Id}/level_3/${l3Id}/level_4`).orderBy('name').get();
                setL4Options(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HierarchyNode)));
            } catch (e) { console.error(e); }
            setLoadingOptions(p => ({ ...p, l4: false }));
        };
        fetchL4();
    }, [l3Id, organisationDomain, currentData.l1Id, currentData.l2Id]);

    // Fetch L5 Options when L4 changes
    useEffect(() => {
        if (!l4Id) { setL5Options([]); setL5Id(''); return; }
        const fetchL5 = async () => {
            setLoadingOptions(p => ({ ...p, l5: true }));
            try {
                const snap = await db.collection(`organisations/${organisationDomain}/level_1/${currentData.l1Id}/level_2/${currentData.l2Id}/level_3/${l3Id}/level_4/${l4Id}/level_5`).orderBy('name').get();
                setL5Options(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HierarchyNode)));
            } catch (e) { console.error(e); }
            setLoadingOptions(p => ({ ...p, l5: false }));
        };
        fetchL5();
    }, [l4Id, l3Id, organisationDomain, currentData.l1Id, currentData.l2Id]);

    const handleConfirm = () => {
        const l3 = l3Options.find(o => o.id === l3Id);
        const l4 = l4Options.find(o => o.id === l4Id);
        const l5 = l5Options.find(o => o.id === l5Id);

        if (!l3 || !l4 || !l5) return;

        onConfirm({
            allocationLevel3Id: l3.id!, allocationLevel3Name: l3.name,
            allocationLevel4Id: l4.id!, allocationLevel4Name: l4.name,
            allocationLevel5Id: l5.id!, allocationLevel5Name: l5.name,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Work Order Details">
            <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-yellow-800 text-sm">
                    <p className="font-bold mb-1">Important:</p>
                    <p>Please confirm the cost settlement location (Site, Department, Section). This information defines where costs are booked and may not be editable after conversion.</p>
                </div>

                <div className="space-y-4">
                    {/* Added missing id props to Input components */}
                    <Input id="l3Select" as="select" label="Site (Level 3)" value={l3Id} onChange={e => { setL3Id(e.target.value); setL4Id(''); setL5Id(''); }} disabled={loadingOptions.l3}>
                        <option value="">Select Site...</option>
                        {l3Options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </Input>

                    <Input id="l4Select" as="select" label="Department (Level 4)" value={l4Id} onChange={e => { setL4Id(e.target.value); setL5Id(''); }} disabled={!l3Id || loadingOptions.l4}>
                        <option value="">Select Department...</option>
                        {l4Options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </Input>
                    
                    <Input id="l5Select" as="select" label="Section (Level 5)" value={l5Id} onChange={e => setL5Id(e.target.value)} disabled={!l4Id || loadingOptions.l5}>
                        <option value="">Select Section...</option>
                        {l5Options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </Input>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleConfirm} isLoading={isLoading} disabled={!l3Id || !l4Id || !l5Id} className="bg-green-600 hover:bg-green-700">Confirm & Convert</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConvertWorkRequestModal;
