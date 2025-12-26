import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { MaintenanceType } from '../../../types/am_types';
import Button from '../../Button';
import MaintenanceTypeModal from './MaintenanceTypeModal';
import ConfirmationModal from '../../common/ConfirmationModal';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const defaultMaintenanceTypes: MaintenanceType[] = [
    { code: 'PM', name: 'Preventive Maintenance', description: 'Scheduled maintenance performed to prevent failures and prolong asset life.', enabled: true },
    { code: 'CM', name: 'Corrective Maintenance', description: 'Unscheduled maintenance performed to restore a failed asset to operational condition.', enabled: true },
    { code: 'PDM', name: 'Predictive Maintenance', description: 'Uses data analysis tools and techniques to detect anomalies and predict potential failures.', enabled: true },
    { code: 'CBM', name: 'Condition-Based Maintenance', description: 'Maintenance performed based on the real-time condition of an asset, triggered by monitoring.', enabled: true },
    { code: 'EM', name: 'Emergency Maintenance', description: 'Immediate, unscheduled maintenance required to address a critical failure or safety hazard.', enabled: true },
    { code: 'SDM', name: 'Shutdown Maintenance', description: 'Maintenance that can only be performed when the asset or entire facility is shut down.', enabled: true },
    { code: 'RM', name: 'Routine Maintenance', description: 'Simple, recurring tasks like cleaning, lubrication, and minor adjustments.', enabled: true },
    { code: 'DM', name: 'Deferred Maintenance', description: 'Postponed maintenance tasks that are not immediately critical but need to be addressed in the future.', enabled: true },
    { code: 'RCM', name: 'Reliability-Centered Maintenance', description: 'A corporate-level strategy to ensure that assets continue to do what their users require in their present operating context.', enabled: true },
    { code: 'TPM', name: 'Total Productive Maintenance', description: 'A holistic approach to equipment maintenance that strives to achieve perfect production.', enabled: true },
];

const MaintenanceTypesTab: React.FC = () => {
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MaintenanceType | null>(null);

  const maintenanceTypesCollectionRef = collection(db, 'modules/AM/Maintenance Types');

  useEffect(() => {
    const q = query(maintenanceTypesCollectionRef, orderBy('code'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
      } else {
        const typesData = snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as MaintenanceType));
        setMaintenanceTypes(typesData);
        setNeedsSeeding(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching maintenance types:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      defaultMaintenanceTypes.forEach(type => {
        const docRef = doc(maintenanceTypesCollectionRef, type.code);
        batch.set(docRef, type);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: MaintenanceType) => {
    if (selectedType) { // Editing existing
      const docRef = doc(maintenanceTypesCollectionRef, data.code);
      await updateDoc(docRef, data);
    } else { // Creating new
      const docRef = doc(maintenanceTypesCollectionRef, data.code);
      await setDoc(docRef, data);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    const docRef = doc(maintenanceTypesCollectionRef, selectedType.code);
    await deleteDoc(docRef);
    setIsConfirmModalOpen(false);
    setSelectedType(null);
  };
  
  if (loading) {
    return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }
  
  if (needsSeeding) {
    return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No maintenance types found. Populate the database with a default set of standard maintenance types to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>
                Seed Default Types
            </Button>
        </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Maintenance Types</h3>
                <p className="mt-1 text-sm text-gray-600">
                Define the different types of maintenance that can be performed on assets.
                </p>
            </div>
            <Button onClick={() => { setSelectedType(null); setIsModalOpen(true); }}>
                Add New Type
            </Button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code & Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {maintenanceTypes.map(type => (
                        <tr key={type.code} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-900 font-semibold whitespace-no-wrap">{type.name}</p>
                                <p className="text-gray-600 whitespace-no-wrap">{type.code}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-700 whitespace-no-wrap">{type.description}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${type.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {type.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedType(type); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${type.name}`}>
                                        <EditIcon />
                                    </button>
                                    <button onClick={() => { setSelectedType(type); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${type.name}`}>
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>

        <MaintenanceTypeModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            maintenanceType={selectedType}
        />

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to permanently delete the maintenance type "${selectedType?.name}"? This action cannot be undone.`}
            confirmButtonText="Delete"
        />
    </div>
  );
};

export default MaintenanceTypesTab;
