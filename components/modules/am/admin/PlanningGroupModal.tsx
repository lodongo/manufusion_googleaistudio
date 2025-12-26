import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { PlanningGroup } from '../../../../types/am_types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';
import { collection, query, where, getDocs, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';

interface PlanningGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
    groupToEdit?: PlanningGroup | null;
}

const PlanningGroupModal: React.FC<PlanningGroupModalProps> = ({ isOpen, onClose, organisation, theme, groupToEdit }) => {
    const { currentUserProfile } = useAuth();
    const isEditing = !!groupToEdit;
    
    // Form State
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && groupToEdit) {
                setName(groupToEdit.name);
                setCode(groupToEdit.code);
                setDescription(groupToEdit.description);
            } else {
                setName('');
                setCode('');
                setDescription('');
            }
            setError('');
        }
    }, [isOpen, groupToEdit]);

    const handleSave = async () => {
        if (!name || !code) {
            setError("Name and Code are required.");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const groupData: any = {
                name: name.toUpperCase(),
                code: code.toUpperCase(),
                description: description,
                updatedAt: Timestamp.now()
            };

            const groupsRef = collection(db, `organisations/${organisation.domain}/modules/AM/planningGroups`);

            if (isEditing && groupToEdit) {
                await setDoc(doc(groupsRef, groupToEdit.id), groupData, { merge: true });
            } else {
                // Check if code is unique
                const qCode = query(groupsRef, where('code', '==', code.toUpperCase()));
                const snap = await getDocs(qCode);
                if (!snap.empty) {
                    throw new Error(`Group with code ${code.toUpperCase()} already exists.`);
                }
                
                groupData.assignedSections = []; // Initialize empty
                groupData.createdAt = Timestamp.now();
                groupData.createdBy = { uid: currentUserProfile?.uid, name: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}` };
                await addDoc(groupsRef, groupData);
            }
            onClose();
        } catch (e: any) {
            setError(e.message || "Failed to save planning group.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Group Properties' : 'Create New Group'}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="groupCode" label="Group Code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required disabled={isEditing} maxLength={10} placeholder="e.g. MECH_PLAN" />
                    <Input id="groupName" label="Group Name" value={name} onChange={e => setName(e.target.value.toUpperCase())} required containerClassName="md:col-span-2" placeholder="e.g. MECHANICAL MAINTENANCE PLANNING" />
                </div>
                <Input id="groupDesc" as="textarea" label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional group description..." />

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 font-medium">{error}</p>}

                <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto">Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={isLoading} 
                        style={{ backgroundColor: theme.colorPrimary }}
                        className="!w-auto"
                    >
                        {isEditing ? 'Update Properties' : 'Create Group'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default PlanningGroupModal;