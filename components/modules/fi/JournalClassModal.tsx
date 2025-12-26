import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { JournalClass, Normal, Statement } from '../../../types/fi_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface JournalClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: JournalClass) => Promise<void>;
  classToEdit?: JournalClass | null;
  allJournalClasses?: JournalClass[];
}

const normalBalanceOptions: Normal[] = ['Debit', 'Credit', 'Mixed'];
const statementImpactOptions: Statement[] = ['BS', 'PL', 'CF', 'OCI', 'OffBook'];

const JournalClassModal: React.FC<JournalClassModalProps> = ({ isOpen, onClose, onSave, classToEdit, allJournalClasses }) => {
  const [formData, setFormData] = useState<JournalClass>({
    code: '', name: '', description: '', normalBalance: 'Mixed',
    statementImpact: [], enabled: true, version: 1, examples: []
  });

  // State for creating new code
  const [categorySelection, setCategorySelection] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [subcategoryCode, setSubcategoryCode] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!classToEdit;

  const availableCategories = useMemo(() => {
    if (!allJournalClasses) return [];
    const uniqueCategories = new Set(allJournalClasses.map(jc => jc.code.split('.')[0]));
    return Array.from(uniqueCategories).sort();
  }, [allJournalClasses]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && classToEdit) {
        setFormData({
            ...classToEdit,
            examples: classToEdit.examples || []
        });
      } else {
        setFormData({
            code: '', name: '', description: '', normalBalance: 'Mixed',
            statementImpact: [], enabled: true, version: 1, examples: []
        });
        setCategorySelection('');
        setNewCategoryCode('');
        setSubcategoryCode('');
      }
      setErrors({});
    }
  }, [isOpen, classToEdit, isEditing]);
  
  const validate = async (dataToValidate: JournalClass): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!isEditing) {
        const codeParts = dataToValidate.code.split('.');
        if (codeParts.length < 2 || !codeParts[0] || !codeParts[1]) {
            newErrors.subcategory = 'A full code (CATEGORY.SUBCATEGORY) must be constructed.';
        } else if (!/^[A-Z0-9\.]+$/.test(dataToValidate.code)) {
            newErrors.subcategory = 'Code can only contain uppercase letters, numbers, and periods.';
        } else {
             const docRef = db.collection('modules/FI/journals').doc(dataToValidate.code);
             const docSnap = await docRef.get();
             if (docSnap.exists) {
                 newErrors.subcategory = `Code "${dataToValidate.code}" already exists.`;
             }
        }
    }

    if (!dataToValidate.name.trim()) newErrors.name = 'Name is required.';
    if (dataToValidate.statementImpact.length === 0) newErrors.statementImpact = 'At least one statement impact must be selected.';
    
    if (!isEditing) {
        if (!categorySelection) newErrors.category = "Please select a category."
        if (categorySelection === 'NEW' && !newCategoryCode) newErrors.newCategory = "New category code is required."
        if (!subcategoryCode) newErrors.subcategory = "Subcategory code is required."
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    setIsLoading(true);
    
    let finalCode = formData.code;
    if (!isEditing) {
        const finalCategory = categorySelection === 'NEW' ? newCategoryCode.trim().toUpperCase() : categorySelection;
        const finalSubcategory = subcategoryCode.trim().toUpperCase();
        if (finalCategory && finalSubcategory) {
            finalCode = `${finalCategory}.${finalSubcategory}`;
        }
    }
    
    const dataToSave = { ...formData, code: finalCode };
    
    if (!(await validate(dataToSave))) {
        setIsLoading(false);
        return;
    }
    
    try {
      await onSave(dataToSave);
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImpactChange = (impact: Statement) => {
    setFormData(prev => {
        const newImpacts = prev.statementImpact.includes(impact)
            ? prev.statementImpact.filter(i => i !== impact)
            : [...prev.statementImpact, impact];
        return { ...prev, statementImpact: newImpacts };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Journal Class' : 'Add New Journal Class'}>
      <div className="space-y-4">
        {isEditing ? (
             <Input id="code" label="Code" value={formData.code} disabled />
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="categorySelection" className="block text-sm font-medium text-gray-700">Category</label>
                        <select
                            id="categorySelection"
                            value={categorySelection}
                            onChange={(e) => setCategorySelection(e.target.value)}
                            className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.category ? 'border-red-500' : ''}`}
                        >
                            <option value="">Select Category...</option>
                            {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            <option value="NEW">-- New Category --</option>
                        </select>
                         {errors.category && <p className="mt-2 text-xs text-red-600">{errors.category}</p>}
                    </div>
                    {categorySelection === 'NEW' && (
                        <Input
                            id="newCategoryCode"
                            label="New Category Code"
                            value={newCategoryCode}
                            onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())}
                            error={errors.newCategory}
                            required
                        />
                    )}
                </div>
                <Input
                    id="subcategoryCode"
                    label="Subcategory Code"
                    value={subcategoryCode}
                    onChange={(e) => setSubcategoryCode(e.target.value.toUpperCase())}
                    error={errors.subcategory}
                    required
                />
            </>
        )}

        <Input id="name" label="Name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} error={errors.name} required />
        <Input as="textarea" id="description" label="Description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
        <Input as="textarea" id="examples" label="Examples (comma-separated)" value={(formData.examples || []).join(', ')} onChange={(e) => setFormData(p => ({ ...p, examples: e.target.value.split(',').map(ex => ex.trim()) }))} rows={2} />
        
        <div className="grid grid-cols-2 gap-4">
            <Input as="select" id="normalBalance" label="Normal Balance" value={formData.normalBalance} onChange={e => setFormData(p => ({ ...p, normalBalance: e.target.value as Normal }))}>
                {normalBalanceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Input>
            <Input id="version" label="Version" type="number" value={formData.version} onChange={e => setFormData(p => ({ ...p, version: Number(e.target.value) || 1 }))} min={1} />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">Statement Impact</label>
            <div className="mt-2 flex flex-wrap gap-4">
                {statementImpactOptions.map(impact => (
                    <label key={impact} className="flex items-center space-x-2">
                        <input type="checkbox" checked={formData.statementImpact.includes(impact)} onChange={() => handleImpactChange(impact)} className="h-4 w-4 rounded" />
                        <span>{impact}</span>
                    </label>
                ))}
            </div>
             {errors.statementImpact && <p className="mt-2 text-xs text-red-600">{errors.statementImpact}</p>}
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
            {isEditing ? 'Save Changes' : 'Create Class'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default JournalClassModal;