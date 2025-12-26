
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Meter } from '../../../../types/em_types';
import type { Organisation } from '../../../../types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

interface MeterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Meter>) => Promise<void>;
    meterToEdit?: Meter | null;
    theme: Organisation['theme'];
}

const MeterModal: React.FC<MeterModalProps> = ({ isOpen, onClose, onSave, meterToEdit, theme }) => {
    const [formData, setFormData] = useState<Partial<Meter>>({
        name: '',
        serialNumber: '',
        ipAddress: '',
        enabled: true
    });
    const [availableIps, setAvailableIps] = useState<string[]>([]);
    const [loadingIps, setLoadingIps] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(meterToEdit ? { ...meterToEdit } : {
                name: '',
                serialNumber: '',
                ipAddress: '',
                enabled: true
            });

            // Fetch available IPs from /energyManagement
            const fetchIps = async () => {
                setLoadingIps(true);
                try {
                    const snap = await getDocs(collection(db, 'energyManagement'));
                    setAvailableIps(snap.docs.map(doc => doc.id).sort());
                } catch (e) {
                    console.error("Error fetching energyManagement IDs:", e);
                } finally {
                    setLoadingIps(false);
                }
            };
            fetchIps();
        }
    }, [isOpen, meterToEdit]);

    const handleSave = async () => {
        if (!formData.name || !formData.serialNumber || !formData.ipAddress) {
            alert("All fields are required.");
            return;
        }
        setIsLoading(true);
        await onSave(formData);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={meterToEdit ? "Update Meter Configuration" : "Register New Smart Meter"} size="lg">
            <div className="space-y-6">
                <Input 
                    id="mName" 
                    label="Meter Name / Alias" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                    required 
                    placeholder="e.g. MAIN DISTRIBUTION BOARD 1"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        id="mSerial" 
                        label="Serial Number" 
                        value={formData.serialNumber || ''} 
                        onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase()})} 
                        required 
                        placeholder="e.g. SN-987654321"
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Network IP (From Registry) <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.ipAddress}
                            onChange={e => setFormData({...formData, ipAddress: e.target.value})}
                            disabled={loadingIps}
                        >
                            <option value="">{loadingIps ? 'Loading available IPs...' : 'Select Device IP...'}</option>
                            {availableIps.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <input 
                        type="checkbox" 
                        id="mEnabled"
                        checked={formData.enabled} 
                        onChange={e => setFormData({...formData, enabled: e.target.checked})} 
                        className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex flex-col">
                        <label htmlFor="mEnabled" className="text-sm font-bold text-slate-700 cursor-pointer">Active Status</label>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Include meter in data ingestion cycle</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading} className="!w-auto px-10">Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={isLoading} 
                        className="!w-auto px-12 shadow-xl shadow-indigo-100 font-bold" 
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        {meterToEdit ? 'Save Changes' : 'Register Meter'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MeterModal;
