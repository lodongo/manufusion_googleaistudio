import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { MemsSection } from '../../types';
import Button from '../Button';
import SectionModal from './SectionModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { defaultSections } from '../../constants/memsSections';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const SectionsTab: React.FC = () => {
  const [sections, setSections] = useState<MemsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<MemsSection | null>(null);

  const sectionsCollectionRef = collection(db, 'settings/memsSetup/sections');

  useEffect(() => {
    const q = query(sectionsCollectionRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
        setSections([]);
      } else {
        const sectionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MemsSection));
        setSections(sectionsData);
        setNeedsSeeding(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sections:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      defaultSections.forEach(section => {
        const docRef = doc(sectionsCollectionRef); // Auto-generate ID
        batch.set(docRef, section);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding section data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: Omit<MemsSection, 'id'>, id?: string) => {
    if (id) { // Editing existing
      const docRef = doc(sectionsCollectionRef, id);
      await updateDoc(docRef, data);
    } else { // Creating new
      await addDoc(sectionsCollectionRef, data);
    }
  };

  const handleDelete = async () => {
    if (!selectedSection) return;
    const docRef = doc(sectionsCollectionRef, selectedSection.id);
    await deleteDoc(docRef);
    setIsConfirmModalOpen(false);
    setSelectedSection(null);
  };
  
  if (loading) {
    return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
  }
  
  if (needsSeeding) {
    return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Sections / Cost Centers</h3>
            <p className="text-gray-500 mb-4">No sections found. You can populate the database with a detailed, default set of standard sections to begin. These can be used as cost centers throughout MEMS.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>
                Seed Default Sections
            </Button>
        </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Sections / Cost Centers</h3>
                <p className="mt-1 text-sm text-gray-600">
                Define organizational sections that can be used as cost centers in your MRP.
                </p>
            </div>
            <Button onClick={() => { setSelectedSection(null); setIsModalOpen(true); }}>
                Add New Section
            </Button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/2">Description</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {sections.map(section => (
                        <tr key={section.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-900 font-semibold whitespace-no-wrap">{section.name}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm">
                                <p className="text-gray-700 whitespace-no-wrap">{section.description}</p>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedSection(section); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${section.name}`}>
                                        <EditIcon />
                                    </button>
                                    <button onClick={() => { setSelectedSection(section); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${section.name}`}>
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

        <SectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            sectionToEdit={selectedSection}
            existingNames={sections.map(s => s.name)}
        />

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to permanently delete the section "${selectedSection?.name}"? This action cannot be undone.`}
            confirmButtonText="Delete"
        />
    </div>
  );
};

export default SectionsTab;