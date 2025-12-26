

// components/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Users from './admin/Users';
import UserModal from './admin/UserModal';
import UserAddModal from './admin/UserAddModal';
import ActivityLog from './admin/ActivityLog';
import Modules from './admin/Modules';
import ModuleEditModal from './admin/ModuleEditModal';
import Settings from './admin/Settings';
import type { AppUser, Module, Organisation } from '../types';
import { db } from '../services/firebase';
import ModuleRightsManager from './admin/ModuleRightsManager';
import ModulePageLoader from './common/ModulePageLoader';


// Icon components
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197" /></svg>;
const ActivityLogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const ModulesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const AdminDashboard: React.FC = () => {
    const { currentUserProfile, logout } = useAuth();
    const [activeView, setActiveView] = useState('dashboard');
    
    // State for modals
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isUserAddModalOpen, setIsUserAddModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
    const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
    const [selectedModuleForEdit, setSelectedModuleForEdit] = useState<Module | null>(null);
    const [selectedModuleForSetup, setSelectedModuleForSetup] = useState<Module | null>(null);
    const [selectedModuleForRights, setSelectedModuleForRights] = useState<Module | null>(null);
    
    // State for mobile sidebar
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // New state for module page navigation within the 'dashboard' view
    const [modules, setModules] = useState<Module[]>([]);
    const [moduleView, setModuleView] = useState<'hub' | 'user' | 'admin'>('hub');
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [modulesLoading, setModulesLoading] = useState(true);

    const manufusionOrg: Organisation = {
        id: 'manufusion.com',
        name: 'Manufusion',
        domain: 'manufusion.com',
        industryCategory: 'Software',
        industrySubcategory: 'Enterprise Management Systems',
        currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
        address: {
          continent: 'North America',
          country: 'United States',
          countryIsoCode: 'US',
          town: 'Admin City',
          road: '123 MEMS Lane',
          block: 'A',
        },
        phoneNumber: '+15551234567',
        website: 'https://www.manufusion.com',
        theme: {
          slogan: 'Manufusion Enterprise Management System',
          logoURL: '',
          colorPrimary: '#4F46E5', // indigo-600
          colorSecondary: '#10B981',
          colorAccent: '#F97316',
        },
        createdBy: 'system',
        createdAt: new Date().toISOString(),
    };

    useEffect(() => {
        const q = db.collection("modules").orderBy("name");
        const unsubscribe = q.onSnapshot((snapshot) => {
            const modulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
            setModules(modulesData);
            setModulesLoading(false);
        }, (error) => {
            console.error("Error fetching modules:", error);
            setModulesLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Reset module view when navigating away from the dashboard
    useEffect(() => {
        if (activeView !== 'dashboard') {
            setModuleView('hub');
            setSelectedModule(null);
        }
        if (activeView !== 'modules') {
            setSelectedModuleForSetup(null);
            setSelectedModuleForRights(null);
        }
    }, [activeView]);

    const handleUserSelect = (user: AppUser) => {
        setSelectedUser(user);
        setIsUserModalOpen(true);
    };

    const handleModuleSelectForEdit = (module: Module) => {
        setSelectedModuleForEdit(module);
        setIsModuleModalOpen(true);
    };

    const handleModuleSelectForSetup = (module: Module) => {
        setSelectedModuleForSetup(module);
    };

    const handleModuleRightsSelect = (module: Module) => {
        setSelectedModuleForRights(module);
    };

    const handleModuleCardClick = (module: Module) => {
        setSelectedModule(module);
        setModuleView('user');
    };

    const renderDashboardContent = () => {
        if (!currentUserProfile) return null;

        if (moduleView !== 'hub' && selectedModule) {
            const props = {
                module: selectedModule,
                onBackToDashboard: () => setModuleView('hub'),
                theme: manufusionOrg.theme,
                currentUser: currentUserProfile,
                onSwitchToAdmin: () => setModuleView('admin'),
                onSwitchToUser: () => setModuleView('user'),
                organisation: manufusionOrg,
            };
    
            return <ModulePageLoader 
                moduleCode={selectedModule.code} 
                pageType={moduleView}
                {...props}
            />;
        }

        // This is the 'hub' view
        if (modulesLoading) {
            return <div className="flex justify-center items-center p-8"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
        }
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Module Hub</h1>
                <p className="text-gray-600 mb-6">Select a module to view its user-facing dashboard or manage its settings.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map(module => (
                        <button 
                            key={module.id} 
                            onClick={() => handleModuleCardClick(module)}
                            className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-xl hover:-translate-y-1 transition-all"
                        >
                        <h2 className="text-xl font-bold text-gray-900">{module.name}</h2>
                        <p className="text-gray-600 mt-2 text-sm">{module.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderModuleSetupPage = () => {
        if (!selectedModuleForSetup) return null;
        
        return <ModulePageLoader
            moduleCode={selectedModuleForSetup.code}
            pageType="memssetup"
            module={selectedModuleForSetup}
            onBackToModules={() => setSelectedModuleForSetup(null)}
        />
    };

    const renderContent = () => {
        if (!currentUserProfile) {
            return <div className="flex justify-center items-center h-full"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
        }

        switch (activeView) {
            case 'dashboard':
                return renderDashboardContent();
            case 'users':
                return <div className="p-4 md:p-8"><Users onUserSelect={handleUserSelect} onAddUser={() => setIsUserAddModalOpen(true)} currentUserProfile={currentUserProfile} /></div>;
            case 'modules':
                if (selectedModuleForSetup) return renderModuleSetupPage();
                if (selectedModuleForRights) return <ModuleRightsManager module={selectedModuleForRights} onBackToModules={() => setSelectedModuleForRights(null)} />;
                return <div className="p-4 md:p-8"><Modules onModuleSelect={handleModuleSelectForEdit} onModuleSetupSelect={handleModuleSelectForSetup} onModuleRightsSelect={handleModuleRightsSelect} currentUserProfile={currentUserProfile} /></div>;
            case 'activity':
                return <div className="p-4 md:p-8"><ActivityLog /></div>;
            case 'settings':
                return <div className="p-4 md:p-8"><Settings /></div>;
            default:
                return <div className="p-4 md:p-8"><h1 className="text-2xl">Welcome, {currentUserProfile.firstName}</h1></div>;
        }
    };
    
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
        { id: 'users', label: 'Users', icon: <UsersIcon /> },
        { id: 'modules', label: 'Modules', icon: <ModulesIcon /> },
        { id: 'activity', label: 'Activity Log', icon: <ActivityLogIcon /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    ];
    
    const Sidebar = () => (
        <aside className={`fixed inset-y-0 left-0 bg-gray-800 text-white w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-30`}>
            <div className="p-4 border-b border-gray-700">
                <h1 className="text-2xl font-bold">MEMS Admin</h1>
            </div>
            <nav className="mt-4">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActiveView(item.id);
                            setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center px-4 py-3 hover:bg-gray-700 transition-colors ${activeView === item.id ? 'bg-gray-900' : ''}`}
                    >
                        {item.icon}
                        <span className="ml-3">{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex justify-between md:justify-end items-center p-4 bg-white border-b">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center">
                        <span className="mr-4 text-sm">Welcome, {currentUserProfile?.firstName}</span>
                        <button onClick={logout} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Logout</button>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
                    {renderContent()}
                </main>
            </div>

            {currentUserProfile && (
                <>
                    {selectedUser && <UserModal user={selectedUser} currentUserProfile={currentUserProfile} isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} />}
                    <UserAddModal currentUserProfile={currentUserProfile} isOpen={isUserAddModalOpen} onClose={() => setIsUserAddModalOpen(false)} />
                    {selectedModuleForEdit && <ModuleEditModal module={selectedModuleForEdit} isOpen={isModuleModalOpen} onClose={() => setIsModuleModalOpen(false)} onUpdate={() => setIsModuleModalOpen(false)} />}
                </>
            )}
        </div>
    );
};

export default AdminDashboard;