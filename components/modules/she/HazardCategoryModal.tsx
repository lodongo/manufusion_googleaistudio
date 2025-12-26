
// components/modules/she/HazardCategoryModal.tsx
import React, { useState, useEffect } from 'react';
import type { HazardCategory } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface HazardCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<HazardCategory, 'id'>) => Promise<void>;
  category?: HazardCategory | null;
}

const HazardCategoryModal: React.FC<HazardCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
  const [formData, setFormData] = useState<Omit<HazardCategory, 'id'>>({ code: '', name: '', description: '', enabled: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!category;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && category) {
        setFormData({ code: category.code, name: category.name, description: category.description, enabled: category.enabled });
      } else {
        setFormData({ code: '', name: '', description: '', enabled: true });
      }
      setErrors({});
    }
  }, [isOpen, category, isEditing]);

  const handleSaveClick = async () => {
    // Basic validation
    if (!formData.code || !formData.name) {
        setErrors({ code: 'Code is required', name: 'Name is required' });
        return;
    }
    setIsLoading(true);
    await onSave(formData);
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Hazard Category' : 'Add New Hazard Category'}>
      <div className="space-y-4">
        <Input
          id="code"
          label="Code (Unique Identifier)"
          value={formData.code}
          onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
          error={errors.code}
          disabled={isEditing}
          required
        />
        <Input
          id="name"
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          error={errors.name}
          required
        />
        <Input
          as="textarea"
          id="description"
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
          rows={3}
        />
        <div className="flex items-center">
            <input type="checkbox" id="enabled" checked={formData.enabled} onChange={e => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="h-4 w-4 rounded" />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">Enabled</label>
        </div>
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default HazardCategoryModal;
