
import React from 'react';
import type { Module, Organisation } from '../../../types';

interface ModulesManagementTabProps {
    isEditing: boolean;
    activeSubTab: string;
    isDataLoading: boolean;
    allModules: Module[];
    subscribedModules: string[];
    handleModuleToggle: (moduleId: string) => void;
    theme: Organisation['theme'];
}

export const ModulesManagementTab: React.FC<ModulesManagementTabProps> = ({
    isEditing,
    activeSubTab,
    isDataLoading,
    allModules,
    subscribedModules,
    handleModuleToggle,
    theme
}) => {
    if (!isEditing || activeSubTab !== 'modules') return null;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-800">Subscribed Modules</h3>
            <p className="text-sm text-slate-500">Manage which modules are active for this organisation.</p>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isDataLoading ? <div className="col-span-full text-center">Loading modules...</div> : 
                 allModules.map(module => (
                    <div key={module.id} className={`p-4 border rounded-lg flex items-start justify-between ${subscribedModules.includes(module.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                        <div>
                            <h4 className="font-semibold text-slate-800">{module.name} ({module.code})</h4>
                            <p className="text-xs text-slate-500 mt-1">{module.description}</p>
                            {module.isCore && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded mt-2 inline-block">Core</span>}
                        </div>
                        <div className="ml-4">
                            <input 
                                type="checkbox" 
                                checked={subscribedModules.includes(module.id)} 
                                onChange={() => handleModuleToggle(module.id)}
                                disabled={module.isCore}
                                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                style={{ accentColor: theme.colorPrimary }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
