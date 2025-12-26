
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { StorageLocation } from '../../../types/in_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../../Button';

interface StorageLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StorageLocation, 'id'>, id?: string) => Promise<void>;
  locationToEdit?: StorageLocation | null;
}

const StorageLocationModal: React.FC<StorageLocationModalProps> = ({ isOpen, onClose, onSave, locationToEdit }) => {
  const [formData, setFormData] = useState<Omit<StorageLocation, 'id' | 'code'>>({ name: '', description: '', enabled: true });
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!locationToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && locationToEdit) {
        setFormData({ name: locationToEdit.name, description: locationToEdit.description, enabled: locationToEdit.enabled });
        setCode(locationToEdit.code);
      } else {
        setFormData({ name: '', description: '', enabled: true });
        setCode('');
      }
      setErrors({});
    }
  }, [isOpen, locationToEdit, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!code.trim()) {
        newErrors.code = 'Code is required.';
    } else if (!/^[A-Z]{3}$/.test(code)) {
        newErrors.code = 'Code must be exactly 3 uppercase letters.';
    }
    
    if (!isEditing && code && !newErrors.code) {
      const docRef = db.collection('modules/IN/StorageLocations').doc(code);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        newErrors.code = `Code "${code}" already exists.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!(await validate())) return;
    
    setIsLoading(true);
    try {
      await onSave({ ...formData, code }, locationToEdit?.id);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Storage Location' : 'Add New Storage Location'}>
      <div className="space-y-4">
        <Input
          id="code"
          label="Code (3-letter unique identifier)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          error={errors.code}
          disabled={isEditing}
          required
          maxLength={3}
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
            {isEditing ? 'Save Changes' : 'Create Location'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default StorageLocationModal;
