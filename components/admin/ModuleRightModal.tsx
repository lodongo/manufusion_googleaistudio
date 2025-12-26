import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import type { Module, ModuleRight } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface ModuleRightModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: Module;
  rightToEdit?: ModuleRight | null;
}

const rightTypes: ModuleRight['type'][] = ['Action', 'Approval', 'Configuration', 'Reporting', 'View'];

const ModuleRightModal: React.FC<ModuleRightModalProps> = ({ isOpen, onClose, module, rightToEdit }) => {
  const [formData, setFormData] = useState<Omit<ModuleRight, 'id' | 'code'>>({ name: '', description: '', type: 'Action' });
  const [codeSuffix, setCodeSuffix] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!rightToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && rightToEdit) {
        setFormData({ name: rightToEdit.name, description: rightToEdit.description, type: rightToEdit.type });
        const suffix = rightToEdit.code.startsWith(`${module.code}_`) ? rightToEdit.code.substring(module.code.length + 1) : rightToEdit.code;
        setCodeSuffix(suffix);
      } else {
        setFormData({ name: '', description: '', type: 'Action' });
        setCodeSuffix('');
      }
      setErrors({});
    }
  }, [isOpen, rightToEdit, isEditing, module.code]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!isEditing) {
        if (!codeSuffix.trim()) newErrors.code = 'Code suffix is required.';
        else if (!/^[A-Z0-9_]+$/.test(codeSuffix)) newErrors.code = 'Code can only contain uppercase letters, numbers, and underscores.';
        
        if (codeSuffix) {
            const fullCode = `${module.code}_${codeSuffix}`;
            const docRef = db.collection('settings/memsSetup/module_rights').doc(module.code).collection('rights').doc(fullCode);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                newErrors.code = `Code "${fullCode}" already exists.`;
            }
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!(await validate())) return;
    
    setIsLoading(true);
    const fullCode = isEditing ? rightToEdit!.code : `${module.code}_${codeSuffix}`;
    const rightsCollectionRef = db.collection('settings/memsSetup/module_rights').doc(module.code).collection('rights');
    
    try {
        const dataToSave = { ...formData, code: fullCode };
        const docRef = rightsCollectionRef.doc(fullCode);
        if (isEditing) {
            await docRef.update(dataToSave);
        } else {
            await docRef.set(dataToSave);
        }
        onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit Right: ${rightToEdit?.code}` : `Add New Right to ${module.name}`}>
      <div className="space-y-4">
        <div className="flex items-end gap-2">
            <div className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 text-gray-600 text-sm h-[42px] flex items-center">
                {module.code}_
            </div>
            <Input
              id="code"
              label="Code Suffix"
              containerClassName="flex-grow"
              value={codeSuffix}
              onChange={(e) => setCodeSuffix(e.target.value.toUpperCase())}
              error={errors.code}
              disabled={isEditing}
              required
            />
        </div>

        <Input
          id="name"
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          error={errors.name}
          required
        />
        <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(p => ({ ...p, type: e.target.value as ModuleRight['type'] }))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
                {rightTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
        </div>
        <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
        </div>
        
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Right'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ModuleRightModal;