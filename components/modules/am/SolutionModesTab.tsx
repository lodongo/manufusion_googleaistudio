import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { SolutionMode } from '../../../types/am_types';
import Button from '../../Button';
import SolutionModeModal from './SolutionModeModal';
import ConfirmationModal from '../../common/ConfirmationModal';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const defaultSolutionModes: Omit<SolutionMode, 'id'>[] = [
    // Corrective Actions (Immediate Fixes)
    { name: 'Repair Component', description: 'Fix the defective component or part of the asset to restore functionality.', category: 'Corrective', enabled: true },
    { name: 'Replace Component (Like-for-Like)', description: 'Substitute a failed or worn-out component with an identical new or refurbished one.', category: 'Corrective', enabled: true },
    { name: 'Adjust/Realign Component', description: 'Make minor corrections to settings, alignment, or positioning.', category: 'Corrective', enabled: true },
    { name: 'Reset/Restart System', description: 'Perform a system reset, software reboot, or power cycle to clear faults.', category: 'Corrective', enabled: true },
    { name: 'Clear Blockage/Jam', description: 'Remove a physical obstruction from a line, filter, or pathway.', category: 'Corrective', enabled: true },
    { name: 'Tighten Fasteners/Connections', description: 'Secure loose bolts, screws, electrical terminals, or other fasteners to the correct torque.', category: 'Corrective', enabled: true },
    { name: 'Weld Repair', description: 'Perform a welding operation to repair a crack or break in a metal component.', category: 'Corrective', enabled: true },
    { name: 'Emergency Patch/Bypass', description: 'Apply a temporary fix or bypass a component to allow the system to operate until a permanent repair can be made.', category: 'Corrective', enabled: false },
    { name: 'Restore Power', description: 'Address a localized power issue, such as replacing a fuse or resetting a breaker.', category: 'Corrective', enabled: true },

    // Preventive Actions (Proactive & Scheduled)
    { name: 'Perform Scheduled PM Task', description: 'Execute a scheduled maintenance task according to the PM plan (e.g., PM01, PM02).', category: 'Preventive', enabled: true },
    { name: 'Clean Component/Area', description: 'Remove dirt, debris, corrosion, or contamination from the asset and its surroundings.', category: 'Preventive', enabled: true },
    { name: 'Lubricate Bearings/Gears/Chains', description: 'Apply appropriate lubricants to reduce friction and wear in moving parts.', category: 'Preventive', enabled: true },
    { name: 'Calibrate Sensor/Instrument', description: 'Adjust equipment to meet operational specifications and ensure measurement accuracy.', category: 'Preventive', enabled: true },
    { name: 'Perform Condition Monitoring', description: 'Conduct vibration analysis, thermal imaging, or oil analysis to assess asset health.', category: 'Preventive', enabled: true },
    { name: 'Rebuild/Overhaul Component', description: 'Disassemble, inspect, replace worn parts, and reassemble the asset to near-original specifications.', category: 'Preventive', enabled: true },
    { name: 'Install Upgrade/Retrofit Kit', description: 'Add new components or features to improve reliability, safety, or capability.', category: 'Preventive', enabled: true },
    { name: 'Replace Consumables/Wear Parts', description: 'Replace parts with a defined lifespan, such as filters, belts, seals, or blades.', category: 'Preventive', enabled: true },
    { name: 'Inspect for Wear/Cracks/Leaks', description: 'Perform a detailed visual or NDT inspection to identify potential failures.', category: 'Preventive', enabled: true },
    { name: 'Update Software/Firmware', description: 'Install a new version of the control software or firmware to improve performance or fix bugs.', category: 'Preventive', enabled: true },
    { name: 'Perform Load Testing', description: 'Test the asset under specified load conditions to verify its integrity and performance.', category: 'Preventive', enabled: true },

    // Procedural Actions (Process & People)
    { name: 'Retrain Operator/Technician', description: 'Provide additional training to personnel to prevent recurrence of human error.', category: 'Procedural', enabled: true },
    { name: 'Update Standard Operating Procedure (SOP)', description: 'Revise the documented procedure to improve clarity, safety, or efficiency.', category: 'Procedural', enabled: true },
    { name: 'Create New Procedure/Work Instruction', description: 'Document a new standard procedure for a task that was previously undocumented.', category: 'Procedural', enabled: true },
    { name: 'Improve Labeling/Signage', description: 'Enhance visual cues, labels, or signs to prevent errors and improve safety.', category: 'Procedural', enabled: true },
    { name: 'Implement Checklist/Verification Step', description: 'Introduce a checklist for a complex task to ensure all steps are followed correctly.', category: 'Procedural', enabled: true },
    { name: 'Modify Process Parameters', description: 'Change the operating setpoints (e.g., speed, temperature, pressure) based on analysis.', category: 'Procedural', enabled: true },
    { name: 'Change Supplier/Material Specification', description: 'Source materials or components from a different supplier or use a different spec to improve quality.', category: 'Procedural', enabled: true },
    { name: 'Improve Housekeeping (5S)', description: 'Implement 5S or other housekeeping initiatives to improve organization and cleanliness.', category: 'Procedural', enabled: true },
    { name: 'Enhance Communication Protocol', description: 'Improve shift handover procedures or communication between departments.', category: 'Procedural', enabled: true },

    // Analytical Actions (Investigation & Analysis)
    { name: 'Perform Root Cause Analysis (RCA)', description: 'Conduct a formal investigation (e.g., 5 Whys, Fishbone) to find the fundamental cause.', category: 'Analytical', enabled: true },
    { name: 'Monitor/Inspect with Increased Frequency', description: 'Place the asset under closer observation or increase inspection frequency temporarily.', category: 'Analytical', enabled: true },
    { name: "Take Sample for Analysis (Oil, Water, etc.)", description: 'Collect a sample (e.g., oil, material, water) for laboratory analysis.', category: 'Analytical', enabled: true },
    { name: 'Consult OEM/Expert', description: 'Contact the Original Equipment Manufacturer or a subject matter expert for advice.', category: 'Analytical', enabled: true },
    { name: 'Review Maintenance/Failure History', description: 'Analyze past maintenance records for trends and patterns.', category: 'Analytical', enabled: true },
    { name: 'Perform Failure Mode and Effects Analysis (FMEA)', description: 'Conduct an FMEA to proactively identify and mitigate potential failures.', category: 'Analytical', enabled: true },
    { name: 'Redesign Component/Process', description: 'Initiate an engineering change to redesign a component or process that is prone to failure.', category: 'Analytical', enabled: true },
    { name: 'Data Analysis from Historian/SCADA', description: 'Analyze historical process data to identify correlations leading to failure.', category: 'Analytical', enabled: true },

    // No Action (Deliberate Decisions)
    { name: 'No Action Required', description: 'After investigation, it is determined that no corrective or preventive action is necessary.', category: 'No Action', enabled: true },
    { name: 'Run to Failure (Planned)', description: 'A conscious, documented decision to allow a non-critical component to fail before replacing it.', category: 'No Action', enabled: false },
    { name: 'Acceptable Loss/Risk', description: 'The failure is deemed to have a low impact and the cost of prevention outweighs the benefit.', category: 'No Action', enabled: false },
];

