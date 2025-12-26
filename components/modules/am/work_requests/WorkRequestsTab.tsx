
import React, { useState } from 'react';
import type { AppUser, Organisation } from '../../../../types';
import type { WorkRequest, WorkOrder } from '../../../../types/am_types';
import CreateWorkRequest from './CreateWorkRequest';
import WorkRequestDashboard from './WorkRequestDashboard';
import { WorkRequestList } from './WorkRequestList';

interface WorkRequestsTabProps {
    currentUser: AppUser;
    theme: Organisation['theme'];
    organisation: Organisation;
    onViewWorkOrder: (workOrder: WorkOrder) => void;
}

type MainTab = 'new_requests' | 'converted_requests';
type NewRequestSubTab = 'dashboard' | 'list';

const WorkRequestsTab: React.FC<WorkRequestsTabProps> = ({ currentUser, theme, organisation, onViewWorkOrder }) => {
    // Top level tab state
    const [activeMainTab, setActiveMainTab] = useState<MainTab>('new_requests');
    
    // Sub tab state for 'New Requests'
    const [newReqSubTab, setNewReqSubTab] = useState<NewRequestSubTab>('dashboard');
    
    // UI state for creating/editing
    const [isCreating, setIsCreating] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<WorkRequest | null>(null);

    const handleEditRequest = (request: WorkRequest) => {
        setRequestToEdit(request);
        setIsCreating(true);
    };

    const handleCreateComplete = () => {
        setIsCreating(false);
        setRequestToEdit(null);
        // Switch to list view to see the new item
        if (activeMainTab === 'new_requests') {
            setNewReqSubTab('list');
        } else {
            setActiveMainTab('new_requests');
            setNewReqSubTab('list');
        }
    };

    const MainTabButton: React.FC<{ tabId: MainTab, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => {
                setActiveMainTab(tabId);
                setIsCreating(false); 
                setRequestToEdit(null);
            }}
            className={`whitespace-nowrap py-3 px-6 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeMainTab === tabId
                    ? '' // Color applied via style
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeMainTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    const SubTabButton: React.FC<{ tabId: NewRequestSubTab, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => {
                setNewReqSubTab(tabId);
                setIsCreating(false);
                setRequestToEdit(null);
            }}
            className={`whitespace-nowrap py-1.5 px-3 rounded-md font-medium text-xs transition-colors duration-200 ${
                newReqSubTab === tabId
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
            }`}
            style={newReqSubTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    // If showing the create/edit form
    if (isCreating) {
        return (
            <div className="bg-white rounded-b-lg shadow-md p-6">
                <div className="mb-4">
                    <button 
                        onClick={() => { setIsCreating(false); setRequestToEdit(null); }}
                        className="text-sm hover:underline flex items-center gap-1"
                        style={{ color: theme.colorPrimary }}
                    >
                        &larr; Back to List
                    </button>
                </div>
                <CreateWorkRequest 
                    currentUser={currentUser} 
                    theme={theme} 
                    organisation={organisation} 
                    onComplete={handleCreateComplete} 
                    requestToEdit={requestToEdit || undefined} 
                />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-b-lg shadow-md min-h-[500px]">
            {/* Level 1 Navigation: New vs Converted */}
            <div className="border-b border-slate-200 bg-white">
                <nav className="-mb-px flex" aria-label="Main Tabs">
                    <MainTabButton tabId="new_requests" label="New Requests" />
                    <MainTabButton tabId="converted_requests" label="Converted Requests" />
                </nav>
            </div>

            <div className="p-4 md:p-6">
                {activeMainTab === 'new_requests' && (
                    <div className="space-y-6">
                        {/* Level 2 Navigation: Dashboard vs List */}
                        <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                            <SubTabButton tabId="dashboard" label="Dashboard" />
                            <SubTabButton tabId="list" label="List" />
                        </div>

                        {newReqSubTab === 'dashboard' && (
                            <WorkRequestDashboard 
                                currentUser={currentUser} 
                                theme={theme} 
                                organisation={organisation} 
                            />
                        )}

                        {newReqSubTab === 'list' && (
                            <WorkRequestList 
                                currentUser={currentUser} 
                                theme={theme} 
                                organisation={organisation} 
                                onEditRequest={handleEditRequest}
                                onViewWorkOrder={onViewWorkOrder}
                                viewMode="new"
                                onCreate={() => setIsCreating(true)}
                            />
                        )}
                    </div>
                )}

                {activeMainTab === 'converted_requests' && (
                    <WorkRequestList 
                        currentUser={currentUser} 
                        theme={theme} 
                        organisation={organisation} 
                        onEditRequest={handleEditRequest} // Though typically converted ones might be read-only for editing
                        onViewWorkOrder={onViewWorkOrder}
                        viewMode="converted"
                    />
                )}
            </div>
        </div>
    );
};

export default WorkRequestsTab;
