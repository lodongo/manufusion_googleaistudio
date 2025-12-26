import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { doc, onSnapshot, setDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import type { Organisation } from '../../../types';
import type { FinancialCalendarSettings, FinancialPeriod } from '../../../types/fi_types';
import Input from '../../Input';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';

interface CalendarConfigTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CalendarConfigTab: React.FC<CalendarConfigTabProps> = ({ organisation, theme }) => {
    const defaultFYDate = `${new Date().getFullYear()}-01-01`;
    const [settings, setSettings] = useState<FinancialCalendarSettings>({
        cycleType: 'standard',
        fyStartDate: defaultFYDate,
        retailYearEndRule: 'last_day_of_month',
        retailYearEndMonth: 12,
        retailYearEndDay: 6, // Saturday
        weekStartsOn: 0, // Sunday
    });
    
    const [previewPeriods, setPreviewPeriods] = useState<FinancialPeriod[]>([]);
    const [yearToGenerate, setYearToGenerate] = useState(new Date().getFullYear());
    const [existingYears, setExistingYears] = useState<number[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [confirmGenerate, setConfirmGenerate] = useState(false);

    const settingsDocRef = useMemo(() => doc(db, `organisations/${organisation.domain}/modules/FI/settings/calendarConfig`), [organisation.domain]);
    const periodsCollectionRef = useMemo(() => collection(db, `organisations/${organisation.domain}/modules/FI/periods`), [organisation.domain]);

    useEffect(() => {
        const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                // Ensure all fields have defaults to prevent errors with older data structures
                const data = docSnap.data();
                setSettings(prev => ({ ...prev, ...data }));
            }
            setLoading(false);
        });

        const q = query(periodsCollectionRef);
        const unsubPeriods = onSnapshot(q, (snapshot) => {
            const years = new Set<number>();
            snapshot.forEach(doc => {
                years.add(doc.data().fy as number);
            });
            setExistingYears(Array.from(years).sort());
        });

        return () => {
            unsubSettings();
            unsubPeriods();
        };
    }, [settingsDocRef, periodsCollectionRef]);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await setDoc(settingsDocRef, settings, { merge: true });
            alert('Configuration saved!');
        } catch (error) {
            console.error(error);
            alert('Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };
    
    // --- Calendar Generation Logic ---
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const addDays = (date: Date, days: number) => { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result; };

    const getRetailYearEndDate = (year: number, month: number, dayOfWeek: number, rule: 'last_day_of_month' | 'closest_to_end_of_month') => {
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
        const lastDayOfWeek = lastDayOfMonth.getUTCDay();
        let daysToSubtract = (lastDayOfWeek - dayOfWeek + 7) % 7;
        const lastMatchingDay = addDays(lastDayOfMonth, -daysToSubtract);

        if (rule === 'closest_to_end_of_month') {
            const nextMatchingDay = addDays(lastMatchingDay, 7);
            const diffLast = Math.abs(lastMatchingDay.getTime() - lastDayOfMonth.getTime());
            const diffNext = Math.abs(nextMatchingDay.getTime() - lastDayOfMonth.getTime());
            return diffNext < diffLast ? nextMatchingDay : lastMatchingDay;
        }
        return lastMatchingDay;
    };
    
    const handlePreview = () => {
        const newPeriods: Omit<FinancialPeriod, 'id' | 'status'>[] = [];
        let currentDate: Date;

        if (settings.cycleType === 'standard') {
            const startMonth = parseInt(settings.fyStartDate.substring(5,7), 10) -1;
            const startDate = new Date(Date.UTC(yearToGenerate, startMonth, 1));

            for (let i = 0; i < 12; i++) {
                const periodStartDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
                const periodEndDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i + 1, 0));
                newPeriods.push({ fy: yearToGenerate, period: i + 1, startDate: formatDate(periodStartDate), endDate: formatDate(periodEndDate) });
            }
        } else {
            const weekPatterns: Record<string, number[]> = { '445': [4, 4, 5], '454': [4, 5, 4], '544': [5, 4, 4] };
            const pattern = weekPatterns[settings.cycleType];
            
            const findStartDate = (year: number): {start: Date, weeks: number} => {
                const yearEndDate = getRetailYearEndDate(year, settings.retailYearEndMonth, settings.retailYearEndDay, settings.retailYearEndRule);
                const prevYearEndDate = getRetailYearEndDate(year - 1, settings.retailYearEndMonth, settings.retailYearEndDay, settings.retailYearEndRule);
                const yearStartDate = addDays(prevYearEndDate, 1);

                const diffDays = (yearEndDate.getTime() - yearStartDate.getTime()) / (1000 * 3600 * 24) + 1;
                const weeks = Math.round(diffDays / 7);
                
                // Adjust start date to align with weekStartsOn
                const dayOfWeek = yearStartDate.getUTCDay();
                const adjustment = (dayOfWeek - settings.weekStartsOn + 7) % 7;
                return { start: addDays(yearStartDate, -adjustment), weeks };
            };
            
            const { start, weeks: weeksInYear } = findStartDate(yearToGenerate);
            currentDate = start;

            let periodCounter = 1;
            for (let q = 0; q < 4; q++) {
                for (const weeks of pattern) {
                    let weeksForPeriod = weeks;
                    if (periodCounter === 12 && weeksInYear === 53) {
                        weeksForPeriod += 1;
                    }
                    const periodEndDate = addDays(currentDate, weeksForPeriod * 7 - 1);
                    newPeriods.push({ fy: yearToGenerate, period: periodCounter, startDate: formatDate(currentDate), endDate: formatDate(periodEndDate) });
                    currentDate = addDays(periodEndDate, 1);
                    periodCounter++;
                }
            }
        }
        setPreviewPeriods(newPeriods.map(p => ({...p, status: 'Future'})));
    };
    
    const handleGenerateAndActivate = async () => {
        if (previewPeriods.length === 0) {
            alert("Please generate a preview first.");
            setConfirmGenerate(false);
            return;
        }
        setGenerating(true);
        const batch = writeBatch(db);
        try {
            previewPeriods.forEach(p => {
                const docId = `${yearToGenerate}-P${p.period.toString().padStart(2, '0')}`;
                const docRef = doc(periodsCollectionRef, docId);
                batch.set(docRef, {
                    fy: yearToGenerate, period: p.period,
                    startDate: p.startDate, endDate: p.endDate, status: 'Open'
                });
            });
            await batch.commit();
            alert(`Successfully generated and activated ${previewPeriods.length} periods for FY ${yearToGenerate}.`);
        } catch (error) {
            console.error(error);
            alert('Failed to generate periods.');
        } finally {
            setGenerating(false);
            setConfirmGenerate(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    const isYearGenerated = existingYears.includes(yearToGenerate);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Financial Calendar Configuration</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Settings */}
                <div className="p-4 border rounded-lg bg-slate-50 space-y-6">
                    <fieldset className="space-y-4">
                        <legend className="font-semibold text-slate-700">General Settings</legend>
                        <Input as="select" id="cycleType" label="Calendar Cycle Type" value={settings.cycleType} onChange={e => { setSettings(p => ({ ...p, cycleType: e.target.value as any })); setPreviewPeriods([]); }}>
                            <option value="standard">Standard Calendar (12 Periods)</option>
                            <option value="445">4-4-5 Week Pattern</option>
                            <option value="454">4-5-4 Week Pattern</option>
                            <option value="544">5-4-4 Week Pattern</option>
                        </Input>
                        <Input id="yearToGenerate" label="Financial Year to Generate" type="number" value={yearToGenerate} onChange={e => { setYearToGenerate(Number(e.target.value)); setPreviewPeriods([]); }} />
                    </fieldset>

                    {settings.cycleType === 'standard' ? (
                         <fieldset className="space-y-4 pt-4 border-t">
                            <legend className="font-semibold text-slate-700">Standard Calendar Settings</legend>
                            <Input id="fyStartDate" label="Financial Year Start Date" type="date" value={settings.fyStartDate} onChange={e => setSettings(p => ({ ...p, fyStartDate: e.target.value }))} required />
                         </fieldset>
                    ) : (
                         <fieldset className="space-y-4 pt-4 border-t">
                             <legend className="font-semibold text-slate-700">Retail Calendar Settings</legend>
                             <Input as="select" id="retailYearEndMonth" label="Financial Year Ends In" value={settings.retailYearEndMonth} onChange={e => setSettings(p => ({ ...p, retailYearEndMonth: Number(e.target.value) }))}>
                                {Array.from({length: 12}, (_, i) => i+1).map(m => <option key={m} value={m}>{new Date(0, m-1).toLocaleString('default', { month: 'long' })}</option>)}
                             </Input>
                             <Input as="select" id="retailYearEndDay" label="on the" value={settings.retailYearEndDay} onChange={e => setSettings(p => ({...p, retailYearEndDay: Number(e.target.value) as any}))}>
                                {WEEK_DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
                             </Input>
                             <Input as="select" id="retailYearEndRule" label="which is" value={settings.retailYearEndRule} onChange={e => setSettings(p => ({ ...p, retailYearEndRule: e.target.value as any }))}>
                                <option value="last_day_of_month">Last occurrence of that day in the month</option>
                                <option value="closest_to_end_of_month">Occurrence of that day closest to month-end</option>
                             </Input>
                             <Input as="select" id="weekStartsOn" label="Week Starts On" value={settings.weekStartsOn} onChange={e => setSettings(p => ({...p, weekStartsOn: Number(e.target.value) as any}))}>
                                {WEEK_DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
                             </Input>
                         </fieldset>
                    )}
                    
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <Button onClick={handleSaveConfig} isLoading={saving}>Save Configuration</Button>
                        <Button onClick={handlePreview} variant="secondary">Preview Periods for FY {yearToGenerate}</Button>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg text-slate-700 mb-2">Generated Period Preview for FY {yearToGenerate}</h4>
                    {isYearGenerated && <div className="p-3 text-sm text-yellow-800 bg-yellow-100 rounded-md mb-4">Warning: Periods for FY {yearToGenerate} already exist. Activating will overwrite them.</div>}
                    {previewPeriods.length > 0 ? (
                        <>
                            <div className="overflow-y-auto border rounded-lg max-h-96">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="p-2 text-left font-medium">Period</th>
                                            <th className="p-2 text-left font-medium">Start Date</th>
                                            <th className="p-2 text-left font-medium">End Date</th>
                                            <th className="p-2 text-right font-medium">Days</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {previewPeriods.map(p => {
                                            const days = (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (1000 * 3600 * 24) + 1;
                                            return(
                                            <tr key={p.period}>
                                                <td className="p-2 font-medium">{p.period}</td>
                                                <td className="p-2 font-mono">{p.startDate}</td>
                                                <td className="p-2 font-mono">{p.endDate}</td>
                                                <td className="p-2 text-right">{days}</td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg flex items-center justify-center gap-4">
                                <Button onClick={() => setConfirmGenerate(true)} isLoading={generating}>Generate & Activate Periods</Button>
                            </div>
                        </>
                    ) : (
                        <div className="h-96 flex items-center justify-center text-center text-slate-500 bg-slate-50 rounded-md border-2 border-dashed">
                           <p>Adjust settings and click "Preview Periods" to see the results.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <ConfirmationModal 
                isOpen={confirmGenerate}
                onClose={() => setConfirmGenerate(false)}
                onConfirm={handleGenerateAndActivate}
                title={`Generate Periods for FY ${yearToGenerate}?`}
                message={`This will create ${previewPeriods.length} financial periods in the database. ${isYearGenerated ? 'Existing periods for this year will be overwritten.' : ''} This action cannot be undone.`}
                isLoading={generating}
                confirmButtonClass="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                confirmButtonText="Yes, Generate & Activate"
            />
        </div>
    );
};

export default CalendarConfigTab;