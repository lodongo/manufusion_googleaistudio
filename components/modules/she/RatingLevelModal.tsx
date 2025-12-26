
// components/modules/she/RatingLevelModal.tsx
import React, { useState, useEffect } from 'react';
import type { RatingLevel } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface RatingLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (level: RatingLevel) => void;
  level?: RatingLevel | null;
}

const RatingLevelModal: React.FC<RatingLevelModalProps> = ({ isOpen, onClose, onSave, level }) => {
    const [formData, setFormData] = useState<RatingLevel>({ id: '', name: '', score: 1, description: '' });
    const isEditing = !!(level && level.id);

    useEffect(() => {
        if(isOpen) {
            if (isEditing && level) setFormData(level);
            else setFormData({ id: `temp_${Date.now()}`, name: '', score: 1, description: '' });
        }
    }, [isOpen, level, isEditing]);
    
    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Level' : 'Add Level'}>
            <div className="space-y-4">
                <Input id="score" label="Score" type="number" value={formData.score} onChange={e => setFormData(p => ({...p, score: parseInt(e.target.value, 10)}))} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                <Input as="textarea" id="description" label="Description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} />
                <Button onClick={handleSave}>Save</Button>
            </div>
        </Modal>
    );
};

export default RatingLevelModal;
