import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { SpareType } from '../../../types/in_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import SpareTypeModal from './SpareTypeModal';
import { defaultSpareTypes } from '../../../constants/in_spare_types';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const SpareTypesTab: React.FC = () => {
  const [spareTypes, setSpareTypes] = useState<SpareType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SpareType | null>(null);

  const collectionRef = collection(db, 'modules/IN/SpareTypes');

  useEffect(() => {
    const q = query(collectionRef, orderBy('code'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
      } else {
        setSpareTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpareType)));
        setNeedsSeeding(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      defaultSpareTypes.forEach(type => {
        const docRef = doc(collectionRef, type.code);
        batch.set(docRef, type);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: Omit<SpareType, 'id'>, id?: string) => {
    const docRef = doc(collectionRef, data.code);
    if (id) {
        await updateDoc(doc(collectionRef, id), data);
    } else {
        await setDoc(docRef, data);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    await deleteDoc(doc(collectionRef, selectedType.id));
    setIsConfirmModalOpen(false);
    setSelectedType(null);
  };

  if (loading) {
    return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }
  
  if (needsSeeding) {
    return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Spare Types</h3>
            <p className="text-gray-500 mb-4">No spare part types found. Populate the database with a default set to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Spare Types</Button>
        </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Spare Part Types</h3>
                <p className="mt-1 text-sm text-gray-600">Manage the classification of spare parts for better inventory control.</p>
            </div>
            <Button onClick={() => { setSelectedType(null); setIsModalOpen(true); }}>Add New Type</Button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code & Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {spareTypes.map(type => (
                        <tr key={type.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-900 font-semibold">{type.name}</p>
                                <p className="text-gray-600 font-mono text-xs">{type.code}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm"><p className="text-gray-700">{type.description}</p></td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${type.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {type.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedType(type); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                    <button onClick={() => { setSelectedType(type); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>

        <SpareTypeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} typeToEdit={selectedType} />
        <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${selectedType?.name}"?`} />
    </div>
  );
};

export default SpareTypesTab;
