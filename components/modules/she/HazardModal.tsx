
// components/modules/she/HazardModal.tsx
import React, { useState, useEffect } from 'react';
import type { Hazard } from '../../../types/she_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface HazardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Hazard, 'id'>, id?: string) => Promise<void>;
  hazard?: Hazard | null;
}

const HazardModal: React.FC<HazardModalProps> = ({ isOpen, onClose, onSave, hazard }) => {
  const [formData, setFormData] = useState<Omit<Hazard, 'id'>>({ name: '', description: '', enabled: true });
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!hazard;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && hazard) {
        setFormData({ name: hazard.name, description: hazard.description, enabled: hazard.enabled });
      } else {
        setFormData({ name: '', description: '', enabled: true });
      }
    }
  }, [isOpen, hazard, isEditing]);

  const handleSaveClick = async () => {
    if (!formData.name) return;
    setIsLoading(true);
    await onSave(formData, hazard?.id);
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Hazard' : 'Add New Hazard'}>
      <div className="space-y-4">
        <Input id="name" label="Name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} required />
        <Input as="textarea" id="description" label="Description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
        <div className="flex items-center">
            <input type="checkbox" id="enabled" checked={formData.enabled} onChange={e => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="h-4 w-4 rounded" />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">Enabled</label>
        </div>
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Hazard'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default HazardModal;
