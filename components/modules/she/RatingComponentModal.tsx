
// components/modules/she/RatingComponentModal.tsx
import React, { useState, useEffect } from 'react';
import type { RatingComponent } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface RatingComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<RatingComponent, 'id'>) => Promise<void>;
  component?: RatingComponent | null;
}

const RatingComponentModal: React.FC<RatingComponentModalProps> = ({ isOpen, onClose, onSave, component }) => {
    const [formData, setFormData] = useState<Omit<RatingComponent, 'id'>>({ code: '', name: '', description: '', levels: [] });
    const isEditing = !!component;

    useEffect(() => {
        if(isOpen){
            if(isEditing && component) setFormData({ code: component.code, name: component.name, description: component.description, levels: component.levels || [] });
            else setFormData({ code: '', name: '', description: '', levels: [] });
        }
    }, [isOpen, component, isEditing]);

    const handleSave = async () => {
        await onSave(formData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Rating Component' : 'Add Rating Component'}>
            <div className="space-y-4">
                <Input id="code" label="Code" value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value.toUpperCase()}))} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <Input as="textarea" id="description" label="Description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                <Button onClick={handleSave}>Save</Button>
            </div>
        </Modal>
    );
};

export default RatingComponentModal;
