
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { MaintenanceType } from '../../../types/am_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface MaintenanceTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MaintenanceType) => Promise<void>;
  maintenanceType?: MaintenanceType | null;
}

const MaintenanceTypeModal: React.FC<MaintenanceTypeModalProps> = ({ isOpen, onClose, onSave, maintenanceType }) => {
  const [formData, setFormData] = useState<MaintenanceType>({ code: '', name: '', description: '', enabled: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!maintenanceType;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && maintenanceType) {
        setFormData(maintenanceType);
      } else {
        setFormData({ code: '', name: '', description: '', enabled: true });
      }
      setErrors({});
    }
  }, [isOpen, maintenanceType, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.code.trim()) newErrors.code = 'Code is required.';
    else if (!/^[A-Z0-9_]+$/.test(formData.code)) newErrors.code = 'Code can only contain uppercase letters, numbers, and underscores.';
    if (!formData.name.trim()) newErrors.name = 'Name is required.';

    if (!isEditing && formData.code) {
        const docRef = db.collection('modules/AM/Maintenance Types').doc(formData.code);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            newErrors.code = `Code "${formData.code}" already exists.`;
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    const isValid = await validate();
    if (!isValid) return;
    
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Maintenance Type' : 'Add New Maintenance Type'}>
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
        <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="enabled" className="font-medium text-gray-700">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="enabled" name="enabled" checked={formData.enabled} onChange={(e) => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className={`ml-3 text-sm font-medium ${formData.enabled ? 'text-green-700' : 'text-gray-500'}`}>{formData.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
        
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Maintenance Type'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MaintenanceTypeModal;