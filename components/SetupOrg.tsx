
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import type { CountryData, Continent, Organisation, Module } from '../types';

// Section Imports
import { SetupDashboard } from './setup/dashboard/SetupDashboard';
import { BasicInfoTab } from './setup/org_data/BasicInfoTab';
import { LocationTab } from './setup/org_data/LocationTab';
import { ThemeTab } from './setup/org_data/ThemeTab';
import { ModulesManagementTab } from './setup/org_data/ModulesManagementTab';
import { SetupEmployees } from './setup/employees/SetupEmployees';
import { SetupHierarchy } from './setup/hierarchy/SetupHierarchy';
import { OrgSettingsTab } from './org/OrgSettingsTab';
import OrgRoles from './org/OrgRoles';
import ActivityLog from './admin/ActivityLog';

// Types for local state
import type { HierarchyNode } from './org/HierarchyNodeModal';

interface SetupOrgProps {
  onOrgCreated: (newOrgData: Organisation) => void;
  onGoToOrgDashboard: () => void;
  organisationData?: Organisation;
}

// Icons
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const InfoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197" /></svg>;
const HierarchyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const RolesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const LogsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;

export const SetupOrg: React.FC<SetupOrgProps> = ({ onOrgCreated, onGoToOrgDashboard, organisationData }) => {
  const { user, currentUserProfile } = useAuth();
  const isEditing = !!organisationData;
  const [mainTab, setMainTab] = useState(isEditing ? 'dashboard' : 'organizationData');
  const [activeSubTab, setActiveSubTab] = useState('basicInfo');
  
  // Specific Sub-states
  const [editingEmployeeUid, setEditingEmployeeUid] = useState<string | null>(null);
  const [configuringWarehouseNode, setConfiguringWarehouseNode] = useState<HierarchyNode | null>(null);
  const [viewingMaterialPath, setViewingMaterialPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orgData, setOrgData] = useState<Organisation>({
    name: '',
    domain: user?.email?.split('@')[1] || '',
    website: '',
    industryCategory: '',
    industrySubcategory: '',
    currency: { code: '', name: '', symbol: ''},
    address: {
      continent: '',
      country: '',
      countryIsoCode: '',
      town: '',
      road: '',
      block: '',
    },
    phoneNumber: '',
    theme: {
      slogan: '',
      logoURL: '',
      colorPrimary: '#4F46E5', // indigo-600
      colorSecondary: '#10B981',
      colorAccent: '#F97316',
    },
    createdBy: '',
    createdAt: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  const [selectedIndustryCategory, setSelectedIndustryCategory] = useState('');
  const [selectedIndustrySubcategory, setSelectedIndustrySubcategory] = useState('');
  const [industryCategories, setIndustryCategories] = useState<{ id: string; name: string }[]>([]);
  const [industrySubcategories, setIndustrySubcategories] = useState<{ id: string; name: string }[]>([]);
  
  const [continents, setContinents] = useState<Continent[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);

  const [allModules, setAllModules] = useState<Module[]>([]);
  const [subscribedModules, setSubscribedModules] = useState<string[]>([]);
  
  const [phoneError, setPhoneError] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSubcategoriesLoading, setIsSubcategoriesLoading] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /* Added currencyConfig state for hierarchy drill-downs */
  const [currencyConfig, setCurrencyConfig] = useState({ local: 'USD', base: 'USD', rate: 1 });

  /* Added effect to fetch currency config from organization settings */
  useEffect(() => {
    if (!organisationData?.domain) return;
    const docRef = db.doc(`organisations/${organisationData.domain}/modules/FI/settings/currency`);
    const unsubscribe = docRef.onSnapshot(snap => {
        if (snap.exists) {
            const data = snap.data();
            setCurrencyConfig({
                local: data?.localCurrency || 'USD',
                base: data?.baseCurrency || 'USD',
                rate: data?.constantRateConfig?.calculatedRate || 1
            });
        }
    });
    return unsubscribe;
  }, [organisationData?.domain]);

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon/>, visible: isEditing },
    { id: 'organizationData', name: 'Organization Data', icon: <InfoIcon/>, visible: true },
    { id: 'employees', name: 'Employees', icon: <UsersIcon/>, visible: isEditing },
    { id: 'orgHierarchy', name: 'Hierarchy', icon: <HierarchyIcon/>, visible: isEditing },
    { id: 'roles', name: 'Roles', icon: <RolesIcon/>, visible: isEditing },
    { id: 'settings', name: 'Settings', icon: <SettingsIcon/>, visible: isEditing },
    { id: 'logs', name: 'Logs', icon: <LogsIcon/>, visible: isEditing },
  ].filter(item => item.visible);

  useEffect(() => {
    // When returning from profile view to employee list, ensure the main tab is correct
    if (!editingEmployeeUid) {
      if (mainTab !== 'employees') {
        // This logic is to prevent switching away if user just selected another tab
      }
    } else {
      setMainTab('employees');
      setConfiguringWarehouseNode(null);
    }
  }, [editingEmployeeUid, mainTab]);

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      setError('');
      try {
        const categoriesRef = db.collection('settings').doc('memsSetup').collection('industry_categories');
        const catQuery = categoriesRef.orderBy('name');
        const catSnapshot = await catQuery.get();
        const cats = catSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setIndustryCategories(cats);

        const fetchedContinents: Continent[] = [];
        const fetchedCountries: CountryData[] = [];
        const continentsRef = db.collection('settings/memsSetup/continents');
        const continentsSnap = await continentsRef.orderBy('name').get();
        
        if (continentsSnap.empty) {
          // For dev environment or first run if not seeded
          console.warn("Location data not found."); 
        }
        
        const countryPromises = continentsSnap.docs.map(continentDoc => {
          fetchedContinents.push({ id: continentDoc.id, ...continentDoc.data() } as Continent);
          const countriesRef = continentDoc.ref.collection('countries');
          return countriesRef.where('enabled', '==', true).orderBy('name').get();
        });

        const countrySnapshots = await Promise.all(countryPromises);
        
        countrySnapshots.forEach(snapshot => {
            snapshot.forEach(countryDoc => {
                fetchedCountries.push({ id: countryDoc.id, ...countryDoc.data() } as CountryData);
            });
        });

        setContinents(fetchedContinents);
        setCountries(fetchedCountries);

        const modulesCollection = db.collection("modules");
        const modulesSnapshot = await modulesCollection.orderBy("name").get();
        const modulesData = modulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
        setAllModules(modulesData);
        const coreModuleIds = modulesData.filter(m => m.isCore).map(m => m.id);

        if (isEditing && organisationData) {
            const phoneNumber = organisationData.phoneNumber ? parsePhoneNumberFromString(organisationData.phoneNumber) : null;
            
            setOrgData(prev => ({
                ...prev,
                name: organisationData.name || '',
                website: organisationData.website || '',
                phoneNumber: phoneNumber ? (phoneNumber.nationalNumber as string || '') : '',
                address: {
                    continent: fetchedContinents.find(c => c.name === organisationData.address.continent)?.id || '',
                    country: organisationData.address.country || '',
                    countryIsoCode: organisationData.address.countryIsoCode || '',
                    town: organisationData.address.town || '',
                    road: organisationData.address.road || '',
                    block: organisationData.address.block || '',
                },
                theme: {
                    slogan: organisationData.theme?.slogan || '',
                    logoURL: organisationData.theme?.logoURL || '',
                    colorPrimary: organisationData.theme?.colorPrimary || '#4F46E5',
                    colorSecondary: organisationData.theme?.colorSecondary || '#10B981',
                    colorAccent: organisationData.theme?.colorAccent || '#F97316',
                }
            }));
            setLogoPreview(organisationData.theme?.logoURL || '');
            
            // Fetch subscribed modules from subcollection
            const subscribedModulesRef = db.collection('organisations').doc(organisationData.domain).collection('modules');
            const subscribedSnap = await subscribedModulesRef.get();
            const subscribedFromDB = subscribedSnap.docs.map(doc => doc.id);

            const initialSubscribed = new Set([...subscribedFromDB, ...coreModuleIds]);
            setSubscribedModules(Array.from(initialSubscribed));

            const category = cats.find(c => c.name === organisationData.industryCategory);
            if (category) {
                setSelectedIndustryCategory(category.id);
            }
        } else {
            setSubscribedModules(coreModuleIds);
        }

      } catch (err: any) {
        console.error("Failed to fetch initial data:", err);
        setError(err.message || "Could not load required setup data.");
      } finally {
        setIsDataLoading(false);
      }
    };
    
    fetchData();
  }, [isEditing, organisationData]);

  useEffect(() => {
    if (!selectedIndustryCategory) {
      setIndustrySubcategories([]);
      setSelectedIndustrySubcategory('');
      return;
    }
    const fetchSubcategories = async () => {
      setIsSubcategoriesLoading(true);
      try {
        const subcategoriesRef = db.collection('settings').doc('memsSetup').collection('industry_categories').doc(selectedIndustryCategory).collection('Industry_subcategories');
        const q = subcategoriesRef.orderBy('name');
        const querySnapshot = await q.get();
        const subs = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setIndustrySubcategories(subs);

        if (isEditing && organisationData && subs.length > 0) {
            const subcategory = subs.find(s => s.name === organisationData.industrySubcategory);
            if (subcategory) {
                setSelectedIndustrySubcategory(subcategory.id);
            }
        }

      } catch (err) {
        console.error("Failed to fetch subcategories:", err);
        setError("Could not load industry subcategories for the selected category.");
      } finally {
        setIsSubcategoriesLoading(false);
      }
    };
    fetchSubcategories();
  }, [selectedIndustryCategory, isEditing, organisationData]);

  useEffect(() => {
    if (orgData.phoneNumber && orgData.address.countryIsoCode) {
        if (isValidPhoneNumber(orgData.phoneNumber, orgData.address.countryIsoCode as CountryCode)) {
            setPhoneError('');
        } else {
            setPhoneError('Invalid phone number for the selected country.');
        }
    } else {
        setPhoneError('');
    }
  }, [orgData.phoneNumber, orgData.address.countryIsoCode]);
  
  if (!user || !user.email || !currentUserProfile) {
      return <div>Error: User not found.</div>
  }

  const domain = user.email.split('@')[1];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setOrgData(prev => ({ ...prev, [id]: value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setOrgData(p => ({ ...p, address: { ...p.address, [id]: value } }));
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setOrgData(p => ({ ...p, theme: { ...p.theme, [id]: value } }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleModuleToggle = (moduleId: string) => {
    const module = allModules.find(m => m.id === moduleId);
    if (module && module.isCore) {
        return; // Do nothing for core modules, they cannot be deselected
    }
    setSubscribedModules(prev => {
        const isSubscribed = prev.includes(moduleId);
        if (isSubscribed) {
            return prev.filter(id => id !== moduleId);
        } else {
            return [...prev, moduleId];
        }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneError) {
        setError('Please fix the errors before submitting.');
        return;
    }
    if (!orgData.name || !selectedIndustryCategory || !selectedIndustrySubcategory || !orgData.address.continent || !orgData.address.countryIsoCode) {
      setError('All fields on Basic Info and Location tabs are required.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    let finalLogoURL = orgData.theme.logoURL;

    if (logoFile) {
        try {
            const metadata = {
                contentType: logoFile.type,
            };
            const logoRef = storage.ref(`organisations/${domain}/logo`);
            const snapshot = await logoRef.put(logoFile, metadata);
            finalLogoURL = await snapshot.ref.getDownloadURL();
        } catch (uploadError) {
            console.error("Logo upload failed:", uploadError);
            setError("Failed to upload logo. Please try again.");
            setIsLoading(false);
            return;
        }
    }
    
    const selectedCountry = countries.find(c => c.iso2 === orgData.address.countryIsoCode);
    const selectedContinent = continents.find(c => c.id === orgData.address.continent);
    const categoryName = industryCategories.find(c => c.id === selectedIndustryCategory)?.name || '';
    const subcategoryName = industrySubcategories.find(s => s.id === selectedIndustrySubcategory)?.name || '';

    try {
      const dataPayload: Omit<Organisation, 'id' | 'createdBy' | 'createdAt'> = {
        name: orgData.name,
        domain: domain,
        industryCategory: categoryName,
        industrySubcategory: subcategoryName,
        currency: selectedCountry?.currency || { code: '', name: '', symbol: ''},
        address: {
            continent: selectedContinent?.name || '',
            country: selectedCountry?.name || '',
            countryIsoCode: orgData.address.countryIsoCode,
            town: orgData.address.town,
            road: orgData.address.road,
            block: orgData.address.block,
        },
        phoneNumber: parsePhoneNumberFromString(orgData.phoneNumber, orgData.address.countryIsoCode as CountryCode)?.number || '',
        website: orgData.website,
        theme: {
            ...orgData.theme,
            logoURL: finalLogoURL,
        },
      };
      
      const orgDocRef = db.collection("organisations").doc(domain);
      
      if (isEditing) {
        await orgDocRef.update(dataPayload as any); // Firestore SDK is flexible with partial updates
        onOrgCreated({ ...organisationData, ...dataPayload } as Organisation);
      } else {
        const newOrgData: Organisation = {
            ...dataPayload,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        };
        await orgDocRef.set(newOrgData);
        onOrgCreated(newOrgData);
      }

      // Update modules subcollection
      const modulesSubcollectionRef = db.collection('organisations').doc(domain).collection('modules');
      const existingModulesSnap = await modulesSubcollectionRef.get();
      const existingModuleIds = new Set(existingModulesSnap.docs.map(doc => doc.id));

      const newModuleIds = new Set(subscribedModules);
      const coreModuleIds = new Set(allModules.filter(m => m.isCore).map(m => m.id));

      const batch = db.batch();

      // Delete unsubscribed modules (if not core)
      existingModulesSnap.docs.forEach(doc => {
          if (!newModuleIds.has(doc.id) && !coreModuleIds.has(doc.id)) {
              batch.delete(doc.ref);
          }
      });

      // Add newly subscribed modules
      newModuleIds.forEach(moduleId => {
          if (!existingModuleIds.has(moduleId)) {
              const docRef = modulesSubcollectionRef.doc(moduleId);
              batch.set(docRef, { paid: false, activated: true });
          }
      });
      
      await batch.commit();

    } catch (err) {
      console.error("Failed to save organisation:", err);
      setError('Failed to save organisation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCountries = countries.filter(country => {
    const selectedContinentObj = continents.find(c => c.id === orgData.address.continent);
    return selectedContinentObj && country.continent === selectedContinentObj.name;
  });

  const TabButton: React.FC<{tabId: string, label: string}> = ({ tabId, label }) => (
    <button type="button" onClick={() => setActiveSubTab(tabId)}
        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
            activeSubTab !== tabId && 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
        }`}
        style={activeSubTab === tabId ? { borderColor: orgData.theme.colorPrimary, color: orgData.theme.colorPrimary } : {}}
    >
        {label}
    </button>
  );

  const renderOrganizationData = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm">
        <form onSubmit={handleSubmit}>
            <div className="border-b border-slate-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabId="basicInfo" label="Basic Info" />
                    <TabButton tabId="location" label="Location and Address" />
                    <TabButton tabId="theme" label="Theme" />
                    {isEditing && <TabButton tabId="modules" label="Modules Management" />}
                </nav>
            </div>
            
            {activeSubTab === 'basicInfo' && (
                <BasicInfoTab 
                    orgData={orgData} 
                    setOrgData={setOrgData} 
                    industryCategories={industryCategories}
                    selectedIndustryCategory={selectedIndustryCategory}
                    setSelectedIndustryCategory={setSelectedIndustryCategory}
                    industrySubcategories={industrySubcategories}
                    selectedIndustrySubcategory={selectedIndustrySubcategory}
                    setSelectedIndustrySubcategory={setSelectedIndustrySubcategory}
                    isDataLoading={isDataLoading}
                    isSubcategoriesLoading={isSubcategoriesLoading}
                    phoneError={phoneError}
                    handleChange={handleChange}
                />
            )}

            {activeSubTab === 'location' && (
                <LocationTab 
                    orgData={orgData}
                    setOrgData={setOrgData}
                    continents={continents}
                    filteredCountries={filteredCountries}
                    isDataLoading={isDataLoading}
                    handleAddressChange={handleAddressChange}
                />
            )}

            {activeSubTab === 'theme' && (
                <ThemeTab 
                    orgData={orgData}
                    handleThemeChange={handleThemeChange}
                    logoPreview={logoPreview}
                    fileInputRef={fileInputRef}
                    handleLogoChange={handleLogoChange}
                />
            )}

            {isEditing && activeSubTab === 'modules' && (
                <ModulesManagementTab
                    isEditing={isEditing}
                    activeSubTab={activeSubTab}
                    isDataLoading={isDataLoading}
                    allModules={allModules}
                    subscribedModules={subscribedModules}
                    handleModuleToggle={handleModuleToggle}
                    theme={orgData.theme}
                />
            )}

            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
            
            <div className="pt-6 border-t border-slate-200 mt-6 flex justify-end">
                <Button type="submit" isLoading={isLoading} disabled={!!phoneError || isLoading} style={{ backgroundColor: orgData.theme.colorPrimary }}>
                    {isEditing ? 'Save Changes' : 'Complete Setup'}
                </Button>
            </div>
        </form>
    </div>
  );
  
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
        <aside className="w-64 bg-slate-800 text-white flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-slate-700">
                <h1 className="text-xl font-bold text-white">Org Settings</h1>
                <p className="text-sm text-slate-400">{organisationData?.name || 'New Organisation'}</p>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => { setMainTab(item.id); setEditingEmployeeUid(null); setConfiguringWarehouseNode(null); setViewingMaterialPath(null); }}
                        className={`w-full flex items-center px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                            mainTab === item.id
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        <div className="mr-3">{item.icon}</div>
                        {item.name}
                    </button>
                ))}
                <button
                    onClick={onGoToOrgDashboard}
                    className="w-full flex items-center px-4 py-3 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white mt-4"
                >
                    <div className="mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    </div>
                    Back to Dashboard
                </button>
            </nav>
        </aside>
        
        <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex justify-between items-center p-6 bg-white border-b border-slate-200 shadow-sm">
                 <h2 className="text-2xl font-bold text-slate-800">
                    {navItems.find(i => i.id === mainTab)?.name}
                 </h2>
                 {!organisationData && <div className="text-sm text-slate-500">Complete initial setup to unlock all features.</div>}
            </header>
            <main className="flex-1 overflow-y-auto p-6">
                {mainTab === 'dashboard' && <SetupDashboard organisationData={organisationData} isEditing={isEditing} />}
                {mainTab === 'organizationData' && renderOrganizationData()}
                {mainTab === 'employees' && isEditing && (
                    <SetupEmployees 
                        editingEmployeeUid={editingEmployeeUid}
                        setEditingEmployeeUid={setEditingEmployeeUid}
                        currentUserProfile={currentUserProfile}
                        theme={orgData.theme}
                    />
                )}
                {mainTab === 'orgHierarchy' && isEditing && (
                    <SetupHierarchy 
                        configuringWarehouseNode={configuringWarehouseNode}
                        setConfiguringWarehouseNode={setConfiguringWarehouseNode}
                        viewingMaterialPath={viewingMaterialPath}
                        setViewingMaterialPath={setViewingMaterialPath}
                        currentUserProfile={currentUserProfile}
                        organisationData={organisationData}
                        theme={orgData.theme}
                        /* Pass the currencyConfig to SetupHierarchy */
                        currencyConfig={currencyConfig}
                    />
                )}
                {mainTab === 'roles' && isEditing && (
                    <OrgRoles currentUserProfile={currentUserProfile} theme={orgData.theme} />
                )}
                {mainTab === 'settings' && isEditing && organisationData && (
                    <OrgSettingsTab organisation={organisationData} />
                )}
                {mainTab === 'logs' && isEditing && (
                     <ActivityLog domain={currentUserProfile.domain} />
                )}
            </main>
        </div>
    </div>
  );
};
