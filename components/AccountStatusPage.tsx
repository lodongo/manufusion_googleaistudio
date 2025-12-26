import React from 'react';

interface AccountStatusPageProps {
  status: 'disabled' | 'deleted';
  onLogout: () => void;
}

const AccountStatusPage: React.FC<AccountStatusPageProps> = ({ status, onLogout }) => {
  const messages = {
    disabled: {
      title: 'Account Disabled',
      message: 'Your account has been disabled by an administrator. Please contact your organisation\'s administrator for assistance.',
    },
    deleted: {
      title: 'Account Not Found',
      message: 'This account no longer exists. If you believe this is an error, please contact an administrator.',
    },
  };

  const { title, message } = messages[status];

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg text-center">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
        <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <button
        onClick={onLogout}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        Logout and Return to Homepage
      </button>
    </div>
  );
};

export default AccountStatusPage;
