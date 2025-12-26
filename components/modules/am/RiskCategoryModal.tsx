
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { RiskCategory } from '../../../types/am_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface RiskCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<RiskCategory, 'code'>, code: string) => Promise<void>;
  category?: RiskCategory | null;
}

const RiskCategoryModal: React.FC<RiskCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
  const [formData, setFormData] = useState<Omit<RiskCategory, 'code'>>({ name: '', description: '', enabled: true, color: '#000000' });
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!category;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && category) {
        setFormData({ name: category.name, description: category.description, enabled: category.enabled, color: category.color || '#000000' });
        setCode(category.code);
      } else {
        setFormData({ name: '', description: '', enabled: true, color: '#000000' });
        setCode('');
      }
      setErrors({});
    }
  }, [isOpen, category, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Category name is required.';
    if (!isEditing) {
        if (!code.trim()) newErrors.code = 'Code is required.';
        else if (!/^[A-Z0-9]+$/.test(code)) newErrors.code = 'Code can only contain uppercase letters and numbers.';
        
        if (code) {
            const docRef = db.doc(`modules/AM/Risks/${code}`);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                newErrors.code = `Code "${code}" already exists.`;
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
      await onSave(formData, code);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Risk Category' : 'Add New Risk Category'}>
      <div className="space-y-4">
        <Input
            id="code"
            label="Code (Unique Identifier)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={errors.code}
            disabled={isEditing}
            required
            maxLength={5}
        />
        <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
                <Input
                  id="name"
                  label="Category Name"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  error={errors.name}
                  required
                />
            </div>
            <div>
                 <Input
                    id="color"
                    label="Color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))}
                    containerClassName="h-full"
                    className="h-10 p-1 w-full cursor-pointer"
                />
            </div>
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
            {isEditing ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RiskCategoryModal;
