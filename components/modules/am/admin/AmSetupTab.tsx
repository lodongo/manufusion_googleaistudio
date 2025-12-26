import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import type { Organisation } from '../../../../types';
import Button from '../../../Button';
import Input from '../../../Input';

interface AmSetupTabProps {
  theme: Organisation['theme'];
  organisation: Organisation;
}

const AmSetupTab: React.FC<AmSetupTabProps> = ({ theme, organisation }) => {
  const [config, setConfig] = useState({
    planningCycle: 'Weekly',
    weekStartDay: 'Monday'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const docRef = db.doc(`organisations/${organisation.domain}/modules/AM/settings/planning`);
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data();
          setConfig({
            planningCycle: data?.planningCycle || 'Weekly',
            weekStartDay: data?.weekStartDay || 'Monday'
          });
        }
      } catch (e) {
        console.error("Error fetching planning config:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [organisation.domain]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.doc(`organisations/${organisation.domain}/modules/AM/settings/planning`).set(config, { merge: true });
      alert("Planning configuration saved successfully.");
    } catch (e) {
      console.error("Error saving planning config:", e);
      alert("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-b-lg shadow-md flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md min-h-[400px] animate-fade-in">
      <div className="max-w-xl space-y-8">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Planning Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">Configure the scheduling cadence and working week structure for preventive maintenance operations.</p>
        </div>

        <div className="space-y-6">
          <Input 
            as="select" 
            id="planningCycle" 
            label="Planning Cycle" 
            value={config.planningCycle} 
            onChange={e => setConfig(p => ({...p, planningCycle: e.target.value}))}
          >
            <option value="Weekly">Weekly</option>
            <option value="Bi-Weekly">Bi-Weekly</option>
            <option value="Monthly">Monthly</option>
          </Input>

          <Input 
            as="select" 
            id="weekStartDay" 
            label="Week Start Day" 
            value={config.weekStartDay} 
            onChange={e => setConfig(p => ({...p, weekStartDay: e.target.value}))}
          >
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </Input>
        </div>

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">
                Last modified: {new Date().toLocaleDateString()}
            </div>
            <Button onClick={handleSave} isLoading={saving} style={{ backgroundColor: theme.colorPrimary }} className="!w-auto px-10 shadow-lg shadow-indigo-100">
                Save Configuration
            </Button>
        </div>
      </div>
    </div>
  );
};

export default AmSetupTab;