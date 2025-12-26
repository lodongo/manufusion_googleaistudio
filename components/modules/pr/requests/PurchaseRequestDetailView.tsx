import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { PurchaseRequisition } from '../../../../types/pr_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';

// Tabs
import PrDashboardTab from './PrDashboardTab';
import PrDetailsTab from './PrDetailsTab';
import PrProcessingTab from './PrProcessingTab';

interface PurchaseRequestDetailViewProps {
    prId: string;
    onBack: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const PurchaseRequestDetailView: React.FC<PurchaseRequestDetailViewProps> = ({ prId, onBack, organisation, theme, currentUser }) => {
    const [pr, setPr] = useState<PurchaseRequisition | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'details' | 'processing'>('dashboard');
    
    useEffect(() => {
        setLoading(true);
        const docRef = doc(db, `organisations/${organisation.domain}/modules/PR/perchaseRequisitions/${prId}`);
        
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() } as PurchaseRequisition;
                setPr(data);

                // If user is on 'processing' tab but PR is no longer 'APPROVED', fallback to dashboard
                if (activeTab === 'processing' && data.status !== 'APPROVED') {
                    setActiveTab('dashboard');
                }
            } else {
                setPr(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error listening to PR updates", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [prId, organisation.domain, activeTab]);

    const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId as any)}
            className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tabId
                    ? '' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
        >
            {label}
        </button>
    );

    if (loading) return <div className="p-8 text-center">Loading Purchase Request...</div>;
    if (!pr) return <div className="p-8 text-center">Request not found.</div>;

    // Sourcing / Processing actions only allowed for APPROVED requisitions
    const canProcess = pr.status === 'APPROVED';

    return (
        <Modal isOpen={true} onClose={onBack} title={`Purchase Request: ${pr.prNumber}`} size="7xl">
            <div className="flex flex-col h-full space-y-4">
                 <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6">
                        <TabButton tabId="dashboard" label="Dashboard" />
                        <TabButton tabId="details" label="Details" />
                        {canProcess && <TabButton tabId="processing" label="Processing" />}
                    </nav>
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-[500px]">
                    {activeTab === 'dashboard' && <PrDashboardTab pr={pr} />}
                    {activeTab === 'details' && (
                        <PrDetailsTab 
                            pr={pr} 
                            organisation={organisation} 
                            theme={theme} 
                            currentUser={currentUser} 
                        />
                    )}
                    {activeTab === 'processing' && canProcess && (
                        <PrProcessingTab 
                            pr={pr} 
                            organisation={organisation} 
                            currentUser={currentUser} 
                            theme={theme}
                        />
                    )}
                </div>

                <div className="border-t pt-4 flex justify-end">
                    <Button onClick={onBack} variant="secondary">Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseRequestDetailView;
