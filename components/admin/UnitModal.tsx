
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UnitOfMeasure, UnitSystem, UnitClassification } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<UnitOfMeasure, 'id'>) => Promise<void>;
  unitToEdit?: UnitOfMeasure | null;
}

const unitTypes: UnitSystem[] = ['Metric', 'Imperial', 'US Customary', 'General', 'Time', 'Data'];
const unitClassifications: UnitClassification[] = [
    'Count', 'Weight/Mass', 'Length/Distance', 'Area', 'Volume/Liquid', 'Volume/Dry',
    'Temperature', 'Time', 'Speed', 'Pressure', 'Energy', 'Power', 'Data', 'Flow Rate', 'Torque', 'Force'
];

const UnitModal: React.FC<UnitModalProps> = ({ isOpen, onClose, onSave, unitToEdit }) => {
  const [formData, setFormData] = useState<Omit<UnitOfMeasure, 'id'>>({
      name: '',
      code: '',
      type: 'General',
      classification: 'Count',
      description: '',
      enabled: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!unitToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && unitToEdit) {
        setFormData(unitToEdit);
      } else {
        setFormData({ name: '', code: '', type: 'General', classification: 'Count', description: '', enabled: true });
      }
      setErrors({});
    }
  }, [isOpen, unitToEdit, isEditing]);

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!formData.code.trim()) newErrors.code = 'Code is required.';
    
    if (!isEditing && formData.code) {
      // Check uniqueness of code if creating new
      const docRef = db.collection('settings/memsSetup/units').doc(formData.code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          newErrors.code = `Code "${formData.code}" already exists.`;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { id, value, type } = e.target;
      if (type === 'checkbox') {
          setFormData(p => ({ ...p, [id]: (e.target as HTMLInputElement).checked }));
      } else {
          setFormData(p => ({ ...p, [id]: value }));
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Unit' : 'Add New Unit'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Input
                id="name"
                label="Unit Name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                required
                placeholder="e.g. Kilogram"
            />
            <Input
                id="code"
                label="Code/Symbol"
                value={formData.code}
                onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.replace(/\//g, '_') }))}
                error={errors.code}
                required
                disabled={isEditing}
                placeholder="e.g. kg"
            />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">System Type</label>
                <select
                    id="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="classification" className="block text-sm font-medium text-gray-700">Classification</label>
                <select
                    id="classification"
                    value={formData.classification}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    {unitClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        </div>
        
        <Input
            as="textarea"
            id="description"
            label="Description"
            value={formData.description}
            onChange={handleChange}
            rows={2}
        />

        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="enabled" className="font-medium text-gray-700">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="enabled" checked={formData.enabled} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
        
        {errors.form && <p className="mt-2 text-xs text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Unit'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UnitModal;
