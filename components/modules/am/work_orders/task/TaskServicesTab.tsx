
import React from 'react';
import type { WorkOrderTask, ServiceItem } from '../../../../../types/am_types';
import type { ProcurementCategory, ProcurementSubcategory, Vendor } from '../../../../../types/pr_types';
import Input from '../../../../Input';
import Button from '../../../../Button';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;

interface TaskServicesTabProps {
    formData: Partial<WorkOrderTask>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<WorkOrderTask>>>;
    isLocked: boolean;
    serviceForm: Partial<ServiceItem>;
    setServiceForm: React.Dispatch<React.SetStateAction<Partial<ServiceItem>>>;
    serviceCategories: ProcurementCategory[];
    serviceSubcategories: ProcurementSubcategory[];
    filteredVendors: Vendor[];
    editingServiceId: string | null;
    handleSaveService: () => void;
    handleCancelServiceEdit: () => void;
    handleEditService: (service: ServiceItem) => void;
    handleRemoveService: (id: string) => void;
    handleUpdateServiceStatus: (serviceId: string, status: string) => void;
}

const TaskServicesTab: React.FC<TaskServicesTabProps> = ({ 
    formData, setFormData, isLocked, serviceForm, setServiceForm, 
    serviceCategories, serviceSubcategories, filteredVendors, editingServiceId,
    handleSaveService, handleCancelServiceEdit, handleEditService, handleRemoveService, handleUpdateServiceStatus
}) => {
    return (
        <div className="space-y-6">
            {!isLocked && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                     <h4 className="font-semibold text-slate-700 mb-3">{editingServiceId ? 'Edit Service Requirement' : 'Add Service Requirement'}</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Input as="select" id="serviceCat" label="Service Category" value={serviceForm.categoryId || ''} onChange={e => setServiceForm(p => ({...p, categoryId: e.target.value, subcategoryId: ''}))}>
                             <option value="">Select Category...</option>
                             {serviceCategories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                         </Input>
                         <Input as="select" id="serviceSub" label="Service Subcategory" value={serviceForm.subcategoryId || ''} onChange={e => setServiceForm(p => ({...p, subcategoryId: e.target.value}))} disabled={!serviceForm.categoryId}>
                             <option value="">Select Subcategory...</option>
                             {serviceSubcategories.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                         </Input>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                         <Input 
                            as="select" 
                            id="supplier" 
                            label="Supplier" 
                            value={serviceForm.supplier || ''} 
                            onChange={e => setServiceForm(p => ({...p, supplier: e.target.value}))} 
                            disabled={!serviceForm.categoryId}
                        >
                            <option value="">Select Vendor...</option>
                            {filteredVendors.map(v => <option key={v.id} value={v.legalName}>{v.legalName}</option>)}
                         </Input>
                         <Input id="tentativeDate" label="Tentative Date" type="date" value={serviceForm.tentativeDate || ''} onChange={e => setServiceForm(p => ({...p, tentativeDate: e.target.value}))} />
                     </div>
                     <div className="mt-4">
                         <Input as="select" id="serviceStatus" label="Status" value={serviceForm.availabilityStatus || 'Not Contacted'} onChange={e => setServiceForm(p => ({...p, availabilityStatus: e.target.value as any}))} >
                             <option value="Not Contacted">Not Contacted</option>
                             <option value="Available">Available</option>
                             <option value="Not Available">Not Available</option>
                         </Input>
                     </div>
                     <div className="mt-4 flex justify-end gap-2">
                         {editingServiceId && <Button onClick={handleCancelServiceEdit} variant="secondary" className="!w-auto !py-1 !px-4 text-sm">Cancel</Button>}
                         <Button onClick={handleSaveService} className="!w-auto !py-1 !px-4 text-sm">{editingServiceId ? 'Update Service' : '+ Add Service'}</Button>
                     </div>
                </div>
            )}

            <div>
                <h4 className="font-semibold text-slate-700 mb-2">Required Services</h4>
                {(formData.requiredServices || []).length === 0 ? <p className="text-slate-500 italic">No services added.</p> : (
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-2">Service</th>
                                <th className="p-2">Supplier</th>
                                <th className="p-2">Date</th>
                                <th className="p-2">Status</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.requiredServices?.map((s, i) => (
                                <tr key={s.id} className="border-b">
                                    <td className="p-2">
                                        <div className="font-medium text-slate-800">{s.subcategoryName}</div>
                                        <div className="text-xs text-slate-500">{s.categoryName}</div>
                                    </td>
                                    <td className="p-2 text-slate-600">{s.supplier}</td>
                                    <td className="p-2 text-slate-600">{s.tentativeDate || '-'}</td>
                                    <td className="p-2">
                                        {!isLocked ? (
                                            <select 
                                                className={`px-2 py-0.5 rounded text-xs border-0 cursor-pointer font-bold ${s.availabilityStatus === 'Available' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
                                                value={s.availabilityStatus}
                                                onChange={(e) => handleUpdateServiceStatus(s.id, e.target.value)}
                                            >
                                                <option value="Not Contacted">Not Contacted</option>
                                                <option value="Available">Available</option>
                                                <option value="Not Available">Not Available</option>
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded text-xs ${s.availabilityStatus === 'Available' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                                {s.availabilityStatus}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-2 text-center flex items-center justify-center gap-2">
                                        {!isLocked && <button onClick={() => handleEditService(s)} className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50" title="Edit"><EditIcon /></button>}
                                        {!isLocked && <button onClick={() => handleRemoveService(s.id)} className="text-red-500 font-bold p-1 rounded hover:bg-red-50" title="Remove">×</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default TaskServicesTab;
