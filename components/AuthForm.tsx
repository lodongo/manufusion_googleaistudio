import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import { addLog } from '../services/logger';
import Input from './Input';
import Button from './Button';

interface AuthFormProps {
  initialMode?: 'login' | 'signup';
  onSwitchToHomepage: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ initialMode = 'login', onSwitchToHomepage }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');

  // Live validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  const validateForm = useCallback(() => {
    if (isLogin) {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const passwordValid = password.length > 0;
      return emailValid && passwordValid;
    }

    // Signup mode
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValid = emailRegex.test(email);
    const passwordValid = password.length >= 6;
    const passwordsMatch = password === confirmPassword;
    const nameValid = firstName.trim().length > 0;
      
    return emailValid && passwordValid && passwordsMatch && nameValid;
  }, [isLogin, email, password, confirmPassword, firstName]);
  
  useEffect(() => {
    setIsFormValid(validateForm());
  }, [validateForm]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (isLogin) {
      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (err: any) {
        setError(err.message || 'Failed to login.');
      }
    } else { // Signup mode
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (!user) {
            throw new Error("User creation failed.");
        }
        
        await user.updateProfile({
            displayName: firstName
        });
        
        const emailDomain = email.split('@')[1]?.toLowerCase();
        // Super Admin check for manufusion.com
        const accessLevel = emailDomain === 'manufusion.com' ? 5 : 5; // Default new org owners to level 5

        const userData = {
            uid: user.uid,
            firstName,
            lastName: '', 
            email,
            domain: emailDomain,
            createdAt: new Date().toISOString(),
            photoURL: '',
            accessLevel: accessLevel,
            status: 'active'
        };

        await db.collection("users").doc(user.uid).set(userData);

        await addLog({
            action: 'User Self-Registration',
            performedBy: { uid: user.uid, email: user.email! },
            targetUser: { uid: user.uid, email: user.email! },
            details: `New account created for: ${firstName}.`
        });
        
      } catch (err: any) {
        console.error("Signup Error:", err);
        setError(err.message || 'Failed to create an account.');
      }
    }
    setIsLoading(false);
  };
  
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      await auth.sendPasswordResetEmail(email);
      setMessage("Password reset email sent. Please check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email.");
    }
    setIsLoading(false);
  }

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {isLogin ? 'Sign in to access your dashboard' : 'Join us and start managing your enterprise'}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleAuthAction}>
        {!isLogin && (
          <Input 
              id="firstName" 
              label="First Name" 
              type="text" 
              value={firstName} 
              onChange={e => setFirstName(e.target.value)} 
              required 
              placeholder="Your first name"
          />
        )}

        <Input 
            id="email" 
            label="Email address" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            autoComplete="email" 
            placeholder="you@example.com"
        />

        <Input 
            id="password" 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            autoComplete={isLogin ? "current-password" : "new-password"} 
            placeholder="••••••••"
        />

        {!isLogin && (
          <Input 
            id="confirmPassword" 
            label="Confirm Password" 
            type="password"
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            required 
            autoComplete="new-password" 
            placeholder="••••••••"
          />
        )}
        
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
        {message && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">{message}</p>}
        
        <div className="pt-2">
          <Button type="submit" isLoading={isLoading} disabled={!isFormValid || isLoading}>
            {isLogin ? 'Sign in' : 'Create account'}
          </Button>
        </div>
      </form>

      <div className="mt-8 space-y-4">
        <div className="text-sm text-center">
            <button 
                type="button" 
                onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setMessage('');
                }} 
                className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
        </div>

        {isLogin && (
          <div className="text-sm text-center">
            <button type="button" onClick={handleForgotPassword} className="text-slate-500 hover:text-slate-800 transition-colors">
              Forgot password?
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 text-center">
          <button type="button" onClick={onSwitchToHomepage} className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
