
import React, { useState, useEffect } from 'react';
import type { EnergyConsumerSubSubcategory } from '../../../../types/em_types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

interface ConsumerSubSubcategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<EnergyConsumerSubSubcategory, 'id' | 'enabled'>) => Promise<void>;
    subSubcategory?: EnergyConsumerSubSubcategory | null;
}

const ConsumerSubSubcategoryModal: React.FC<ConsumerSubSubcategoryModalProps> = ({ isOpen, onClose, onSave, subSubcategory }) => {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(subSubcategory?.name || '');
        }
    }, [isOpen, subSubcategory]);

    const handleSave = async () => {
        if (!name) return;
        setIsLoading(true);
        await onSave({ name });
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subSubcategory ? 'Edit Detail Item' : 'New Detail Item'}>
            <div className="space-y-4">
                <Input 
                    id="name" 
                    label="Item Name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    placeholder="e.g. Detached house"
                />
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} isLoading={isLoading}>Save Item</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConsumerSubSubcategoryModal;
