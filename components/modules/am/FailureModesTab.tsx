import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { FailureMode } from '../../../types/am_types';
import Button from '../../Button';
import FailureModeModal from './FailureModeModal';
import ConfirmationModal from '../../common/ConfirmationModal';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const defaultFailureModes: Omit<FailureMode, 'id'>[] = [
    // Man (Human Factors)
    { name: 'Lack of Training/Skill', description: 'Operator lacks the necessary skills or knowledge to perform the task correctly.', category: 'Man', enabled: true },
    { name: 'Inattention/Distraction', description: 'Operator fails to pay sufficient attention, leading to an error.', category: 'Man', enabled: true },
    { name: 'Fatigue/Exhaustion', description: 'Physical or mental exhaustion impairs operator performance.', category: 'Man', enabled: true },
    { name: 'Incorrect Procedure Followed', description: 'Operator performs the wrong steps or misinterprets the correct procedure.', category: 'Man', enabled: true },
    { name: 'Procedure Not Followed', description: 'Operator knowingly or unknowingly deviates from the standard operating procedure (SOP).', category: 'Man', enabled: true },
    { name: 'Miscommunication', description: 'Poor communication between team members, shifts, or departments leads to an error.', category: 'Man', enabled: true },
    { name: 'Complacency/Overconfidence', description: 'Operator becomes too comfortable and overlooks critical steps or checks.', category: 'Man', enabled: true },
    { name: 'Rushing/Time Pressure', description: 'Operator makes mistakes due to being hurried.', category: 'Man', enabled: true },
    { name: 'Incorrect Tool Selection', description: 'Using the wrong tool for the job, causing damage or incorrect results.', category: 'Man', enabled: true },
    { name: 'Willful Damage/Sabotage', description: 'Intentional act to cause failure or disruption.', category: 'Man', enabled: false },
    { name: 'Improper Handling', description: 'Incorrectly moving, lifting, or manipulating materials or equipment.', category: 'Man', enabled: true },
    { name: 'Failure to Report Anomaly', description: 'Operator notices an issue but does not report it, leading to a larger failure.', category: 'Man', enabled: true },

    // Machine (Equipment/Hardware)
    { name: 'Wear and Tear (Normal Aging)', description: 'Component failure due to expected degradation over its lifecycle.', category: 'Machine', enabled: true },
    { name: 'Bearing Failure (Spalling, Overheating)', description: 'Failure of a bearing due to contamination, misalignment, load, or wear.', category: 'Machine', enabled: true },
    { name: 'Seal/Gasket Leakage', description: 'Failure of a seal, leading to fluid or gas leakage.', category: 'Machine', enabled: true },
    { name: 'Structural Fatigue/Cracking', description: 'Cracks or fractures in a structural component due to cyclic loading.', category: 'Machine', enabled: true },
    { name: 'Misalignment', description: 'Shafts or components are not correctly aligned, causing vibration and wear.', category: 'Machine', enabled: true },
    { name: 'Imbalance', description: 'Uneven weight distribution in rotating components causing vibration.', category: 'Machine', enabled: true },
    { name: 'Gear Failure (Pitting, Tooth Breakage)', description: 'Damage to gear teeth due to overload, wear, or misalignment.', category: 'Machine', enabled: true },
    { name: 'Belt/Chain Failure (Slipping, Breaking)', description: 'A belt or chain fails due to tension issues, wear, or contamination.', category: 'Machine', enabled: true },
    { name: 'Corrosion/Erosion', description: 'Material degradation due to chemical reaction or physical abrasion.', category: 'Machine', enabled: true },
    { name: 'Blockage/Clogging', description: 'Flow is restricted in a pipe, filter, or passage.', category: 'Machine', enabled: true },
    { name: 'Loosening of Fasteners', description: 'Bolts, screws, or other fasteners become loose due to vibration or improper torque.', category: 'Machine', enabled: true },
    { name: 'Motor Failure (Winding, Bearing)', description: 'An electric motor fails due to electrical or mechanical issues.', category: 'Machine', enabled: true },
    { name: 'Wiring/Connection Failure', description: 'Electrical connections are loose, corroded, or broken.', category: 'Machine', enabled: true },
    { name: 'Sensor Malfunction/Drift', description: 'A sensor provides inaccurate readings or fails completely.', category: 'Machine', enabled: true },
    { name: 'Power Supply Failure', description: 'The component that provides electrical power to the system fails.', category: 'Machine', enabled: true },
    { name: 'Control Board/PLC Failure', description: 'A bug or malfunction in the control hardware or PLC.', category: 'Machine', enabled: true },
    { name: 'Blown Fuse/Tripped Breaker', description: 'An overcurrent protection device is activated.', category: 'Machine', enabled: true },
    { name: 'Short Circuit', description: 'An unintended path for electrical current is created.', category: 'Machine', enabled: true },
    { name: 'Hose/Line Leakage or Rupture', description: 'A hydraulic or pneumatic line fails, causing a loss of pressure.', category: 'Machine', enabled: true },
    { name: 'Pump/Compressor Failure', description: 'The primary component for fluid or air movement fails.', category: 'Machine', enabled: true },
    { name: 'Valve Malfunction (Sticking, Leaking)', description: 'A control valve does not open, close, or modulate correctly.', category: 'Machine', enabled: true },
    { name: 'Contaminated Fluid/Air', description: 'The hydraulic fluid or compressed air is contaminated with dirt or moisture.', category: 'Machine', enabled: true },
    { name: 'Incorrect Pressure/Flow', description: 'The system operates at the wrong pressure or flow rate.', category: 'Machine', enabled: true },

    // Method (Process/Procedure)
    { name: 'Incorrect Setup/Calibration', description: 'Equipment is not configured or calibrated correctly for the specific task.', category: 'Method', enabled: true },
    { name: 'Poor Maintenance Procedure', description: 'Maintenance tasks are not performed correctly, are incomplete, or at the wrong interval.', category: 'Method', enabled: true },
    { name: 'Inadequate Inspection/PM Frequency', description: 'The interval between inspections is too long to catch developing failures.', category: 'Method', enabled: true },
    { name: 'Wrong Tools Used', description: 'Using improper or uncalibrated tools for a maintenance or operational task.', category: 'Method', enabled: true },
    { name: 'Process Parameter Deviation', description: 'Operating parameters (e.g., speed, temperature, pressure) are outside the acceptable range.', category: 'Method', enabled: true },
    { name: 'Poor Equipment Design', description: 'Inherent flaws in the design of the equipment or process that make it prone to failure.', category: 'Method', enabled: true },
    { name: 'Inadequate Cleaning Procedure', description: 'Failure to properly clean equipment, leading to contamination, overheating, or malfunction.', category: 'Method', enabled: true },
    { name: 'Incorrect Startup/Shutdown Sequence', description: 'The procedure for starting or stopping the equipment is not followed correctly.', category: 'Method', enabled: true },
    { name: 'Flawed Standard Operating Procedure (SOP)', description: 'The documented procedure is incorrect, incomplete, or ambiguous.', category: 'Method', enabled: true },
    { name: 'No Procedure Defined', description: 'A formal procedure for a task does not exist, leading to inconsistent execution.', category: 'Method', enabled: true },
    { name: 'Inadequate Change Management', description: 'A change to the process or equipment was made without proper evaluation or documentation.', category: 'Method', enabled: true },

    // Material (Raw Materials/Consumables)
    { name: 'Defective Raw Material/Component', description: 'Incoming materials or parts do not meet quality specifications.', category: 'Material', enabled: true },
    { name: 'Incorrect Material Specification', description: 'The wrong type of material or component was used for the application.', category: 'Material', enabled: true },
    { name: 'Material Contamination', description: 'Foreign substances are introduced into the material or process fluids.', category: 'Material', enabled: true },
    { name: 'Material Degradation (Aging, Exposure)', description: 'Material properties change over time due to exposure to environmental factors.', category: 'Material', enabled: true },
    { name: 'Supplier Quality Issues', description: 'Inconsistent quality from a parts or material supplier.', category: 'Material', enabled: true },
    { name: 'Incorrect Lubricant/Fluid', description: 'The wrong type or grade of oil, grease, or fluid is used.', category: 'Material', enabled: true },
    { name: 'Out-of-Spec Consumable Part', description: 'A consumable part like a filter or blade does not meet specifications.', category: 'Material', enabled: true },
    { name: 'Improper Material Mix Ratio', description: 'Components are mixed in incorrect proportions.', category: 'Material', enabled: true },

    // Environment (Operating Conditions)
    { name: 'Extreme Temperature (High or Low)', description: 'Operating in ambient temperatures outside the specified design range.', category: 'Environment', enabled: true },
    { name: 'High Humidity/Moisture Intrusion', description: 'Excessive moisture causes corrosion, short circuits, or material degradation.', category: 'Environment', enabled: true },
    { name: 'Dust/Dirt/Foreign Object Contamination', description: 'Airborne contaminants interfere with mechanical, electrical, or cooling components.', category: 'Environment', enabled: true },
    { name: 'Power Surge/Outage/Quality Issue', description: 'Fluctuations or interruptions in the electrical supply damage sensitive components.', category: 'Environment', enabled: true },
    { name: 'Improper Storage Conditions', description: 'Incorrect storage conditions for spare parts, materials, or equipment.', category: 'Environment', enabled: true },
    { name: 'Excessive Vibration (External Source)', description: 'Vibration from adjacent machinery or the building structure affects the asset.', category: 'Environment', enabled: true },
    { name: 'Chemical Exposure', description: 'Exposure to corrosive or otherwise damaging chemicals in the atmosphere.', category: 'Environment', enabled: true },
    { name: 'Inadequate Lighting', description: 'Poor lighting leads to operator errors or missed visual cues of failure.', category: 'Environment', enabled: true },
    { name: 'Ventilation Issues', description: 'Poor air circulation leads to overheating or concentration of contaminants.', category: 'Environment', enabled: true }
];

