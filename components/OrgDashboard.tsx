
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { Module, Organisation } from '../types';
import UserModal from './admin/UserModal';
import ToolsDashboard from './ToolsDashboard';

// Statically import all module pages to avoid dynamic import issues.
import AmAdminPage from './modules/am_admin';
import AmUserPage from './modules/am_user';
import FiAdminPage from './modules/fi_admin';
import FiUserPage from './modules/fi_user';
import FlAdminPage from './modules/fl_admin';
import FlUserPage from './modules/fl_user';
import HrAdminPage from './modules/hr_admin';
import HrUserPage from './modules/hr_user';
import InAdminPage from './modules/in_admin';
import InUserPage from './modules/in_user';
import MaAdminPage from './modules/ma_admin';
import MaUserPage from './modules/ma_user';
import OdAdminPage from './modules/od_admin';
import OdUserPage from './modules/od_user';
import PrAdminPage from './modules/pr_admin';
import PrUserPage from './modules/pr_user';
import WhAdminPage from './modules/wh_admin';
import WhUserPage from './modules/wh_user';
import SheAdminPage from './modules/she_admin';
import SheUserPage from './modules/she_user';
import MatAdminPage from './modules/mat_admin';
import MatUserPage from './modules/mat_user';
import EmAdminPage from './modules/em_admin';
import EmUserPage from './modules/em_user';

// --- Icon Components for Modules ---
const ModuleIcon: React.FC<{ code: string }> = ({ code }) => {
  const iconClass = "w-5 h-5";
  switch (code) {
    case 'OD': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    case 'HR': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a3.001 3.001 0 015.658 0M12 6a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'FI': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    case 'PR': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
    case 'MA': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.572 1.065c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'AM': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14M5 10h14M5 14h14M5 18h14" /></svg>;
    case 'IN': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case 'WH': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 17l-3.13-3.13a4 4 0 010-5.66L14 5" /><path d="M7 12a4 4 0 000 5.66L10.13 20.8a4 4 0 005.66 0L19 17.66a4 4 0 000-5.66L15.87 8.87a4 4 0 00-5.66 0L7 12z" /><path d="M7 12L3.13 8.13a4 4 0 010-5.66L6.26  H12a4 4 0 015.66 0L20.8 5.47a4 4 0 010 5.66L17 14" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
    case 'FL': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'EM': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    default: return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
  }
};
const ProfileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const ToolsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>;


interface OrgDashboardProps {
  organisation: Organisation;
  onGoToSetup: () => void;
}

