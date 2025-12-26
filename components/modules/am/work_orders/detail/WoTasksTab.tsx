
import React from 'react';
import type { WorkOrderTask } from '../../../../../types/am_types';
import Button from '../../../../Button';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface WoTasksTabProps {
    tasks: WorkOrderTask[];
    loadingTasks: boolean;
    onSelectTask: (task: WorkOrderTask | 'new') => void;
    setConfirmDelete: (task: WorkOrderTask | null) => void;
}

const WoTasksTab: React.FC<WoTasksTabProps> = ({ tasks, loadingTasks, onSelectTask, setConfirmDelete }) => {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Tasks</h3>
                <Button onClick={() => onSelectTask('new')} className="!w-auto !py-1.5 !px-4 !text-sm">+ Add Task</Button>
            </div>

            {loadingTasks ? <div className="p-8 text-center">Loading tasks...</div> : (
                <div className="space-y-3">
                    {tasks.length === 0 ? (
                        <p className="text-center py-8 text-slate-500 bg-white rounded-lg border border-dashed">No tasks added yet.</p>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-white flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{task.taskId}</span>
                                        <h4 className="font-bold text-slate-800">{task.taskName}</h4>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{task.discipline}</span>
                                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">{task.taskTypeCategory} - {task.taskTypeModeName}</span>
                                        <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">Est: {task.estimatedDurationHours}h</span>
                                        {task.riskAssessments && task.riskAssessments.length > 0 && (
                                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">Risks: {task.riskAssessments.length}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onSelectTask(task)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"><EditIcon /></button>
                                    <button onClick={() => setConfirmDelete(task)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"><DeleteIcon /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default WoTasksTab;
