
import React, { useState, useEffect } from 'react';
import type { EnergyConsumerSubcategory } from '../../../../types/em_types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

interface ConsumerSubcategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<EnergyConsumerSubcategory, 'id' | 'enabled'>, code: string) => Promise<void>;
    subcategory?: EnergyConsumerSubcategory | null;
}

const ConsumerSubcategoryModal: React.FC<ConsumerSubcategoryModalProps> = ({ isOpen, onClose, onSave, subcategory }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(subcategory?.name || '');
            setCode(subcategory?.code || '');
            setDescription(subcategory?.description || '');
        }
    }, [isOpen, subcategory]);

    const handleSave = async () => {
        if (!name || !code) return;
        setIsLoading(true);
        await onSave({ name, description }, code.toUpperCase());
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subcategory ? 'Edit Sub-classification' : 'New Sub-classification'}>
            <div className="space-y-4">
                <Input id="code" label="Unique Code (e.g. LGT-LED)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={!!subcategory} required />
                <Input id="name" label="Display Name" value={name} onChange={e => setName(e.target.value)} required />
                <Input id="desc" label="Description" as="textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                <div className="flex justify-end pt-4"><Button onClick={handleSave} isLoading={isLoading}>Save Sub-classification</Button></div>
            </div>
        </Modal>
    );
};

export default ConsumerSubcategoryModal;
