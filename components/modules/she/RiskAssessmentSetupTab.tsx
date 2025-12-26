
// components/modules/she/RiskAssessmentSetupTab.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation, AppUser } from '../../../types';
import type { RatingComponent, SheRiskAssessmentSettings } from '../../../types/she_types';
import { useAuth } from '../../../context/AuthContext';
import Input from '../../Input';
import Button from '../../Button';

interface RiskAssessmentSetupTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

const RiskAssessmentSetupTab: React.FC<RiskAssessmentSetupTabProps> = ({ organisation, theme }) => {
  const { currentUserProfile } = useAuth();
  const [ratingComponents, setRatingComponents] = useState<RatingComponent[]>([]);
  const [settings, setSettings] = useState<SheRiskAssessmentSettings>({ riskFormula: [], intolerableCutoff: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const settingsDocRef = db.collection('organisations').doc(organisation.domain).collection('she_settings').doc('riskAssessment');

  useEffect(() => {
    setLoading(true);
    const componentsRef = db.collection('modules/SHE/Ratings');
    const q = componentsRef.orderBy('name');

    const unsubComponents = q.onSnapshot((snapshot) => {
      setRatingComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RatingComponent)));
    });

    const unsubSettings = settingsDocRef.onSnapshot((doc) => {
      if (doc.exists) {
        setSettings(doc.data() as SheRiskAssessmentSettings);
      } else {
        // Set default if no settings exist
        setSettings({ riskFormula: ['SEV', 'FREQ_OCCUR'], intolerableCutoff: 15 });
      }
      setLoading(false);
    });

    return () => {
      unsubComponents();
      unsubSettings();
    };
  }, [organisation.domain]);

  const handleFormulaChange = (componentCode: string) => {
    setSettings(prev => {
      const newFormula = prev.riskFormula.includes(componentCode)
        ? prev.riskFormula.filter(code => code !== componentCode)
        : [...prev.riskFormula, componentCode];
      return { ...prev, riskFormula: newFormula };
    });
  };

  const handleSave = async () => {
    if (!currentUserProfile) return;
    setSaving(true);
    const settingsToSave = {
      ...settings,
      updatedAt: new Date(),
      updatedBy: {
        uid: currentUserProfile.uid,
        name: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`
      }
    };
    await settingsDocRef.set(settingsToSave, { merge: true });
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Configuration */}
      <div className="p-6 border rounded-lg bg-slate-50">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Risk Formula Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select components to multiply for Risk Score:</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ratingComponents.map(comp => (
                <label key={comp.id} className="flex items-center space-x-2 p-3 border rounded-md bg-white has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300">
                  <input
                    type="checkbox"
                    checked={settings.riskFormula.includes(comp.code)}
                    onChange={() => handleFormulaChange(comp.code)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-slate-800">{comp.name} ({comp.code})</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Intolerable Risk Cutoff Score"
            type="number"
            value={settings.intolerableCutoff}
            onChange={e => setSettings(prev => ({...prev, intolerableCutoff: Number(e.target.value)}))}
            containerClassName="max-w-xs"
            id="intolerableCutoff"
          />

          <div className="p-4 bg-white rounded-md border border-slate-200">
            <h4 className="font-semibold text-slate-600">Formula Preview:</h4>
            <p className="font-mono text-blue-700 mt-1">Risk Score = {settings.riskFormula.join(' * ') || 'N/A'}</p>
            <p className="mt-2 text-sm">A calculated risk score greater than <strong className="text-red-600">{settings.intolerableCutoff}</strong> will be considered <strong className="text-red-600">Intolerable</strong>.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} isLoading={saving}>Save Settings</Button>
        </div>
      </div>

      {/* Section 2: Reference */}
      <div className="p-6 border rounded-lg">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Reference: Rating Components &amp; Levels</h3>
        <div className="space-y-6">
          {ratingComponents.map(comp => (
            <div key={comp.id}>
              <h4 className="font-semibold text-slate-700">{comp.name} ({comp.code})</h4>
              <p className="text-sm text-slate-500 mb-2">{comp.description}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-t">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left font-medium text-slate-600">Score</th>
                      <th className="p-2 text-left font-medium text-slate-600">Level Name</th>
                      <th className="p-2 text-left font-medium text-slate-600">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comp.levels?.sort((a,b) => a.score - b.score).map(level => (
                      <tr key={level.id}>
                        <td className="p-2 font-bold text-center w-16">{level.score}</td>
                        <td className="p-2 font-semibold text-slate-800 w-48">{level.name}</td>
                        <td className="p-2 text-slate-600">{level.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskAssessmentSetupTab;