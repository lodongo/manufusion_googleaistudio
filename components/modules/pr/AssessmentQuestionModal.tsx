
import React, { useState, useEffect } from 'react';
import type { AssessmentQuestion } from '../../../types/pr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface AssessmentQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AssessmentQuestion, 'id'>) => Promise<void>;
  question?: AssessmentQuestion | null;
}

const AssessmentQuestionModal: React.FC<AssessmentQuestionModalProps> = ({ isOpen, onClose, onSave, question }) => {
  const [formData, setFormData] = useState<Omit<AssessmentQuestion, 'id'>>({
      question_text: '',
      question_type: 'strategic',
      scores: 'both',
      rating_scale: { "1": "", "2": "", "3": "", "4": "", "5": "" }
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(question ? {
          question_text: question.question_text,
          question_type: question.question_type,
          scores: question.scores,
          rating_scale: question.rating_scale || { "1": "", "2": "", "3": "", "4": "", "5": "" }
      } : {
          question_text: '',
          question_type: 'strategic',
          scores: 'both',
          rating_scale: { "1": "", "2": "", "3": "", "4": "", "5": "" }
      });
    }
  }, [isOpen, question]);

  const handleSaveClick = async () => {
    if (!formData.question_text) return;
    setIsLoading(true);
    await onSave(formData);
    setIsLoading(false);
    onClose();
  };
  
  const handleScaleChange = (level: string, value: string) => {
      setFormData(prev => ({
          ...prev,
          rating_scale: {
              ...prev.rating_scale,
              [level]: value
          }
      }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={question ? 'Edit Question' : 'Add Question'} size="xl">
      <div className="space-y-4">
        <Input
          as="textarea"
          id="qText"
          label="Question Text"
          value={formData.question_text}
          onChange={(e) => setFormData(p => ({ ...p, question_text: e.target.value }))}
          required
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700">Type</label>
                <select 
                    className="mt-1 block w-full p-2 border rounded-md"
                    value={formData.question_type}
                    onChange={e => setFormData(p => ({...p, question_type: e.target.value as any}))}
                >
                    <option value="strategic">Strategic</option>
                    <option value="situational">Situational</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Scored By</label>
                <select 
                    className="mt-1 block w-full p-2 border rounded-md"
                    value={formData.scores}
                    onChange={e => setFormData(p => ({...p, scores: e.target.value as any}))}
                >
                    <option value="both">Both</option>
                    <option value="organisation">Organisation</option>
                    <option value="supplier">Supplier</option>
                </select>
            </div>
        </div>
        
        <div className="pt-4 border-t">
            <h4 className="font-medium text-slate-800 mb-2">Rating Scale Definitions</h4>
            <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(level => (
                    <div key={level} className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white ${level < 3 ? 'bg-red-500' : level === 3 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                            {level}
                        </span>
                        <Input 
                            id={`scale_${level}`} 
                            label="" 
                            value={formData.rating_scale[String(level)] || ''} 
                            onChange={e => handleScaleChange(String(level), e.target.value)} 
                            placeholder={`Definition for Level ${level}`}
                            containerClassName="flex-grow mb-0"
                            className="!mt-0"
                        />
                    </div>
                ))}
            </div>
        </div>
        
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

export default AssessmentQuestionModal;
