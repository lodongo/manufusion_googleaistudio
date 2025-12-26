
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, where, setDoc } from 'firebase/firestore';
import type { AppUser, Organisation } from '../../../../types';
import type { SpareType, StorageLocation } from '../../../../types/in_types';
import type { ProcurementCategory, ProcurementSubcategory, ProcurementComponent, Vendor } from '../../../../types/pr_types';
import Input from '../../../Input';
import Button from '../../../Button';

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface NewMaterialTabProps {
  currentUser: AppUser;
  theme: Organisation['theme'];
  organisation: Organisation;
}

interface HierarchyNode {
  id: string;
  path: string;
  name: string;
  code: string;
}

const NewMaterialTab: React.FC<NewMaterialTabProps> = ({ currentUser, theme, organisation }) => {
    const [step, setStep] = useState(1);
    const [submissionStatus, setSubmissionStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Selection state
    const [selectedStorageLocation, setSelectedStorageLocation] = useState<StorageLocation | null>(null);
    const [selectedSpareType, setSelectedSpareType] = useState<SpareType | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<(ProcurementCategory & { id: string }) | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<(ProcurementSubcategory & { id: string }) | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<(ProcurementComponent & { id: string }) | null>(null);
    const [selection, setSelection] = useState({ l4: '', l5: '' });
    
    // Vendor State
    const [allVendors, setAllVendors] = useState<Vendor[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [vendorSearch, setVendorSearch] = useState('');

    // Dropdown options state
    const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
    const [spareTypes, setSpareTypes] = useState<SpareType[]>([]);
    const [categories, setCategories] = useState<(ProcurementCategory & { id: string })[]>([]);
    const [subcategories, setSubcategories] = useState<(ProcurementSubcategory & { id: string })[]>([]);
    const [components, setComponents] = useState<(ProcurementComponent & { id: string })[]>([]);
    const [hierarchy, setHierarchy] = useState<{ l4: HierarchyNode[], l5: HierarchyNode[] }>({ l4: [], l5: [] });
    
    // Form data state
    const [source, setSource] = useState<'OEM' | 'OCM' | 'General Suppliers'>('General Suppliers');
    const [sourceInfo, setSourceInfo] = useState({ oemName: '', oemPartNumber: '', ocmName: '', ocmPartNumber: '' });
    const [attributesData, setAttributesData] = useState<Record<string, any>>({});
    
    // UI State
    const [loading, setLoading] = useState({
        masterData: true,
        subcategories: false, components: false, submitting: false,
        hierarchy: true, vendors: true
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const resetForm = () => {
        setStep(1);
        setSelectedStorageLocation(null);
        setSelectedSpareType(null);
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setSelectedComponent(null);
        setSelection({ l4: '', l5: '' });
        setSelectedVendorId('');
        setVendorSearch('');
        setSource('General Suppliers');
        setSourceInfo({ oemName: '', oemPartNumber: '', ocmName: '', ocmPartNumber: '' });
        setAttributesData({});
        setErrors({});
    };

    // Fetch all initial data
    useEffect(() => {
        const unsubscribes: (() => void)[] = [];
        setLoading({ masterData: true, subcategories: false, components: false, submitting: false, hierarchy: true, vendors: true });
        
        const fetchData = async () => {
            const refs = [
                { path: 'modules/IN/StorageLocations', setter: setStorageLocations },
                { path: 'modules/IN/SpareTypes', setter: setSpareTypes },
                { path: 'modules/PR/Classifications/GS/Categories', setter: setCategories },
            ];

            refs.forEach(refInfo => {
                const collRef = collection(db, refInfo.path);
                unsubscribes.push(onSnapshot(query(collRef, orderBy('name')), (snap) => {
                    refInfo.setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
                }));
            });

            const vendorsRef = collection(db, `organisations/${organisation.domain}/modules/PR/vendors`);
            unsubscribes.push(onSnapshot(query(vendorsRef, where('status', '==', 'Approved'), orderBy('legalName')), (snapshot) => {
                setAllVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
                setLoading(p => ({...p, vendors: false}));
            }));

            if (currentUser.allocationLevel3Id) {
                const l3Path = `organisations/${organisation.domain}/level_1/${currentUser.allocationLevel1Id}/level_2/${currentUser.allocationLevel2Id}/level_3/${currentUser.allocationLevel3Id}`;
                const l4Ref = collection(db, `${l3Path}/level_4`);
                unsubscribes.push(onSnapshot(query(l4Ref, orderBy('name')), (snap) => {
                    setHierarchy(prev => ({...prev, l4: snap.docs.map(d => ({id:d.id, path: d.ref.path, ...d.data()} as HierarchyNode))}));
                    setLoading(p => ({...p, hierarchy: false}));
                }));
            } else {
                 setLoading(p => ({...p, hierarchy: false}));
            }
        };

        fetchData().finally(() => setLoading(p => ({...p, masterData: false})));
        return () => unsubscribes.forEach(unsub => unsub());
    }, [currentUser, organisation.domain]);

    const filteredVendors = useMemo(() => {
        if (!vendorSearch) return allVendors;
        const lower = vendorSearch.toLowerCase();
        return allVendors.filter(v => 
            v.legalName.toLowerCase().includes(lower) ||
            v.vendorCode.toLowerCase().includes(lower) ||
            (v.tradingName && v.tradingName.toLowerCase().includes(lower))
        );
    }, [allVendors, vendorSearch]);
    
    useEffect(() => {
        if (!selectedCategory) { setSubcategories([]); setSelectedSubcategory(null); return; }
        setLoading(p => ({...p, subcategories: true}));
        const ref = collection(db, `modules/PR/Classifications/GS/Categories/${selectedCategory.id}/Subcategories`);
        const unsub = onSnapshot(query(ref, orderBy('name')), (snap) => {
            setSubcategories(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProcurementSubcategory & { id: string })));
            setLoading(p => ({...p, subcategories: false}));
        });
        setSelectedSubcategory(null);
        return unsub;
    }, [selectedCategory]);

    useEffect(() => {
        if (!selectedCategory || !selectedSubcategory) { setComponents([]); setSelectedComponent(null); return; }
        setLoading(p => ({...p, components: true}));
        const ref = collection(db, `modules/PR/Classifications/GS/Categories/${selectedCategory.id}/Subcategories/${selectedSubcategory.id}/Components`);
        const unsub = onSnapshot(query(ref, orderBy('name')), (snap) => {
            setComponents(snap.docs.map(doc => ({...doc.data(), id: doc.id } as ProcurementComponent & { id: string })));
            setLoading(p => ({...p, components: false}));
        });
        setSelectedComponent(null);
        return unsub;
    }, [selectedSubcategory, selectedCategory]);
    
    useEffect(() => {
        if (!selection.l4) { setHierarchy(p => ({...p, l5: []})); setSelection(p => ({...p, l5: ''})); return; }
        const l4Node = hierarchy.l4.find(n => n.id === selection.l4);
        if(!l4Node) return;
        const l5Ref = collection(db, `${l4Node.path}/level_5`);
        const unsub = onSnapshot(query(l5Ref, orderBy('name')), (snap) => {
             setHierarchy(p => ({...p, l5: snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() } as HierarchyNode))}));
        });
        setSelection(p => ({...p, l5: ''}));
        return unsub;
    }, [selection.l4, hierarchy.l4]);

    useEffect(() => { setAttributesData({}); }, [selectedComponent]);
    useEffect(() => { 
        setSelectedVendorId(''); 
        setVendorSearch('');
    }, [source]);

    const handleVendorChange = (vendorId: string) => {
        setSelectedVendorId(vendorId);
        const vendor = allVendors.find(v => v.id === vendorId);
        if (!vendor) return;

        if (source === 'OEM') {
            setSourceInfo(p => ({ ...p, oemName: vendor.legalName }));
        } else if (source === 'OCM') {
            setSourceInfo(p => ({ ...p, ocmName: vendor.legalName }));
        }
    };
    
    const validateStep = (currentStep: number) => {
        const newErrors: Record<string, string> = {};
        if (currentStep === 1) {
            if (!selection.l4 || !selection.l5) newErrors.location = "Department and Section must be selected.";
            if (!selectedStorageLocation) newErrors.storageLocation = "Storage Location is required.";
            if (!selectedSpareType) newErrors.spareType = "Material Type is required.";
        }
        if (currentStep === 2) {
            if (!selectedComponent) newErrors.component = "A specific component must be selected.";
        }
        if (currentStep === 3) {
            if (source === 'OEM' && !sourceInfo.oemPartNumber) newErrors.partNumber = "OEM Part Number is required.";
            if (source === 'OCM' && !sourceInfo.ocmPartNumber) newErrors.partNumber = "OCM Part Number is required.";
        }
        if (currentStep === 4) {
            selectedComponent?.attributes.forEach(attr => {
                if (attr.isRequired && !attributesData[attr.name]) {
                    newErrors[`attr_${attr.name}`] = `${attr.name} is a required attribute.`;
                }
            });
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const nextStep = () => {
        if (validateStep(step)) {
            setStep(s => s + 1);
        }
    };
    const prevStep = () => setStep(s => s - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep(4)) {
            setSubmissionStatus({ message: "Please fill all required attributes.", type: 'error'});
            return;
        }
        setLoading(p => ({...p, submitting: true}));
        setSubmissionStatus(null);
        
        try {
            const l4Node = hierarchy.l4.find(n => n.id === selection.l4);
            const l5Node = hierarchy.l5.find(n => n.id === selection.l5);
            
            // Capture allocation data for the sub-document
            const locationPayload = {
                allocationLevel1Id: currentUser.allocationLevel1Id || '',
                allocationLevel1Name: currentUser.allocationLevel1Name || '',
                allocationLevel2Id: currentUser.allocationLevel2Id || '',
                allocationLevel2Name: currentUser.allocationLevel2Name || '',
                allocationLevel3Id: currentUser.allocationLevel3Id || '',
                allocationLevel3Name: currentUser.allocationLevel3Name || '',
                allocationLevel4Id: l4Node?.id || '',
                allocationLevel4Name: l4Node?.name || '',
                allocationLevel5Id: l5Node?.id || '',
                allocationLevel5Name: l5Node?.name || '',
            };

            // Main payload for masterData collection (without allocation details)
            const mainPayload: any = {
                status: 'Pending Approval',
                storageLocationId: selectedStorageLocation!.id,
                storageLocationName: selectedStorageLocation!.name,
                materialTypeCode: selectedSpareType!.code,
                materialTypeName: selectedSpareType!.name,
                materialTypeDescription: selectedSpareType!.description,
                procurementCategoryCode: selectedCategory!.id,
                procurementCategoryName: selectedCategory!.name,
                procurementSubcategoryCode: selectedSubcategory!.id,
                procurementSubcategoryName: selectedSubcategory!.name,
                procurementComponentCode: selectedComponent!.id,
                procurementComponentName: selectedComponent!.name,
                procurementComponentDescription: selectedComponent!.description,
                source: source,
                oemName: sourceInfo.oemName,
                oemPartNumber: sourceInfo.oemPartNumber,
                ocmName: sourceInfo.ocmName,
                ocmPartNumber: sourceInfo.ocmPartNumber,
                attributes: attributesData,
                approver1: false,
                approver2: false,
                approver3: false,
                createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                createdAt: Timestamp.now(),
            };
            
            // 1. Save to global masterData collection
            const masterDataRef = collection(db, `organisations/${organisation.domain}/modules/IN/masterData`);
            const docRef = await addDoc(masterDataRef, mainPayload);

            // 2. Save location details to sub-document
            const requestDetailsRef = doc(db, docRef.path, 'requests', 'requestDetails');
            await setDoc(requestDetailsRef, locationPayload);

            setSubmissionStatus({ message: "Material request submitted successfully for approval!", type: 'success'});
            resetForm();

        } catch (err: any) {
            console.error("Submission error:", err);
            setSubmissionStatus({ message: `Submission failed: ${err.message}`, type: 'error'});
        } finally {
            setLoading(p => ({...p, submitting: false}));
        }
    };
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-b-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">New Material Creation Request</h2>
            <form onSubmit={handleSubmit} className="space-y-8">
                {step === 1 && (
                    <fieldset className="space-y-4">
                        <legend className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Step 1: Material Location & Type</legend>
                        <div className="p-4 border rounded-md bg-slate-50">
                            <h4 className="font-semibold text-slate-700">Default Location</h4>
                            <p className="text-sm text-slate-600">{currentUser.allocationLevel1Name} &gt; {currentUser.allocationLevel2Name} &gt; {currentUser.allocationLevel3Name}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Input as="select" id="l4Select" label="Department" value={selection.l4} onChange={e => setSelection({ l4: e.target.value, l5: '' })} disabled={loading.hierarchy} error={errors.location}><option value="">{loading.hierarchy ? 'Loading...' : 'Select...'}</option>{hierarchy.l4.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Input>
                            <Input as="select" id="l5Select" label="Section" value={selection.l5} onChange={e => setSelection(p => ({ ...p, l5: e.target.value }))} disabled={!selection.l4} error={errors.location}><option value="">Select...</option>{hierarchy.l5.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Input>
                            <Input as="select" id="storageLocationSelect" label="Storage Location" error={errors.storageLocation} value={selectedStorageLocation?.id || ''} onChange={e => setSelectedStorageLocation(storageLocations.find(st => st.id === e.target.value) || null)} disabled={loading.masterData}><option value="">{loading.masterData ? 'Loading...' : 'Select...'}</option>{storageLocations.map(st => <option key={st.id} value={st.id}>{st.name} ({st.code})</option>)}</Input>
                            <Input as="select" id="spareTypeSelect" label="Material Type" error={errors.spareType} value={selectedSpareType?.id || ''} onChange={e => setSelectedSpareType(spareTypes.find(st => st.id === e.target.value) || null)} disabled={loading.masterData}><option value="">{loading.masterData ? 'Loading...' : 'Select...'}</option>{spareTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}</Input>
                        </div>
                    </fieldset>
                )}
                
                {step === 2 && (
                    <fieldset className="space-y-4">
                        <legend className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Step 2: Classification</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input as="select" id="categorySelect" label="Procurement Category" value={selectedCategory?.id || ''} onChange={e => setSelectedCategory(categories.find(c => c.id === e.target.value) || null)} disabled={loading.masterData}><option value="">{loading.masterData ? 'Loading...' : 'Select...'}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Input>
                            <Input as="select" id="subcategorySelect" label="Subcategory" value={selectedSubcategory?.id || ''} onChange={e => setSelectedSubcategory(subcategories.find(sc => sc.id === e.target.value) || null)} disabled={!selectedCategory || loading.subcategories}><option value="">{loading.subcategories ? 'Loading...' : 'Select...'}</option>{subcategories.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}</Input>
                            <Input as="select" id="componentSelect" label="Component" value={selectedComponent?.id || ''} onChange={e => setSelectedComponent(components.find(co => co.id === e.target.value) || null)} disabled={!selectedSubcategory || loading.components} error={errors.component}><option value="">{loading.components ? 'Loading...' : 'Select...'}</option>{components.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}</Input>
                        </div>
                    </fieldset>
                )}
                
                {step === 3 && (
                    <fieldset className="space-y-4">
                        <legend className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Step 3: Source Information</legend>
                        <Input as="select" id="sourceSelect" label="Source Type" value={source} onChange={e => setSource(e.target.value as any)}><option value="General Suppliers">General Suppliers</option><option value="OEM">OEM</option><option value="OCM">OCM</option></Input>
                        {(source === 'OEM' || source === 'OCM') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Input label={`Search ${source} Vendor`} id="vendorSearch" value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Type name or code..." />
                                    <Input as="select" id="vendorSelect" label={`${source} Vendor`} value={selectedVendorId} onChange={e => handleVendorChange(e.target.value)} disabled={loading.vendors}>
                                        <option value="">{loading.vendors ? 'Loading vendors...' : (allVendors.length === 0 ? 'No approved vendors found' : 'Select a vendor (optional)...')}</option>
                                        {filteredVendors.map(vendor => (<option key={vendor.id} value={vendor.id!}>{vendor.legalName} ({vendor.vendorCode})</option>))}
                                    </Input>
                                </div>
                                <div className="space-y-4">
                                    <Input label={`${source} Name`} id="sourceName" value={source === 'OEM' ? sourceInfo.oemName : sourceInfo.ocmName} onChange={e => setSourceInfo(p => ({...p, [source === 'OEM' ? 'oemName' : 'ocmName']: e.target.value}))} />
                                    <Input label={`${source} Part Number`} id="sourcePartNumber" value={source === 'OEM' ? sourceInfo.oemPartNumber : sourceInfo.ocmPartNumber} onChange={e => setSourceInfo(p => ({...p, [source === 'OEM' ? 'oemPartNumber' : 'ocmPartNumber']: e.target.value}))} error={errors.partNumber}/>
                                </div>
                            </div>
                        )}
                    </fieldset>
                )}

                {step === 4 && selectedComponent && (
                    <fieldset className="space-y-4">
                        <legend className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Step 4: Attributes</legend>
                        <p className="text-sm text-slate-500 -mt-4">{selectedComponent.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            {selectedComponent.attributes.map((attr, i) => {
                                const inputId = `attr_${i}_${attr.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                                const errorId = `attr_${attr.name}`;
                                const inputProps: any = { id: inputId, label: `${attr.name}${attr.unit ? ` (${attr.unit})` : ''}`, value: attributesData[attr.name] || '', onChange: (e: any) => setAttributesData(p => ({...p, [attr.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value})), required: attr.isRequired, error: errors[errorId]};
                                
                                if (attr.dataType === 'boolean') {
                                    return (<div key={inputId} className={`flex items-center pt-6 ${attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''}`}>
                                        <input type="checkbox" id={inputId} checked={!!attributesData[attr.name]} onChange={inputProps.onChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor={inputId} className="ml-2 block text-sm font-medium text-slate-700">{attr.name}{attr.isRequired && <span className="text-red-500 ml-1">*</span>}</label>
                                    </div>)
                                }

                                if (attr.dataType === 'dropdown' || attr.dataType === 'multiselect') {
                                    return <Input as="select" {...inputProps} key={inputId} containerClassName={attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''}><option value="">Select...</option>{(attr.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}</Input>;
                                }
                                return <Input type={attr.dataType as any} {...inputProps} key={inputId} containerClassName={attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''} />;
                            })}
                        </div>
                    </fieldset>
                )}

                {submissionStatus && <div className={`p-3 rounded-md text-sm font-semibold text-center ${submissionStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{submissionStatus.message}</div>}
                
                <div className="flex justify-end pt-8 border-t gap-4">
                    {step > 1 && <Button type="button" variant="secondary" onClick={prevStep}>Previous</Button>}
                    {step < 4 && <Button type="button" onClick={nextStep}>Next</Button>}
                    {step === 4 && <Button type="submit" isLoading={loading.submitting} style={{backgroundColor: theme.colorPrimary}}>Submit Material Request</Button>}
                </div>
            </form>
        </div>
    );
};

export default NewMaterialTab;
