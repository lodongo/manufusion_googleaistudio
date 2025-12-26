
import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { db, firebaseConfig } from '../../services/firebase';
import { addLog } from '../../services/logger';
import type { AppUser, MemsSettings } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import CountryCodeSelect from '../CountryCodeSelect';
import ConfirmationModal from '../common/ConfirmationModal';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

// Icons
const SaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586L7.707 10.293zM5 4a2 2 0 012-2h6a2 2 0 012 2v2.5a.5.5 0 01-1 0V4a1 1 0 00-1-1H7a1 1 0 00-1 1v12a1 1 0 001 1h6a1 1 0 001-1v-2.5a.5.5 0 011 0V16a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" /></svg>;
const ResetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>;
const DisableIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.367zM14.89 13.477L6.524 5.11A6 6 0 0114.89 13.477zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>;
const EnableIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


interface OrgUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgAdminProfile: AppUser;
  userToEdit?: AppUser | null;
}

const OrgUserModal: React.FC<OrgUserModalProps> = ({ isOpen, onClose, orgAdminProfile, userToEdit }) => {
  const [formData, setFormData] = useState<Partial<AppUser>>({});
  const [countryIsoCode, setCountryIsoCode] = useState('US');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmText, setConfirmText] = useState({ title: '', message: '' });

  const mode = userToEdit ? 'edit' : 'add';
  const orgDomain = orgAdminProfile.domain;

  const isEditingAnotherAdmin = mode === 'edit' && userToEdit?.accessLevel === 5;

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && userToEdit) {
        const phone = userToEdit.phoneNumber ? parsePhoneNumberFromString(userToEdit.phoneNumber) : null;
        setFormData({
          firstName: userToEdit.firstName,
          lastName: userToEdit.lastName,
          email: userToEdit.email,
          phoneNumber: phone?.nationalNumber || '',
          accessLevel: userToEdit.accessLevel,
        });
        setCountryIsoCode(phone?.country || 'US');
      } else {
        // Reset for 'add' mode
        setFormData({ accessLevel: 1, email: `@${orgDomain}` });
        setCountryIsoCode('US');
      }
      setErrors({});
    }
  }, [isOpen, userToEdit, mode, orgDomain]);

  useEffect(() => {
    if (mode === 'add' && formData.firstName && formData.lastName) {
      const first = formData.firstName.toLowerCase();
      const last = formData.lastName.toLowerCase();
      setFormData(prev => ({ ...prev, email: `${first}.${last}@${orgDomain}` }));
    }
  }, [formData.firstName, formData.lastName, mode, orgDomain]);

  useEffect(() => {
    if (!formData.phoneNumber) {
        setErrors(e => ({ ...e, phoneNumber: '' }));
        return;
    };
    if (isValidPhoneNumber(formData.phoneNumber, countryIsoCode as CountryCode)) {
        setErrors(e => ({ ...e, phoneNumber: '' }));
    } else {
        setErrors(e => ({ ...e, phoneNumber: 'Invalid phone number.' }));
    }
  }, [formData.phoneNumber, countryIsoCode]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleActionWithConfirm = (action: () => void, title: string, message: string) => {
    setConfirmAction(() => action);
    setConfirmText({ title, message });
    setIsConfirmOpen(true);
  };
  
  const handleSave = async () => {
    if (mode === 'add') {
      await handleAddUser();
    } else {
      await handleUpdateUser();
    }
  };

  const handleAddUser = async () => {
    if (errors.phoneNumber) return;
    setIsLoading(true);
    setErrors({});
    
    const appName = 'orgUserCreation';
    let secondaryApp: firebase.app.App | undefined;
    try {
        const { firstName, lastName, email, phoneNumber, accessLevel } = formData;
        if (!firstName || !lastName || !email || !phoneNumber) {
            throw new Error("All fields must be filled.");
        }

        secondaryApp = firebase.initializeApp(firebaseConfig, appName);
        const secondaryAuth = firebase.auth(secondaryApp);

        const settingsRef = db.collection('settings').doc('memsSetup');
        const settingsSnap = await settingsRef.get();
        const defaultPassword = (settingsSnap.data() as MemsSettings)?.defaultPassword;
        if (!defaultPassword) throw new Error("Default password is not set by admin.");

        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, defaultPassword);
        const newUser = userCredential.user;

        if (!newUser) {
            throw new Error("Failed to create user in authentication system.");
        }

        const parsedPhoneNumber = parsePhoneNumberFromString(phoneNumber, countryIsoCode as CountryCode);
        
        const userData: AppUser = {
            uid: newUser.uid,
            firstName,
            lastName,
            email,
            domain: orgDomain,
            phoneNumber: parsedPhoneNumber?.number || phoneNumber,
            createdAt: new Date().toISOString(),
            photoURL: '',
            accessLevel: Number(accessLevel) as AppUser['accessLevel'],
            status: 'active',
            mustChangePassword: true,
        };

        await db.collection("users").doc(newUser.uid).set(userData);
        await addLog({
            action: 'Org User Created',
            performedBy: { uid: orgAdminProfile.uid, email: orgAdminProfile.email },
            targetUser: { uid: newUser.uid, email: newUser.email! },
            details: `Created new user ${firstName} ${lastName} in ${orgDomain}.`
        });
        
        await secondaryAuth.signOut();
        onClose();

    } catch (err: any) {
        console.error("Error adding org user:", err);
        setErrors({ form: err.message || "Failed to add user." });
    } finally {
        const existingApp = firebase.apps.find(app => app.name === appName);
        if (existingApp) {
            await existingApp.delete();
        }
        setIsLoading(false);
    }
  };
  
  const handleUpdateUser = async () => {
      if (!userToEdit) return;
      setIsLoading(true);
      setErrors({});

      try {
        const { firstName, lastName, phoneNumber, accessLevel } = formData;
        const parsedPhoneNumber = parsePhoneNumberFromString(phoneNumber!, countryIsoCode as CountryCode);

        const updateData: Partial<AppUser> = {
            firstName,
            lastName,
            phoneNumber: parsedPhoneNumber?.number || phoneNumber,
            accessLevel: Number(accessLevel) as AppUser['accessLevel'],
        };
        await db.collection('users').doc(userToEdit.uid).update(updateData as any);
        
        await addLog({
            action: 'Org User Updated',
            performedBy: { uid: orgAdminProfile.uid, email: orgAdminProfile.email },
            targetUser: { uid: userToEdit.uid, email: userToEdit.email },
            details: 'Updated user profile.'
        });
        onClose();

      } catch (err: any) {
          console.error("Error updating user:", err);
          setErrors({ form: err.message || "Failed to update." });
      } finally {
          setIsLoading(false);
      }
  };

  const handleToggleStatus = async () => {
    if (!userToEdit) return;
    const newStatus = userToEdit.status === 'active' ? 'disabled' : 'active';
    await db.collection('users').doc(userToEdit.uid).update({ status: newStatus });
    await addLog({ action: 'User Status Changed', performedBy: { uid: orgAdminProfile.uid, email: orgAdminProfile.email }, targetUser: { uid: userToEdit.uid, email: userToEdit.email }, details: `Set status to ${newStatus}.`});
    onClose();
  };
  
  const handleResetPassword = async () => {
    if (!userToEdit) return;
    await db.collection('users').doc(userToEdit.uid).update({ mustChangePassword: true });
    await addLog({ action: 'Password Reset', performedBy: { uid: orgAdminProfile.uid, email: orgAdminProfile.email }, targetUser: { uid: userToEdit.uid, email: userToEdit.email }, details: 'Forced password reset on next login.'});
    onClose();
  };

  const handleDelete = async () => {
    if (!userToEdit) return;
    await db.collection('users').doc(userToEdit.uid).update({ status: 'deleted' });
    await addLog({ action: 'User Deleted', performedBy: { uid: orgAdminProfile.uid, email: orgAdminProfile.email }, targetUser: { uid: userToEdit.uid, email: userToEdit.email }, details: 'User account was soft-deleted.' });
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'Add New Employee' : 'Edit Employee'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="firstName" label="First Name" name="firstName" value={formData.firstName || ''} onChange={handleChange} required />
            <Input id="lastName" label="Last Name" name="lastName" value={formData.lastName || ''} onChange={handleChange} required />
          </div>
          <Input id="email" label="Email" name="email" value={formData.email || ''} onChange={handleChange} required disabled={mode === 'edit'}/>

          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <div className="w-full sm:w-2/5">
              <CountryCodeSelect id="countryCode" value={countryIsoCode} onChange={e => setCountryIsoCode(e.target.value)} />
            </div>
            <div className="w-full sm:w-3/5">
              <Input id="phoneNumber" label="Phone Number" name="phoneNumber" type="tel" value={formData.phoneNumber || ''} onChange={handleChange} error={errors.phoneNumber} required/>
            </div>
          </div>

          <div>
            <label htmlFor="accessLevel" className="block text-sm font-medium text-gray-700">Access Level</label>
            <select 
                id="accessLevel" 
                name="accessLevel" 
                value={formData.accessLevel} 
                onChange={handleChange} 
                disabled={isEditingAnotherAdmin}
                className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md disabled:bg-gray-200 disabled:cursor-not-allowed"
            >
                <option value={1}>1 - Basic User</option>
                <option value={2}>2 - Team Lead</option>
                <option value={3}>3 - Manager</option>
                <option value={4}>4 - Department Head</option>
                {isEditingAnotherAdmin && <option value={5}>5 - Organisation Owner</option>}
            </select>
            {isEditingAnotherAdmin && <p className="text-xs text-gray-500 mt-1">Organisation Owner access level cannot be changed.</p>}
          </div>
          
          {errors.form && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{errors.form}</p>}
        </div>
        
        <div className="pt-6 mt-6 border-t flex justify-between items-center">
            {/* Left-side actions: Destructive/Secondary */}
            <div className="flex items-center space-x-2">
                {mode === 'edit' && userToEdit && userToEdit.uid !== orgAdminProfile.uid && (
                    <>
                        <button
                            type="button"
                            onClick={() => handleActionWithConfirm(() => handleResetPassword(), 'Reset Password?', `This will require ${userToEdit.firstName} to change their password on next login.`)}
                            className="p-2 text-gray-500 rounded-full hover:bg-gray-200 hover:text-gray-800 transition-colors"
                            title="Force Password Reset"
                        >
                            <ResetIcon />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleActionWithConfirm(() => handleToggleStatus(), `Confirm ${userToEdit.status === 'active' ? 'Disable' : 'Enable'}?`, `This will ${userToEdit.status === 'active' ? 'prevent' : 'allow'} ${userToEdit.firstName} from logging in.`)}
                            className={`p-2 rounded-full transition-colors ${userToEdit.status === 'active' ? 'text-yellow-600 hover:bg-yellow-100' : 'text-green-600 hover:bg-green-100'}`}
                            title={userToEdit.status === 'active' ? 'Disable User' : 'Enable User'}
                        >
                            {userToEdit.status === 'active' ? <DisableIcon /> : <EnableIcon />}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleActionWithConfirm(() => handleDelete(), 'Delete User?', `This will permanently deactivate ${userToEdit.firstName}'s account. This cannot be undone.`)}
                            className="p-2 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                            title="Delete User"
                        >
                            <DeleteIcon />
                        </button>
                    </>
                )}
            </div>

            {/* Right-side action: Primary Save Button */}
            <button
                type="button"
                onClick={handleSave}
                disabled={isLoading || !!errors.phoneNumber}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 transition-colors"
                title={mode === 'add' ? 'Add Employee' : 'Save Changes'}
            >
                {isLoading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <SaveIcon />
                )}
                <span className="ml-2">{mode === 'add' ? 'Add Employee' : 'Save Changes'}</span>
            </button>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => { if(confirmAction) confirmAction(); setIsConfirmOpen(false); }}
        title={confirmText.title}
        message={confirmText.message}
      />
    </>
  );
};

export default OrgUserModal;
