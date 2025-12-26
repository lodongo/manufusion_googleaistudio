import React, { useState } from 'react';
import type { MaterialMasterData, ProcurementData, Organisation } from '../../../../types';
import ProcurementInfoTab from './ProcurementInfoTab';
import ProcurementVendorsTab from './ProcurementVendorsTab';

const ProcurementDataTab: React.FC<{ 
    material: MaterialMasterData; 
    warehouseMaterialPath: string | null; 
    onUpdate?: (data: ProcurementData) => void;
    organisation: Organisation;
    currencyConfig: { local: string; base: string; rate: number };
}> = ({ material, warehouseMaterialPath, onUpdate, organisation, currencyConfig }) => {
    const [activeSubTab, setActiveSubTab] = useState<'info' | 'vendors'>('info');

    return (
        <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 px-6 bg-slate-50/50">
                <nav className="-mb-px flex space-x-6">
                    <button
                        onClick={() => setActiveSubTab('info')}
                        className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                            activeSubTab === 'info' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Procurement Info
                    </button>
                    <button
                        onClick={() => setActiveSubTab('vendors')}
                        className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                            activeSubTab === 'vendors' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Vendors & Agreements
                    </button>
                </nav>
            </div>

            <div className="flex-1 bg-white">
                {activeSubTab === 'info' && (
                    <ProcurementInfoTab 
                        material={material} 
                        warehouseMaterialPath={warehouseMaterialPath} 
                        onUpdate={onUpdate}
                        organisation={organisation}
                    />
                )}
                {activeSubTab === 'vendors' && (
                    <ProcurementVendorsTab 
                        material={material} 
                        warehouseMaterialPath={warehouseMaterialPath}
                        organisation={organisation}
                        currencyConfig={currencyConfig}
                    />
                )}
            </div>
        </div>
    );
};

export default ProcurementDataTab;