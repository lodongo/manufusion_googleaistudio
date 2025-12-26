import React, { useState, useEffect } from 'react';
import type { CountryData, Continent } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';

interface CountryDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<CountryData, 'id'>) => Promise<void>;
  country?: CountryData | null;
  continent?: Continent | null;
}

const CountryDataModal: React.FC<CountryDataModalProps> = ({ isOpen, onClose, onSave, country, continent }) => {
  const [formData, setFormData] = useState<Omit<CountryData, 'id'>>({
    name: '', iso2: '', iso3: '', capital: '', continent: '', dialCode: '', enabled: true,
    currency: { code: '', name: '', symbol: '' }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!country;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && country) {
        setFormData(country);
      } else {
        setFormData({
            name: '', iso2: '', iso3: '', capital: '', continent: continent?.name || '', dialCode: '', enabled: true,
            currency: { code: '', name: '', symbol: '' }
        });
      }
      setErrors({});
    }
  }, [isOpen, country, continent, isEditing]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!formData.iso2.trim() || formData.iso2.length !== 2) newErrors.iso2 = 'ISO2 code must be 2 characters.';
    if (!formData.iso3.trim() || formData.iso3.length !== 3) newErrors.iso3 = 'ISO3 code must be 3 characters.';
    if (!formData.dialCode.trim()) newErrors.dialCode = 'Dial code is required.';
    if (!formData.currency.code.trim()) newErrors.currencyCode = 'Currency code is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = async () => {
    if (!validate()) return;
    
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

  const handleChange = (field: keyof Omit<CountryData, 'id'|'currency'>, value: string | boolean) => {
    setFormData(p => ({ ...p, [field]: value }));
  };

  const handleCurrencyChange = (field: 'code' | 'name' | 'symbol', value: string) => {
    setFormData(p => ({ ...p, currency: { ...p.currency, [field]: value } }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Country' : `Add New Country to ${continent?.name}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="countryName" label="Country Name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} error={errors.name} required />
            <Input id="capitalCity" label="Capital City" value={formData.capital} onChange={(e) => handleChange('capital', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input id="iso2" label="ISO2 Code" value={formData.iso2} onChange={(e) => handleChange('iso2', e.target.value.toUpperCase())} error={errors.iso2} required disabled={isEditing} maxLength={2} />
            <Input id="iso3" label="ISO3 Code" value={formData.iso3} onChange={(e) => handleChange('iso3', e.target.value.toUpperCase())} error={errors.iso3} required maxLength={3} />
            <Input id="dialCode" label="Dial Code" value={formData.dialCode} onChange={(e) => handleChange('dialCode', e.target.value)} error={errors.dialCode} required />
        </div>
        <div className="pt-4 border-t">
            <h4 className="text-md font-medium text-gray-800">Currency</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <Input id="currencyCode" label="Code (e.g., USD)" value={formData.currency.code} onChange={(e) => handleCurrencyChange('code', e.target.value.toUpperCase())} error={errors.currencyCode} required maxLength={3} />
                <Input id="currencyName" label="Name (e.g., US Dollar)" value={formData.currency.name} onChange={(e) => handleCurrencyChange('name', e.target.value)} />
                <Input id="currencySymbol" label="Symbol (e.g., $)" value={formData.currency.symbol} onChange={(e) => handleCurrencyChange('symbol', e.target.value)} maxLength={5}/>
            </div>
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <label className="font-medium text-gray-700">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.enabled} onChange={(e) => handleChange('enabled', e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                <span className="ml-3 text-sm font-medium">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
        {errors.form && <p className="text-xs text-red-600">{errors.form}</p>}
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Country'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CountryDataModal;