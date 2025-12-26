import React, { useEffect } from 'react';
import type { WorkOrderTask, SolutionMode, MaintenanceType } from '../../../../../types/am_types';
import Input from '../../../../Input';

interface TaskGeneralTabProps {
    formData: Partial<WorkOrderTask>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<WorkOrderTask>>>;
    isLocked: boolean;
    taskTypeCategory: string;
    setTaskTypeCategory: (val: string) => void;
    solutionModes: SolutionMode[];
    uniqueSolutionCategories: string[];
    filteredSolutionModes: SolutionMode[];
    maintenanceTypes: MaintenanceType[];
}

const TaskGeneralTab: React.FC<TaskGeneralTabProps> = ({ 
    formData, setFormData, isLocked, taskTypeCategory, setTaskTypeCategory, 
    solutionModes, filteredSolutionModes, maintenanceTypes
}) => {
    
    // Force category to Preventive as requested
    useEffect(() => {
        if (taskTypeCategory !== 'Preventive') {
            setTaskTypeCategory('Preventive');
        }
    }, [taskTypeCategory, setTaskTypeCategory]);

    return (
        <div className="space-y-6 max-w-4xl">
            <Input id="taskName" label="Task Name" value={formData.taskName || ''} onChange={e => setFormData(p => ({...p, taskName: e.target.value}))} required disabled={isLocked} placeholder="e.g. Inspect drive motor bearings"/>
            <Input as="textarea" id="description" label="Detailed Instructions" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={4} required disabled={isLocked} placeholder="Describe the steps to perform this maintenance task..."/>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Task Category</label>
                    <div className="p-2 bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-bold text-sm uppercase">
                        Preventive
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Action Mode</label>
                    <select 
                        value={formData.taskTypeModeCode || ''} 
                        onChange={e => {
                            const mode = solutionModes.find(m => m.id === e.target.value);
                            setFormData(p => ({...p, taskTypeModeCode: mode?.id, taskTypeModeName: mode?.name}));
                        }} 
                        className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50" 
                        disabled={isLocked}
                    >
                        <option value="">Select Mode...</option>
                        {filteredSolutionModes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <Input id="estDuration" label="Estimated Effort (Hours)" type="number" step="0.25" value={formData.estimatedDurationHours || ''} onChange={e => setFormData(p => ({...p, estimatedDurationHours: Number(e.target.value)}))} disabled={isLocked} placeholder="e.g. 1.5"/>
                
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Maintenance Type</label>
                    <select 
                        value={formData.maintenanceTypeCode || ''} 
                        onChange={e => {
                            const selected = maintenanceTypes.find(m => m.code === e.target.value);
                            setFormData(p => ({...p, maintenanceTypeCode: selected?.code, maintenanceTypeName: selected?.name}));
                        }} 
                        className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50" 
                        disabled={isLocked}
                    >
                        <option value="">Select Type...</option>
                        {maintenanceTypes.map(m => <option key={m.code} value={m.code}>{m.name} ({m.code})</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-6">
                <p className="text-xs text-blue-700 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Technical Discipline is inherited automatically from the Master Plan configuration.
                </p>
            </div>
        </div>
    );
};

export default TaskGeneralTab;