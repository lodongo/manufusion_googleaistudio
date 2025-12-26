import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

import AuthForm from './components/AuthForm';
import Website from './components/Website';
import AdminDashboard from './components/AdminDashboard';
import OrgDashboard from './components/OrgDashboard';
import { SetupOrg } from './components/SetupOrg';
import ChangePasswordForm from './components/ChangePasswordForm';
import AccountStatusPage from './components/AccountStatusPage';
import { db } from './services/firebase';
import type { Organisation } from './types';

type UnauthenticatedView = 'website' | 'auth';
type AuthenticatedDashboard = 'admin' | 'org' | 'setup' | 'pendingSetup';
type AuthStatus = 'loading' | 'needsPasswordChange' | 'authenticated' | 'unauthenticated' | 'accountDisabled';

const App: React.FC = () => {
  const { user, loading, currentUserProfile, profileLoading, logout } = useAuth();
  
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [accountStatusReason, setAccountStatusReason] = useState<'disabled' | 'deleted' | null>(null);
  const [unauthView, setUnauthView] = useState<UnauthenticatedView>('auth'); 
  const [initialAuthMode, setInitialAuthMode] = useState<'login' | 'signup'>('login');
  const [dashboardView, setDashboardView] = useState<AuthenticatedDashboard | null>(null);
  const [orgData, setOrgData] = useState<Organisation | null>(null);
  
  useEffect(() => {
    if (loading || (user && profileLoading)) {
      setAuthStatus('loading');
      return;
    }

    if (user && currentUserProfile) {
      if (currentUserProfile.status === 'disabled' || currentUserProfile.status === 'deleted') {
        setAccountStatusReason(currentUserProfile.status);
        setAuthStatus('accountDisabled');
        return;
      }
      
      if (currentUserProfile.mustChangePassword) {
        setAuthStatus('needsPasswordChange');
      } else {
        setAuthStatus('authenticated');
      }
    } else {
      setAuthStatus('unauthenticated');
    }
  }, [user, loading, currentUserProfile, profileLoading]);

  useEffect(() => {
    if (authStatus === 'authenticated' && user && currentUserProfile) {
      const domain = currentUserProfile.domain;
      if (domain === 'manufusion.com') {
        setDashboardView('admin');
      } else {
        const fetchOrg = async () => {
          const orgDocRef = db.collection('organisations').doc(domain);
          const orgDocSnap = await orgDocRef.get();
          
          if (orgDocSnap.exists) {
            const orgDataFromSnap = { id: orgDocSnap.id, ...orgDocSnap.data() } as Organisation;
            setOrgData(orgDataFromSnap);
            setDashboardView('org');
          } else {
            if (currentUserProfile.accessLevel === 5) {
                setDashboardView('setup');
            } else {
                setDashboardView('pendingSetup');
            }
          }
        };
        fetchOrg();
      }
    }
  }, [authStatus, user, currentUserProfile]);

  if (authStatus === 'loading') {
    return <div className="flex items-center justify-center h-screen"><div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }

  if (authStatus === 'accountDisabled') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
          <AccountStatusPage status={accountStatusReason || 'disabled'} onLogout={logout} />
      </div>
    );
  }

  if (authStatus === 'needsPasswordChange') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <ChangePasswordForm onPasswordChanged={() => window.location.reload()} />
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    if (unauthView === 'auth') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
                <AuthForm 
                    initialMode={initialAuthMode} 
                    onSwitchToHomepage={() => setUnauthView('website')} 
                />
            </div>
        );
    }
    return (
        <Website 
            onLoginClick={() => { setInitialAuthMode('login'); setUnauthView('auth'); }} 
            onSetupClick={() => { setInitialAuthMode('signup'); setUnauthView('auth'); }} 
        />
    );
  }

  if (dashboardView === 'admin') {
    return <AdminDashboard />;
  }

  if (dashboardView === 'setup') {
    return <SetupOrg onOrgCreated={(data) => { setOrgData(data); setDashboardView('org'); }} onGoToOrgDashboard={() => setDashboardView('org')} organisationData={orgData || undefined} />;
  }

  if (dashboardView === 'pendingSetup') {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="bg-white p-8 rounded shadow text-center">
                <h2 className="text-xl font-bold mb-4">Organisation Setup Pending</h2>
                <p>Your organisation has not been set up yet. Please contact your administrator.</p>
                <button onClick={logout} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Logout</button>
            </div>
        </div>
    );
  }

  if (dashboardView === 'org' && orgData) {
    return <OrgDashboard organisation={orgData} onGoToSetup={() => setDashboardView('setup')} />;
  }

  return <div>Loading...</div>;
};

export default App;