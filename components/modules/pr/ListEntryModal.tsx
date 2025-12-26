
import React, { useState, useEffect } from 'react';
import type { ProcurementListEntry } from '../../../types/pr_types';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';

interface ListEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ProcurementListEntry) => Promise<void>;
    entryToEdit?: ProcurementListEntry | null;
    title: string;
}

const ListEntryModal: React.FC<ListEntryModalProps> = ({ isOpen, onClose, onSave, entryToEdit, title }) => {
    const [formData, setFormData] = useState<ProcurementListEntry>({
        id: '',
        acronym: '',
        fullAcronym: '',
        description: '',
        value: 0,
        unit: '',
        enabled: true
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const isEditing = !!entryToEdit;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && entryToEdit) {
                setFormData({
                    ...entryToEdit,
                    value: entryToEdit.value ?? 0,
                    unit: entryToEdit.unit ?? ''
                });
            } else {
                setFormData({
                    id: '',
                    acronym: '',
                    fullAcronym: '',
                    description: '',
                    value: 0,
                    unit: '',
                    enabled: true
                });
            }
            setError('');
        }
    }, [isOpen, entryToEdit, isEditing]);

    const handleSave = async () => {
        if (!formData.id || !formData.acronym || !formData.fullAcronym) {
            setError('Code, Acronym and Full Name are required.');
            return;
        }
        setIsLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save entry.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit ${title}` : `Add New ${title}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        id="entryId" 
                        label="Codification (Code)" 
                        value={formData.id} 
                        onChange={e => setFormData({ ...formData, id: e.target.value.toUpperCase().replace(/\s/g, '_') })} 
                        disabled={isEditing}
                        required
                        placeholder="e.g. NET30"
                    />
                    <Input 
                        id="acronym" 
                        label="Acronym" 
                        value={formData.acronym} 
                        onChange={e => setFormData({ ...formData, acronym: e.target.value.toUpperCase() })} 
                        required
                        placeholder="e.g. N30"
                    />
                </div>
                <Input 
                    id="fullAcronym" 
                    label="Full Acronym / Name" 
                    value={formData.fullAcronym} 
                    onChange={e => setFormData({ ...formData, fullAcronym: e.target.value })} 
                    required
                    placeholder="e.g. Net 30 Days"
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        id="numericValue" 
                        label="Numeric Value" 
                        type="number"
                        value={formData.value} 
                        onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} 
                        placeholder="e.g. 30"
                    />
                    <Input 
                        id="unit" 
                        label="Unit" 
                        value={formData.unit} 
                        onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                        placeholder="e.g. Days"
                    />
                </div>
                <Input 
                    as="textarea"
                    id="description" 
                    label="Description" 
                    value={formData.description} 
                    onChange={e => setFormData({ ...formData, description: e.target.value })} 
                    rows={3}
                />
                <div className="flex items-center gap-2 pt-2">
                    <input 
                        type="checkbox" 
                        id="enabled" 
                        checked={formData.enabled} 
                        onChange={e => setFormData({ ...formData, enabled: e.target.checked })} 
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="enabled" className="text-sm font-medium text-slate-700">Enabled</label>
                </div>
                
                {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} isLoading={isLoading}>
                        {isEditing ? 'Save Changes' : 'Add Entry'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ListEntryModal;
