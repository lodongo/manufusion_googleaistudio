

import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import type { CountryData } from '../types';

interface CountryCodeSelectProps {
  id: string;
  value: string; // Now expects country ISO code e.g., 'US'
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  name?: string;
}

const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({ id, value, onChange, disabled, required, label = 'Country', name }) => {
  const [groupedCountries, setGroupedCountries] = useState<Record<string, CountryData[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      setError('');
      try {
        const allCountries: CountryData[] = [];
        const continentsRef = db.collection('settings/memsSetup/continents');
        const continentsSnap = await continentsRef.get();

        if (continentsSnap.empty) {
            throw new Error("Country data not found. Please ask an admin to seed the data.");
        }

        const countryPromises = continentsSnap.docs.map(continentDoc => {
          const countriesRef = continentDoc.ref.collection('countries');
          return countriesRef.where('enabled', '==', true).get();
        });

        const countrySnapshots = await Promise.all(countryPromises);
        
        countrySnapshots.forEach(snapshot => {
            snapshot.forEach(countryDoc => {
                allCountries.push({ id: countryDoc.id, ...countryDoc.data() } as CountryData);
            });
        });

        const grouped = allCountries.reduce((acc, country) => {
            const continentName = country.continent || 'Unclassified';
            if (!acc[continentName]) {
                acc[continentName] = [];
            }
            acc[continentName].push(country);
            return acc;
        }, {} as Record<string, CountryData[]>);

        // Sort countries within each group
        Object.values(grouped).forEach(countriesInGroup => {
            countriesInGroup.sort((a, b) => a.name.localeCompare(b.name));
        });

        setGroupedCountries(grouped);
      } catch (err: any) {
        console.error("Failed to fetch countries:", err);
        setError(err.message || "Could not load country list.");
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={id}
        name={name || id}
        value={value}
        onChange={onChange}
        disabled={loading || disabled || !!error}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-slate-100"
      >
        {loading && <option value="">Loading countries...</option>}
        {error && <option value="">Error: {error}</option>}
        {!loading && !error && (
            <>
                <option value="">Select a country</option>
                {Object.keys(groupedCountries).sort().map((continentName) => (
                    <optgroup key={continentName} label={continentName}>
                        {groupedCountries[continentName].map((country) => (
                            <option key={country.iso2} value={country.iso2}>
                                {country.name}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </>
        )}
      </select>
    </div>
  );
};

export default CountryCodeSelect;