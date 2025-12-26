
// components/modules/she/InjuryCategoryModal.tsx
import React, { useState, useEffect } from 'react';
import type { InjuryCategory } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface InjuryCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InjuryCategory, 'id'>) => Promise<void>;
  category?: InjuryCategory | null;
}

const InjuryCategoryModal: React.FC<InjuryCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
    const [formData, setFormData] = useState<Omit<InjuryCategory, 'id'>>({ code: '', name: '', description: '', enabled: true });
    const isEditing = !!category;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && category) setFormData({ code: category.code, name: category.name, description: category.description, enabled: category.enabled });
            else setFormData({ code: '', name: '', description: '', enabled: true });
        }
    }, [isOpen, category, isEditing]);

    const handleSaveClick = async () => {
        await onSave(formData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Injury Category' : 'Add Injury Category'}>
            <div className="space-y-4">
                <Input id="code" label="Code" value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value.toUpperCase()}))} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <Input as="textarea" id="description" label="Description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                <Button onClick={handleSaveClick}>Save</Button>
            </div>
        </Modal>
    );
};

export default InjuryCategoryModal;
