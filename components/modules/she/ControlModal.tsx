
// components/modules/she/ControlModal.tsx
import React, { useState, useEffect } from 'react';
import type { Control } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface ControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Control, 'id'>, id?: string) => Promise<void>;
  control?: Control | null;
}

const ControlModal: React.FC<ControlModalProps> = ({ isOpen, onClose, onSave, control }) => {
    const [formData, setFormData] = useState<Omit<Control, 'id'>>({ name: '', description: '', enabled: true });
    const isEditing = !!control;

    useEffect(() => {
        if(isOpen) {
            if (isEditing && control) setFormData({ name: control.name, description: control.description, enabled: control.enabled });
            else setFormData({ name: '', description: '', enabled: true });
        }
    }, [isOpen, control, isEditing]);

    const handleSave = async () => {
        await onSave(formData, control?.id);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Control' : 'Add Control'}>
             <div className="space-y-4">
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <Input as="textarea" id="description" label="Description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                <Button onClick={handleSave}>Save</Button>
            </div>
        </Modal>
    );
};

export default ControlModal;