const OrgDashboard: React.FC<OrgDashboardProps> = ({ organisation, onGoToSetup }) => {
  const { currentUserProfile, logout } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [dashboardView, setDashboardView] = useState<'modules' | 'tools'>('modules');
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      try {
        // 1. Get IDs of subscribed and activated modules from the new subcollection
        const subscribedModulesRef = db.collection('organisations').doc(organisation.domain).collection('modules');
        const qSubscribed = subscribedModulesRef.where("activated", "==", true);
        const subscribedSnapshot = await qSubscribed.get();
        const subscribedIds = new Set(subscribedSnapshot.docs.map(doc => doc.id));

        if (subscribedIds.size === 0) {
            setModules([]);
        } else {
            // 2. Get all module definitions from the top-level 'modules' collection
            const allModulesRef = db.collection("modules");
            const qAll = allModulesRef.orderBy("name");
            const allModulesSnapshot = await qAll.get();
            let allModulesData = allModulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
            
            // 3. Filter all modules by the subscribed and activated IDs
            const filteredModules = allModulesData.filter(m => subscribedIds.has(m.id));
            setModules(filteredModules);
        }
      } catch (error) {
        console.error("Error fetching modules for organisation:", error);
        setModules([]); // Show empty state on error
      } finally {
        setLoading(false);
      }
    };

    if (organisation?.domain) {
      fetchModules();
    } else {
      setLoading(false);
      setModules([]);
    }
  }, [organisation]);

  const renderModulePage = () => {
    if (!activeModule || !currentUserProfile) return null;
    
    const commonProps = {
        module: activeModule,
        onBackToDashboard: () => setActiveModule(null),
        theme: organisation.theme,
        organisation: organisation,
    };

    const userProps = {
        ...commonProps,
        currentUser: currentUserProfile,
        onSwitchToAdmin: () => setView('admin'),
    };

    const adminProps = {
        ...commonProps,
        currentUser: currentUserProfile,
        onSwitchToUser: () => setView('user'),
    };
    
    switch (activeModule.code) {
        case 'OD': return view === 'user' ? <OdUserPage {...userProps} /> : <OdAdminPage {...adminProps} />;
        case 'HR': return view === 'user' ? <HrUserPage {...userProps} /> : <HrAdminPage {...adminProps} />;
        case 'FI': return view === 'user' ? <FiUserPage {...userProps} /> : <FiAdminPage {...adminProps} />;
        case 'PR': return view === 'user' ? <PrUserPage {...userProps} /> : <PrAdminPage {...adminProps} />;
        case 'MA': return view === 'user' ? <MaUserPage {...userProps} /> : <MaAdminPage {...adminProps} />;
        case 'AM': return view === 'user' ? <AmUserPage {...userProps} /> : <AmAdminPage {...adminProps} />;
        case 'IN': return view === 'user' ? <InUserPage {...userProps} /> : <InAdminPage {...adminProps} />;
        case 'WH': return view === 'user' ? <WhUserPage {...userProps} /> : <WhAdminPage {...adminProps} />;
        case 'FL': return view === 'user' ? <FlUserPage {...userProps} /> : <FlAdminPage {...adminProps} />;
        case 'SHE': return view === 'user' ? <SheUserPage {...userProps} /> : <SheAdminPage {...adminProps} />;
        case 'MAT': return view === 'user' ? <MatUserPage {...userProps} /> : <MatAdminPage {...adminProps} />;
        case 'EM': return view === 'user' ? <EmUserPage {...userProps} /> : <EmAdminPage {...adminProps} />;
        default:
            return (
                <div className="p-8 bg-white rounded-lg shadow">
                    <h2 className="text-2xl font-bold">Module Not Implemented</h2>
                    <p className="mt-2 text-gray-600">The page component for module code "{activeModule.code}" has not been created yet.</p>
                    <button onClick={() => setActiveModule(null)} className="mt-4 px-4 py-2 text-white rounded-md" style={{backgroundColor: organisation.theme.colorPrimary}}>Back to Hub</button>
                </div>
            );
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen w-screen"><div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }
  
  if (!currentUserProfile) {
      // This case should be handled by App.tsx, but as a safeguard:
      return <div className="flex items-center justify-center h-screen w-screen"><div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }

  if (modules.length === 0 && dashboardView !== 'tools') {
    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <aside className={`fixed inset-y-0 left-0 bg-slate-800 text-white w-64 flex flex-col flex-shrink-0`}>
                 <div className="p-4 flex items-center gap-4 border-b border-slate-700">
                    {organisation.theme?.logoURL && <img src={organisation.theme.logoURL} alt={`${organisation.name} logo`} className="h-10 w-10 object-contain rounded-md bg-white p-1" />}
                    <div>
                        <h1 className="text-lg font-bold leading-tight">{organisation.name}</h1>
                    </div>
                </div>
                <div className="mt-4 px-2">
                    <button 
                        onClick={() => setDashboardView('tools')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 text-slate-300 hover:bg-slate-700 hover:text-white`}
                    >
                        <ToolsIcon />
                        <span>Tools</span>
                    </button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col items-center justify-center p-4 ml-64">
                <div className="w-full max-w-lg text-center bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800">Modules Not Set Up</h2>
                <p className="mt-2 text-gray-600">
                    Your organization has not subscribed to any modules yet.
                </p>
                {currentUserProfile.accessLevel === 5 ? (
                    <>
                    <p className="mt-2 text-gray-500">
                        As an administrator, you can configure which modules are available.
                    </p>
                    <button
                        onClick={onGoToSetup}
                        className="mt-6 px-4 py-2 text-white rounded-md hover:opacity-90"
                        style={{ backgroundColor: organisation.theme.colorPrimary }}
                    >
                        Configure Modules
                    </button>
                    </>
                ) : (
                    <p className="mt-2 text-gray-500">
                    Please contact your administrator to configure modules for your organization.
                    </p>
                )}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className={`fixed inset-y-0 left-0 bg-slate-800 text-white w-64 flex flex-col flex-shrink-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-30`}>
        <div className="p-4 flex items-center gap-4 border-b border-slate-700">
            {organisation.theme?.logoURL && <img src={organisation.theme.logoURL} alt={`${organisation.name} logo`} className="h-10 w-10 object-contain rounded-md bg-white p-1" />}
            <div>
                 <h1 className="text-lg font-bold leading-tight">{organisation.name}</h1>
                 {organisation.theme?.slogan && <p className="text-xs text-slate-400">{organisation.theme.slogan}</p>}
            </div>
        </div>
        
        <nav className="mt-4 flex-1 px-2 space-y-1 overflow-y-auto">
            <div className="mb-4">
                <button 
                    onClick={() => {
                        setDashboardView('tools');
                        setActiveModule(null);
                        setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 group relative ${dashboardView === 'tools' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                >
                    {dashboardView === 'tools' && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full" style={{backgroundColor: organisation.theme.colorPrimary}}></span>}
                    <ToolsIcon />
                    <span>Tools</span>
                </button>
            </div>
            
            <div className="pt-2 border-t border-slate-700">
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Modules</p>
              {modules.map(module => (
                <button 
                  key={module.id} 
                  onClick={() => {
                      setActiveModule(module);
                      setDashboardView('modules');
                      setView('user'); 
                      setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 group relative ${activeModule?.id === module.id && dashboardView === 'modules' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                >
                  {activeModule?.id === module.id && dashboardView === 'modules' && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full" style={{backgroundColor: organisation.theme.colorPrimary}}></span>}
                  <ModuleIcon code={module.code} />
                  <span>{module.name}</span>
                </button>
              ))}
            </div>
        </nav>
      </aside>
      
      {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20" onClick={() => setIsSidebarOpen(false)}></div>}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between md:justify-end items-center p-4 bg-white border-b border-slate-200">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-4">
                <button onClick={() => setIsUserModalOpen(true)} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                    <ProfileIcon /> <span className="hidden sm:inline">Edit Profile</span>
                </button>
                {currentUserProfile.accessLevel === 5 && (
                    <button onClick={onGoToSetup} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                        <SettingsIcon /> <span className="hidden sm:inline">Edit Organisation</span>
                    </button>
                )}
                <button onClick={logout} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                    <LogoutIcon /> <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {dashboardView === 'tools' ? (
              <ToolsDashboard currentUser={currentUserProfile} theme={organisation.theme} />
          ) : (
              activeModule ? renderModulePage() : (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-700">Welcome to MEMS</h2>
                    <p className="mt-4 text-slate-500">Select a module or tool from the menu to begin.</p>
                  </div>
                </div>
              )
          )}
        </main>
      </div>
      
      {currentUserProfile && (
        <UserModal 
            user={currentUserProfile} 
            currentUserProfile={currentUserProfile} 
            isOpen={isUserModalOpen} 
            onClose={() => setIsUserModalOpen(false)} 
            theme={organisation.theme}
        />
      )}
    </div>
  );
};

export default OrgDashboard;
