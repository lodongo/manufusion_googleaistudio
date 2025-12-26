
import React, { useState } from 'react';
import type { Organisation, AppUser } from '../../../types';
import StockTakeDashboard from './StockTakeDashboard';
import StockTakeSessions from './StockTakeSessions';
import StockTakeReview from './StockTakeReview';
import StockTakeSetup from './StockTakeSetup';
import StockTakeHistorical from './StockTakeHistorical';

interface StockTakeAdminTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const StockTakeAdminTab: React.FC<StockTakeAdminTabProps> = ({ organisation, theme, currentUser }) => {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');

    const subTabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'sessions', label: 'Sessions' },
        { id: 'postings', label: 'Review and Posting' },
        { id: 'history', label: 'Historical' },
        { id: 'setup', label: 'Setup' },
    ];

    const SubTabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
        <button
          onClick={() => setActiveSubTab(tabId)}
          className={`whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
            activeSubTab === tabId ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {label}
        </button>
    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'dashboard':
                return <StockTakeDashboard organisation={organisation} theme={theme} />;
            case 'sessions':
                return <StockTakeSessions organisation={organisation} theme={theme} currentUser={currentUser} />;
            case 'postings':
                return <StockTakeReview organisation={organisation} theme={theme} currentUser={currentUser} />;
            case 'history':
                return <StockTakeHistorical organisation={organisation} theme={theme} currentUser={currentUser} />;
            case 'setup':
                return <StockTakeSetup organisation={organisation} theme={theme} currentUser={currentUser} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
             <div className="border-b border-slate-200 overflow-x-auto">
                <nav className="-mb-px flex space-x-4">
                    {subTabs.map(tab => <SubTabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
                </nav>
            </div>
            <div className="min-h-[400px]">
                {renderContent()}
            </div>
        </div>
    );
};

export default StockTakeAdminTab;
