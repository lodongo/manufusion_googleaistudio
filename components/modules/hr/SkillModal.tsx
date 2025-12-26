
import React, { useState, useEffect } from 'react';
import type { Skill } from '../../../types/hr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Skill, 'id'|'enabled'>, code: string) => Promise<void>;
  skill?: Skill | null;
}

const SkillModal: React.FC<SkillModalProps> = ({ isOpen, onClose, onSave, skill }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!skill;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: skill?.name || '', description: skill?.description || '' });
            setCode(skill?.id || '');
        }
    }, [isOpen, skill]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Skill' : 'Add Skill'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., SDEV-FE)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Skill'}</Button>
            </div>
        </Modal>
    );
};

export default SkillModal;
