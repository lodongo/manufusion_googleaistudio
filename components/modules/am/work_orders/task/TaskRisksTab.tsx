
import React from 'react';
import type { RiskAssessmentItem } from '../../../../../types/she_types';
import Button from '../../../../Button';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface TaskRisksTabProps {
    riskAssessments: RiskAssessmentItem[];
    isLocked: boolean;
    setRaModalState: (state: {isOpen: boolean, assessment: RiskAssessmentItem | null}) => void;
    setAssessmentToDelete: (assessment: RiskAssessmentItem | null) => void;
}

const TaskRisksTab: React.FC<TaskRisksTabProps> = ({ 
    riskAssessments, isLocked, setRaModalState, setAssessmentToDelete 
}) => {
    return (
        <div>
           <div className="flex justify-between items-center mb-4">
               <h4 className="font-semibold text-slate-700">Risk Assessments</h4>
               {!isLocked && <Button onClick={() => setRaModalState({isOpen: true, assessment: {id: `temp_${Date.now()}`, hazardCategoryCode: '', hazardCategoryName: '', hazardId: '', hazardName: '', hazardDescription: '', initialRatings: {}, initialScore: 0, isIntolerable: false, controls: [], controlDetails: '', residualRatings: {}, residualScore: 0, isResidualTolerable: true}})} className="!w-auto !py-1 !px-3 text-sm">+ Add Assessment</Button>}
           </div>
           
           {riskAssessments.length === 0 ? <p className="text-slate-500 italic">No risk assessments recorded.</p> : (
               <div className="space-y-4">
                   {riskAssessments.map((ra, i) => (
                       <div key={ra.id} className="border rounded-lg p-4 bg-slate-50">
                           <div className="flex justify-between items-start">
                               <div>
                                   <h5 className="font-bold text-slate-800">{ra.hazardCategoryName}: {ra.hazardName}</h5>
                                   <p className="text-xs text-slate-600">{ra.hazardDescription}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                   {!isLocked && <button onClick={() => setRaModalState({isOpen: true, assessment: ra})} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><EditIcon/></button>}
                                   {!isLocked && <button onClick={() => setAssessmentToDelete(ra)} className="text-red-600 hover:bg-red-100 p-1 rounded"><DeleteIcon/></button>}
                               </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                               <div className={`p-2 rounded border ${ra.isIntolerable ? 'bg-red-100 border-red-200 text-red-800' : 'bg-green-100 border-green-200 text-green-800'}`}>
                                   <strong>Initial Score:</strong> {ra.initialScore}
                               </div>
                                <div className={`p-2 rounded border ${!ra.isResidualTolerable ? 'bg-red-100 border-red-200 text-red-800' : 'bg-green-100 border-green-200 text-green-800'}`}>
                                   <strong>Residual Score:</strong> {ra.residualScore}
                               </div>
                           </div>
                           {ra.controls.length > 0 && (
                               <div className="mt-3 pt-3 border-t border-slate-200">
                                   <p className="text-xs font-bold text-slate-500 uppercase mb-1">Controls</p>
                                   <ul className="list-disc list-inside text-sm text-slate-700">
                                       {ra.controls.map((c, idx) => <li key={idx}>{c.controlName} {c.isPreTask ? <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded ml-1">Pre-Task</span> : ''}</li>)}
                                   </ul>
                               </div>
                           )}
                       </div>
                   ))}
               </div>
           )}
       </div>
    );
};

export default TaskRisksTab;
