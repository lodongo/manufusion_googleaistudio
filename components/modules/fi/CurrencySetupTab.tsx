
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation } from '../../../types';
import type { MemsCurrency, CurrencySettings, ExchangeRate } from '../../../types/fi_types';
import Input from '../../Input';
import Button from '../../Button';
import LineChart from '../../common/LineChart';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const { Timestamp } = firebase.firestore;


interface CurrencySetupTabProps {
  organisation: Organisation;
  theme: Organisation['theme'];
}

type Period = 'currentMonth' | 'last30d' | 'ytd' | 'last12m';

const CurrencySetupTab: React.FC<CurrencySetupTabProps> = ({ organisation, theme }) => {
  const [settings, setSettings] = useState<CurrencySettings>({ localCurrency: organisation.currency.code, baseCurrency: 'USD' });
  const [allCurrencies, setAllCurrencies] = useState<MemsCurrency[]>([]);
  const [loading, setLoading] = useState({ settings: true, currencies: true, chart: false });
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  
  const [period, setPeriod] = useState<Period>('last30d');
  const [chartData, setChartData] = useState<{ date: Date, rate: number }[]>([]);

  const settingsDocRef = useMemo(() => 
    db.doc(`organisations/${organisation.domain}/modules/FI/settings/currency`), 
    [organisation.domain]
  );

  useEffect(() => {
    const currenciesRef = db.collection('settings/memsSetup/currencies');
    const q = currenciesRef.where('enabled', '==', true).orderBy('code');
    const unsubCurrencies = q.onSnapshot((snapshot) => {
      setAllCurrencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MemsCurrency)));
      setLoading(prev => ({ ...prev, currencies: false }));
    });

    const unsubSettings = settingsDocRef.onSnapshot((docSnap) => {
      if (docSnap.exists) {
        setSettings(docSnap.data() as CurrencySettings);
      } else {
        setSettings({ localCurrency: organisation.currency.code, baseCurrency: 'USD' });
      }
      setLoading(prev => ({ ...prev, settings: false }));
    });

    return () => { unsubCurrencies(); unsubSettings(); };
  }, [organisation.currency.code, settingsDocRef]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await settingsDocRef.set(settings);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // --- Calculate Constant Rate ---
  const handleCalculateConstantRate = async () => {
      if (!settings.constantRateConfig) return;
      if (settings.constantRateConfig.method === 'Manual') {
           // If manual, just save what is in manualRate
           if (!settings.constantRateConfig.manualRate) {
               setError("Please enter a manual rate.");
               return;
           }
           setSettings(prev => ({
               ...prev,
               constantRateConfig: {
                   ...prev.constantRateConfig!,
                   calculatedRate: prev.constantRateConfig!.manualRate,
                   lastCalculated: new Date().toISOString()
               }
           }));
           return;
      }

      setCalculating(true);
      setError('');
      
      try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setMonth(endDate.getMonth() - (settings.constantRateConfig.durationMonths || 3));
          
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];

          // Fetch rates for base currency against local currency (if possible) 
          // or base against USD and local against USD to calculate cross rate.
          // Assuming structure is settings/memsSetup/currencies/{CODE}/exchangeRates
          
          const fetchRates = async (code: string) => {
              const rRef = db.collection(`settings/memsSetup/currencies/${code}/exchangeRates`);
              const q = rRef.where('date', '>=', startStr).where('date', '<=', endStr).orderBy('date');
              const snap = await q.get();
              return snap.docs.map(d => d.data() as ExchangeRate);
          };

          let calculatedRates: number[] = [];

          if (settings.baseCurrency === 'USD') {
              const localRates = await fetchRates(settings.localCurrency);
              // Local vs USD means 1 USD = X Local. We want to convert Supplier (Foreign) -> Base (USD) -> Local.
              // Actually, the "Constant Rate" usually defines the budget rate for Local Currency vs Base Currency.
              // Let's assume Constant Rate = How much Local Currency equals 1 Unit of Base Currency.
              calculatedRates = localRates.map(r => r.rate);
          } else {
               // Cross rate calculation needed if base isn't USD (and data is USD based)
               const localRates = await fetchRates(settings.localCurrency);
               const baseRates = await fetchRates(settings.baseCurrency);
               
               // Map base rates by date
               const baseMap = new Map(baseRates.map(r => [r.date, r.rate]));
               
               localRates.forEach(lr => {
                   const br = baseMap.get(lr.date);
                   if (br) {
                       // 1 USD = LR Local
                       // 1 USD = BR Base
                       // 1 Base = (LR / BR) Local
                       calculatedRates.push(lr.rate / Number(br));
                   }
               });
          }
          
          if (calculatedRates.length === 0) {
              throw new Error("No historical data found for the selected duration.");
          }

          let result = 0;
          if (settings.constantRateConfig.method === 'Simple Average') {
              const sum = calculatedRates.reduce((a,b) => a+b, 0);
              result = sum / calculatedRates.length;
          } else if (settings.constantRateConfig.method === 'Spot Rate') {
              result = calculatedRates[calculatedRates.length - 1]; // Last available
          } else {
              // Weighted Average placeholder - simple average for now or more complex logic
              const sum = calculatedRates.reduce((a,b) => a+b, 0);
              result = sum / calculatedRates.length; 
          }
          
          setSettings(prev => ({
              ...prev,
              constantRateConfig: {
                  ...prev.constantRateConfig!,
                  calculatedRate: Number(result.toFixed(6)),
                  lastCalculated: new Date().toISOString()
              }
          }));

      } catch (e: any) {
          console.error(e);
          setError("Calculation failed: " + e.message);
      } finally {
          setCalculating(false);
      }
  };

  const timeFilter = useMemo(() => {
    const end = new Date();
    let start = new Date();
    switch (period) {
      case 'currentMonth':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'last30d':
        start.setDate(end.getDate() - 30);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      case 'last12m':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    return { 
      start: start.toISOString().split('T')[0], 
      end: end.toISOString().split('T')[0] 
    };
  }, [period]);

  useEffect(() => {
    if (!settings.localCurrency || !settings.baseCurrency) return;

    const fetchRates = async () => {
      setLoading(prev => ({ ...prev, chart: true }));
      setError('');
      setChartData([]);
      
      const { localCurrency, baseCurrency } = settings;
      
      if (localCurrency === baseCurrency) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        setChartData([{date: yesterday, rate: 1}, {date: today, rate: 1}]);
        setLoading(prev => ({ ...prev, chart: false }));
        return;
      }

      try {
        const fetchRatesForCurrency = async (code: string) => {
          const ratesRef = db.collection(`settings/memsSetup/currencies/${code}/exchangeRates`);
          const q = ratesRef.where('date', '>=', timeFilter.start).where('date', '<=', timeFilter.end).orderBy('date');
          const snapshot = await q.get();
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExchangeRate));
        };

        if (baseCurrency === 'USD') {
          const localRates = await fetchRatesForCurrency(localCurrency);
          setChartData(localRates.map(r => ({ date: new Date(r.date), rate: r.rate })));
        } else {
          const [localRatesVsUsd, baseRatesVsUsd] = await Promise.all([
            fetchRatesForCurrency(localCurrency),
            fetchRatesForCurrency(baseCurrency)
          ]);

          const baseRatesMap = new Map(baseRatesVsUsd.map(r => [r.date, r.rate]));
          const crossRates = localRatesVsUsd.map(localRate => {
            const baseRate = baseRatesMap.get(localRate.date);
            if (baseRate && Number(baseRate) > 0) {
              return { date: new Date(localRate.date), rate: Number(localRate.rate) / Number(baseRate) };
            }
            return null;
          }).filter(Boolean) as { date: Date; rate: number }[];
          
          setChartData(crossRates);
        }
      } catch (err: any) {
        setError("Failed to load exchange rate data. The selected currency may not have data available.");
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, chart: false }));
      }
    };

    fetchRates();
  }, [settings, timeFilter]);

  const PeriodButton: React.FC<{ value: Period; label: string }> = ({ value, label }) => (
    <button
      onClick={() => setPeriod(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === value ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
      style={period === value ? { backgroundColor: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <Input as="select" label="Local Currency (Reporting)" value={settings.localCurrency} onChange={e => setSettings(p => ({ ...p, localCurrency: e.target.value }))} disabled={loading.currencies} id="localCurrency">
          {loading.currencies ? <option>Loading...</option> : allCurrencies.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
        </Input>
        <Input as="select" label="Base Currency (Consolidation)" value={settings.baseCurrency} onChange={e => setSettings(p => ({ ...p, baseCurrency: e.target.value }))} disabled={loading.currencies} id="baseCurrency">
           {loading.currencies ? <option>Loading...</option> : allCurrencies.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
        </Input>
        <Button onClick={handleSave} isLoading={saving} disabled={loading.settings}>Save Settings</Button>
      </div>

      {/* Constant Rate Configuration */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h4 className="font-bold text-slate-700 mb-4">Organization Constant Rate</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <Input 
                  as="select" 
                  label="Calculation Method" 
                  id="calcMethod"
                  value={settings.constantRateConfig?.method || 'Simple Average'}
                  onChange={e => setSettings(p => ({...p, constantRateConfig: { ...p.constantRateConfig!, method: e.target.value as any } }))}
              >
                  <option value="Simple Average">Simple Average</option>
                  <option value="Weighted Average">Weighted Average</option>
                  <option value="Spot Rate">Spot Rate (Latest)</option>
                  <option value="Manual">Manual Entry</option>
              </Input>

              {settings.constantRateConfig?.method !== 'Manual' ? (
                   <Input 
                        as="select" 
                        label="Duration" 
                        id="duration"
                        value={settings.constantRateConfig?.durationMonths || 3}
                        onChange={e => setSettings(p => ({...p, constantRateConfig: { ...p.constantRateConfig!, durationMonths: Number(e.target.value) } }))}
                    >
                        <option value={1}>Last 1 Month</option>
                        <option value={3}>Last 3 Months</option>
                        <option value={6}>Last 6 Months</option>
                        <option value={12}>Last 12 Months</option>
                    </Input>
              ) : (
                  <Input 
                        label="Manual Rate" 
                        type="number"
                        id="manualRate"
                        value={settings.constantRateConfig?.manualRate || ''}
                        onChange={e => setSettings(p => ({...p, constantRateConfig: { ...p.constantRateConfig!, manualRate: Number(e.target.value) } }))}
                  />
              )}

              <Button onClick={handleCalculateConstantRate} isLoading={calculating} variant="secondary">
                  {settings.constantRateConfig?.method === 'Manual' ? 'Apply Manual Rate' : 'Calculate & Set'}
              </Button>
              
              <div className="bg-white p-2 rounded border text-center">
                  <span className="text-xs text-slate-500 block uppercase font-bold">Current Constant Rate</span>
                  <span className="text-lg font-mono font-bold text-blue-600">
                      {settings.constantRateConfig?.calculatedRate ? `1 ${settings.baseCurrency} = ${settings.constantRateConfig.calculatedRate} ${settings.localCurrency}` : 'Not Set'}
                  </span>
                  {settings.constantRateConfig?.lastCalculated && (
                      <span className="text-[10px] text-slate-400 block mt-1">
                          Updated: {new Date(settings.constantRateConfig.lastCalculated).toLocaleDateString()}
                      </span>
                  )}
              </div>
          </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
      
      <div className="pt-6 border-t">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-700">
                Trend: {settings.localCurrency} / {settings.baseCurrency}
            </h3>
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                <PeriodButton value="currentMonth" label="This Month" />
                <PeriodButton value="last30d" label="Last 30 Days" />
                <PeriodButton value="ytd" label="YTD" />
                <PeriodButton value="last12m" label="Last 12 Months" />
            </div>
        </div>
        {loading.chart ? (
             <div className="flex justify-center items-center h-96"><div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin" style={{borderColor: theme.colorPrimary}}></div></div>
        ) : chartData.length > 0 ? (
            <LineChart data={chartData} themeColor={theme.colorPrimary} />
        ) : (
            <div className="h-96 flex items-center justify-center bg-slate-50 rounded-lg text-slate-500">No exchange rate data available for the selected period.</div>
        )}
      </div>
    </div>
  );
};

export default CurrencySetupTab;
