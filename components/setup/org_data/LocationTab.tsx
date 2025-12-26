
import React from 'react';
import Input from '../../Input';
import type { Organisation, Continent, CountryData } from '../../../types';

interface LocationTabProps {
    orgData: Organisation;
    setOrgData: React.Dispatch<React.SetStateAction<Organisation>>;
    continents: Continent[];
    filteredCountries: CountryData[];
    isDataLoading: boolean;
    handleAddressChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export const LocationTab: React.FC<LocationTabProps> = ({
    orgData,
    setOrgData,
    continents,
    filteredCountries,
    isDataLoading,
    handleAddressChange
}) => {
    return (
        <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="continent" className="block text-sm font-medium text-slate-700">Continent</label>
                    <select id="continent" value={orgData.address.continent} onChange={(e) => setOrgData(p => ({...p, address: {...p.address, continent: e.target.value, countryIsoCode: ''}}))} required disabled={isDataLoading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="">{isDataLoading ? 'Loading...' : 'Select Continent'}</option>
                        {continents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="countryIsoCode" className="block text-sm font-medium text-slate-700">Country</label>
                    <select id="countryIsoCode" value={orgData.address.countryIsoCode} onChange={handleAddressChange} required disabled={!orgData.address.continent || isDataLoading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-slate-100">
                        <option value="">Select Country</option>
                        {filteredCountries.map(country => <option key={country.iso2} value={country.iso2}>{country.name}</option>)}
                    </select>
                </div>
            </div>
            <h3 className="text-lg font-medium text-slate-800 pt-2 border-t border-slate-200">Headquarters Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="town" label="Town / City" type="text" value={orgData.address.town} onChange={handleAddressChange} />
                <Input id="road" label="Road / Street" type="text" value={orgData.address.road} onChange={handleAddressChange} />
                <Input id="block" label="Block / Building / Plot No." type="text" value={orgData.address.block} onChange={handleAddressChange} />
            </div>
        </div>
    );
};
