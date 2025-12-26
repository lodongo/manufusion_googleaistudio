
import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../types';
import OnHandInventoryTab from './inventory/OnHandInventoryTab';
import MasterDataRegistryTab from './inventory/MasterDataRegistryTab';
import NewMaterialTab from './inventory/NewMaterialTab';
import RequestsTab from './inventory/RequestsTab';

interface InventoryProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onViewMaterial: (materialId: string, path?: string) => void;
  currencyConfig: { local: string; base: string; rate: number };
}

const Inventory: React.FC<InventoryProps> = ({ currentUser, theme, organisation, onViewMaterial, currencyConfig }) => {
    const [activeSubTab, setActiveSubTab] = useState<'onHand' | 'masterData' | 'newMaterial' | 'requests'>('onHand');
    
    const TabButton: React.FC<{ id: 'onHand' | 'masterData' | 'newMaterial' | 'requests', label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveSubTab(id)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 transition-colors ${activeSubTab === id ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white p-4 md:p-6 rounded-b-lg shadow-md h-full flex flex-col">
            {/* Sub-Tab Navigation */}
            <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
                <TabButton id="onHand" label="Warehouse Inventory" />
                <TabButton id="masterData" label="Master Data Registry" />
                <TabButton id="newMaterial" label="New Material" />
                <TabButton id="requests" label="Requests" />
            </div>

            <div className="flex-1">
                {activeSubTab === 'onHand' && (
                    <OnHandInventoryTab 
                        currentUser={currentUser} 
                        theme={theme} 
                        organisation={organisation} 
                        onViewMaterial={onViewMaterial}
                        currencyConfig={currencyConfig}
                    />
                )}
                {activeSubTab === 'masterData' && (
                    <MasterDataRegistryTab 
                        currentUser={currentUser} 
                        theme={theme} 
                        organisation={organisation} 
                        onViewMaterial={onViewMaterial} 
                    />
                )}
                {activeSubTab === 'newMaterial' && (
                    <NewMaterialTab 
                        currentUser={currentUser} 
                        theme={theme} 
                        organisation={organisation} 
                    />
                )}
                {activeSubTab === 'requests' && (
                    <RequestsTab
                        currentUser={currentUser}
                        theme={theme}
                        organisation={organisation}
                    />
                )}
            </div>
        </div>
    );
};

export default Inventory;
