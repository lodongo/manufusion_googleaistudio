
import React from 'react';
import type { AppUser, Organisation } from '../../../../types';

interface AmDashboardProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const AmDashboard: React.FC<AmDashboardProps> = ({ currentUser, theme, organisation }) => {
  return (
    <div className="bg-white p-8 rounded-b-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Asset Management Dashboard</h2>
      <p className="text-gray-600">
        Overview of asset performance, open work requests, and maintenance compliance.
      </p>
      {/* Dashboard widgets would go here */}
    </div>
  );
};

export default AmDashboard;
