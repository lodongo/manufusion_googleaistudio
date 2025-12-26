
import React, { useState } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import Input from './Input';
import Button from './Button';

interface ChangePasswordFormProps {
  onPasswordChanged: () => void;
}

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onPasswordChanged }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!user) {
        setError('No user is signed in.');
        return;
    }

    setIsLoading(true);
    try {
      await user.updatePassword(password);
      
      const userRef = db.collection('users').doc(user.uid);
      await userRef.update({ mustChangePassword: false });
      
      setSuccess(true);
      
      // Give user feedback then trigger redirect
      setTimeout(() => {
        onPasswordChanged();
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update password. You may need to sign out and sign back in.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
      return (
          <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg text-center">
              <h2 className="text-2xl font-bold text-green-600 mb-4">Password Updated!</h2>
              <p className="text-gray-600">You will be redirected to your dashboard shortly.</p>
          </div>
      );
  }
  
  return (
    <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-center text-3xl font-extrabold text-gray-900 mb-2">
        Change Your Password
      </h2>
      <p className="text-center text-gray-600 mb-6">
        For security, you must change your password before proceeding.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input 
            id="newPassword" 
            label="New Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
            autoComplete="new-password"
        />
        <Input 
            id="confirmNewPassword" 
            label="Confirm New Password" 
            type="password"
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            required
            autoComplete="new-password"
        />
        
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
        
        <div className="pt-2">
          <Button type="submit" isLoading={isLoading} disabled={isLoading}>
            Set New Password
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordForm;
