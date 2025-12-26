
// components/modules/she/OperatingModesTab.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { OperatingMode } from '../../../types/she_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import OperatingModeModal from './OperatingModeModal';
import { defaultSheOperatingModes } from '../../../constants/she_operating_modes';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const OperatingModesTab: React.FC = () => {
  const [modes, setModes] = useState<OperatingMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<OperatingMode | null>(null);

  const collectionRef = collection(db, 'modules/SHE/OperatingModes');

  useEffect(() => {
    const q = query(collectionRef, orderBy('level'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
      } else {
        setModes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperatingMode)));
        setNeedsSeeding(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching operating modes:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      defaultSheOperatingModes.forEach(mode => {
        const docRef = doc(collectionRef, String(mode.level));
        batch.set(docRef, mode);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: Omit<OperatingMode, 'id'>) => {
    const docRef = doc(collectionRef, String(data.level));
    if (selectedMode) { // Editing
      await updateDoc(docRef, data as any);
    } else { // Creating
      await setDoc(docRef, data);
    }
  };

  const handleDelete = async () => {
    if (!selectedMode) return;
    const docRef = doc(collectionRef, selectedMode.id);
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
            <p className="text-gray-500 mb-4">No modes of operation found. Populate with a default set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Modes</Button>
        </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Modes of Operation</h3>
                <p className="mt-1 text-sm text-gray-600">
                Define the different operational states for equipment risk assessments.
                </p>
            </div>
            <Button onClick={() => { setSelectedMode(null); setIsModalOpen(true); }}>
                Add New Mode
            </Button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Level</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {modes.map(mode => (
                        <tr key={mode.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm font-semibold text-center">{mode.level}</td>
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-900 font-semibold whitespace-no-wrap">{mode.name}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-700 whitespace-no-wrap">{mode.description}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${mode.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {mode.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedMode(mode); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${mode.name}`}>
                                        <EditIcon />
                                    </button>
                                    <button onClick={() => { setSelectedMode(mode); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${mode.name}`}>
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

        <OperatingModeModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            modeToEdit={selectedMode}
        />

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to permanently delete the mode "${selectedMode?.name}"? This action cannot be undone.`}
            confirmButtonText="Delete"
        />
    </div>
  );
};

export default OperatingModesTab;
