import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MaterialMasterData, Organisation, InventoryData } from '../../../../types';
import { MaterialMovement } from '../../../../types/in_types';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// Added collection to the imports from firebase/firestore to resolve "Cannot find name 'collection'" error on line 376.
import { collection, collectionGroup, query, where, onSnapshot, orderBy, limit, doc, addDoc } from 'firebase/firestore';
import Button from '../../../Button';
import Input from '../../../Input';
import Modal from '../../../common/Modal';
import ConfirmationModal from '../../../common/ConfirmationModal';
import { useAuth } from '../../../../context/AuthContext';

const { Timestamp } = firebase.firestore;

const EXCLUSION_REASONS = [
    'Data Error',
    'One-off Project',
    'Stock Adjustment',
    'System Correction',
    'Seasonal Spike',
    'Other'
];

interface AnalyticsProps {
    material: MaterialMasterData;
    organisation: Organisation;
    warehousePath?: string | null;
    currencyConfig: { local: string; base: string; rate: number };
    theme: Organisation['theme'];
    onUpdate?: (data: InventoryData) => void;
}

interface ExclusionRecord {
    movementId: string;
    reason: string;
    date: string;
    quantity: number;
    excludedBy: string;
}

interface DataPoint {
    date: number;
    val: number; 
    totalVal: number; 
    type: 'RECEIPT' | 'ISSUE' | 'ADJ_POS' | 'ADJ_NEG' | 'SIMULATED';
    isExcluded?: boolean;
    originalRef?: MaterialMovement;
}

type ForecastModel = 'Linear' | 'Holt' | 'MovingAvg' | 'SingleExp';