const FailureModesTab: React.FC = () => {
    const [failureModes, setFailureModes] = useState<FailureMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedFailureMode, setSelectedFailureMode] = useState<FailureMode | null>(null);
    
    const [openAccordion, setOpenAccordion] = useState<string | null>('Machine');
    
    const failureModesCollectionRef = collection(db, 'modules/AM/Failure Modes');

    useEffect(() => {
        const q = query(failureModesCollectionRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                const modesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FailureMode));
                setFailureModes(modesData);
                setNeedsSeeding(false);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching failure modes:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const groupedFailureModes = useMemo(() => {
        return failureModes.reduce((acc, mode) => {
          (acc[mode.category] = acc[mode.category] || []).push(mode);
          return acc;
        }, {} as Record<FailureMode['category'], FailureMode[]>);
    }, [failureModes]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            defaultFailureModes.forEach(mode => {
                const docRef = doc(failureModesCollectionRef); // Auto-generate ID
                batch.set(docRef, mode);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error seeding data:", error);
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleSave = async (data: Omit<FailureMode, 'id'>, id?: string) => {
        if (id) { // Editing
            const docRef = doc(failureModesCollectionRef, id);
            await updateDoc(docRef, data);
        } else { // Creating
            await addDoc(failureModesCollectionRef, data);
        }
    };

    const handleDelete = async () => {
        if (!selectedFailureMode) return;
        const docRef = doc(failureModesCollectionRef, selectedFailureMode.id);
        await deleteDoc(docRef);
        setIsConfirmModalOpen(false);
        setSelectedFailureMode(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
    }
    
    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
                <p className="text-gray-500 mb-4">No failure modes found. Populate the database with a default set of standard failure modes to begin.</p>
                <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Failure Modes</Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Failure Modes</h3>
                    <p className="mt-1 text-sm text-gray-600">Catalog common failures using the 5M model (Man, Machine, Method, Material, Environment).</p>
                </div>
                <Button onClick={() => { setSelectedFailureMode(null); setIsModalOpen(true); }}>Add New Failure Mode</Button>
            </div>

            <div className="space-y-2">
                {(Object.keys(groupedFailureModes) as FailureMode['category'][]).sort().map(category => (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setOpenAccordion(openAccordion === category ? null : category)}
                            aria-expanded={openAccordion === category}
                            aria-controls={`panel-${category.replace(/\s+/g, '-')}`}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                        >
                            <h4 className="font-semibold text-gray-800">{category} ({groupedFailureModes[category]?.length || 0})</h4>
                            <div className={`${openAccordion === category ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        {openAccordion === category && (
                            <div 
                                id={`panel-${category.replace(/\s+/g, '-')}`}
                                className="bg-white divide-y divide-gray-200"
                            >
                                {groupedFailureModes[category].map(mode => (
                                    <div key={mode.id} className="p-4 flex justify-between items-start hover:bg-gray-50">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{mode.name}</p>
                                            <p className="text-sm text-gray-600">{mode.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2 flex-shrink-0">
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${mode.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {mode.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <button onClick={() => { setSelectedFailureMode(mode); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${mode.name}`}><EditIcon /></button>
                                            <button onClick={() => { setSelectedFailureMode(mode); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${mode.name}`}><DeleteIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <FailureModeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} failureMode={selectedFailureMode} />
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete the failure mode "${selectedFailureMode?.name}"? This action cannot be undone.`} confirmButtonText="Delete" />
        </div>
    );
};

export default FailureModesTab;
