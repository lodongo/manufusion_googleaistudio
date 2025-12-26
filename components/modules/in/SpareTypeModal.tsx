
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { SpareType } from '../../../types/in_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface SpareTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<SpareType, 'id'>, id?: string) => Promise<void>;
  typeToEdit?: SpareType | null;
}

const SpareTypeModal: React.FC<SpareTypeModalProps> = ({ isOpen, onClose, onSave, typeToEdit }) => {
  const [formData, setFormData] = useState<Omit<SpareType, 'id' | 'code'>>({ name: '', description: '', enabled: true });
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!typeToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && typeToEdit) {
        setFormData({ name: typeToEdit.name, description: typeToEdit.description, enabled: typeToEdit.enabled });
        setCode(typeToEdit.code);
      } else {
        setFormData({ name: '', description: '', enabled: true });
        setCode('');
      }
      setErrors({});
    }
  }, [isOpen, typeToEdit, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!code.trim()) {
        newErrors.code = 'Code is required.';
    } else if (!/^[A-Z]{3}$/.test(code)) {
        newErrors.code = 'Code must be exactly 3 uppercase letters.';
    }
    
    if (!isEditing && code && !newErrors.code) {
      const docRef = db.collection('modules/IN/SpareTypes').doc(code);
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
      await onSave({ ...formData, code }, typeToEdit?.id);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Spare Type' : 'Add New Spare Type'}>
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
            {isEditing ? 'Save Changes' : 'Create Type'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SpareTypeModal;
