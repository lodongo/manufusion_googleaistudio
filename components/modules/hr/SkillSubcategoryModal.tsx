
import React, { useState, useEffect } from 'react';
import type { SkillSubcategory } from '../../../types/hr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface SkillSubcategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<SkillSubcategory, 'id'|'enabled'>, code: string) => Promise<void>;
  subcategory?: SkillSubcategory | null;
}

const SkillSubcategoryModal: React.FC<SkillSubcategoryModalProps> = ({ isOpen, onClose, onSave, subcategory }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!subcategory;

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: subcategory?.name || '', description: subcategory?.description || '' });
            setCode(subcategory?.id || '');
        }
    }, [isOpen, subcategory]);

    const handleSave = async () => {
        setIsLoading(true);
        await onSave(formData, code);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Skill Subcategory' : 'Add Skill Subcategory'}>
             <div className="space-y-4">
                <Input id="code" label="Code (e.g., TECH-SDEV)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEditing} required />
                <Input id="name" label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full border border-gray-300 rounded-md p-2" placeholder="Description"></textarea>
                <Button onClick={handleSave} isLoading={isLoading}>{isEditing ? 'Save Changes' : 'Add Subcategory'}</Button>
            </div>
        </Modal>
    );
};

export default SkillSubcategoryModal;
