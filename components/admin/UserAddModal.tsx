
import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { db, firebaseConfig } from '../../services/firebase';
import { addLog } from '../../services/logger';
import type { AppUser, MemsSettings } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import CountryCodeSelect from '../CountryCodeSelect';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

interface UserAddModalProps {
  currentUserProfile: AppUser;
  isOpen: boolean;
  onClose: () => void;
}

const UserAddModal: React.FC<UserAddModalProps> = ({ currentUserProfile, isOpen, onClose }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryIsoCode, setCountryIsoCode] = useState('US');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accessLevel, setAccessLevel] = useState<AppUser['accessLevel']>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEmailEditable, setIsEmailEditable] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Reset form when modal is opened/closed and auto-detect country
  useEffect(() => {
    if (isOpen) {
        try {
            const userLocale = navigator.language;
            if (userLocale) {
                const countryCode = userLocale.split('-')[1]?.toUpperCase();
                if (countryCode) {
                    setCountryIsoCode(countryCode);
                }
            }
        } catch (e) {
            console.warn("Could not auto-detect country for admin.", e);
        }
    } else {
        // Reset logic
        setFirstName('');
        setLastName('');
        setEmail('');
        setCountryIsoCode('US'); // Default back to US on close
        setPhoneNumber('');
        setAccessLevel(1);
        setErrors({});
        setIsEmailEditable(false);
        setIsCheckingEmail(false);
    }
  }, [isOpen]);

  // Auto-generate email
  useEffect(() => {
    if (firstName && lastName && !isEmailEditable) {
      const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const generatedEmail = `${first}.${last}@manufusion.com`;
      setEmail(generatedEmail);
    }
  }, [firstName, lastName, isEmailEditable]);

  // Debounced email validation
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!email) {
        setErrors(e => ({ ...e, email: '' }));
        return;
      }
      
      const emailRegex = /^[^\s@]+@manufusion\.com$/;
      if (!emailRegex.test(email)) {
          setErrors(e => ({ ...e, email: "Email must end with @manufusion.com" }));
          return;
      }

      setIsCheckingEmail(true);
      try {
        const q = db.collection("users").where("email", "==", email);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
            setErrors(e => ({ ...e, email: "This email already exists. Please provide a unique one." }));
            setIsEmailEditable(true); // Allow editing
        } else {
            setErrors(e => ({ ...e, email: '' }));
        }
      } catch (e) {
        console.error("Email check failed:", e);
        setErrors(prev => ({ ...prev, email: 'Could not verify email.' }));
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [email]);
  
  // Phone number validation
  useEffect(() => {
    if (!phoneNumber) {
      setErrors(e => ({ ...e, phoneNumber: '' }));
      return;
    };
    if (isValidPhoneNumber(phoneNumber, countryIsoCode as CountryCode)) {
      setErrors(e => ({ ...e, phoneNumber: '' }));
    } else {
      setErrors(e => ({ ...e, phoneNumber: 'Invalid phone number for the selected country.' }));
    }
  }, [phoneNumber, countryIsoCode]);

  const handleAddUser = async () => {
    if (Object.values(errors).some(e => e) || !firstName || !lastName || !phoneNumber || !email) {
        setErrors(e => ({ ...e, form: 'Please fill in all fields correctly.' }));
        return;
    }
      
    setIsLoading(true);
    setErrors({});

    const appName = 'userCreationApp';
    let secondaryApp: firebase.app.App | undefined;

    try {
        secondaryApp = firebase.initializeApp(firebaseConfig, appName);
        const secondaryAuth = firebase.auth(secondaryApp);

        const settingsRef = db.collection('settings').doc('memsSetup');
        const settingsSnap = await settingsRef.get();
        let defaultPassword: string | undefined;
        if (settingsSnap.exists) {
            defaultPassword = (settingsSnap.data() as MemsSettings)?.defaultPassword;
        }

        if (!defaultPassword) {
            throw new Error("Default password is not set in MEMS settings. Please configure it on the Settings page.");
        }

        // Create user in Firebase Auth
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, defaultPassword);
        const newUser = userCredential.user;

        if (!newUser) {
            throw new Error("User creation failed in secondary app.");
        }

        // Create user document in Firestore
        const parsedPhoneNumber = parsePhoneNumberFromString(phoneNumber, countryIsoCode as CountryCode);
        const userData: AppUser = {
            uid: newUser.uid,
            firstName,
            lastName,
            email,
            domain: 'manufusion.com',
            phoneNumber: parsedPhoneNumber?.number || phoneNumber,
            createdAt: new Date().toISOString(),
            photoURL: '',
            accessLevel,
            status: 'active',
            mustChangePassword: true,
        };
        await db.collection("users").doc(newUser.uid).set(userData);

        // Add log entry
        await addLog({
            action: 'User Created',
            performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email },
            targetUser: { uid: newUser.uid, email: newUser.email! },
            details: `Admin created new user: ${firstName} ${lastName} with access level ${accessLevel}.`
        });

        // Sign out the new user from the secondary app instance to clean up
        await secondaryAuth.signOut();

        onClose();
    } catch (err: any) {
        console.error(err);
        let errorMessage = err.message || 'Failed to add user.';
        if (err.code === 'auth/email-already-in-use') {
            errorMessage = 'This email address is already in use by another account.';
        } else if (err.code === 'auth/weak-password') {
            errorMessage = 'The default password is too weak. Please set a stronger one in Settings.';
        }
        setErrors(e => ({ ...e, form: errorMessage }));
    } finally {
        // Cleanup the secondary app instance
        const existingApp = firebase.apps.find(app => app.name === appName);
        if (existingApp) {
            await existingApp.delete();
        }
        setIsLoading(false);
    }
  };

  const isFormValid = !Object.values(errors).some(e => e) && firstName && lastName && email && phoneNumber && !isCheckingEmail;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New MEMS User">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">New users will be created with the default password and will be required to change it on first login.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="firstName" label="First Name" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            <Input id="lastName" label="Last Name" type="text" value={lastName} onChange={e => setLastName(e.target.value)} required />
        </div>
        
        <Input 
            id="email" 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={e => {
                setEmail(e.target.value)
                setIsEmailEditable(true);
            }} 
            required
            error={errors.email}
            rightIcon={isEmailEditable ? 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg> : null
            }
        />
        
        <div className="flex flex-col sm:flex-row gap-2 items-start">
            <div className="w-full sm:w-2/5">
              <CountryCodeSelect id="countryCode" value={countryIsoCode} onChange={e => setCountryIsoCode(e.target.value)} required />
            </div>
            <div className="w-full sm:w-3/5">
              <Input id="phoneNumber" label="Phone Number" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required error={errors.phoneNumber} />
            </div>
        </div>

        <div>
            <label htmlFor="accessLevel" className="block text-sm font-medium text-slate-700">Access Level</label>
            <select
                id="accessLevel"
                name="accessLevel"
                value={accessLevel}
                onChange={e => setAccessLevel(Number(e.target.value) as AppUser['accessLevel'])}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
                <option value={1}>1 - Basic</option>
                <option value={2}>2 - Standard</option>
                <option value={3}>3 - Privileged</option>
                <option value={4}>4 - Admin</option>
                <option value={5}>5 - Super Admin</option>
            </select>
        </div>
        
        {errors.form && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{errors.form}</p>}
        
        <div className="pt-4">
          <Button type="button" onClick={handleAddUser} isLoading={isLoading} disabled={!isFormValid || isLoading}>
            Add User
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UserAddModal;