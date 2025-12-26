
import React, { useState } from 'react';
import { db } from '../../../../services/firebase';
import type { Vendor, VendorStatus } from '../../../../types/pr_types';
import type { Organisation, AppUser } from '../../../../types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';

interface VendorProfileTabProps {
    vendor: Vendor;
    onEdit: () => void;
    organisation: Organisation;
    currentUser: AppUser;
}

const DetailItem: React.FC<{ label: string; value?: string | React.ReactNode }> = ({ label, value }) => (
    <div className="py-2">
        <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
        <dd className="mt-1 text-sm text-slate-900 break-words">{value || '-'}</dd>
    </div>
);

const VendorProfileTab: React.FC<VendorProfileTabProps> = ({ vendor, onEdit, organisation, currentUser }) => {
    const [status, setStatus] = useState<VendorStatus>(vendor.status);
    const [isUpdating, setIsUpdating] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const updateStatus = async (newStatus: VendorStatus) => {
        setIsUpdating(true);
        try {
            await db.doc(`organisations/${organisation.domain}/modules/PR/vendors/${vendor.id}`).update({
                status: newStatus,
                updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                updatedAt: new Date()
            });
            setStatus(newStatus);
            if(newStatus !== 'Deleted') alert(`Status updated to ${newStatus}`);
        } catch (e) {
            console.error(e);
            alert("Failed to update status.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        await updateStatus('Deleted');
        setConfirmDelete(false);
        alert("Vendor marked as Deleted.");
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Actions Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Strategic Status:</label>
                    <select 
                        value={status} 
                        onChange={(e) => updateStatus(e.target.value as VendorStatus)}
                        disabled={isUpdating || status === 'Deleted'}
                        className="p-2 border rounded-md text-sm bg-white"
                    >
                        <option value="Pending">Pending</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Active">Active</option>
                        <option value="Approved">Approved</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Deactivated">Deactivated</option>
                        <option value="Deleted" disabled>Deleted</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onEdit} disabled={status === 'Deleted'} className="!w-auto">Edit Profile</Button>
                    {status !== 'Deleted' && (
                        <Button 
                            variant="secondary" 
                            className="!w-auto !bg-red-50 !text-red-700 hover:!bg-red-100 !border-red-200"
                            onClick={() => setConfirmDelete(true)}
                        >
                            Delete Vendor
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-8">
                 <section>
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <DetailItem label="Legal Name" value={vendor.legalName} />
                        <DetailItem label="Trading Name" value={vendor.tradingName} />
                        <DetailItem label="Type" value={vendor.vendorType} />
                        <DetailItem label="Registration #" value={vendor.registrationNumber} />
                        <DetailItem label="Tax ID" value={vendor.taxId} />
                        <DetailItem label="VAT #" value={vendor.vatNumber} />
                        <DetailItem label="Description" value={vendor.description} />
                        <DetailItem label="Website" value={vendor.website ? <a href={vendor.website} target="_blank" rel="noreferrer" className="text-blue-600 underline">{vendor.website}</a> : '-'} />
                    </div>
                </section>
                
                <section>
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Corporate Structure</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <DetailItem label="Date of Incorporation" value={vendor.dateOfIncorporation} />
                        <DetailItem label="Ownership Type" value={vendor.ownershipType} />
                        <DetailItem label="Parent Company" value={vendor.parentCompany} />
                    </div>
                </section>

                <section>
                     <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Industry & Categorization</h3>
                     {(vendor.industries && vendor.industries.length > 0) ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {vendor.industries.map((ind, i) => (
                                 <div key={i} className="p-3 bg-slate-50 rounded border border-slate-100">
                                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{ind.classificationName}</p>
                                     <p className="text-sm font-medium text-slate-800">{ind.categoryName}</p>
                                     {ind.categoryDescription && <p className="text-xs text-slate-500 mt-1 italic">{ind.categoryDescription}</p>}
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <p className="text-sm text-slate-400 italic">No industry categories defined.</p>
                     )}
                </section>

                <section>
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Contact & Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-3 rounded">
                             <h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Primary Contact</h4>
                             <p className="text-sm font-medium">{vendor.primaryContact.name}</p>
                             <p className="text-xs">{vendor.primaryContact.title}</p>
                             <p className="text-sm mt-1">{vendor.primaryContact.email}</p>
                             <p className="text-sm">{vendor.primaryContact.mobile}</p>
                             {vendor.altContactName && <p className="text-xs mt-2 pt-2 border-t text-slate-500">Alt: {vendor.altContactName}</p>}
                        </div>
                        <div className="bg-slate-50 p-3 rounded">
                            <h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Physical Address</h4>
                            <p className="text-sm">{vendor.physicalAddress.building}</p>
                            <p className="text-sm">{vendor.physicalAddress.city}, {vendor.physicalAddress.state}</p>
                            <p className="text-sm">{vendor.physicalAddress.country}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded">
                             <h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Billing Address</h4>
                             <p className="text-sm">{vendor.billingAddress?.building || 'Same as Physical'}</p>
                        </div>
                    </div>
                </section>

                <section>
                     <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Financials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <DetailItem label="Currency" value={`${vendor.currency.name} (${vendor.currency.code})`} />
                        <DetailItem label="Payment Terms" value={vendor.banking.paymentTerms} />
                        <DetailItem label="Incoterm" value={vendor.defaultIncoterm} />
                        <DetailItem label="Credit Limit" value={vendor.banking.creditLimit} />
                        <DetailItem label="Bank Name" value={vendor.banking.bankName} />
                        <DetailItem label="Account Number" value={vendor.banking.accountNumber} />
                        <DetailItem label="SWIFT" value={vendor.banking.swiftCode} />
                        <DetailItem label="Pay Method" value={vendor.banking.paymentMethod} />
                    </div>
                </section>
                
                <section>
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Compliance & Internal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <DetailItem label="Tax Clearance Expiry" value={vendor.taxClearanceExpiry} />
                        <DetailItem label="Insurance Expiry" value={vendor.insuranceExpiry} />
                        <DetailItem label="License Expiry" value={vendor.licenseExpiry} />
                        <DetailItem label="Internal Remarks" value={vendor.remarks} />
                    </div>
                </section>

                <section>
                     <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 uppercase">Attachments</h3>
                     <ul className="list-disc list-inside text-sm">
                        {(vendor.attachments || []).map(att => (
                            <li key={att.url}><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{att.name}</a> <span className="text-xs text-slate-400">({new Date(att.uploadedAt).toLocaleDateString()})</span></li>
                        ))}
                        {(!vendor.attachments || vendor.attachments.length === 0) && <li className="text-slate-400 italic list-none">No attachments.</li>}
                    </ul>
                </section>
            </div>
            
            <ConfirmationModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title="Delete Vendor?"
                message="This will mark the vendor as Deleted. It will be hidden from normal lists but retained in the database."
                confirmButtonText="Mark as Deleted"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
        </div>
    );
};

export default VendorProfileTab;
