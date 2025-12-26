import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import type { MaintenanceMasterPlan, MasterPlanTask } from '../../../../types/am_types';
import Button from '../../../Button';
import MasterPlanTaskDetail from './MasterPlanTaskDetail';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

interface MasterPlanTaskEditorProps {
    plan: MaintenanceMasterPlan;
    onBack: () => void;
    organisation: Organisation;
    theme: Organisation['theme'];
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const MasterPlanTaskEditor: React.FC<MasterPlanTaskEditorProps> = ({ plan, onBack, organisation, theme }) => {
    const [tasks, setTasks] = useState<MasterPlanTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<MasterPlanTask | 'new' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<MasterPlanTask | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const tasksRef = collection(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${plan.id}/tasks`);
        const q = query(tasksRef, orderBy('taskId', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterPlanTask)));
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [plan.id, organisation.domain]);

    const handleDeleteTask = async () => {
        if (!confirmDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, `organisations/${organisation.domain}/modules/AM/masterPlans/${plan.id}/tasks`, confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error(error);
            alert("Failed to delete task.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (selectedTask) {
        return (
            <MasterPlanTaskDetail 
                plan={plan}
                task={selectedTask === 'new' ? null : selectedTask}
                onBack={() => setSelectedTask(null)}
                organisation={organisation}
                theme={theme}
            />
        );
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md min-h-[600px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
                <div>
                    <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-1">&larr; Back to Registry</button>
                    <h2 className="text-2xl font-bold text-slate-800">Manage Tasks: {plan.code}</h2>
                    <p className="text-sm text-slate-500 mt-1">Assembly: {plan.assemblyName} | {plan.disciplineName} - {plan.intervalName}</p>
                </div>
                <Button onClick={() => setSelectedTask('new')} className="!w-auto !py-2 !px-6 shadow-md">
                    + Add Template Task
                </Button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 italic">Loading template tasks...</div>
            ) : (
                <div className="space-y-4">
                    {tasks.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 italic bg-slate-50 border-2 border-dashed rounded-xl">
                            No tasks defined for this master plan. Click "Add Template Task" to begin building the technical scope.
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} className="border rounded-xl p-5 hover:shadow-md transition-shadow bg-white flex justify-between items-start group">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">{task.taskId}</span>
                                        <h4 className="font-bold text-slate-800 text-lg">{task.taskName}</h4>
                                    </div>
                                    <p className="text-sm text-slate-600 line-clamp-2 max-w-2xl">{task.description}</p>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">{task.discipline}</span>
                                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">{task.taskTypeModeName}</span>
                                        <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">Est: {task.estimatedDurationHours}h</span>
                                        {task.riskAssessments && task.riskAssessments.length > 0 && (
                                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">Risk Mitigation Required</span>
                                        )}
                                        {task.requiredSpares && task.requiredSpares.length > 0 && (
                                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">{task.requiredSpares.length} Spares Planned</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setSelectedTask(task)} 
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-transparent hover:border-blue-100"
                                    >
                                        <EditIcon />
                                    </button>
                                    <button 
                                        onClick={() => setConfirmDelete(task)} 
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-red-100"
                                    >
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <ConfirmationModal 
                isOpen={!!confirmDelete} 
                onClose={() => setConfirmDelete(null)} 
                onConfirm={handleDeleteTask} 
                title="Delete Template Task" 
                message={`Are you sure you want to remove the task "${confirmDelete?.taskName}" from this master template?`}
                isLoading={isDeleting}
            />
        </div>
    );
};

export default MasterPlanTaskEditor;