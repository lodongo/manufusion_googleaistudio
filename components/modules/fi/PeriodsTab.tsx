import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { doc, onSnapshot, collection, query, updateDoc } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { FinancialPeriod, BudgetingSettings } from '../../../types/fi_types';
import Input from '../../Input';
import ConfirmationModal from '../../common/ConfirmationModal';

interface PeriodsTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
  setActiveSubTab: (tabId: string) => void;
}

const PeriodsTab: React.FC<PeriodsTabProps> = ({ organisation, theme, setActiveSubTab }) => {
  const [settings, setSettings] = useState<BudgetingSettings>({});
  const [allPeriods, setAllPeriods] = useState<FinancialPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; period: FinancialPeriod | null; newStatus: 'Open' | 'Closed' | null }>({ isOpen: false, period: null, newStatus: null });

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
    return Array.from(years).sort((a, b) => Number(b) - Number(a)); // Sort descending
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
    return <div className="p-8 text-center">Loading periods...</div>;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-lg font-medium text-gray-900">Manage Financial Periods</h3>
        <div className="w-full md:w-64">
          <Input as="select" label="Financial Year" id="financialYear" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {availableYears.map(year => (
              <option key={year} value={year}>
                FY {year}
                {year === settings.activeFinancialYear && ' (Active)'}
                {year === settings.planningFinancialYear && ' (Planning)'}
              </option>
            ))}
          </Input>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-x-auto border">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Start Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">End Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {displayedPeriods.map(period => (
              <tr key={period.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{period.period}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDateLong(period.startDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDateLong(period.endDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(period.status)}`}>
                    {period.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  {period.status !== 'Future' && (
                    <button onClick={() => handleToggleStatus(period)} className="text-sm font-medium hover:underline" style={{ color: theme.colorPrimary }}>
                      {period.status === 'Open' ? 'Close' : 'Re-open'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ isOpen: false, period: null, newStatus: null })}
        onConfirm={confirmToggleStatus}
        title={`Confirm: ${confirmState.newStatus} Period`}
        message={`Are you sure you want to ${confirmState.newStatus?.toLowerCase()} Period ${confirmState.period?.period} for FY ${confirmState.period?.fy}?`}
        isLoading={saving}
      />
    </div>
  );
};

export default PeriodsTab;