
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../types';
import Input from '../../Input';
// Removed MaterialApprovalModal as it's replaced by the new page
import MaterialApprovalModal from './MaterialApprovalModal';

interface MaterialCatalogueProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
  onViewMaterial: (materialId: string) => void;
}

const MaterialCatalogue: React.FC<MaterialCatalogueProps> = ({ currentUser, theme, organisation, onViewMaterial }) => {
    const [materials, setMaterials] = useState<MaterialMasterData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialMasterData | null>(null);

    useEffect(() => {
        const masterDataRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);
        const q = query(masterDataRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialMasterData));
            setMaterials(fetchedMaterials);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching materials: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain]);

    const filteredMaterials = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        return materials
            .filter(material => {
                if (activeTab === 'pending') {
                    return material.status === 'Pending Approval';
                }
                return material.status === 'Approved' || material.status === 'Rejected';
            })
            .filter(material => {
                if (!searchTerm) return true;
                const code = material.materialCode || '';
                return (
                    code.toLowerCase().includes(lowercasedFilter) ||
                    (material.procurementComponentName || '').toLowerCase().includes(lowercasedFilter) ||
                    (material.materialTypeName || '').toLowerCase().includes(lowercasedFilter)
                );
            });
    }, [materials, activeTab, searchTerm]);

    const handleViewClick = (material: MaterialMasterData) => {
        if (material.status === 'Approved') {
            onViewMaterial(material.id);
        } else {
            setSelectedMaterial(material);
        }
    };

    const TabButton: React.FC<{ tabId: 'pending' | 'approved', label: string }> = ({ tabId, label }) => (
        <button
          type="button"
          onClick={() => setActiveTab(tabId)}
          className={`whitespace-nowrap py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === tabId ? 'text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
          style={activeTab === tabId ? { backgroundColor: theme.colorPrimary } : {}}
        >
          {label}
        </button>
    );

    const getStatusChip = (status: MaterialMasterData['status']) => {
        switch (status) {
            case 'Pending Approval': return 'bg-yellow-100 text-yellow-800';
            case 'Approved': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-b-lg shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                    <TabButton tabId="pending" label="Pending Approvals" />
                    <TabButton tabId="approved" label="Approved & Rejected" />
                </div>
                <Input
                    label=""
                    id="search-materials"
                    type="search"
                    placeholder="Search by code or name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    containerClassName="w-full md:w-72"
                />
            </div>

            {loading ? (
                <div className="text-center py-10">Loading materials...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Material Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredMaterials.map(material => (
                                <tr key={material.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-700">{material.materialCode || 'Pending...'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{material.procurementComponentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{material.materialTypeName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <div>{material.createdBy.name}</div>
                                        <div className="text-xs">{material.createdAt.toDate().toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(material.status)}`}>
                                            {material.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleViewClick(material)} className="hover:underline" style={{color: theme.colorPrimary}}>
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredMaterials.length === 0 && <p className="text-center py-8 text-slate-500">No materials found.</p>}
                </div>
            )}
            
            {selectedMaterial && (
                <MaterialApprovalModal
                    isOpen={!!selectedMaterial}
                    onClose={() => setSelectedMaterial(null)}
                    material={selectedMaterial}
                    currentUser={currentUser}
                    organisation={organisation}
                    theme={theme}
                />
            )}
        </div>
    );
};

export default MaterialCatalogue;
