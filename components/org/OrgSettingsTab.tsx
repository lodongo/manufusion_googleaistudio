
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import Input from '../Input';
import Button from '../Button';
import type { Organisation } from '../../types';

export const OrgSettingsTab: React.FC<{ organisation: Organisation }> = ({ organisation }) => {
    const [counters, setCounters] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchCounters = async () => {
            // Fetch counters from various modules
            const amRef = db.doc(`organisations/${organisation.domain}/modules/AM/settings/counters`);
            const prRef = db.doc(`organisations/${organisation.domain}/modules/PR/pr_settings/counters`);
            const inRef = db.doc(`organisations/${organisation.domain}/modules/IN/settings/counters`);
            const fiRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/counters`);
            
            const [amSnap, prSnap, inSnap, fiSnap] = await Promise.all([amRef.get(), prRef.get(), inRef.get(), fiRef.get()]);
            
            setCounters({
                am: amSnap.data() || {},
                pr: prSnap.data() || {},
                in: inSnap.data() || {},
                fi: fiSnap.data() || {}
            });
            setLoading(false);
        };
        fetchCounters();
    }, [organisation.domain]);

    const handleCounterChange = (module: string, key: string, value: string) => {
        setCounters((prev: any) => ({
            ...prev,
            [module]: { ...prev[module], [key]: Number(value) }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const batch = db.batch();
            const amRef = db.doc(`organisations/${organisation.domain}/modules/AM/settings/counters`);
            const prRef = db.doc(`organisations/${organisation.domain}/modules/PR/pr_settings/counters`);
            const inRef = db.doc(`organisations/${organisation.domain}/modules/IN/settings/counters`);
            const fiRef = db.doc(`organisations/${organisation.domain}/modules/FI/settings/counters`);
            
            batch.set(amRef, counters.am, { merge: true });
            batch.set(prRef, counters.pr, { merge: true });
            batch.set(inRef, counters.in, { merge: true });
            batch.set(fiRef, counters.fi, { merge: true });
            
            await batch.commit();
            alert("Settings saved successfully.");
        } catch (err) {
            console.error(err);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading settings...</div>;

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Document Sequence Counters</h3>
            <p className="text-sm text-slate-500">Set the next sequence number for generated documents. The system will increment from this value.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 border rounded bg-slate-50">
                    <h4 className="font-semibold text-indigo-700 mb-3">Asset Management (AM)</h4>
                    <div className="space-y-3">
                        <Input id="amWorkRequestCounter" label="Work Request Counter" type="number" value={counters.am.workRequestCounter || 0} onChange={e => handleCounterChange('am', 'workRequestCounter', e.target.value)} />
                        <Input id="amWorkOrderCounter" label="Work Order Counter" type="number" value={counters.am.workOrderCounter || 0} onChange={e => handleCounterChange('am', 'workOrderCounter', e.target.value)} />
                        <Input id="amMaintenancePlanCounter" label="Maintenance Plan Counter" type="number" value={counters.am.maintenancePlanCounter || 0} onChange={e => handleCounterChange('am', 'maintenancePlanCounter', e.target.value)} />
                    </div>
                </div>
                <div className="p-4 border rounded bg-slate-50">
                    <h4 className="font-semibold text-green-700 mb-3">Procurement (PR)</h4>
                    <div className="space-y-3">
                        <Input id="prVendorCounter" label="Vendor Counter" type="number" value={counters.pr.vendorCounter || 0} onChange={e => handleCounterChange('pr', 'vendorCounter', e.target.value)} />
                        <Input id="prRequisitionCounter" label="Requisition Counter" type="number" value={counters.pr.requisitionCounter || 0} onChange={e => handleCounterChange('pr', 'requisitionCounter', e.target.value)} />
                        <Input id="prPoCounter" label="Purchase Order Counter" type="number" value={counters.pr.poCounter || 0} onChange={e => handleCounterChange('pr', 'poCounter', e.target.value)} />
                    </div>
                </div>
                 <div className="p-4 border rounded bg-slate-50">
                    <h4 className="font-semibold text-blue-700 mb-3">Inventory (IN)</h4>
                    <div className="space-y-3">
                        <Input id="inMaterialCounter" label="Material Counter (Global)" type="number" value={counters.in.materialCounter || 0} onChange={e => handleCounterChange('in', 'materialCounter', e.target.value)} />
                        <Input id="inSalesOrderCounter" label="Sales Order Counter" type="number" value={counters.in.salesOrderCounter || 0} onChange={e => handleCounterChange('in', 'salesOrderCounter', e.target.value)} />
                    </div>
                </div>
                 <div className="p-4 border rounded bg-slate-50">
                    <h4 className="font-semibold text-amber-700 mb-3">Finance (FI)</h4>
                    <div className="space-y-3">
                        <Input id="fiJournalCounter" label="Journal Entry Counter" type="number" value={counters.fi.journalCounter || 0} onChange={e => handleCounterChange('fi', 'journalCounter', e.target.value)} />
                        <Input id="fiPostingRuleCounter" label="Posting Rule Counter" type="number" value={counters.fi.postingRuleCounter || 0} onChange={e => handleCounterChange('fi', 'postingRuleCounter', e.target.value)} />
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} isLoading={saving} className="!w-auto">Save Settings</Button>
            </div>
        </div>
    );
};
