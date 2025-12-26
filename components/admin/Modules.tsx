
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import type { Module, AppUser } from '../../types';
import Button from '../Button';
import ModuleAddModal from './ModuleAddModal';
import ConfirmationModal from '../common/ConfirmationModal';

interface ModulesProps {
    onModuleSelect: (module: Module) => void;
    onModuleSetupSelect: (module: Module) => void;
    onModuleRightsSelect: (module: Module) => void;
    currentUserProfile: AppUser | null;
}

const SetupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.982.033 2.285-.947 2.285-1.566.379-1.566 2.6 0 2.978.98.238 1.487 1.305.947 2.286-.835 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.566 2.6 1.566 2.978 0a1.533 1.533 0 012.287-.947c1.372.835 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.286c1.566-.379-1.566-2.6 0-2.978a1.532 1.532 0 01-.947-2.286c.835-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const initialModules: Omit<Module, 'id'>[] = [
    { name: 'Organisational Design', code: 'OD', description: "Structure your success. Design, visualize, and manage your company's hierarchy.", active: true, isCore: true, monthlyCost: 150, monthlyDiscount: 0, annualCost: 1500, annualDiscount: 16.67 },
    { name: 'Human Resources', code: 'HR', description: "Empower your people. Manage your entire workforce lifecycle in one integrated platform.", active: true, isCore: true, monthlyCost: 250, monthlyDiscount: 0, annualCost: 2500, annualDiscount: 16.67 },
    { name: 'Finance', code: 'FI', description: "Achieve financial clarity. Streamline accounting, manage budgets, and generate real-time reports.", active: true, isCore: true, monthlyCost: 400, monthlyDiscount: 0, annualCost: 4000, annualDiscount: 16.67 },
    { name: 'Procurement', code: 'PR', description: "Optimize your spending. Automate purchase orders and manage suppliers with full visibility.", active: true, isCore: false, monthlyCost: 200, monthlyDiscount: 0, annualCost: 2000, annualDiscount: 16.67 },
    { name: 'Manufacturing', code: 'MA', description: "From raw materials to finished goods. Control production schedules and optimize shop floor efficiency.", active: true, isCore: false, monthlyCost: 500, monthlyDiscount: 0, annualCost: 5000, annualDiscount: 16.67 },
    { name: 'Asset Management', code: 'AM', description: "Maximize asset value. Track, maintain, and manage the complete lifecycle of your physical assets.", active: true, isCore: false, monthlyCost: 180, monthlyDiscount: 0, annualCost: 1800, annualDiscount: 16.67 },
    { name: 'Inventory', code: 'IN', description: "Master your stock levels. Gain real-time visibility and automate reordering to prevent stockouts.", active: true, isCore: false, monthlyCost: 220, monthlyDiscount: 0, annualCost: 2200, annualDiscount: 16.67 },
    { name: 'Warehousing', code: 'WH', description: "Run a smarter warehouse. Optimize storage, streamline picking and packing, and manage logistics.", active: true, isCore: false, monthlyCost: 300, monthlyDiscount: 0, annualCost: 3000, annualDiscount: 16.67 },
    { name: 'Fleet', code: 'FL', description: "Keep your operations moving. Manage vehicle maintenance, track routes, and optimize fuel consumption.", active: true, isCore: false, monthlyCost: 170, monthlyDiscount: 0, annualCost: 1700, annualDiscount: 16.67 },
];

const Modules: React.FC<ModulesProps> = ({ onModuleSelect, onModuleSetupSelect, onModuleRightsSelect, currentUserProfile }) => {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null);

    const isAdmin = currentUserProfile?.accessLevel === 5;

    useEffect(() => {
        const modulesCollection = db.collection("modules");
        const unsubscribe = modulesCollection.onSnapshot((snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
                setModules([]);
            } else {
                const modulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
                setModules(modulesData);
                setNeedsSeeding(false);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching modules:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSeedModules = async () => {
        setIsSeeding(true);
        try {
            const batch = db.batch();
            const modulesCollection = db.collection("modules");

            initialModules.forEach(moduleData => {
                const docRef = modulesCollection.doc(moduleData.code);
                batch.set(docRef, moduleData);
            });

            await batch.commit();
            setNeedsSeeding(false);
        } catch (error) {
            console.error("Error seeding modules:", error);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDelete = async () => {
        if (!moduleToDelete) return;
        setIsSeeding(true); // Re-use seeding loader for delete operation
        try {
            await db.collection('modules').doc(moduleToDelete.id).delete();
        } catch (error) {
            console.error("Error deleting module:", error);
        } finally {
            setIsSeeding(false);
            setModuleToDelete(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }
    
    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-slate-700 mb-2">No Modules Found</h2>
                <p className="text-slate-500 mb-4">The modules collection in your database is empty. Populate it with the default MEMS modules.</p>
                <Button onClick={handleSeedModules} isLoading={isSeeding}>
                    Seed Modules
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-slate-800">Module Management</h2>
                {isAdmin && (
                    <Button onClick={() => setIsAddModalOpen(true)}>Add New Module</Button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map(module => (
                    <div key={module.id} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col transition-transform hover:-translate-y-1 relative">
                        {isAdmin && (
                            <button
                                onClick={() => setModuleToDelete(module)}
                                className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors z-10"
                                title="Delete Module"
                            >
                               <DeleteIcon />
                            </button>
                        )}
                        <div className="p-6 flex-grow">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-bold text-slate-900">{module.name} ({module.code})</h3>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    {module.isCore && (
                                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                            Core
                                        </span>
                                    )}
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${module.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                        {module.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                            <p className="text-slate-600 mt-2 text-sm">{module.description}</p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t">
                            <div className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="text-slate-500">Monthly</p>
                                    <p className="text-slate-800 font-semibold">${module.monthlyCost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Annual</p>
                                    <p className="text-slate-800 font-semibold">${module.annualCost.toFixed(2)}</p>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => onModuleSetupSelect(module)}
                                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors"
                                            title="Module Setup"
                                        >
                                            <SetupIcon />
                                        </button>
                                        <button
                                            onClick={() => onModuleSelect(module)}
                                            className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md font-medium text-sm transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <ModuleAddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
            <ConfirmationModal
                isOpen={!!moduleToDelete}
                onClose={() => setModuleToDelete(null)}
                onConfirm={handleDelete}
                title={`Delete Module: ${moduleToDelete?.name}?`}
                message="Are you sure you want to delete this module? This action cannot be undone and may affect organizations subscribed to it."
                confirmButtonText="Delete"
                isLoading={isSeeding}
            />
        </div>
    );
};

export default Modules;