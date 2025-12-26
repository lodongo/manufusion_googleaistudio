
// components/modules/she/InjuryModal.tsx
import React, { useState, useEffect } from 'react';
import type { Injury } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface InjuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Injury, 'id'>, id?: string) => Promise<void>;
  injury?: Injury | null;
}

const InjuryModal: React.FC<InjuryModalProps> = ({ isOpen, onClose, onSave, injury }) => {
    const [formData, setFormData] = useState<Omit<Injury, 'id'>>({ name: '', description: '', enabled: true });
    const isEditing = !!injury;

    useEffect(() => {
        if(isOpen) {
            if (isEditing && injury) setFormData({ name: injury.name, description: injury.description, enabled: injury.enabled });
            else setFormData({ name: '', description: '', enabled: true });
        }
    }, [isOpen, injury, isEditing]);

    const handleSaveClick = async () => {
        await onSave(formData, injury?.id);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Injury' : 'Add Injury'}>
            <div className="space-y-4">
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <Input as="textarea" id="description" label="Description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                <Button onClick={handleSaveClick}>Save</Button>
            </div>
        </Modal>
    );
};

export default InjuryModal;
