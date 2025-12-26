
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import type { AppUser, Organisation } from '../../../../types';
import type { MaintenancePlan } from '../../../../types/am_types';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import { levelInfo } from '../../../org/HierarchyNodeModal';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const { Timestamp } = firebase.firestore;

interface CreateMaintenancePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  organisation: Organisation;
  onPlanCreated?: () => void;
}

// Helper to get ISO week number and start date of a week
const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getDateOfISOWeek = (w: number, y: number) => {
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
};

const CreateMaintenancePlanModal: React.FC<CreateMaintenancePlanModalProps> = ({ isOpen, onClose, currentUser, organisation, onPlanCreated }) => {
  const currentYear = new Date().getFullYear();
  const currentWeek = getISOWeek(new Date());

  // Form State
  const [year, setYear] = useState<number>(currentYear);
  const [week, setWeek] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');

  // Hierarchy Selection
  const [l3Id, setL3Id] = useState('');
  const [l4Id, setL4Id] = useState('');
  const [l5Id, setL5Id] = useState('');
  
  const [l3Options, setL3Options] = useState<HierarchyNode[]>([]);
  const [l4Options, setL4Options] = useState<HierarchyNode[]>([]);
  const [l5Options, setL5Options] = useState<HierarchyNode[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingHier, setLoadingHier] = useState(false);
  const [error, setError] = useState('');

  // 1. Initialize Hierarchy - Fetch Level 3 (Sites)
  useEffect(() => {
    if (isOpen) {
        setLoadingHier(true);
        // Assuming we want to fetch all sites under the user's allocated L2 or just all sites
        // Traversing from root L1->L2->L3
        const fetchL3 = async () => {
             const nodes: HierarchyNode[] = [];
             try {
                // Simplified: Fetch all L3s for the organisation directly via collectionGroup if possible
                // Better: Iterate known structure
                const l1Ref = db.collection(`organisations/${organisation.domain}/level_1`);
                const l1Snap = await l1Ref.get();
                
                for (const l1 of l1Snap.docs) {
                    const l2Snap = await l1.ref.collection('level_2').get();
                    for (const l2 of l2Snap.docs) {
                        const l3Snap = await l2.ref.collection('level_3').get();
                        l3Snap.forEach(l3 => {
                            nodes.push({ id: l3.id, path: l3.ref.path, ...l3.data() } as HierarchyNode);
                        });
                    }
                }
                setL3Options(nodes.sort((a,b) => a.name.localeCompare(b.name)));
             } catch (e) {
                 console.error("Error fetching sites:", e);
             } finally {
                 setLoadingHier(false);
             }
        };
        fetchL3();
        
        // Reset form
        setYear(currentYear);
        setWeek('');
        setStartDate('');
        setEndDate('');
        setL3Id(''); setL4Id(''); setL5Id('');
    }
  }, [isOpen, organisation.domain, currentYear]);

  // 2. Fetch L4 when L3 changes
  useEffect(() => {
      if (!l3Id) { setL4Options([]); setL4Id(''); setL5Id(''); return; }
      const l3Node = l3Options.find(n => n.id === l3Id);
      if (l3Node && l3Node.path) {
          db.collection(`${l3Node.path}/level_4`).orderBy('name').get().then(snap => {
              setL4Options(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)));
          });
      }
      setL4Id(''); setL5Id('');
  }, [l3Id, l3Options]);

  // 3. Fetch L5 when L4 changes
  useEffect(() => {
      if (!l4Id) { setL5Options([]); setL5Id(''); return; }
      const l4Node = l4Options.find(n => n.id === l4Id);
      if (l4Node && l4Node.path) {
          db.collection(`${l4Node.path}/level_5`).orderBy('name').get().then(snap => {
              setL5Options(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode)));
          });
      }
      setL5Id('');
  }, [l4Id, l4Options]);

  // 4. Update Start Date when Week/Year changes
  useEffect(() => {
      if (year && week) {
          const start = getDateOfISOWeek(Number(week), year);
          const startStr = start.toISOString().split('T')[0];
          setStartDate(startStr);
          
          // Auto-calculate end date based on duration
          const end = new Date(start);
          end.setDate(end.getDate() + (durationDays - 1)); // -1 because start is day 1
          setEndDate(end.toISOString().split('T')[0]);
      }
  }, [year, week, durationDays]);

  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];
  
  const weekOptions = useMemo(() => {
      const weeks = [];
      const startWk = year === currentYear ? currentWeek + 1 : 1;
      const endWk = 52; // Simplified, some years have 53
      
      for (let w = startWk; w <= endWk; w++) {
          weeks.push(w);
      }
      return weeks;
  }, [year, currentYear, currentWeek]);

  const handleSave = async () => {
    if (!l3Id || !l4Id || !l5Id || !week || !startDate || !endDate) {
        setError("Please fill in all required fields.");
        return;
    }
    setLoading(true);
    setError('');

    try {
        const l3 = l3Options.find(n => n.id === l3Id);
        const l4 = l4Options.find(n => n.id === l4Id);
        const l5 = l5Options.find(n => n.id === l5Id);

        // Auto-generate name: PM-{SITE}-{DEPT}-FY{YY}-W{WK}
        const shortYear = year.toString().slice(-2);
        const wkStr = week.toString().padStart(2, '0');
        const generatedName = `PM-${l3?.name.substring(0,3).toUpperCase()}-${l4?.name.substring(0,3).toUpperCase()}-${wkStr}`;

        const counterRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('settings').doc('counters');
        const plansRef = db.collection('organisations').doc(organisation.domain).collection('modules').doc('AM').collection('maintenancePlans');

        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let newCount = 1;
            if (counterDoc.exists) {
                newCount = (counterDoc.data()?.maintenancePlanCounter || 0) + 1;
            }
            const planId = `MP${newCount.toString().padStart(6, '0')}`;

            const newPlan: Omit<MaintenancePlan, 'id'> = {
                planId,
                planName: generatedName,
                
                // Schedule
                year,
                week: Number(week),
                scheduledStartDate: startDate,
                scheduledEndDate: endDate,
                durationDays,
                
                workStartTime,
                workEndTime,
                
                // Hierarchy
                allocationLevel3Id: l3?.id,
                allocationLevel3Name: l3?.name,
                allocationLevel4Id: l4?.id,
                allocationLevel4Name: l4?.name,
                allocationLevel5Id: l5?.id,
                allocationLevel5Name: l5?.name,

                status: 'OPEN',
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now(),
            };

            const newDocRef = plansRef.doc();
            transaction.set(newDocRef, newPlan);
            transaction.set(counterRef, { maintenancePlanCounter: newCount }, { merge: true });
        });

        if (onPlanCreated) onPlanCreated();
        onClose();
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to create plan.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Maintenance Plan" size="lg">
        <div className="space-y-4">
            {/* Scheduling Section */}
            <div className="bg-slate-50 p-4 rounded border">
                <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Scheduling</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Year</label>
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="mt-1 block w-full p-2 border rounded-md">
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Week</label>
                        <select value={week} onChange={e => setWeek(Number(e.target.value))} className="mt-1 block w-full p-2 border rounded-md" required>
                            <option value="">Select Week...</option>
                            {weekOptions.map(w => <option key={w} value={w}>Week {w}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                    <Input id="startDate" label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    <Input id="endDate" label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                    <Input id="duration" label="Duration (Days)" type="number" value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} min={1} required />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <Input id="workStartTime" label="Daily Work Start" type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} required />
                    <Input id="workEndTime" label="Daily Work End" type="time" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} required />
                </div>
            </div>

            {/* Hierarchy Section */}
            <div className="bg-slate-50 p-4 rounded border">
                <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Location / Context</h4>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">{levelInfo[3].name}</label>
                        <select value={l3Id} onChange={e => setL3Id(e.target.value)} disabled={loadingHier} className="mt-1 block w-full p-2 border rounded-md">
                            <option value="">{loadingHier ? 'Loading...' : 'Select Site...'}</option>
                            {l3Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">{levelInfo[4].name}</label>
                        <select value={l4Id} onChange={e => setL4Id(e.target.value)} disabled={!l3Id} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100">
                            <option value="">Select Department...</option>
                            {l4Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">{levelInfo[5].name}</label>
                        <select value={l5Id} onChange={e => setL5Id(e.target.value)} disabled={!l4Id} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100">
                            <option value="">Select Section...</option>
                            {l5Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} isLoading={loading}>Create Plan</Button>
            </div>
        </div>
    </Modal>
  );
};

export default CreateMaintenancePlanModal;
