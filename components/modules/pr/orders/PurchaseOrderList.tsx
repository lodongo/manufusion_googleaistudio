
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { Organisation, AppUser } from '../../../../types';
import type { PurchaseOrder } from '../../../../types/pr_types';
import Button from '../../../Button';
import PurchaseOrderModal from './PurchaseOrderModal';

interface PurchaseOrderListProps {
    organisation: Organisation;
    theme: Organisation['theme'];
    currentUser: AppUser;
}

const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({ organisation, theme, currentUser }) => {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    useEffect(() => {
        const ref = collection(db, `organisations/${organisation.domain}/modules/PR/orders`);
        const q = query(ref, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching orders: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organisation.domain]);

    const handleEdit = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedOrder(null);
        setIsModalOpen(true);
    }

    const getStatusChip = (status: string) => {
        switch(status) {
            case 'ISSUED': return 'bg-blue-100 text-blue-800';
            case 'CREATED': return 'bg-slate-200 text-slate-800 font-semibold';
            case 'DRAFT': return 'bg-gray-100 text-gray-800';
            case 'RECEIVED': return 'bg-green-100 text-green-800';
            case 'CANCELLED': return 'bg-red-100 text-red-800';
            case 'REJECTED': return 'bg-red-200 text-red-900';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    return (
        <div className="bg-white p-6 rounded-b-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Purchase Orders</h2>
                <Button onClick={handleCreate} className="!w-auto">Create Order</Button>
            </div>
            
            {loading ? <p className="text-center py-8">Loading orders...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">PO Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-blue-600">{order.poNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{order.vendorName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{order.issueDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-800">
                                        {order.currency || '$'} {order.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleEdit(order)} 
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            View / Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {orders.length === 0 && <p className="text-center py-8 text-slate-500">No purchase orders found.</p>}
                </div>
            )}
            
            {isModalOpen && (
                <PurchaseOrderModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    organisation={organisation}
                    currentUser={currentUser}
                    theme={theme}
                    poToEdit={selectedOrder}
                    onSave={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default PurchaseOrderList;
