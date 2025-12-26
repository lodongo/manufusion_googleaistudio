
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Organisation } from '../../../../types';
import Button from '../../../Button';
import Input from '../../../Input';

interface PrThresholdsTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
}

interface ThresholdSettings {
    threeQuoteThreshold: number;
    tenderThreshold: number;
}

const PrThresholdsTab: React.FC<PrThresholdsTabProps> = ({ organisation, theme }) => {
    const [settings, setSettings] = useState<ThresholdSettings>({ threeQuoteThreshold: 0, tenderThreshold: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, `organisations/${organisation.domain}/modules/PR/settings/thresholds`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as ThresholdSettings);
                }
            } catch (e) {
                console.error("Error fetching thresholds:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [organisation.domain]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, `organisations/${organisation.domain}/modules/PR/settings/thresholds`), settings);
            alert("Thresholds saved successfully.");
        } catch (e) {
            console.error("Error saving thresholds:", e);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading settings...</div>;

    const currencySymbol = organisation.currency?.symbol || '$';
    const currencyCode = organisation.currency?.code || 'USD';

    return (
        <div className="max-w-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Procurement Thresholds</h3>
            <p className="text-sm text-slate-600 mb-6">Define the monetary limits ({currencyCode}) that trigger mandatory procurement processes.</p>
            
            <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="threeQuote" className="block text-sm font-medium text-slate-700">Minimum for 3 Quotes</label>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Requires 3 active quotes</span>
                        </div>
                        <div className="relative rounded-md shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
                            </div>
                            <Input 
                                id="threeQuote" 
                                type="number" 
                                value={settings.threeQuoteThreshold} 
                                onChange={e => setSettings({...settings, threeQuoteThreshold: Number(e.target.value)})}
                                className="!pl-8" 
                                label=""
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Requests above this amount will require at least 3 vendor quotes before approval.</p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="tender" className="block text-sm font-medium text-slate-700">Minimum for Tendering</label>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Requires formal tender process</span>
                        </div>
                        <div className="relative rounded-md shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
                            </div>
                            <Input 
                                id="tender" 
                                type="number" 
                                value={settings.tenderThreshold} 
                                onChange={e => setSettings({...settings, tenderThreshold: Number(e.target.value)})}
                                className="!pl-8" 
                                label=""
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Requests above this amount must go through a formal tendering committee.</p>
                    </div>
                </div>

                <div className="pt-4 border-t flex justify-end">
                    <Button onClick={handleSave} isLoading={saving} className="!w-auto" style={{backgroundColor: theme.colorPrimary}}>Save Thresholds</Button>
                </div>
            </div>
        </div>
    );
};

export default PrThresholdsTab;
