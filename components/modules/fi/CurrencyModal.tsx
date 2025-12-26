import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { MemsCurrency } from '../../../types/fi_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<MemsCurrency, 'id'>, id?: string) => Promise<void>;
  currencyToEdit?: MemsCurrency | null;
}

const CurrencyModal: React.FC<CurrencyModalProps> = ({ isOpen, onClose, onSave, currencyToEdit }) => {
  const [formData, setFormData] = useState<Omit<MemsCurrency, 'id' | 'code'>>({ name: '', symbol: '', countries: [], enabled: true });
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!currencyToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && currencyToEdit) {
        setFormData({ name: currencyToEdit.name, symbol: currencyToEdit.symbol, countries: currencyToEdit.countries, enabled: currencyToEdit.enabled });
        setCode(currencyToEdit.code);
      } else {
        setFormData({ name: '', symbol: '', countries: [], enabled: true });
        setCode('');
      }
      setErrors({});
    }
  }, [isOpen, currencyToEdit, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!code.trim()) {
      newErrors.code = 'Code is required.';
    } else if (!/^[A-Z]{3}$/.test(code)) {
      newErrors.code = 'Code must be exactly 3 uppercase letters.';
    }

    if (!isEditing && code && !newErrors.code) {
      const docRef = db.collection('settings/memsSetup/currencies').doc(code);
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
      await onSave({ ...formData, code }, currencyToEdit?.id);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Currency' : 'Add New Currency'}>
      <div className="space-y-4">
        <Input
          id="code"
          label="Currency Code (3-letter ISO)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          error={errors.code}
          disabled={isEditing}
          required
          maxLength={3}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="name"
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              error={errors.name}
              required
            />
            <Input
              id="symbol"
              label="Symbol"
              value={formData.symbol}
              onChange={(e) => setFormData(p => ({ ...p, symbol: e.target.value }))}
            />
        </div>
        <Input
            as="textarea"
            id="countries"
            label="Countries (comma-separated)"
            value={formData.countries.join(', ')}
            onChange={(e) => setFormData(p => ({ ...p, countries: e.target.value.split(',').map(c => c.trim()) }))}
            rows={3}
        />
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="enabled" className="font-medium text-gray-700">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="enabled" checked={formData.enabled} onChange={e => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className={`ml-3 text-sm font-medium ${formData.enabled ? 'text-green-700' : 'text-gray-500'}`}>{formData.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
        
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Currency'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CurrencyModal;
