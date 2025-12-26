import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Continent, CountryData } from '../../types';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';
import CountryDataModal from './CountryDataModal';
import { continentsWithCountries } from '../../constants/countryData';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const CountriesDataTab: React.FC = () => {
    const [continents, setContinents] = useState<Continent[]>([]);
    const [countriesByContinent, setCountriesByContinent] = useState<Record<string, CountryData[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
    const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
    const [countryToDelete, setCountryToDelete] = useState<CountryData | null>(null);
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

    const continentsCollectionRef = collection(db, 'settings/memsSetup/continents');

    useEffect(() => {
        const q = query(continentsCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setContinents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Continent)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const toggleAccordion = useCallback((continentId: string) => {
        const isOpen = !openAccordions[continentId];
        setOpenAccordions(prev => ({ ...prev, [continentId]: isOpen }));

        if (isOpen && !countriesByContinent[continentId]) {
            const countriesRef = collection(continentsCollectionRef, continentId, 'countries');
            onSnapshot(query(countriesRef, orderBy('name')), (snapshot) => {
                setCountriesByContinent(prev => ({
                    ...prev,
                    [continentId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CountryData))
                }));
            });
        }
    }, [openAccordions, countriesByContinent]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            for (const continentData of continentsWithCountries) {
                const continentRef = doc(continentsCollectionRef, continentData.continent.id);
                batch.set(continentRef, continentData.continent);
                for (const country of continentData.countries) {
                    const countryRef = doc(collection(continentRef, 'countries'), country.iso2);
                    const countryPayload = {
                        name: country.name,
                        iso2: country.iso2,
                        iso3: country.iso3,
                        capital: country.capital,
                        currency: country.currency,
                        dialCode: country.dialCode,
                        continent: continentData.continent.name,
                        enabled: country.enabled
                    };
                    batch.set(countryRef, countryPayload);
                }
            }
            await batch.commit();
        } catch (error) {
            console.error("Error seeding country data:", error);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSave = async (data: Omit<CountryData, 'id'>) => {
        if (!selectedContinent) return;
        const countryRef = doc(continentsCollectionRef, selectedContinent.id, 'countries', data.iso2);
        await setDoc(countryRef, data, { merge: true }); // Use setDoc with merge to handle create/update
    };

    const handleDelete = async () => {
        if (!countryToDelete || !selectedContinent) return;
        await deleteDoc(doc(continentsCollectionRef, selectedContinent.id, 'countries', countryToDelete.id));
        setIsConfirmModalOpen(false);
        setCountryToDelete(null);
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No country data found. Populate the database with a default set of all world countries to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed All Countries</Button>
        </div>
    );

    return (
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Country Management</h3>
            <div className="space-y-2">
                {continents.map(continent => (
                    <div key={continent.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => toggleAccordion(continent.id)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none">
                            <h4 className="font-semibold text-gray-800">{continent.name} ({countriesByContinent[continent.id]?.length || 0})</h4>
                            <div className={`${openAccordions[continent.id] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordions[continent.id] && (
                            <div className="bg-white">
                                <div className="p-4 border-b">
                                    <Button onClick={() => { setSelectedContinent(continent); setSelectedCountry(null); setIsModalOpen(true); }}>Add Country to {continent.name}</Button>
                                </div>
                                <div className="divide-y divide-gray-200">
                                {countriesByContinent[continent.id] === undefined ? <p className="p-4 text-sm text-gray-500">Loading...</p> 
                                : countriesByContinent[continent.id].map(country => (
                                    <div key={country.id} className="p-4 flex justify-between items-start hover:bg-gray-50">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{country.name} ({country.iso2})</p>
                                            <p className="text-sm text-gray-600">Capital: {country.capital} | Currency: {country.currency.code}</p>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${country.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {country.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <button onClick={() => { setSelectedContinent(continent); setSelectedCountry(country); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                            <button onClick={() => { setSelectedContinent(continent); setCountryToDelete(country); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <CountryDataModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} country={selectedCountry} continent={selectedContinent} />
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${countryToDelete?.name}"? This action cannot be undone.`} />
        </div>
    );
};

export default CountriesDataTab;