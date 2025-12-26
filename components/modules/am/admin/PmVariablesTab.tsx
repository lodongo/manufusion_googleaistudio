import React, { useState } from 'react';
import type { Organisation } from '../../../../types';
import IntervalsSubTab from './IntervalsSubTab';
import DisciplinesSubTab from './DisciplinesSubTab';
import PmStatusesSubTab from './PmStatusesSubTab';

interface PmVariablesTabProps {
    theme: Organisation['theme'];
}

type SubTab = 'intervals' | 'disciplines' | 'statuses';

const PmVariablesTab: React.FC<PmVariablesTabProps> = ({ theme }) => {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('intervals');

    const subTabs = [
        { id: 'intervals', label: 'Intervals' },
        { id: 'disciplines', label: 'Disciplines' },
        { id: 'statuses', label: 'Asset Statuses' },
    ];

    const NavButton: React.FC<{ tabId: SubTab, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveSubTab(tabId)}
            className={`whitespace-nowrap py-1.5 px-4 rounded-md font-bold text-xs transition-colors duration-200 ${
                activeSubTab === tabId
                    ? 'text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-200'
            }`}
            style={activeSubTab === tabId ? { backgroundColor: theme?.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-md min-h-[500px] border border-slate-200">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">PM Maintenance Variables</h2>
                <p className="text-sm text-slate-500 mt-1">Configure the core parameters used in preventive maintenance planning across the organization.</p>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-lg w-fit mb-8 shadow-inner">
                {subTabs.map(tab => (
                    <NavButton key={tab.id} tabId={tab.id as SubTab} label={tab.label} />
                ))}
            </div>

            <div className="animate-fade-in">
                {activeSubTab === 'intervals' && <IntervalsSubTab />}
                {activeSubTab === 'disciplines' && <DisciplinesSubTab />}
                {activeSubTab === 'statuses' && <PmStatusesSubTab />}
            </div>
        </div>
    );
};

export default PmVariablesTab;