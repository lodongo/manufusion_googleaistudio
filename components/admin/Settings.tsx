
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import Input from '../Input';
import Button from '../Button';
import type { MemsSettings } from '../../types';
import { addLog } from '../../services/logger';
import { useAuth } from '../../context/AuthContext';
import IndustryTypesTab from './IndustryTypesTab';
import CountriesDataTab from './CountriesDataTab';
import SectionsTab from './SectionsTab';
import UnitsTab from './UnitsTab';

const Settings: React.FC = () => {
    const { currentUserProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('memsSetup');
    const [settings, setSettings] = useState<MemsSettings>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (activeTab === 'memsSetup') {
            const fetchSettings = async () => {
                setIsLoading(true);
                const docRef = db.collection('settings').doc('memsSetup');
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    setSettings(docSnap.data() as MemsSettings);
                }
                setIsLoading(false);
            };
            fetchSettings();
        }
    }, [activeTab]);
    
    const handleSave = async () => {
        if (!currentUserProfile) return;
        setIsSaving(true);
        try {
            const docRef = db.collection('settings').doc('memsSetup');
            await docRef.set(settings, { merge: true });

            await addLog({
                action: 'Settings Updated',
                performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email },
                details: 'Updated MEMS default password setting.'
            });

            alert('Settings saved successfully!');
        } catch (error) {
            console.error("Error saving settings:", error);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderContent = () => {
        if (isLoading && activeTab === 'memsSetup') {
            return <div className="flex justify-center items-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
        }
        
        switch (activeTab) {
            case 'memsSetup':
                return (
                    <div className="bg-white p-6 rounded-lg shadow space-y-4 max-w-lg">
                         <h3 className="text-lg font-medium text-gray-900">Default Password</h3>
                         <p className="text-sm text-gray-500">
                             Set the default password for new users created by an admin or for users whose passwords are reset.
                             Users will be required to change this password upon their first login.
                         </p>
                        <Input 
                            id="defaultPassword"
                            label="Default User Password"
                            type="text"
                            value={settings.defaultPassword || ''}
                            onChange={(e) => setSettings(s => ({...s, defaultPassword: e.target.value}))}
                        />
                        <div className="pt-2">
                           <Button onClick={handleSave} isLoading={isSaving}>Save Settings</Button>
                        </div>
                    </div>
                );
            case 'sections':
                return <SectionsTab />;
            case 'industryTypes':
                return <IndustryTypesTab />;
            case 'countriesData':
                return <CountriesDataTab />;
            case 'units':
                return <UnitsTab />;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
        <button 
            onClick={() => setActiveTab(tabName)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
            {label}
        </button>
      );

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Settings</h2>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabName="memsSetup" label="MEMS Setup" />
                    <TabButton tabName="sections" label="Sections" />
                    <TabButton tabName="industryTypes" label="Industry Types" />
                    <TabButton tabName="countriesData" label="Countries Data" />
                    <TabButton tabName="units" label="Units" />
                </nav>
            </div>
            <div className="mt-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default Settings;
