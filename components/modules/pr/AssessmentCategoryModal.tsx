
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { AssessmentCategory } from '../../../types/pr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface AssessmentCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AssessmentCategory, 'id'>) => Promise<void>;
  category?: AssessmentCategory | null;
}

const AssessmentCategoryModal: React.FC<AssessmentCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
  const [formData, setFormData] = useState<Omit<AssessmentCategory, 'id'>>({
      name: '',
      weight_percent: 0,
      description: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(category ? {
          name: category.name,
          weight_percent: category.weight_percent,
          description: category.description,
      } : {
          name: '',
          weight_percent: 0,
          description: ''
      });
    }
  }, [isOpen, category]);

  const handleSaveClick = async () => {
    if (!formData.name) return;
    setIsLoading(true);
    await onSave(formData);
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Edit Category' : 'Add Category'}>
      <div className="space-y-4">
        <Input
          id="catName"
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          required
        />
        <Input
          id="catWeight"
          label="Weight (%)"
          type="number"
          value={formData.weight_percent}
          onChange={(e) => setFormData(p => ({ ...p, weight_percent: Number(e.target.value) }))}
          required
        />
        <Input
          as="textarea"
          id="catDesc"
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
          rows={3}
        />
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveClick} isLoading={isLoading}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

export default AssessmentCategoryModal;
