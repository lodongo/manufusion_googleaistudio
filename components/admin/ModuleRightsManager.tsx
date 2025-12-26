import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Module, ModuleRight } from '../../types';
import Button from '../Button';
import ConfirmationModal from '../common/ConfirmationModal';
import ModuleRightModal from './ModuleRightModal';
import { defaultModuleRights } from '../../constants/module_rights';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface ModuleRightsManagerProps {
  module: Module;
  onBackToModules?: () => void;
}

const ModuleRightsManager: React.FC<ModuleRightsManagerProps> = ({ module, onBackToModules }) => {
    const [rights, setRights] = useState<ModuleRight[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedRight, setSelectedRight] = useState<ModuleRight | null>(null);

    const rightsCollectionRef = collection(db, 'settings/memsSetup/module_rights', module.code, 'rights');

    useEffect(() => {
        const q = query(rightsCollectionRef, orderBy('code'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rightsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ModuleRight));
            setRights(rightsData);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching rights for ${module.code}:`, error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [module.code]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        const defaultRights = defaultModuleRights[module.code];
        if (!defaultRights) {
            alert(`No default rights defined for module ${module.code}.`);
            setIsSeeding(false);
            return;
        }
        try {
            const batch = writeBatch(db);
            defaultRights.forEach(right => {
                const docRef = doc(rightsCollectionRef, right.code);
                batch.set(docRef, right);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error seeding rights:", error);
        } finally {
            setIsSeeding(false);
        }
    };
    
    const handleDelete = async () => {
        if (!selectedRight) return;
        await deleteDoc(doc(rightsCollectionRef, selectedRight.id));
        setIsConfirmModalOpen(false);
        setSelectedRight(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-12"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>;
    }

    return (
        <div>
            {onBackToModules && (
                <button onClick={onBackToModules} className="text-sm text-blue-600 hover:underline mb-4">
                    &larr; Back to Module Management
                </button>
            )}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Module Rights</h3>
                    <p className="mt-1 text-sm text-gray-600">Define all user permissions for the {module.name} ({module.code}) module.</p>
                </div>
                <Button onClick={() => { setSelectedRight(null); setIsModalOpen(true); }}>
                    Add New Right
                </Button>
            </div>
          
            {rights.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Rights Defined</h3>
                    <p className="text-gray-500 mb-4">There are no permissions configured for this module. You can add them manually or seed a default set.</p>
                    <Button onClick={handleSeedData} isLoading={isSeeding}>
                        Seed Default Rights for {module.name}
                    </Button>
                </div>
            ) : (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">Code</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">Name & Type</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/3">Description</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                            {rights.map(right => (
                                <tr key={right.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-4 bg-white text-sm">
                                        <p className="text-gray-900 font-mono whitespace-no-wrap">{right.code}</p>
                                    </td>
                                    <td className="px-5 py-4 bg-white text-sm">
                                        <p className="text-gray-900 font-semibold whitespace-no-wrap">{right.name}</p>
                                        <p className="text-gray-500 whitespace-no-wrap">{right.type}</p>
                                    </td>
                                    <td className="px-5 py-4 bg-white text-sm">
                                        <p className="text-gray-700 whitespace-no-wrap">{right.description}</p>
                                    </td>
                                    <td className="px-5 py-4 bg-white text-sm text-center">
                                        <div className="inline-flex space-x-2">
                                            <button onClick={() => { setSelectedRight(right); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${right.name}`}>
                                                <EditIcon />
                                            </button>
                                            <button onClick={() => { setSelectedRight(right); setIsConfirmModalOpen(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${right.name}`}>
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
            )}

            {isModalOpen && (
                <ModuleRightModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    module={module}
                    rightToEdit={selectedRight}
                />
            )}
    
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to permanently delete the right "${selectedRight?.name}"? This action cannot be undone.`}
                confirmButtonText="Delete"
            />
        </div>
    );
};

export default ModuleRightsManager;
