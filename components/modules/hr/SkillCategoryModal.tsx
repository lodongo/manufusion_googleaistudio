
import React, { useState, useEffect } from 'react';
import type { SkillCategory } from '../../../types/hr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface SkillCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<SkillCategory, 'id'|'enabled'>, code: string) => Promise<void>;
  category?: SkillCategory | null;
}

const SkillCategoryModal: React.FC<SkillCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!category;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: category?.name || '', description: category?.description || '' });
            setCode(category?.id || '');
        }
    }, [isOpen, category]);

    const handleSave = async () => {
        setIsLoading(true);
        // Add validation here if needed
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Skill Category' : 'Add Skill Category'}>
            <div className="space-y-4">
                <Input id="code" label="Code (e.g., TECH)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Category'}</Button>
            </div>
        </Modal>
    );
};

export default SkillCategoryModal;
