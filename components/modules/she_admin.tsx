
import React from 'react';
import type { Module, AppUser, Organisation } from '../../types';

interface ModuleAdminPageProps {
  module: Module;
  currentUser: AppUser;
  onSwitchToUser: () => void;
  onBackToDashboard: () => void;
  theme: Organisation['theme'];
  organisation: Organisation;
}

const SheAdminPage: React.FC<ModuleAdminPageProps> = ({ module }) => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">SHE Admin Page for {module.name}</h1>
      <p>This module page is under construction.</p>
    </div>
  );
};

export default SheAdminPage;
