import React, { useState, useEffect } from 'react';
import type { MemsSection } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<MemsSection, 'id'>, id?: string) => Promise<void>;
  sectionToEdit?: MemsSection | null;
  existingNames: string[];
}

const SectionModal: React.FC<SectionModalProps> = ({ isOpen, onClose, onSave, sectionToEdit, existingNames }) => {
  const [formData, setFormData] = useState<Omit<MemsSection, 'id'>>({ name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!sectionToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && sectionToEdit) {
        setFormData({ name: sectionToEdit.name, description: sectionToEdit.description });
      } else {
        setFormData({ name: '', description: '' });
      }
      setErrors({});
    }
  }, [isOpen, sectionToEdit, isEditing]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
        newErrors.name = 'Name is required.';
    }

    const otherNames = isEditing 
        ? existingNames.filter(name => name !== sectionToEdit?.name)
        : existingNames;

    if (otherNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
        newErrors.name = `The section name "${trimmedName}" already exists.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      await onSave(formData, sectionToEdit?.id);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Section' : 'Add New Section'}>
      <div className="space-y-4">
        <Input
          id="name"
          label="Section Name"
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          error={errors.name}
          required
        />
        <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
        
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Section'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SectionModal;