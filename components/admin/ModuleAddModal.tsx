
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { addLog } from '../../services/logger';
import { useAuth } from '../../context/AuthContext';
import type { Module } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface ModuleAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModuleAddModal: React.FC<ModuleAddModalProps> = ({ isOpen, onClose }) => {
  const { currentUserProfile } = useAuth();
  const [formData, setFormData] = useState<Omit<Module, 'id'>>({
      name: '',
      code: '',
      description: '',
      active: true,
      isCore: false, 
      monthlyCost: 0,
      monthlyDiscount: 0,
      annualCost: 0,
      annualDiscount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
        // Reset form on open
        setFormData({
            name: '', code: '', description: '', active: true, isCore: false, 
            monthlyCost: 0, monthlyDiscount: 0, annualCost: 0, annualDiscount: 0
        });
        setError('');
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({...prev, [name]: checked }));
    } else if (name === 'code') {
        setFormData(prev => ({...prev, code: value.toUpperCase().replace(/[^A-Z]/g, '') }));
    } else {
        const numValue = parseFloat(value);
        setFormData(prev => ({...prev, [name]: type === 'number' ? (isNaN(numValue) ? 0 : numValue) : value }));
    }
  };

  const handleSave = async () => {
    if (!currentUserProfile || !formData.code || !formData.name) {
        setError('Code and Name are required.');
        return;
    }
    setIsLoading(true);
    setError('');

    try {
      const moduleRef = doc(db, 'modules', formData.code);
      const docSnap = await getDoc(moduleRef);
      if (docSnap.exists()) {
          throw new Error(`Module with code "${formData.code}" already exists.`);
      }

      await setDoc(moduleRef, formData);

      await addLog({
        action: 'Module Created',
        performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email! },
        details: `Created new module ${formData.name} (${formData.code}).`
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create module.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Module">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Input
                id="code"
                label="Module Code (e.g., OD)"
                name="code"
                type="text"
                value={formData.code}
                onChange={handleChange}
                maxLength={4}
                required
            />
            <Input
                id="name"
                label="Module Name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
            />
        </div>
         <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="active" className="font-medium text-gray-700">Module Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="active" name="active" checked={formData.active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                <span className="ml-3 text-sm font-medium">{formData.active ? 'Active' : 'Inactive'}</span>
            </label>
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label htmlFor="isCore" className="font-medium text-gray-700">Core Module (Mandatory)</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="isCore" name="isCore" checked={formData.isCore} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                 <span className="ml-3 text-sm font-medium">{formData.isCore ? 'Yes' : 'No'}</span>
            </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Input id="monthlyCost" label="Monthly Cost ($)" name="monthlyCost" type="number" value={formData.monthlyCost} onChange={handleChange}/>
            <Input id="monthlyDiscount" label="Monthly Discount (%)" name="monthlyDiscount" type="number" value={formData.monthlyDiscount} onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Input id="annualCost" label="Annual Cost ($)" name="annualCost" type="number" value={formData.annualCost} onChange={handleChange} />
            <Input id="annualDiscount" label="Annual Discount (%)" name="annualDiscount" type="number" value={formData.annualDiscount} onChange={handleChange} />
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="pt-4">
          <Button onClick={handleSave} isLoading={isLoading}>Create Module</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ModuleAddModal;
