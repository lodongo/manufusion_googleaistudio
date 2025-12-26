
// components/modules/she/OperatingModeModal.tsx
import React, { useState, useEffect } from 'react';
import type { OperatingMode } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

interface OperatingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<OperatingMode, 'id'>) => Promise<void>;
  modeToEdit?: OperatingMode | null;
}

const OperatingModeModal: React.FC<OperatingModeModalProps> = ({ isOpen, onClose, onSave, modeToEdit }) => {
  const [formData, setFormData] = useState<Omit<OperatingMode, 'id'>>({ level: 0, name: '', description: '', enabled: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!modeToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && modeToEdit) {
        setFormData({ level: modeToEdit.level, name: modeToEdit.name, description: modeToEdit.description, enabled: modeToEdit.enabled });
      } else {
        setFormData({ level: 0, name: '', description: '', enabled: true });
      }
      setErrors({});
    }
  }, [isOpen, modeToEdit, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (formData.name.trim() === '') newErrors.name = 'Name is required.';
    if (formData.level < 0) newErrors.level = 'Level must be a non-negative number.';
    
    if (!isEditing) {
        const docRef = db.doc(`modules/SHE/OperatingModes/${String(formData.level)}`);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            newErrors.level = `Level ${formData.level} already exists.`;
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!(await validate())) return;
    
    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Mode of Operation' : 'Add New Mode of Operation'}>
      <div className="space-y-4">
        <Input
          id="level"
          label="Level (Unique Identifier)"
          type="number"
          value={String(formData.level)}
          onChange={(e) => setFormData(p => ({ ...p, level: parseInt(e.target.value, 10) || 0 }))}
          error={errors.level}
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
            {isEditing ? 'Save Changes' : 'Create Mode'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default OperatingModeModal;
