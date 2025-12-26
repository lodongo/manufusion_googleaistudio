
import React from 'react';
import Input from '../../Input';
import type { Organisation } from '../../../types';

interface BasicInfoTabProps {
    orgData: Organisation;
    setOrgData: React.Dispatch<React.SetStateAction<Organisation>>;
    industryCategories: { id: string; name: string }[];
    selectedIndustryCategory: string;
    setSelectedIndustryCategory: (id: string) => void;
    industrySubcategories: { id: string; name: string }[];
    selectedIndustrySubcategory: string;
    setSelectedIndustrySubcategory: (id: string) => void;
    isDataLoading: boolean;
    isSubcategoriesLoading: boolean;
    phoneError: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    orgData,
    industryCategories,
    selectedIndustryCategory,
    setSelectedIndustryCategory,
    industrySubcategories,
    selectedIndustrySubcategory,
    setSelectedIndustrySubcategory,
    isDataLoading,
    isSubcategoriesLoading,
    phoneError,
    handleChange
}) => {
    return (
        <div className="space-y-4">
            <Input id="name" label="Organisation Name" type="text" value={orgData.name} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="industryCategory" className="block text-sm font-medium text-slate-700">Industry Category</label>
                    <select id="industryCategory" value={selectedIndustryCategory} onChange={(e) => setSelectedIndustryCategory(e.target.value)} required disabled={isDataLoading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="">{isDataLoading ? 'Loading...' : 'Select a Category'}</option>
                        {industryCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="industrySubcategory" className="block text-sm font-medium text-slate-700">Industry Subcategory</label>
                    <select id="industrySubcategory" value={selectedIndustrySubcategory} onChange={(e) => setSelectedIndustrySubcategory(e.target.value)} required disabled={!selectedIndustryCategory || isSubcategoriesLoading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="">{isSubcategoriesLoading ? 'Loading...' : 'Select a Subcategory'}</option>
                        {industrySubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="phoneNumber" label="Primary Phone Number" type="tel" value={orgData.phoneNumber} onChange={handleChange} error={phoneError} required/>
                <Input id="website" label="Website (Optional)" type="url" value={orgData.website} onChange={handleChange} />
            </div>
        </div>
    );
};
