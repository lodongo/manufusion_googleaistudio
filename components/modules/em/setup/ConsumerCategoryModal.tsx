
import React, { useState, useEffect } from 'react';
import type { EnergyConsumerCategory } from '../../../../types/em_types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

interface ConsumerCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<EnergyConsumerCategory, 'id' | 'enabled'>, code: string) => Promise<void>;
    category?: EnergyConsumerCategory | null;
}

const ConsumerCategoryModal: React.FC<ConsumerCategoryModalProps> = ({ isOpen, onClose, onSave, category }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(category?.name || '');
            setCode(category?.code || '');
            setDescription(category?.description || '');
        }
    }, [isOpen, category]);

    const handleSave = async () => {
        if (!name || !code) return;
        setIsLoading(true);
        await onSave({ name, description }, code.toUpperCase());
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Edit Consumer Category' : 'New Consumer Category'}>
            <div className="space-y-4">
                <Input id="code" label="Unique Code (e.g. LGT)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={!!category} required />
                <Input id="name" label="Display Name" value={name} onChange={e => setName(e.target.value)} required />
                <Input id="desc" label="Description" as="textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                <div className="flex justify-end pt-4"><Button onClick={handleSave} isLoading={isLoading}>Save Category</Button></div>
            </div>
        </Modal>
    );
};

export default ConsumerCategoryModal;
