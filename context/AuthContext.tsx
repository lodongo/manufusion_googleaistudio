
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth, db } from '../services/firebase';
import type { AppUser } from '../types';

interface AuthContextType {
  user: firebase.User | null;
  loading: boolean;
  logout: () => Promise<void>;
  currentUserProfile: AppUser | null;
  profileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileLoading(true);
      const userRef = db.collection("users").doc(user.uid);
      const unsubscribeProfile = userRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
          setCurrentUserProfile({ ...docSnap.data(), uid: docSnap.id } as AppUser);
        } else {
          setCurrentUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error("Error fetching user profile:", error);
        setCurrentUserProfile(null);
        setProfileLoading(false);
      });
      return () => unsubscribeProfile();
    } else {
      setCurrentUserProfile(null);
      setProfileLoading(false);
    }
  }, [user]);

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    loading,
    logout,
    currentUserProfile,
    profileLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
