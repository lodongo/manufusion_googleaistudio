
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { ProcurementComponent, ComponentAttribute, AttributeType } from '../../../types/pr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface ProcurementComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ProcurementComponent, 'code'>, code: string) => Promise<void>;
  component?: ProcurementComponent | null;
  parentSubcategoryCode?: string | null;
}

export const ProcurementComponentModal: React.FC<ProcurementComponentModalProps> = ({ isOpen, onClose, onSave, component, parentSubcategoryCode }) => {
  const [formData, setFormData] = useState<Omit<ProcurementComponent, 'code'>>({ name: '', description: '', enabled: true, attributes: [] });
  const [codeSuffix, setCodeSuffix] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!component;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && component) {
        setFormData({ name: component.name, description: component.description, enabled: component.enabled, attributes: component.attributes });
        const parts = component.code.split('-');
        setCodeSuffix(parts[parts.length - 1] || '');
      } else {
        setFormData({ name: '', description: '', enabled: true, attributes: [] });
        setCodeSuffix('');
      }
      setErrors({});
    }
  }, [isOpen, component, isEditing]);

  const handleAttributeChange = (index: number, field: keyof ComponentAttribute, value: any) => {
    const newAttributes = [...formData.attributes];
    (newAttributes[index] as any)[field] = value;
    setFormData(prev => ({ ...prev, attributes: newAttributes }));
  };

  const addAttribute = () => {
    setFormData(prev => ({ ...prev, attributes: [...prev.attributes, { name: '', dataType: 'text', isRequired: false }] }));
  };

  const removeAttribute = (index: number) => {
    setFormData(prev => ({ ...prev, attributes: prev.attributes.filter((_, i) => i !== index) }));
  };

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Component name is required.';
    if (!isEditing) {
        if (!codeSuffix.trim()) newErrors.code = 'Code suffix is required.';
        else if (!/^[A-Z0-9]+$/.test(codeSuffix)) newErrors.code = 'Code can only contain uppercase letters and numbers.';
        
        if (codeSuffix && parentSubcategoryCode) {
            const parentParts = parentSubcategoryCode.split('-');
            const classificationCode = parentParts[0];
            const categoryCode = `${parentParts[0]}-${parentParts[1]}`;
            const fullCode = `${parentSubcategoryCode}-${codeSuffix}`;
            const docRef = db.doc(`modules/PR/Classifications/${classificationCode}/Categories/${categoryCode}/Subcategories/${parentSubcategoryCode}/Components/${fullCode}`);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                newErrors.code = `Code "${fullCode}" already exists.`;
            }
        }
    }
    formData.attributes.forEach((attr, index) => {
        if(!attr.name.trim()) newErrors[`attr_name_${index}`] = "Name is required."
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!(await validate())) return;
    
    setIsLoading(true);
    try {
      const finalCode = isEditing && component ? component.code : `${parentSubcategoryCode}-${codeSuffix}`;
      const cleanedFormData = {
        ...formData,
        attributes: formData.attributes.map(({options, unit, ...attr}) => ({
            ...attr,
            ...(attr.dataType === 'dropdown' && { options: options || [] }),
            ...(attr.dataType === 'number' && { unit: unit || '' }),
        }))
      }
      await onSave(cleanedFormData, finalCode);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Component' : 'Add New Component'}>
      <div className="space-y-4">
        {!isEditing && parentSubcategoryCode && (
            <div className="flex gap-2">
                <Input id="prefix" label="Prefix" value={parentSubcategoryCode || ''} disabled className="flex-grow"/>
                <Input
                    id="codeSuffix"
                    name="codeSuffix"
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
          label="Component Name"
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          error={errors.name}
          required
        />
        
        <div className="pt-4 border-t">
            <h4 className="text-md font-semibold text-gray-800 mb-2">Attributes</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {formData.attributes.map((attr, index) => (
                    <div key={index} className="p-3 border rounded-md bg-gray-50 space-y-2 relative">
                        <button onClick={() => removeAttribute(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">&times;</button>
                        <Input id={`attr_name_${index}`} label={`Attribute ${index + 1} Name`} value={attr.name} onChange={e => handleAttributeChange(index, 'name', e.target.value)} error={errors[`attr_name_${index}`]}/>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Data Type</label>
                                <select value={attr.dataType} onChange={e => handleAttributeChange(index, 'dataType', e.target.value as AttributeType)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="dropdown">Dropdown</option>
                                </select>
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={attr.isRequired} onChange={e => handleAttributeChange(index, 'isRequired', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    <span className="text-sm font-medium text-gray-700">Required</span>
                                </label>
                            </div>
                        </div>
                        {attr.dataType === 'dropdown' && <Input id={`attr_options_${index}`} label="Options (comma-separated)" value={attr.options?.join(',') || ''} onChange={e => handleAttributeChange(index, 'options', e.target.value.split(','))}/>}
                        {attr.dataType === 'number' && <Input id={`attr_unit_${index}`} label="Unit (e.g., mm, kg)" value={attr.unit || ''} onChange={e => handleAttributeChange(index, 'unit', e.target.value)}/>}
                    </div>
                ))}
            </div>
            <Button type="button" onClick={addAttribute} variant="secondary" className="mt-2 !w-auto text-sm">+ Add Attribute</Button>
        </div>
        
        {errors.form && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{errors.form}</p>}
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Component'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};