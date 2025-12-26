import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { doc, onSnapshot, collection, query, updateDoc, setDoc } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { FinancialPeriod, BudgetingSettings } from '../../../types/fi_types';
import Input from '../../Input';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';

interface ActiveCalendarsTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
  setActiveSubTab: (tabId: string) => void;
}

const ActiveCalendarsTab: React.FC<ActiveCalendarsTabProps> = ({ organisation, theme, setActiveSubTab }) => {
  const [settings, setSettings] = useState<BudgetingSettings>({});
  const [allPeriods, setAllPeriods] = useState<FinancialPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const settingsDocRef = useMemo(() => doc(db, `organisations/${organisation.domain}/modules/FI/settings/budgeting`), [organisation.domain]);
  const periodsCollectionRef = useMemo(() => collection(db, `organisations/${organisation.domain}/modules/FI/periods`), [organisation.domain]);

  useEffect(() => {
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      setSettings(docSnap.exists() ? (docSnap.data() as BudgetingSettings) : {});
    });
    const unsubPeriods = onSnapshot(query(periodsCollectionRef), (snapshot) => {
      const periodsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FinancialPeriod));
      setAllPeriods(periodsData);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubPeriods(); };
  }, [settingsDocRef, periodsCollectionRef]);

  const availableYears = useMemo(() => {
    const years = new Set(allPeriods.map(p => p.fy));
    return Array.from(years).sort((a: number, b: number) => b - a); // Sort descending
  }, [allPeriods]);

  useEffect(() => {
    if (!loading) {
      if (settings.activeFinancialYear && availableYears.includes(settings.activeFinancialYear)) {
        setSelectedYear(settings.activeFinancialYear);
      } else if (availableYears.length > 0) {
        setSelectedYear(availableYears[0]);
      } else {
        setSelectedYear('');
      }
    }
  }, [loading, settings.activeFinancialYear, availableYears]);

  const displayedPeriods = useMemo(() => {
    if (!selectedYear) return [];
    return allPeriods
      .filter(p => p.fy === selectedYear)
      .sort((a, b) => Number(a.period) - Number(b.period));
  }, [allPeriods, selectedYear]);

  const formatDateLong = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00Z');
    return date.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  };

  const handleToggleStatus = (period: FinancialPeriod) => {
    const newStatus = period.status === 'Open' ? 'Closed' : 'Open';
    setConfirmState({ isOpen: true, period, newStatus });
  };
  
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; period: FinancialPeriod | null; newStatus: 'Open' | 'Closed' | null }>({ isOpen: false, period: null, newStatus: null });

  const confirmToggleStatus = async () => {
    if (!confirmState.period || !confirmState.newStatus) return;
    setSaving(true);
    const periodRef = doc(periodsCollectionRef, confirmState.period.id!);
    try {
      await updateDoc(periodRef, { status: confirmState.newStatus });
    } catch (error) {
      console.error("Failed to update period status:", error);
      alert("Error updating status.");
    } finally {
      setSaving(false);
      setConfirmState({ isOpen: false, period: null, newStatus: null });
    }
  };

  if (loading) {
      return <div className="p-8 text-center">Loading calendars...</div>
  }

  if (availableYears.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
        <p className="font-semibold">No Financial Periods Found</p>
        <p className="mt-2">You need to generate calendar periods before you can view them.</p>
        <button onClick={() => setActiveSubTab('calendarConfig')} className="mt-4 text-sm font-semibold hover:underline" style={{ color: theme.colorPrimary }}>
          Go to Calendar Config
        </button>
      </div>
    );
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await setDoc(settingsDocRef, settings, { merge: true });
    setSaving(false);
    alert('Settings saved successfully!');
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({...prev, [name]: value ? Number(value) : undefined }));
  };

  const CalendarCard: React.FC<{ year: number; label: string; }> = ({ year, label }) => {
    const yearData = allPeriods.filter(p => p.fy === year);
    const isGenerated = yearData.length > 0;
    const isActive = settings.activeFinancialYear === year;
    const isPlanning = settings.planningFinancialYear === year;
    
    let details;
    if (isGenerated) {
        const sortedPeriods = [...yearData].sort((a,b) => a.period - b.period);
        const startDate = sortedPeriods[0]?.startDate;
        const endDate = sortedPeriods[sortedPeriods.length - 1]?.endDate;
        const periodCount = sortedPeriods.length;
        details = (
            <>
                <p className="text-sm text-slate-500">{startDate} to {endDate}</p>
                <p className="text-sm text-slate-500">{periodCount} Periods</p>
            </>
        );
    } else {
        details = (
            <div className="text-center py-4">
                <p className="font-semibold text-yellow-700">Not Generated</p>
                <button
                    onClick={() => setActiveSubTab('calendarConfig')}
                    className="mt-2 text-sm hover:underline" style={{color: theme.colorPrimary}}>
                    Generate Calendar
                </button>
            </div>
        );
    }
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <h4 className="font-bold text-lg text-slate-800">{year}</h4>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isActive && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>}
            {isPlanning && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Planning</span>}
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">{details}</div>
      </div>
    );
  };

  const currentYear = new Date().getFullYear();
  const yearsToShow = {
    last: currentYear - 1,
    current: currentYear,
    next: currentYear + 1
  };

  return (
    <div className="space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Active Financial Calendars</h3>
        <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
            <legend className="font-semibold text-slate-700">Control Panel</legend>
            <p className="text-sm text-slate-600">
                Designate one financial year as 'Active' for current transactions and one as 'Planning' for budget preparation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Input as="select" label="Active Financial Year" name="activeFinancialYear" value={settings.activeFinancialYear || ''} onChange={handleChange} id="activeFinancialYear">
                    <option value="">Select Year...</option>
                    {availableYears.map(y => <option key={y} value={y}>FY {y}</option>)}
                </Input>
                <Input as="select" label="Planning Financial Year" name="planningFinancialYear" value={settings.planningFinancialYear || ''} onChange={handleChange} id="planningFinancialYear">
                    <option value="">Select Year...</option>
                    {availableYears.map(y => <option key={y} value={y}>FY {y}</option>)}
                </Input>
                <Button onClick={handleSave} isLoading={saving} disabled={loading}>Save Settings</Button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CalendarCard year={yearsToShow.last} label="Last Year" />
            <CalendarCard year={yearsToShow.current} label="Current Year" />
            <CalendarCard year={yearsToShow.next} label="Next Year" />
        </div>
    </div>
  );
};

export default ActiveCalendarsTab;