const MetricBlock: React.FC<{ label: string; recommended: number; current: number; unit?: string }> = ({ label, recommended, current, unit }) => {
    const variance = recommended - current;
    return (
        <div className="flex flex-col px-6 py-3 border-r border-slate-200 last:border-0 min-w-[180px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-900">{Math.round(recommended).toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">{unit}</span>
            </div>
            <div className="flex flex-col mt-1.5 space-y-0.5">
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter">Current:</span>
                    <span className="text-slate-600 font-bold">{Math.round(current).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter">Variance:</span>
                    <span className={`font-mono font-black ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                        {variance > 0 ? '+' : ''}{Math.round(variance).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};

const MaterialAnalyticsTab: React.FC<AnalyticsProps> = ({ material, organisation, warehousePath, currencyConfig, theme, onUpdate }) => {
    const { currentUserProfile } = useAuth();
    const [movements, setMovements] = useState<MaterialMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewCurrency, setViewCurrency] = useState<'local' | 'base'>('local');

    // --- Engine Configuration ---
    const [historyHorizon, setHistoryHorizon] = useState(12);
    const [forecastHorizon, setForecastHorizon] = useState(12);
    const [safetyDelta, setSafetyDelta] = useState(0);
    const [model, setModel] = useState<ForecastModel>('Holt');
    const [replenishmentCycle, setReplenishmentCycle] = useState(30);
    const [leadTimeOverride, setLeadTimeOverride] = useState<number | ''>(''); 
    const [manualSafetyStock, setManualSafetyStock] = useState<number | ''>('');
    const [useAffinityScaling, setUseAffinityScaling] = useState(true);
    
    // --- Simulation State ---
    const [isSimulatingDemand, setIsSimulatingDemand] = useState(false);
    const [simulatedMonthlyDemand, setSimulatedMonthlyDemand] = useState(10);
    const [randomizeSimulation, setRandomizeSimulation] = useState(false);
    const [simulationSeed, setSimulationSeed] = useState(Date.now());
    
    const [exclusions, setExclusions] = useState<Record<string, ExclusionRecord>>({});

    const [selectedMovement, setSelectedMovement] = useState<MaterialMovement | null>(null);
    const [restoreId, setRestoreId] = useState<string | null>(null); 
    const [exclusionReason, setExclusionReason] = useState('Data Error');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [acceptModalOpen, setAcceptModalOpen] = useState(false);
    
    const chartRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    const docPath = warehousePath || `organisations/${organisation.domain}/modules/IN/masterData/${material.id}`;
    const strategicAffinity = material.inventoryData?.serviceLevelTarget || 95;

    useEffect(() => {
        setLoading(true);
        // Ensure path starts from root for collectionGroup check
        const movementsRef = collectionGroup(db as any, 'materialMovements');
        const qMovements = query(movementsRef, where('materialId', '==', material.id), orderBy('date', 'desc'), limit(50));
        
        const unsubMoves = onSnapshot(qMovements, (snapshot) => {
            const orgMovements = snapshot.docs
                .filter(d => d.ref.path.startsWith(`organisations/${organisation.domain}`))
                .map(d => ({ id: d.id, ...d.data() } as MaterialMovement));
            setMovements(orgMovements);
            setLoading(false);
        }, (err) => { console.error("Movement Fetch Error:", err); setLoading(false); });

        const unsubSettings = onSnapshot(doc(db as any, docPath), (snap) => {
             const data = snap.data();
             if (data?.analyticsSettings?.exclusions) setExclusions(data.analyticsSettings.exclusions);
             if (data?.analyticsSettings?.config) {
                 const cfg = data.analyticsSettings.config;
                 if (typeof cfg.historyHorizon === 'number') setHistoryHorizon(cfg.historyHorizon);
                 if (typeof cfg.forecastHorizon === 'number') setForecastHorizon(cfg.forecastHorizon);
                 if (typeof cfg.safetyDelta === 'number') setSafetyDelta(cfg.safetyDelta);
                 if (cfg.model) setModel(cfg.model);
                 if (typeof cfg.replenishmentCycle === 'number') setReplenishmentCycle(cfg.replenishmentCycle);
                 if (typeof cfg.leadTimeOverride === 'number' || cfg.leadTimeOverride === '') setLeadTimeOverride(cfg.leadTimeOverride);
                 if (typeof cfg.manualSafetyStock === 'number' || cfg.manualSafetyStock === '') setManualSafetyStock(cfg.manualSafetyStock);
                 if (typeof cfg.useAffinityScaling === 'boolean') setUseAffinityScaling(cfg.useAffinityScaling);
                 if (typeof cfg.isSimulatingDemand === 'boolean') setIsSimulatingDemand(cfg.isSimulatingDemand);
                 if (typeof cfg.simulatedMonthlyDemand === 'number') setSimulatedMonthlyDemand(cfg.simulatedMonthlyDemand);
                 if (typeof cfg.randomizeSimulation === 'boolean') setRandomizeSimulation(cfg.randomizeSimulation);
                 if (typeof cfg.simulationSeed === 'number') setSimulationSeed(cfg.simulationSeed);
             }
        });

        return () => { unsubMoves(); unsubSettings(); };
    }, [material.id, organisation.domain, docPath]);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if(entries[0]) setContainerWidth(entries[0].contentRect.width);
        });
        if (chartRef.current) observer.observe(chartRef.current);
        return () => observer.disconnect();
    }, []);

    const zScore = useMemo(() => {
        const sl = strategicAffinity;
        if (sl >= 99.9) return 3.09;
        if (sl >= 99) return 2.33;
        if (sl >= 98) return 2.05;
        if (sl >= 95) return 1.645;
        if (sl >= 90) return 1.28;
        if (sl >= 85) return 1.04;
        return 1.04;
    }, [strategicAffinity]);

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        let historyStart = new Date(now);
        historyStart.setMonth(historyStart.getMonth() - historyHorizon);

        const daysInHorizon = Math.ceil((now.getTime() - historyStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysToForecast = Math.ceil(forecastHorizon * 30.44);
        
        const dailyDataMap = new Map<string, { demand: number; simulated: number }>();
        const chartDataMap = new Map<string, { type: DataPoint['type'], movements: MaterialMovement[], totalQty: number, effectiveQty: number }>();

        const timeSeries: number[] = [];
        const dateIterator = new Date(historyStart);
        while (dateIterator <= now) {
            const dateStr = dateIterator.toISOString().split('T')[0];
            dailyDataMap.set(dateStr, { demand: 0, simulated: 0 });
            timeSeries.push(0);
            dateIterator.setDate(dateIterator.getDate() + 1);
        }

        // --- SIMULATION LOGIC: Randomize distribution over time AND quantity ---
        if (isSimulatingDemand) {
            const totalSimUnits = simulatedMonthlyDemand * historyHorizon;
            const days: string[] = Array.from(dailyDataMap.keys());

            if (randomizeSimulation) {
                // Pseudo-random seeded distribution for deterministic behavior per seed
                let rng = simulationSeed;
                const nextRand = () => {
                    rng = (rng * 16807) % 2147483647;
                    return (rng - 1) / 2147483646;
                };

                // Define number of random occurrences based on horizon
                const numEvents = Math.max(1, Math.round(historyHorizon * 2.5));
                const eventWeights: number[] = [];
                let totalWeight = 0;

                // 1. Generate random weights for quantity distribution
                for (let i = 0; i < numEvents; i++) {
                    const w = 0.2 + nextRand() * 0.8; // Random weight between 0.2 and 1.0
                    eventWeights.push(w);
                    totalWeight += w;
                }

                // 2. Distribute weighted quantities to random days
                for (let i = 0; i < numEvents; i++) {
                    const randomDayIdx = Math.floor(nextRand() * days.length);
                    const dateStr = days[randomDayIdx];
                    const entry = dailyDataMap.get(dateStr);
                    if (entry) {
                        // Volume per event is scaled to total target volume
                        const eventQty = (eventWeights[i] / totalWeight) * totalSimUnits;
                        entry.simulated += eventQty;
                    }
                }

                // Smooth out simulated values for visual clarity in tooltips
                dailyDataMap.forEach(entry => {
                    if (entry.simulated > 0) {
                        entry.simulated = Math.round(entry.simulated * 10) / 10;
                    }
                });
            } else {
                // Standard non-randomized distribution: Fixed quantity on the 1st of each month
                days.forEach((dateStr) => {
                    if (dateStr.endsWith('-01')) {
                        const entry = dailyDataMap.get(dateStr);
                        if (entry) entry.simulated = simulatedMonthlyDemand;
                    }
                });
            }
        }

        movements.forEach(m => {
            const mDate = m.date.toDate();
            if (mDate < historyStart || mDate > new Date(now.getTime() + 86400000)) return; 
            const dateStr = mDate.toISOString().split('T')[0];
            const qty = Math.abs(m.quantity);
            const isExcluded = !!exclusions[m.id || ''];
            let type: DataPoint['type'] = 'ISSUE';
            if (m.type === 'RECEIPT') type = 'RECEIPT';
            else if (m.type === 'ADJUSTMENT' || m.type === 'RETURN') type = m.quantity > 0 ? 'ADJ_POS' : 'ADJ_NEG';
            const chartKey = `${dateStr}_${type}`;
            if (!chartDataMap.has(chartKey)) chartDataMap.set(chartKey, { type, movements: [], totalQty: 0, effectiveQty: 0 });
            const group = chartDataMap.get(chartKey)!;
            group.movements.push(m);
            group.totalQty += qty;
            if (!isExcluded) group.effectiveQty += qty;
            if (m.type === 'ISSUE' && !isExcluded && !isSimulatingDemand) {
                const dayEntry = dailyDataMap.get(dateStr);
                if (dayEntry) dayEntry.demand += qty;
            }
        });

        let tsIdx = 0;
        const tsIter = new Date(historyStart);
        while (tsIter <= now) {
            const dStr = tsIter.toISOString().split('T')[0];
            const entry = dailyDataMap.get(dStr);
            timeSeries[tsIdx] = isSimulatingDemand ? (entry?.simulated || 0) : (entry?.demand || 0);
            tsIdx++;
            tsIter.setDate(tsIter.getDate() + 1);
        }

        const allPoints: DataPoint[] = Array.from(chartDataMap.entries()).map(([key, data]) => ({
            date: new Date(key.split('_')[0]).getTime(), val: data.effectiveQty, totalVal: data.totalQty, type: data.type,
            isExcluded: data.effectiveQty === 0 && data.totalQty > 0,
            originalRef: data.movements[0]
        })).sort((a,b) => a.date - b.date);

        if (isSimulatingDemand) {
            dailyDataMap.forEach((entry, dateStr) => {
                if (entry.simulated > 0) {
                    allPoints.push({ date: new Date(dateStr).getTime(), val: entry.simulated, totalVal: entry.simulated, type: 'SIMULATED' });
                }
            });
        }

        const totalIssuesInHorizon = timeSeries.reduce((a,b) => a+b, 0);
        const avgDailyDemand = totalIssuesInHorizon / daysInHorizon;
        const varianceVal = timeSeries.length > 1 ? timeSeries.reduce((acc, val) => acc + Math.pow(val - avgDailyDemand, 2), 0) / (timeSeries.length - 1) : 0;
        const stdDev = Math.sqrt(varianceVal);

        let forecastPoints: { x: number, y: number }[] = [];
        const forecastStartMs = now.getTime();

        if (model === 'Linear') {
            const n = timeSeries.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for(let i=0; i<n; i++) { sumX += i; sumY += timeSeries[i]; sumXY += i * timeSeries[i]; sumXX += i * i; }
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
            const intercept = (sumY - slope * sumX) / n;
            for(let i=0; i<daysToForecast; i++) forecastPoints.push({ x: forecastStartMs + (i+1)*86400000, y: Math.max(0, slope * (n + i) + intercept) });
        } else if (model === 'Holt') {
            let a = 0.3, b = 0.1, L = timeSeries[0] || 0, T = (timeSeries[1] || 0) - (timeSeries[0] || 0);
            for(let i=0; i<timeSeries.length; i++) { const nextL = a * timeSeries[i] + (1-a)*(L + T); const nextT = b * (nextL - L) + (1-b)*T; L = nextL; T = nextT; }
            for(let k=1; k<=daysToForecast; k++) forecastPoints.push({ x: forecastStartMs + k*86400000, y: Math.max(0, L + (k * T)) });
        } else if (model === 'MovingAvg') {
            const ma = timeSeries.slice(-30).reduce((a,b) => a+b, 0) / Math.min(30, timeSeries.length || 1);
            for(let i=0; i<daysToForecast; i++) forecastPoints.push({ x: forecastStartMs + (i+1)*86400000, y: ma });
        } else {
            let alpha = 0.3, level = timeSeries[0] || 0;
            for(let i=0; i<timeSeries.length; i++) level = alpha * timeSeries[i] + (1-alpha) * level;
            for(let i=0; i<daysToForecast; i++) forecastPoints.push({ x: forecastStartMs + (i+1)*86400000, y: level });
        }

        const lt = Number(leadTimeOverride) || (material.procurementData?.totalLeadTimeDays || 30);
        const affinityMultiplier = useAffinityScaling ? (strategicAffinity / 100) : 1;

        const calculatedSafety = Math.ceil(zScore * stdDev * Math.sqrt(lt) * (1 + (safetyDelta / 100)));
        let safety = manualSafetyStock !== '' ? Number(manualSafetyStock) : calculatedSafety;
        
        let rop = Math.ceil((avgDailyDemand * lt) + safety);
        let min = safety;
        let oq = avgDailyDemand * replenishmentCycle;
        let max = Math.ceil(rop + oq);
        
        if (useAffinityScaling) {
            safety = Math.ceil(safety * affinityMultiplier);
            rop = Math.ceil(rop * affinityMultiplier);
            min = Math.ceil(min * affinityMultiplier);
            oq = oq * affinityMultiplier;
            max = Math.ceil(max * affinityMultiplier);
        }
        
        // --- WORKING CAPITAL IMPACT CALCULATION ---
        const unitPrice = material.procurementData?.standardPrice || material.inventoryData?.standardPrice || 0;
        const currentOq = (material.inventoryData?.maxStockLevel || 0) - (material.inventoryData?.reorderPointQty || 0);
        const currentAvgInv = (material.inventoryData?.safetyStockQty || 0) + (Math.max(0, currentOq) / 2);
        const recommendedOq = oq;
        const recommendedAvgInv = safety + (recommendedOq / 2);
        const currentInvestment = currentAvgInv * unitPrice;
        const recommendedInvestment = recommendedAvgInv * unitPrice;
        const capImpact = recommendedInvestment - currentInvestment;
        const capImpactPct = currentInvestment > 0 ? (capImpact / currentInvestment) * 100 : 0;

        return {
            allPoints, forecastPoints, historyStart, now, avgDailyDemand, stdDev, 
            recommendations: { rop, min, max, safety }, capImpact, capImpactPct, lt, z: zScore,
            cv: avgDailyDemand > 0 ? stdDev / avgDailyDemand : 0,
            oq
        };
    }, [movements, historyHorizon, forecastHorizon, exclusions, model, replenishmentCycle, leadTimeOverride, strategicAffinity, safetyDelta, isSimulatingDemand, simulatedMonthlyDemand, randomizeSimulation, simulationSeed, material, manualSafetyStock, zScore, useAffinityScaling]);

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            const userFullName = `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`;
            const orgDomain = organisation.domain;
            const activityRef = collection(db as any, `organisations/${orgDomain}/modules/IN/masterData/${material.id}/activityLogs`);

            await db.runTransaction(async (transaction) => {
                transaction.update(doc(db as any, docPath), { 
                    'analyticsSettings.config': { 
                        historyHorizon, forecastHorizon, safetyDelta, model, replenishmentCycle, leadTimeOverride, useAffinityScaling,
                        isSimulatingDemand, simulatedMonthlyDemand, randomizeSimulation, simulationSeed,
                        manualSafetyStock: manualSafetyStock === '' ? null : Number(manualSafetyStock),
                        updatedAt: new Date().toISOString() 
                    }
                });

                transaction.set(doc(activityRef), {
                    timestamp: Timestamp.now(),
                    userName: userFullName,
                    tab: 'Analytics',
                    action: 'Forecasting Config Updated',
                    details: `Updated model to ${model}, horizon to ${forecastHorizon}m.`
                });
            });

            alert("Configuration saved and activity logged.");
        } catch (e) { alert("Save failed."); } finally { setIsSavingConfig(false); }
    };

    const handleCommit = async () => {
        setIsSaving(true);
        try {
            const userFullName = `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}`;
            const orgDomain = organisation.domain;
            const masterMaterialId = material.id;
            
            const auditRef = collection(db as any, `organisations/${orgDomain}/modules/IN/masterData/${masterMaterialId}/configAudit`);
            const activityRef = collection(db as any, `organisations/${orgDomain}/modules/IN/masterData/${masterMaterialId}/activityLogs`);

            await db.runTransaction(async (transaction) => {
                // Update master data
                transaction.update(doc(db as any, docPath), {
                    'inventoryData.stockLevelDetermination': 'Forecasting and Analytics',
                    'inventoryData.minStockLevel': stats.recommendations.min,
                    'inventoryData.maxStockLevel': stats.recommendations.max,
                    'inventoryData.reorderPointQty': stats.recommendations.rop,
                    'inventoryData.safetyStockQty': stats.recommendations.safety,
                    'inventoryData.orderQuantity': Math.round(stats.oq)
                });

                // Write Capital Audit Log
                transaction.set(doc(auditRef), {
                    date: Timestamp.now(),
                    userName: userFullName,
                    source: 'Forecasting',
                    capitalImpact: stats.capImpact,
                    details: `Automated sync: Max level updated to ${Math.round(stats.recommendations.max)}, Safety to ${Math.round(stats.recommendations.safety)}`
                });

                // Write General Activity Log
                transaction.set(doc(activityRef), {
                    timestamp: Timestamp.now(),
                    userName: userFullName,
                    tab: 'Analytics',
                    action: 'Inventory Parameters Synced',
                    details: `Synced calculated stocking parameters from forecasting model.`
                });
            });

            if (onUpdate) onUpdate({ ...material.inventoryData, minStockLevel: stats.recommendations.min, maxStockLevel: stats.recommendations.max, reorderPointQty: stats.recommendations.rop, safetyStockQty: stats.recommendations.safety });
            setAcceptModalOpen(false);
            alert("Master inventory record synchronized and audit logged.");
        } catch (e) { 
            console.error(e);
            alert("Sync failed."); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const renderChart = () => {
        const width = containerWidth || 800;
        const height = 300; 
        const padding = { top: 40, bottom: 40, left: 60, right: 60 };
        const graphH = height - padding.top - padding.bottom; 
        const graphW = width - padding.left - padding.right;
        const bottomY = height - padding.bottom;
        const minTime = stats.historyStart.getTime();
        const maxTime = stats.forecastPoints[stats.forecastPoints.length-1]?.x || stats.now.getTime();
        const timeRange = maxTime - minTime || 1;
        const getX = (t: number) => padding.left + ((t - minTime) / timeRange) * graphW;
        const todayX = getX(stats.now.getTime());
        let maxHist = 5;
        stats.allPoints.forEach(p => maxHist = Math.max(maxHist, p.totalVal));
        const yLimitHist = maxHist * 1.15;
        let maxFore = 0.5;
        stats.forecastPoints.forEach(p => maxFore = Math.max(maxFore, p.y));
        maxFore = Math.max(maxFore, stats.avgDailyDemand);
        const yLimitFore = maxFore * 1.6;
        const getForeY = (v: number) => bottomY - (v / yLimitFore) * graphH;
        const forecastPath = `M ${todayX},${getForeY(stats.avgDailyDemand)} L ${stats.forecastPoints.map(p => `${getX(p.x)},${getForeY(p.y)}`).join(' L ')}`;

        return (
            <svg width={width} height={height} className="rounded-2xl bg-white border border-slate-200 shadow-inner overflow-hidden select-none">
                <rect x={todayX} y={padding.top} width={Math.max(0, width - padding.right - todayX)} height={graphH} fill="#f8fafc" />
                {[0, 0.25, 0.5, 0.75, 1].map(v => (
                    <line key={v} x1={padding.left} y1={bottomY - v*graphH} x2={width-padding.right} y2={bottomY - v*graphH} stroke="#f1f5f9" strokeWidth="1" />
                ))}
                <text x={padding.left - 10} y={padding.top - 10} textAnchor="start" fontSize="9" fill="#94a3b8" fontWeight="bold">HIST TRANSACTION QTY</text>
                {[0, 1].map(v => (
                    <text key={v} x={padding.left - 10} y={bottomY - v*graphH} textAnchor="end" fontSize="10" fill="#64748b" alignmentBaseline="middle">{(v * yLimitHist).toFixed(0)}</text>
                ))}
                <text x={width - padding.right + 10} y={padding.top - 10} textAnchor="end" fontSize="9" fill="#6366f1" fontWeight="bold">FORECAST DAILY DEMAND</text>
                {[0, 1].map(v => (
                    <text key={v} x={width - padding.right + 10} y={bottomY - v*graphH} textAnchor="start" fontSize="10" fill="#6366f1" alignmentBaseline="middle">{(v * yLimitFore).toFixed(2)}</text>
                ))}
                <line x1={todayX} y1={padding.top} x2={todayX} y2={bottomY} stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
                {stats.allPoints.map((p, i) => {
                    const x = getX(p.date);
                    const h = (p.val / yLimitHist) * graphH;
                    let color = p.isExcluded ? "#e2e8f0" : p.type === 'RECEIPT' ? "#3b82f6" : p.type === 'ISSUE' ? "#f43f5e" : p.type === 'ADJ_POS' ? "#0ea5e9" : p.type === 'SIMULATED' ? "#10b981" : "#f59e0b";
                    return (
                        <rect key={i} x={x-2} y={bottomY-h} width={4} height={h} fill={color} rx={1.5} className="cursor-pointer hover:opacity-80 transition-all" onClick={() => { if (p.type === 'SIMULATED') return; p.isExcluded ? setRestoreId(p.originalRef?.id!) : setSelectedMovement(p.originalRef!) }} />
                    );
                })}
                <path d={forecastPath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm transition-all duration-500" />
                <line x1={padding.left} y1={bottomY} x2={width - padding.right} y2={bottomY} stroke="#cbd5e1" strokeWidth="2" />
            </svg>
        );
    };

    const currencySymbol = viewCurrency === 'local' ? currencyConfig.local : currencyConfig.base;
    const formatMoney = (val: number) => {
        let amount = val;
        if (viewCurrency === 'base') amount = val / (currencyConfig.rate || 1);
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="bg-slate-100 flex flex-col h-full lg:flex-row overflow-hidden font-sans">
            <aside className="w-full lg:w-80 bg-white border-r border-slate-200 overflow-y-auto p-6 flex-shrink-0 space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Statistical Engine</h3>
                
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2"><span>History Lookback</span><span className="text-indigo-600 font-black">{historyHorizon}m</span></div>
                    <input type="range" min="3" max="60" value={historyHorizon} onChange={e => setHistoryHorizon(Number(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                </div>
                
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2"><span>Forecast Horizon</span><span className="text-purple-600 font-black">{forecastHorizon}m</span></div>
                    <input type="range" min="1" max="60" value={forecastHorizon} onChange={e => setHistoryHorizon(Number(e.target.value))} className="w-full accent-purple-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategic Affinity Scaling</h4>
                        <input type="checkbox" checked={useAffinityScaling} onChange={e => setUseAffinityScaling(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded" />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                         <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Current Affinity</span>
                         <span className="text-lg font-black text-indigo-700">{strategicAffinity}%</span>
                         <p className="text-[9px] text-slate-500 italic leading-tight mt-1">Multiplier: {useAffinityScaling ? `x${strategicAffinity/100}` : 'None'}</p>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2"><span>Safety Multiplier</span><span className="text-rose-600 font-black">+{safetyDelta}%</span></div>
                    <input type="range" min="0" max="100" step="5" value={safetyDelta} onChange={e => setSafetyDelta(Number(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demand Simulation</h4>
                        <input type="checkbox" checked={isSimulatingDemand} onChange={e => setIsSimulatingDemand(e.target.checked)} className="h-4 w-4 text-emerald-600 rounded" />
                    </div>
                    {isSimulatingDemand && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={randomizeSimulation} 
                                        onChange={e => setRandomizeSimulation(e.target.checked)} 
                                        className="h-3 w-3 text-emerald-600 rounded" 
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Randomize over period</span>
                                </label>
                                {randomizeSimulation && (
                                    <button 
                                        onClick={() => setSimulationSeed(Date.now())}
                                        className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded"
                                    >
                                        Refresh
                                    </button>
                                )}
                            </div>
                            
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Monthly Units</span><span className="text-emerald-600 font-black">{simulatedMonthlyDemand}</span></div>
                                <input type="range" min="1" max={1000} step="1" value={simulatedMonthlyDemand} onChange={e => setSimulatedMonthlyDemand(Number(e.target.value))} className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" />
                            </div>
                            <p className="text-[9px] text-slate-400 italic">
                                {randomizeSimulation ? 'Distributing total expected volume across random days and quantities.' : 'Distributing demand every 1st of the month within horizon.'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Manual Overrides</h4>
                    <Input id="manualSafety" label="Fixed Safety Stock" type="number" value={manualSafetyStock} onChange={e => setManualSafetyStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Auto-calculated..." className="!text-xs h-8" />
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-2">
                    <Button onClick={handleSaveConfig} isLoading={isSavingConfig} variant="secondary" className="!w-full !py-2.5 !text-[10px] font-black tracking-widest uppercase">Save Config</Button>
                    <Button onClick={() => setAcceptModalOpen(true)} className="!w-full !py-2.5 !text-[10px] font-black tracking-widest uppercase shadow-lg" style={{ backgroundColor: theme.colorPrimary }}>Sync Master</Button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 p-6 space-y-4 overflow-y-auto">
                {/* Metrics Banner */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center overflow-x-auto divide-x divide-slate-100">
                        <MetricBlock label="Safety Stock" recommended={stats.recommendations.safety} current={material.inventoryData?.safetyStockQty || 0} unit={material.inventoryData?.inventoryUom} />
                        <MetricBlock label="Reorder Point" recommended={stats.recommendations.rop} current={material.inventoryData?.reorderPointQty || 0} />
                        <MetricBlock label="Min Stock Level" recommended={stats.recommendations.min} current={material.inventoryData?.minStockLevel || 0} />
                        <MetricBlock label="Max Stock Level" recommended={stats.recommendations.max} current={material.inventoryData?.maxStockLevel || 0} />
                    </div>

                    <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-center min-w-[220px] ${stats.capImpact > 0 ? 'bg-rose-50 border-rose-100' : 'bg-green-50 border-green-100'}`}>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Capital Shift</span>
                        <div className="flex flex-col">
                            <span className={`text-xl font-black ${stats.capImpact > 0 ? 'text-rose-700' : 'text-green-700'}`}>
                                {stats.capImpact > 0 ? '+' : ''}{currencySymbol} {formatMoney(stats.capImpact)}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-tight ${stats.capImpact > 0 ? 'text-rose-500' : 'text-green-500'}`}>
                                ({stats.capImpactPct > 0 ? '+' : ''}{stats.capImpactPct.toFixed(1)}% variance)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                         <div className="bg-slate-900 text-white px-5 py-2 rounded-xl shadow-md border border-slate-700">
                            <span className="text-[9px] font-black opacity-60 uppercase block tracking-widest">Demand Velocity</span>
                            <span className="text-xl font-black">{stats.avgDailyDemand.toFixed(3)} <span className="text-[10px] opacity-40 font-normal tracking-normal uppercase">{material.inventoryData?.inventoryUom}/day</span></span>
                         </div>
                         <div className="bg-white border border-slate-200 px-5 py-2 rounded-xl shadow-sm flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest">Model</span>
                            <select value={model} onChange={e => setModel(e.target.value as any)} className="text-sm font-bold text-indigo-700 outline-none bg-transparent cursor-pointer appearance-none">{['Holt', 'Linear', 'MovingAvg', 'SingleExp'].map(m => <option key={m} value={m}>{m}</option>)}</select>
                         </div>
                         <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm flex">
                            <button onClick={() => setViewCurrency('local')} className={`px-2 py-1 text-[9px] font-black rounded transition-all ${viewCurrency === 'local' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>{currencyConfig.local}</button>
                            <button onClick={() => setViewCurrency('base')} className={`px-2 py-1 text-[9px] font-black rounded transition-all ${viewCurrency === 'base' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>{currencyConfig.base}</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 bg-white/60 p-3 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]"></div><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">History</span></div>
                        <div className="flex items-center gap-2"><div className="w-5 h-1 bg-[#6366f1] rounded-full"></div><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prediction</span></div>
                    </div>
                </div>

                <div className="w-full" ref={chartRef}>{renderChart()}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[200px]">
                         <div className="px-5 py-2 border-b bg-slate-50 flex justify-between items-center"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transaction Audit</h4></div>
                         <div className="flex-1 overflow-y-auto custom-scrollbar text-xs">
                            <table className="min-w-full divide-y divide-slate-100">
                                <tbody className="divide-y divide-slate-100">
                                    {movements.slice().reverse().map(m => {
                                        const isExcluded = !!exclusions[m.id!];
                                        return (
                                            <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${isExcluded ? 'opacity-30' : ''}`}>
                                                <td className="px-5 py-2 font-mono text-[10px] text-slate-400">{m.date.toDate().toLocaleDateString()}</td>
                                                <td className="px-5 py-2 font-black uppercase text-[10px] text-slate-600">{m.type}</td>
                                                <td className={`px-5 py-2 text-right font-black ${m.quantity > 0 ? 'text-blue-600' : 'text-rose-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                                                <td className="px-5 py-2 text-right">
                                                    <button onClick={() => isExcluded ? setRestoreId(m.id!) : setSelectedMovement(m)} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 underline">{isExcluded ? 'Include' : 'Exclude'}</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                         </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[200px]">
                        <div className="px-5 py-2 border-b bg-slate-50 flex justify-between items-center"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Manual Flags</h4></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                             {Object.values(exclusions).map((ex: ExclusionRecord) => (
                                 <div key={ex.movementId} className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center group">
                                     <p className="text-[10px] font-black text-slate-800 uppercase">{ex.reason} • {new Date(ex.date).toLocaleDateString()} • {ex.quantity}u</p>
                                     <button onClick={() => setRestoreId(ex.movementId)} className="text-[10px] font-black text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity">RESTORE</button>
                                 </div>
                             ))}
                             {Object.keys(exclusions).length === 0 && <p className="p-6 text-center text-xs text-slate-300 italic">No manual exclusions.</p>}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={!!selectedMovement} onClose={() => setSelectedMovement(null)} title="Movement Exclusion">
                <div className="space-y-4 p-2 text-sm">
                    <p className="text-slate-600">Exclude this transaction from statistical modeling? Use this for anomalies or project-specific demand.</p>
                    <Input id="exReason" as="select" label="Reason" value={exclusionReason} onChange={e => setExclusionReason(e.target.value)}>{EXCLUSION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</Input>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="secondary" onClick={() => setSelectedMovement(null)}>Cancel</Button>
                        <Button onClick={async () => {
                            await db.doc(docPath).update({ [`analyticsSettings.exclusions.${selectedMovement!.id}`]: { movementId: selectedMovement!.id, reason: exclusionReason, date: selectedMovement!.date.toDate().toISOString(), quantity: selectedMovement!.quantity, excludedBy: currentUserProfile?.firstName || 'User' } });
                            setSelectedMovement(null);
                        }} isLoading={isSaving} style={{ backgroundColor: theme.colorPrimary }}>Exclude from Model</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal isOpen={!!restoreId} onClose={() => setRestoreId(null)} onConfirm={async () => { await db.doc(docPath).update({ [`analyticsSettings.exclusions.${restoreId}`]: firebase.firestore.FieldValue.delete() }); setRestoreId(null); }} title="Restore Data Point" message="Are you sure you want to include this transaction back in the statistical calculation?" isLoading={isSaving} />

            <Modal isOpen={acceptModalOpen} onClose={() => setAcceptModalOpen(false)} title="Confirm Synchronization">
                <div className="space-y-6">
                    <p className="text-sm text-slate-600 font-medium">Accepting these recommendations will update the material master inventory parameters. Current stock capital will shift by <strong className={stats.capImpact > 0 ? 'text-rose-600' : 'text-green-600'}>{currencySymbol} {formatMoney(stats.capImpact)}</strong>.</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm"><span className="text-[10px] text-slate-400 font-black uppercase">Rec. Min</span><p className="text-3xl font-black text-slate-800">{Math.round(stats.recommendations.min)}</p></div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm"><span className="text-[10px] text-slate-400 font-black uppercase">Rec. Max</span><p className="text-3xl font-black text-slate-800">{Math.round(stats.recommendations.max)}</p></div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm"><span className="text-[10px] text-blue-500 font-black uppercase">Rec. ROP</span><p className="text-3xl font-black text-blue-700">{Math.round(stats.recommendations.rop)}</p></div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm"><span className="text-[10px] text-rose-500 font-black uppercase">Rec. Safety</span><p className="text-3xl font-black text-rose-700">{Math.round(stats.recommendations.safety)}</p></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button variant="secondary" onClick={() => setAcceptModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCommit} isLoading={isSaving} style={{backgroundColor: theme.colorPrimary}}>Commit Changes</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MaterialAnalyticsTab;