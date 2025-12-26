
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { RiskSubcategory } from '../../../types/am_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface RiskSubcategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<RiskSubcategory, 'code'>, code: string) => Promise<void>;
  subcategory?: RiskSubcategory | null;
  parentCategoryCode?: string | null;
}

const RiskSubcategoryModal: React.FC<RiskSubcategoryModalProps> = ({ isOpen, onClose, onSave, subcategory, parentCategoryCode }) => {
  const [formData, setFormData] = useState<Omit<RiskSubcategory, 'code'>>({ name: '', description: '', enabled: true });
  const [codeSuffix, setCodeSuffix] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!subcategory;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && subcategory) {
        setFormData({ name: subcategory.name, description: subcategory.description, enabled: subcategory.enabled });
        const parts = subcategory.code.split('-');
        setCodeSuffix(parts[parts.length - 1] || '');
      } else {
        setFormData({ name: '', description: '', enabled: true });
        setCodeSuffix('');
      }
      setErrors({});
    }
  }, [isOpen, subcategory, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Subcategory name is required.';
    if (!isEditing) {
        if (!codeSuffix.trim()) newErrors.code = 'Code suffix is required.';
        else if (!/^[A-Z0-9]+$/.test(codeSuffix)) newErrors.code = 'Code can only contain uppercase letters and numbers.';
        
        if (codeSuffix && parentCategoryCode) {
            const fullCode = `${parentCategoryCode}-${codeSuffix}`;
            const docRef = db.doc(`modules/AM/Risks/${parentCategoryCode}/Subcategories/${fullCode}`);
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
    try {
      const finalCode = isEditing && subcategory ? subcategory.code : `${parentCategoryCode}-${codeSuffix}`;
      await onSave(formData, finalCode);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Risk Subcategory' : 'Add New Risk Subcategory'}>
      <div className="space-y-4">
        {!isEditing && parentCategoryCode && (
            <div className="flex gap-2">
                <Input id="prefix" label="Prefix" value={parentCategoryCode || ''} disabled className="flex-grow" />
                <Input
                    id="codeSuffix"
                    label="Code Suffix"
                    value={codeSuffix}
                    onChange={(e) => setCodeSuffix(e.target.value.toUpperCase())}
                    error={errors.code}
                    required
                    maxLength={5}
                    className="w-1/3"
                />
            </div>
        )}
        <Input
          id="name"
          label="Subcategory Name"
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
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label className="font-medium text-gray-700">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                <span className="ml-3 text-sm font-medium">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
        {errors.form && <p className="text-xs text-red-600">{errors.form}</p>}
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Subcategory'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RiskSubcategoryModal;
