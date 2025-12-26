
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { UnitOfMeasure, UnitClassification, UnitSystem } from '../../types';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';
import UnitModal from './UnitModal';
import { defaultUnits } from '../../constants/units';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const UnitsTab: React.FC = () => {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);

  // Filters
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const collectionRef = collection(db, 'settings/memsSetup/units');

  useEffect(() => {
    const q = query(collectionRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
      } else {
        setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UnitOfMeasure)));
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
      defaultUnits.forEach(unit => {
        const docRef = doc(collectionRef, unit.code);
        batch.set(docRef, unit);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding units:", error);
      alert("Failed to seed units.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: Omit<UnitOfMeasure, 'id'>) => {
    const docRef = doc(collectionRef, data.code);
    if (selectedUnit) { // Editing
        await updateDoc(docRef, data as any);
    } else { // Creating
        await setDoc(docRef, data);
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;
    await deleteDoc(doc(collectionRef, selectedUnit.id));
    setIsConfirmModalOpen(false);
    setSelectedUnit(null);
  };

  const filteredUnits = useMemo(() => {
      return units.filter(u => {
          const matchSearch = !searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.code.toLowerCase().includes(searchTerm.toLowerCase());
          const matchClass = !filterClassification || u.classification === filterClassification;
          const matchType = !filterType || u.type === filterType;
          return matchSearch && matchClass && matchType;
      });
  }, [units, searchTerm, filterClassification, filterType]);

  const classifications = Array.from(new Set(units.map(u => u.classification))).sort();
  const types = Array.from(new Set(units.map(u => u.type))).sort();

  if (loading) {
    return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }
  
  if (needsSeeding) {
    return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Units of Measure</h3>
            <p className="text-gray-500 mb-4">No units found. Populate the database with a comprehensive default set of measurement units to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Units</Button>
        </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Units of Measure</h3>
                <p className="mt-1 text-sm text-gray-600">Manage standardized units used across the system.</p>
            </div>
            <Button onClick={() => { setSelectedUnit(null); setIsModalOpen(true); }}>Add New Unit</Button>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <input 
                type="text" 
                placeholder="Search units..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
            />
            <select value={filterClassification} onChange={e => setFilterClassification(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm bg-white">
                <option value="">All Classifications</option>
                {classifications.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm bg-white">
                <option value="">All Types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => {setSearchTerm(''); setFilterClassification(''); setFilterType('')}} className="text-sm text-blue-600 hover:underline px-2">Reset</button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Classification</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {filteredUnits.map(unit => (
                        <tr key={unit.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-900 font-semibold whitespace-no-wrap">{unit.name}</p>
                                <p className="text-gray-500 text-xs">{unit.description}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm font-mono text-slate-600">{unit.code}</td>
                            <td className="px-5 py-4 bg-white text-sm"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">{unit.classification}</span></td>
                            <td className="px-5 py-4 bg-white text-sm text-slate-600">{unit.type}</td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${unit.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {unit.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedUnit(unit); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${unit.name}`}>
                                        <EditIcon />
                                    </button>
                                    <button onClick={() => { setSelectedUnit(unit); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${unit.name}`}>
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {filteredUnits.length === 0 && <p className="text-center py-8 text-slate-500">No units match your filters.</p>}
            </div>
        </div>

        <UnitModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            unitToEdit={selectedUnit}
        />

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to permanently delete "${selectedUnit?.name}"? This action cannot be undone.`}
            confirmButtonText="Delete"
        />
    </div>
  );
};

export default UnitsTab;
