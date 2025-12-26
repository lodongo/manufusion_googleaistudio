
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../services/firebase';
import { addLog } from '../../services/logger';
import { useAuth } from '../../context/AuthContext';
import type { AppUser, Organisation } from '../../types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import CountryCodeSelect from '../CountryCodeSelect';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

interface UserModalProps {
  user: AppUser;
  currentUserProfile: AppUser;
  isOpen: boolean;
  onClose: () => void;
  theme?: Organisation['theme'];
}

// Icons
const ResetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>;
const DisableIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.367zM14.89 13.477L6.524 5.11A6 6 0 0114.89 13.477zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>;
const EnableIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const CameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 9.414V13H5.5z" /><path d="M9 13h2v5a1 1 0 11-2 0v-5z" /></svg>;

const UserModal: React.FC<UserModalProps> = ({ user, currentUserProfile, isOpen, onClose, theme }) => {
  const [formData, setFormData] = useState<Partial<AppUser>>({});
  const [countryIsoCode, setCountryIsoCode] = useState('US');
  const [newPhoto, setNewPhoto] = useState<{file: File | null, preview: string}>({ file: null, preview: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const isSelfEdit = currentUserProfile.uid === user.uid;
  const isAdmin = currentUserProfile.accessLevel === 5;
  const canEditSensitiveFields = isAdmin;
  const canEditProfile = isSelfEdit || isAdmin;

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      const phoneNumber = user.phoneNumber ? parsePhoneNumberFromString(user.phoneNumber) : null;
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: phoneNumber ? phoneNumber.nationalNumber : '',
        accessLevel: user.accessLevel || 1,
      });
      setCountryIsoCode(phoneNumber ? phoneNumber.country || 'US' : 'US');
      setNewPhoto({ file: null, preview: user.photoURL || '' });
      setErrors({});
    }
  }, [user, isOpen]);

  // Live phone validation
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

  const stopCameraStream = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
    }
  };

  useEffect(() => {
      return () => {
          stopCameraStream();
      };
  }, [stream]);

  useEffect(() => {
      if (isCameraOpen && stream && videoRef.current) {
          videoRef.current.srcObject = stream;
      }
  }, [isCameraOpen, stream]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhoto({ file, preview: URL.createObjectURL(file) });
    }
  };

  const handleCameraClick = async () => {
      stopCameraStream(); // Stop any existing stream
      try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(newStream);
          setIsCameraOpen(true);
      } catch (err) {
          console.error("Camera access denied:", err);
          setError("Camera access was denied. Please check your browser permissions.");
      }
  };

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        canvas.toBlob((blob) => {
            if (blob) {
                setNewPhoto({ file: new File([blob], "capture.jpg", { type: "image/jpeg" }), preview: URL.createObjectURL(blob) });
            }
            setIsCameraOpen(false);
            stopCameraStream();
        }, 'image/jpeg');
    }
  };

  const handleCancelCamera = () => {
      setIsCameraOpen(false);
      stopCameraStream();
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!newPhoto.file) return null;
    setIsUploading(true);
    try {
      const filePath = `manufusion/users/avatars/${user.uid}`;
      const storageRef = storage.ref(filePath);
      const snapshot = await storageRef.put(newPhoto.file);
      const downloadURL = await snapshot.ref.getDownloadURL();
      return downloadURL;
    } catch (err) {
      console.error("Photo upload failed:", err);
      setError("Failed to upload photo.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!currentUserProfile) return;
    if (Object.values(errors).some(e => e)) {
        setError("Please fix the errors before saving.");
        return;
    }
    setIsLoading(true);
    setError('');
    
    let photoURL = user.photoURL;
    if (newPhoto.file) {
      const uploadedUrl = await uploadPhoto();
      if (uploadedUrl) {
        photoURL = uploadedUrl;
      } else {
        setIsLoading(false);
        return; // Stop if upload failed
      }
    }
    
    const phoneNumberToSave = formData.phoneNumber ? parsePhoneNumberFromString(formData.phoneNumber, countryIsoCode as CountryCode)?.number : '';

    const changes = [];
    if (canEditSensitiveFields && formData.firstName !== user.firstName) changes.push(`first name to "${formData.firstName}"`);
    if (canEditSensitiveFields && formData.lastName !== user.lastName) changes.push(`last name to "${formData.lastName}"`);
    if (canEditProfile && phoneNumberToSave !== user.phoneNumber) changes.push(`phone number`);
    if (photoURL !== user.photoURL) changes.push(`profile photo`);
    if (canEditSensitiveFields && Number(formData.accessLevel) !== user.accessLevel) changes.push(`access level from ${user.accessLevel} to ${formData.accessLevel}`);

    if (changes.length === 0) {
        setIsLoading(false);
        onClose();
        return;
    }

    try {
      const userRef = db.collection('users').doc(user.uid);
      const updateData: Partial<AppUser> = {
          photoURL: photoURL,
          phoneNumber: phoneNumberToSave,
      };

      if (canEditSensitiveFields) {
          updateData.firstName = formData.firstName;
          updateData.lastName = formData.lastName;
          updateData.accessLevel = Number(formData.accessLevel) as AppUser['accessLevel'];
      }
      
      await userRef.update(updateData as any);

      await addLog({
          action: 'User Updated',
          performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email },
          targetUser: { uid: user.uid, email: user.email },
          details: `Updated ${changes.join(', ')}.`
      });

      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save changes.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    alert("This would trigger a secure backend function to reset the user's password.");
    await addLog({ action: 'Password Reset', performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email }, targetUser: { uid: user.uid, email: user.email }, details: `Admin initiated a password reset.` });
  };

  const handleToggleStatus = async () => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
        await db.collection('users').doc(user.uid).update({ status: newStatus });
        
        await addLog({ 
            action: 'User Status Changed', 
            performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email }, 
            targetUser: { uid: user.uid, email: user.email }, 
            details: `Set user status to ${newStatus}.` 
        });
        /*
        * IMPORTANT: In a production environment, you must also disable/enable the user in Firebase Authentication.
        * This cannot be done from the client-side SDK for security reasons.
        * You should trigger a Firebase Cloud Function here to use the Admin SDK to update the user's Auth account.
        * e.g., admin.auth().updateUser(user.uid, { disabled: newStatus === 'disabled' });
        */
        onClose();
    } catch(err) {
        console.error("Failed to update status:", err);
        setError("Failed to update user status.");
    }
  };
  
  const handleDeleteUser = async () => {
    const confirmMessage = `Are you sure you want to delete ${user.firstName} ${user.lastName}?\n\nThis will mark the user as deleted, and they will no longer be able to log in. This action can only be undone by a database administrator.`;
    
    if (window.confirm(confirmMessage)) {
        try {
            // Soft delete by updating status in Firestore
            await db.collection('users').doc(user.uid).update({ status: 'deleted' });
            
            await addLog({
                action: 'User Deleted',
                performedBy: { uid: currentUserProfile.uid, email: currentUserProfile.email },
                targetUser: { uid: user.uid, email: user.email },
                details: `Marked user as deleted (soft delete).`
            });

            console.warn(`User ${user.uid} has been soft-deleted from Firestore. For complete data erasure (e.g., for GDPR compliance), a backend function should be triggered to permanently delete the user from Firebase Authentication and all associated storage data.`);
            
            onClose();
        } catch(err) {
            console.error("Failed to delete user:", err);
            setError("Failed to delete user.");
        }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit User: ${user.firstName} ${user.lastName}`}>
      <div className="space-y-6 relative">
        {isCameraOpen && (
            <div className="absolute inset-0 bg-black bg-opacity-90 z-20 flex flex-col items-center justify-center p-4 rounded-lg">
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto max-h-[70%] rounded-lg mb-4"></video>
                <div className="flex space-x-4">
                    <button onClick={handleTakePhoto} className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700">Capture</button>
                    <button onClick={handleCancelCamera} className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
        )}
        
        {canEditProfile && (
            <div className="flex flex-col items-center space-y-4">
                <img src={newPhoto.preview || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`} alt="Profile" className="w-24 h-24 rounded-full object-cover shadow-md" />
                <div className="flex space-x-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <UploadIcon /> <span className="ml-2">Upload</span>
                    </button>
                    <button onClick={handleCameraClick} className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <CameraIcon /> <span className="ml-2">Camera</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
            </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="firstName" label="First Name" name="firstName" type="text" value={formData.firstName || ''} onChange={handleChange} disabled={!canEditSensitiveFields} />
            <Input id="lastName" label="Last Name" name="lastName" type="text" value={formData.lastName || ''} onChange={handleChange} disabled={!canEditSensitiveFields} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start">
            <div className="w-full sm:w-2/5">
                <CountryCodeSelect 
                    id="countryCode" 
                    value={countryIsoCode} 
                    onChange={e => setCountryIsoCode(e.target.value)} 
                    disabled={!canEditProfile} 
                />
            </div>
            <div className="w-full sm:w-3/5">
              <Input id="phoneNumber" label="Phone Number" name="phoneNumber" type="tel" value={formData.phoneNumber || ''} onChange={handleChange} disabled={!canEditProfile} error={errors.phoneNumber}/>
            </div>
        </div>

        {isAdmin && (
            <div>
                <label htmlFor="accessLevel" className="block text-sm font-medium text-gray-700">Access Level</label>
                <select id="accessLevel" name="accessLevel" value={formData.accessLevel} onChange={handleChange} disabled={!canEditSensitiveFields} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                </select>
            </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
        
        <div className="pt-4 space-y-2 border-t">
            <Button 
                onClick={handleSaveChanges} 
                isLoading={isLoading || isUploading} 
                disabled={!canEditProfile}
                style={theme ? { backgroundColor: theme.colorPrimary } : {}}
            >
                {isUploading ? 'Uploading Photo...' : 'Save Changes'}
            </Button>
            {isAdmin && !isSelfEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button onClick={handleResetPassword} className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"><ResetIcon /> Reset Pass</button>
                    <button onClick={handleToggleStatus} className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${user.status === 'active' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}>
                      {user.status === 'active' ? <><DisableIcon /> Disable</> : <><EnableIcon /> Enable</>}
                    </button>
                    <button onClick={handleDeleteUser} className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"><DeleteIcon /> Delete</button>
                </div>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default UserModal;