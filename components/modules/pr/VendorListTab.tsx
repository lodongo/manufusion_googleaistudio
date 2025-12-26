
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import type { Organisation } from '../../../types';
import type { Vendor } from '../../../types/pr_types';
import Input from '../../Input';

interface VendorListTabProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    onSelectVendor: (vendor: Vendor) => void;
}

const VendorListTab: React.FC<VendorListTabProps> = ({ organisation, theme, onSelectVendor }) => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const vendorsCollectionRef = db.collection(`organisations/${organisation.domain}/modules/PR/vendors`);
        const q = vendorsCollectionRef.orderBy('createdAt', 'desc');
        
        const unsubscribe = q.onSnapshot((snapshot) => {
            const fetchedVendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
            setVendors(fetchedVendors);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching vendors: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain]);

    const filteredVendors = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        return vendors.filter((vendor: Vendor) => {
            // Exclude deleted vendors from default list
            if (vendor.status === 'Deleted') return false;

            if (!searchTerm) return true;
            return (
                vendor.legalName.toLowerCase().includes(lowercasedFilter) ||
                (vendor.tradingName && vendor.tradingName.toLowerCase().includes(lowercasedFilter)) ||
                vendor.vendorCode.toLowerCase().includes(lowercasedFilter) ||
                vendor.primaryContact.name.toLowerCase().includes(lowercasedFilter)
            );
        });
    }, [vendors, searchTerm]);
    
    const getStatusChip = (status: Vendor['status']) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-800';
            case 'Approved': 
            case 'Active': return 'bg-green-100 text-green-800';
            case 'Rejected': 
            case 'Deactivated': return 'bg-red-100 text-red-800';
            case 'Under Review': return 'bg-blue-100 text-blue-800';
            case 'Suspended': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                 <h2 className="text-xl font-semibold uppercase">Vendor List</h2>
                 <Input
                    id="search-vendors"
                    type="search"
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    containerClassName="w-full md:w-72 mb-0"
                    label=""
                />
            </div>
            
            {loading ? <p className="text-center py-8">Loading vendors...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                         <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Legal Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredVendors.map(vendor => (
                                <tr key={vendor.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                                        <button 
                                            onClick={() => onSelectVendor(vendor)} 
                                            className="text-blue-600 hover:text-blue-800 hover:underline font-bold"
                                        >
                                            {vendor.vendorCode}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{vendor.legalName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <div>{vendor.primaryContact.name}</div>
                                        <div className="text-xs">{vendor.primaryContact.email}</div>
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{vendor.vendorType}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(vendor.status)}`}>
                                            {vendor.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredVendors.length === 0 && <p className="text-center py-8 text-slate-500">No vendors found.</p>}
                </div>
            )}
        </div>
    );
};

export default VendorListTab;
