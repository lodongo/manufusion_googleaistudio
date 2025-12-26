
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { addLog } from '../../services/logger';
import { useAuth } from '../../context/AuthContext';
import type { Module } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface ModuleEditModalProps {
  module: Module;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const ModuleEditModal: React.FC<ModuleEditModalProps> = ({ module, isOpen, onClose, onUpdate }) => {
  const { currentUserProfile } = useAuth();
  const [formData, setFormData] = useState(module);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(module);
  }, [module]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (e.target.type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({...prev, [name]: checked }));
    } else {
        setFormData(prev => ({...prev, [name]: e.target.type === 'number' ? parseFloat(value) : value }));
    }
  };

  const handleSaveChanges = async () => {
    if (!currentUserProfile) return;
    setIsLoading(true);
    setError('');

    const changes: string[] = [];
    if (formData.name !== module.name) changes.push('name');
    if (formData.description !== module.description) changes.push('description');
    if (formData.active !== module.active) changes.push(`status to ${formData.active ? 'Active' : 'Inactive'}`);
    if (formData.isCore !== module.isCore) changes.push(`core status to ${formData.isCore ? 'Core' : 'Not Core'}`);
    if (formData.monthlyCost !== module.monthlyCost) changes.push('monthly cost');
    if (formData.annualCost !== module.annualCost) changes.push('annual cost');

    if (changes.length === 0) {
        setIsLoading(false);
        onClose();
        return;
    }

    try {
      const moduleRef = db.collection('modules').doc(module.id);
      await moduleRef.update({
        name: formData.name,
        description: formData.description,
        active: formData.active,
        isCore: formData.isCore,
        monthlyCost: formData.monthlyCost,
        monthlyDiscount: formData.monthlyDiscount,
        annualCost: formData.annualCost,
        annualDiscount: formData.annualDiscount,
      });

      await addLog({
        action: 'Module Updated',
        performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email },
        details: `Updated module ${module.code}: ${changes.join(', ')}.`
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      setError('Failed to save changes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Module: ${module.name}`}>
      <div className="space-y-4">
        <Input
            id="name"
            label="Module Name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
        />
        <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
        
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="active" className="font-medium text-gray-700">Module Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="active" name="active" checked={formData.active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className={`ml-3 text-sm font-medium ${formData.active ? 'text-green-700' : 'text-gray-500'}`}>{formData.active ? 'Active' : 'Inactive'}</span>
            </label>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="isCore" className="font-medium text-gray-700">Core Module (Mandatory)</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="isCore" name="isCore" checked={formData.isCore} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className={`ml-3 text-sm font-medium ${formData.isCore ? 'text-indigo-700' : 'text-gray-500'}`}>{formData.isCore ? 'Yes' : 'No'}</span>
            </label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <Input
                id="monthlyCost"
                label="Monthly Cost ($)"
                name="monthlyCost"
                type="number"
                value={formData.monthlyCost}
                onChange={handleChange}
            />
            <Input
                id="monthlyDiscount"
                label="Monthly Discount (%)"
                name="monthlyDiscount"
                type="number"
                value={formData.monthlyDiscount}
                onChange={handleChange}
            />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Input
                id="annualCost"
                label="Annual Cost ($)"
                name="annualCost"
                type="number"
                value={formData.annualCost}
                onChange={handleChange}
            />
            <Input
                id="annualDiscount"
                label="Annual Discount (%)"
                name="annualDiscount"
                type="number"
                value={formData.annualDiscount}
                onChange={handleChange}
            />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="pt-4">
          <Button onClick={handleSaveChanges} isLoading={isLoading}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ModuleEditModal;