const SolutionModesTab: React.FC = () => {
    const [solutionModes, setSolutionModes] = useState<SolutionMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedMode, setSelectedMode] = useState<SolutionMode | null>(null);

    const [openAccordion, setOpenAccordion] = useState<string | null>('Corrective');

    const solutionModesCollectionRef = collection(db, 'modules/AM/Solution Modes');

    useEffect(() => {
        const q = query(solutionModesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                const modesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SolutionMode));
                setSolutionModes(modesData);
                setNeedsSeeding(false);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching solution modes:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const groupedSolutionModes = useMemo(() => {
        return solutionModes.reduce((acc, mode) => {
          (acc[mode.category] = acc[mode.category] || []).push(mode);
          return acc;
        }, {} as Record<SolutionMode['category'], SolutionMode[]>);
    }, [solutionModes]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            defaultSolutionModes.forEach(mode => {
                const docRef = doc(solutionModesCollectionRef); // Auto-generate ID
                batch.set(docRef, mode);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error seeding data:", error);
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleSave = async (data: Omit<SolutionMode, 'id'>, id?: string) => {
        if (id) { // Editing
            const docRef = doc(solutionModesCollectionRef, id);
            await updateDoc(docRef, data);
        } else { // Creating
            await addDoc(solutionModesCollectionRef, data);
        }
    };
    
    const handleDelete = async () => {
        if (!selectedMode) return;
        const docRef = doc(solutionModesCollectionRef, selectedMode.id);
        await deleteDoc(docRef);
        setIsConfirmModalOpen(false);
        setSelectedMode(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
    }

    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
                <p className="text-gray-500 mb-4">No solution modes found. Populate the database with a default set of standard solutions to begin.</p>
                <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Solutions</Button>
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Solution Modes</h3>
                    <p className="mt-1 text-sm text-gray-600">Document standard solutions and repair procedures, organized by category.</p>
                </div>
                <Button onClick={() => { setSelectedMode(null); setIsModalOpen(true); }}>Add New Solution</Button>
            </div>
          
            <div className="space-y-2">
                {(Object.keys(groupedSolutionModes) as SolutionMode['category'][]).sort().map(category => (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setOpenAccordion(openAccordion === category ? null : category)}
                            aria-expanded={openAccordion === category}
                            aria-controls={`panel-solution-${category.replace(/\s+/g, '-')}`}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                        >
                            <h4 className="font-semibold text-gray-800">{category} ({groupedSolutionModes[category]?.length || 0})</h4>
                            <div className={`${openAccordion === category ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordion === category && (
                            <div id={`panel-solution-${category.replace(/\s+/g, '-')}`} className="bg-white divide-y divide-gray-200">
                                {groupedSolutionModes[category].map(mode => (
                                    <div key={mode.id} className="p-4 flex justify-between items-start hover:bg-gray-50">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{mode.name}</p>
                                            <p className="text-sm text-gray-600">{mode.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${mode.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {mode.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <button onClick={() => { setSelectedMode(mode); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${mode.name}`}><EditIcon /></button>
                                            <button onClick={() => { setSelectedMode(mode); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${mode.name}`}><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
    
            <SolutionModeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} solutionMode={selectedMode} />
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete the solution mode "${selectedMode?.name}"? This action cannot be undone.`} confirmButtonText="Delete" />
        </div>
    );
};

export default SolutionModesTab;
