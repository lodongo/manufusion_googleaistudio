
import React, { useState, useEffect } from 'react';
import type { TopographyNode } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

interface TopographyNodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<TopographyNode>) => Promise<void>;
    nodeToEdit?: TopographyNode | null;
    parentNode?: TopographyNode | null;
    theme: Organisation['theme'];
}

const TopographyNodeModal: React.FC<TopographyNodeModalProps> = ({ isOpen, onClose, onSave, nodeToEdit, parentNode, theme }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(nodeToEdit?.name || '');
            setDescription(nodeToEdit?.description || '');
        }
    }, [isOpen, nodeToEdit]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        await onSave({ name, description });
        setIsLoading(false);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={nodeToEdit ? "Modify Node Properties" : parentNode ? `Append sub-item to ${parentNode.name}` : "Create Root Topographic Point"}
        >
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Depth</p>
                    <p className="text-sm font-bold text-slate-700">
                        {nodeToEdit ? `Level ${nodeToEdit.level}` : parentNode ? `Level ${parentNode.level + 1}` : 'Level 1 (Root)'}
                    </p>
                </div>

                <Input 
                    id="nodeName" 
                    label="Designation / Name" 
                    value={name} 
                    onChange={e => setName(e.target.value.toUpperCase())} 
                    required 
                    placeholder="e.g. DEPARTMENT 1 or PRODUCTION LINE B"
                />

                <Input 
                    id="nodeDesc" 
                    label="Description (Optional)" 
                    as="textarea"
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Provide additional context for this topographic point..."
                    rows={3}
                />

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto px-10">Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={isLoading} 
                        className="!w-auto px-12 shadow-xl shadow-indigo-100 font-bold" 
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        Save Configuration
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default TopographyNodeModal;
