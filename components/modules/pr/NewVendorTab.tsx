
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, storage } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import type { AppUser, Organisation, CountryData } from '../../../types';
import type { ProcurementClassification, ProcurementCategory, Vendor, VendorIndustry, VendorAttachment } from '../../../types/pr_types';
import Input from '../../Input';
import Button from '../../Button';
import { isValidPhoneNumber, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

const { Timestamp } = firebase.firestore;

interface NewVendorTabProps {
    theme: Organisation['theme'];
    currentUser: AppUser;
    organisation: Organisation;
    vendorToEdit?: Vendor | null;
    onComplete?: () => void;
}

const NewVendorTab: React.FC<NewVendorTabProps> = ({ theme, currentUser, organisation, vendorToEdit, onComplete }) => {
    const isEditing = !!vendorToEdit;
    const [activeSection, setActiveSection] = useState('basic');

    const initialFormData = {
        legalName: '', tradingName: '', vendorType: '', registrationNumber: '', taxId: '', vatNumber: '', description: '',
        dateOfIncorporation: '', parentCompany: '', ownershipType: '',
        industries: [{ classificationId: '', categoryId: '' }],
        physicalAddress: {}, billingAddress: {}, shippingAddress: {},
        primaryContact: {}, banking: {}, currency: { code: '', name: '', symbol: '' },
        defaultIncoterm: '', taxClearanceExpiry: '', insuranceExpiry: '', licenseExpiry: '',
        website: '', altContactName: '', department: '', riskRating: 'LOW', remarks: ''
    };

    const [formData, setFormData] = useState<any>(initialFormData); 
    const [isBillingSameAsPhysical, setIsBillingSameAsPhysical] = useState(false);
    const [isShippingSameAsPhysical, setIsShippingSameAsPhysical] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    // Currency Selector State
    const [currencyContinent, setCurrencyContinent] = useState('');
    const [currencyCountry, setCurrencyCountry] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{ message: string, type: 'info' | 'success' | 'error' } | null>(null);
    
    const mandatoryAttachmentsRef = useRef<Record<string, HTMLInputElement | null>>({});
    const optionalAttachmentsRef = useRef<Record<string, HTMLInputElement | null>>({});

    // Data for dropdowns
    const [countries, setCountries] = useState<CountryData[]>([]);
    const [classifications, setClassifications] = useState<ProcurementClassification[]>([]);
    const [categories, setCategories] = useState<Record<string, ProcurementCategory[]>>({});

    const [loading, setLoading] = useState({ countries: true, classifications: true });

    // --- INITIALIZATION & EDIT MODE HANDLING ---
    useEffect(() => {
        if (isEditing && vendorToEdit) {
            setFormData({
                ...vendorToEdit,
                industries: (vendorToEdit.industries && vendorToEdit.industries.length > 0) ? vendorToEdit.industries : [{ classificationId: '', categoryId: '' }],
                physicalAddress: vendorToEdit.physicalAddress || {},
                billingAddress: vendorToEdit.billingAddress || {},
                shippingAddress: vendorToEdit.shippingAddress || {},
                primaryContact: vendorToEdit.primaryContact || {},
                banking: vendorToEdit.banking || {},
                currency: vendorToEdit.currency || { code: '', name: '', symbol: '' },
            });
            
            // Pre-load categories for existing industries so dropdowns work
            if (vendorToEdit.industries) {
                vendorToEdit.industries.forEach(ind => {
                    if (ind.classificationId) {
                        fetchCategoriesForClassification(ind.classificationId);
                    }
                });
            }
        }
    }, [isEditing, vendorToEdit]);

    const fetchCategoriesForClassification = async (classificationId: string) => {
        if (!classificationId) return;
        // Optimization: check if we already loaded this category to avoid loops, unless forcing refresh
        // But for Edit mode initial load, we need to ensure state is populated.
        try {
            const catRef = db.collection(`modules/PR/Classifications/${classificationId}/Categories`);
            const catSnap = await catRef.orderBy('name').get();
            const fetchedCats = catSnap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementCategory));
            setCategories(prev => ({...prev, [classificationId]: fetchedCats}));
        } catch (e) {
            console.error("Error fetching categories", e);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const allCountries: CountryData[] = [];
                const continentsRef = db.collection('settings/memsSetup/continents');
                const continentsSnap = await continentsRef.get();
                const countryPromises = continentsSnap.docs.map(doc => doc.ref.collection('countries').where('enabled', '==', true).get());
                const countrySnapshots = await Promise.all(countryPromises);
                countrySnapshots.forEach(snap => snap.forEach(doc => allCountries.push({ id: doc.id, ...doc.data() } as CountryData)));
                setCountries(allCountries.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (e) { console.error("Failed to fetch countries:", e); } 
            finally { setLoading(p => ({ ...p, countries: false })); }

            try {
                const classRef = db.collection('modules/PR/Classifications');
                const classSnap = await classRef.orderBy('name').get();
                setClassifications(classSnap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementClassification)));
            } catch (e) { console.error("Failed to fetch classifications:", e); } 
            finally { setLoading(p => ({ ...p, classifications: false })); }
        };
        fetchData();
    }, []);
    
    const uniqueContinents = useMemo(() => Array.from(new Set(countries.map(c => c.continent))).sort(), [countries]);

    const validateAndSetErrors = useCallback(() => {
        const newErrors: Record<string, string> = {};
        const mobile = formData.primaryContact?.mobile;
        const phone = formData.primaryContact?.phone;
        const country = formData.physicalAddress?.countryIsoCode;

        if (mobile && country && !isValidPhoneNumber(mobile, country as CountryCode)) {
            newErrors.primaryMobile = 'Invalid mobile number for country.';
        }
        if (phone && country && !isValidPhoneNumber(phone, country as CountryCode)) {
            newErrors.primaryPhone = 'Invalid phone number for country.';
        }
        
        if (!formData.legalName) newErrors.legalName = 'Legal Name is required.';
        if (!formData.taxId) newErrors.taxId = 'Tax ID is required.';
        if (!formData.primaryContact?.name) newErrors.primaryContactName = 'Contact Name is required.';
        if (!formData.primaryContact?.email) newErrors.primaryContactEmail = 'Contact Email is required.';
        if (!formData.banking?.bankName) newErrors.bankName = 'Bank Name is required.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleInputChange = (section: string, field: string, value: any) => {
        const upperValue = typeof value === 'string' ? value.toUpperCase() : value;
        setFormData((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: upperValue
            }
        }));
    };

    const handleAddressChange = (addressType: string, field: string, value: string) => {
        const upperValue = value.toUpperCase();
        setFormData((prev: any) => ({
            ...prev,
            [addressType]: {
                ...prev[addressType],
                [field]: upperValue
            }
        }));
    };

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const countryCode = e.target.value;
        handleAddressChange('physicalAddress', 'countryIsoCode', countryCode);
        const selectedCountry = countries.find(c => c.iso2 === countryCode);
        if (selectedCountry) {
            handleAddressChange('physicalAddress', 'country', selectedCountry.name.toUpperCase());
        }
    };
    
    const handleCurrencySelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const iso = e.target.value;
        setCurrencyCountry(iso);
        const country = countries.find(c => c.iso2 === iso);
        if (country && country.currency) {
            setFormData((prev: any) => ({ ...prev, currency: country.currency }));
        }
    };
    
    useEffect(() => {
        if (isBillingSameAsPhysical) setFormData((prev: any) => ({ ...prev, billingAddress: prev.physicalAddress }));
    }, [isBillingSameAsPhysical, formData.physicalAddress]);

    useEffect(() => {
        if (isShippingSameAsPhysical) setFormData((prev: any) => ({ ...prev, shippingAddress: prev.physicalAddress }));
    }, [isShippingSameAsPhysical, formData.physicalAddress]);

    const handleIndustryChange = async (index: number, type: 'classificationId' | 'categoryId', value: string) => {
        const newIndustries = [...formData.industries];
        const currentIndustry: Partial<VendorIndustry> = { ...newIndustries[index] };
        
        if (type === 'classificationId') {
            currentIndustry.classificationId = value;
            currentIndustry.categoryId = ''; // Reset category
            const classification = classifications.find(c => c.code === value);
            currentIndustry.classificationName = classification?.name.toUpperCase();
            
            if (value) {
                fetchCategoriesForClassification(value);
            }
        } else if (type === 'categoryId') {
            currentIndustry.categoryId = value;
            const category = categories[currentIndustry.classificationId!]?.find(c => c.code === value);
            currentIndustry.categoryName = category?.name.toUpperCase();
            currentIndustry.categoryDescription = category?.description;
        }
        
        newIndustries[index] = currentIndustry;
        setFormData((prev: any) => ({ ...prev, industries: newIndustries }));
    };

    const addIndustry = () => { if (formData.industries.length < 4) setFormData((prev: any) => ({ ...prev, industries: [...prev.industries, { classificationId: '', categoryId: '' }] })); };
    const removeIndustry = (index: number) => { setFormData((prev: any) => ({ ...prev, industries: prev.industries.filter((_: any, i: number) => i !== index) })); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAndSetErrors()) {
            setSubmitStatus({ message: 'Please fix validation errors.', type: 'error' });
            return;
        }
        setIsSubmitting(true);
        setSubmitStatus({ message: 'Saving vendor...', type: 'info' });

        try {
            let vendorCode = formData.vendorCode;

            if (!isEditing) {
                const counterRef = db.doc(`organisations/${organisation.domain}/modules/PR/pr_settings/counters`);
                vendorCode = await db.runTransaction(async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    const newCount = (counterDoc.data()?.vendorCounter || 0) + 1;
                    transaction.set(counterRef, { vendorCounter: newCount }, { merge: true });
                    return `V${String(newCount).padStart(5, '0')}`;
                });
            }

            const allFiles = [
                ...Object.values(mandatoryAttachmentsRef.current),
                ...Object.values(optionalAttachmentsRef.current)
            ].filter((input: HTMLInputElement | null) => input && input.files && input.files[0]);
            
            const attachmentPromises = allFiles.map(async (input: HTMLInputElement | null) => {
                if (!input || !input.files || !input.files.length) return null;
                const file = input.files[0];
                const filePath = `organisations/${organisation.domain}/modules/PR/vendors/${vendorCode}/${input.name}-${file.name}`;
                const fileRef = storage.ref(filePath);
                const snapshot = await fileRef.put(file);
                const url = await snapshot.ref.getDownloadURL();
                return { name: input.name, url, uploadedAt: new Date().toISOString() };
            });

            const newAttachments = (await Promise.all(attachmentPromises)).filter(Boolean) as VendorAttachment[];
            const finalAttachments = [...(formData.attachments || []), ...newAttachments];

            const vendorData: any = {
                ...formData,
                vendorCode,
                physicalAddress: formData.physicalAddress,
                billingAddress: isBillingSameAsPhysical ? formData.physicalAddress : formData.billingAddress,
                shippingAddress: isShippingSameAsPhysical ? formData.physicalAddress : formData.shippingAddress,
                primaryContact: {
                    name: formData.primaryContact.name,
                    title: formData.primaryContact.title,
                    phone: formData.primaryContact.phone ? parsePhoneNumberFromString(formData.primaryContact.phone, formData.physicalAddress.countryIsoCode as CountryCode)?.number : undefined,
                    mobile: parsePhoneNumberFromString(formData.primaryContact.mobile, formData.physicalAddress.countryIsoCode as CountryCode)?.number,
                    email: formData.primaryContact.email.toLowerCase(),
                },
                attachments: finalAttachments,
                updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                updatedAt: Timestamp.now(),
            };

            if (!isEditing) {
                vendorData.status = 'Pending';
                vendorData.createdBy = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
                vendorData.createdAt = Timestamp.now();
            }

            if (isEditing && vendorToEdit?.id) {
                await db.collection(`organisations/${organisation.domain}/modules/PR/vendors`).doc(vendorToEdit.id).update(vendorData);
                setSubmitStatus({ message: 'Vendor updated successfully!', type: 'success' });
            } else {
                await db.collection(`organisations/${organisation.domain}/modules/PR/vendors`).add(vendorData);
                setSubmitStatus({ message: 'Vendor created successfully!', type: 'success' });
                setFormData(initialFormData);
            }

            if (onComplete) {
                setTimeout(onComplete, 1500);
            }

        } catch (err: any) {
            console.error("Submission error:", err);
            setSubmitStatus({ message: `Failed: ${err.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const FileInput: React.FC<{ label: string, id: string, isOptional?: boolean, inputRef: (el: HTMLInputElement | null) => void }> = ({ label, id, isOptional, inputRef }) => (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <p className="text-xs font-medium text-slate-700 uppercase w-1/2"> {label} {!isOptional && <span className="text-red-500">*</span>} </p>
            <input type="file" id={id} name={id} ref={inputRef} className="text-xs text-slate-500 w-1/2"/>
        </div>
    );
    
    const inputStyles = "uppercase";

    const mandatoryAttachmentFields = [
        { id: 'cert_incorporation', label: 'Certificate of Incorporation' },
        { id: 'tax_compliance', label: 'Tax Compliance Certificate' },
        { id: 'business_permit', label: 'Business Permit / License' },
        { id: 'bank_confirmation', label: 'Bank Confirmation Letter' },
        { id: 'id_copy', label: 'Director ID Copies' },
        { id: 'proof_of_address', label: 'Proof of Address' },
    ];
    const optionalAttachmentFields = [
        { id: 'company_profile', label: 'Company Profile' },
        { id: 'price_catalogue', label: 'Price Catalogue' },
        { id: 'references', label: 'Client References' },
        { id: 'insurance_certs', label: 'Insurance Certificates' },
        { id: 'nda', label: 'NDA' },
        { id: 'sla', label: 'SLA' },
    ];

    const sections = [
        { id: 'basic', label: '1. Basic Info' },
        { id: 'corporate', label: '2. Corporate & Industry' },
        { id: 'address', label: '3. Address & Contact' },
        { id: 'finance', label: '4. Financials' },
        { id: 'compliance', label: '5. Compliance & Docs' },
    ];

    return (
        <div className="flex flex-col md:flex-row h-full bg-slate-50 gap-6 p-6">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                    <div className="p-4 bg-slate-100 border-b border-slate-200">
                        <h3 className="font-bold text-slate-700">{isEditing ? 'Edit Vendor' : 'New Vendor'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{isEditing ? formData.vendorCode : 'Registration'}</p>
                    </div>
                    <nav className="p-2 space-y-1">
                        {sections.map((sec) => (
                            <button
                                key={sec.id}
                                onClick={() => setActiveSection(sec.id)}
                                className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                                    activeSection === sec.id 
                                    ? `bg-blue-50 text-blue-700 border-l-4 border-blue-600` 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                style={activeSection === sec.id ? { borderColor: theme.colorPrimary, color: theme.colorPrimary, backgroundColor: `${theme.colorPrimary}10` } : {}}
                            >
                                {sec.label}
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t border-slate-200">
                         {submitStatus && <div className={`mb-4 p-2 rounded text-xs text-center font-bold ${submitStatus.type === 'success' ? 'bg-green-100 text-green-800' : submitStatus.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}> {submitStatus.message} </div>}
                         <Button onClick={handleSubmit} isLoading={isSubmitting} style={{backgroundColor: theme.colorPrimary}} className="w-full shadow-md">
                            {isEditing ? 'Save Changes' : 'Submit Registration'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* SECTION 1: BASIC */}
                    {activeSection === 'basic' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Vendor Legal Name" id="legalName" value={formData.legalName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, legalName: e.target.value.toUpperCase()})} required className={inputStyles} error={errors.legalName} />
                                <Input label="Trading Name" id="tradingName" value={formData.tradingName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tradingName: e.target.value.toUpperCase()})} className={inputStyles} />
                                <Input as="select" label="Vendor Type" id="vendorType" value={formData.vendorType} onChange={e => setFormData({...formData, vendorType: e.target.value})} required>
                                    <option value="">Select...</option>
                                    <option value="COMPANY">Company</option><option value="INDIVIDUAL">Individual / Sole Proprietor</option><option value="NGO">NGO</option><option value="GOVERNMENT">Government Agency</option><option value="OTHER">Other</option>
                                </Input>
                                <Input label="Tax ID (PIN/TIN)" id="taxId" value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value.toUpperCase()})} required className={inputStyles} error={errors.taxId}/>
                                <Input label="VAT Number" id="vatNumber" value={formData.vatNumber} onChange={e => setFormData({...formData, vatNumber: e.target.value.toUpperCase()})} className={inputStyles} />
                                <Input as="textarea" label="Description of Goods/Services" id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} containerClassName="md:col-span-2" className={inputStyles} />
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: CORPORATE & INDUSTRY */}
                    {activeSection === 'corporate' && (
                        <div className="animate-fade-in">
                             <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Corporate & Industry</h3>
                             
                             <div className="mb-8">
                                <h4 className="font-semibold text-slate-700 mb-4 bg-slate-50 p-2 rounded">Corporate Structure</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input id="dateOfIncorporation" label="Date of Incorporation" type="date" value={formData.dateOfIncorporation || ''} onChange={e => setFormData({...formData, dateOfIncorporation: e.target.value})} />
                                    <Input id="parentCompany" label="Parent Company" value={formData.parentCompany || ''} onChange={e => setFormData({...formData, parentCompany: e.target.value.toUpperCase()})} className={inputStyles}/>
                                    <Input as="select" id="ownershipType" label="Ownership Type" value={formData.ownershipType || ''} onChange={e => setFormData({...formData, ownershipType: e.target.value})}>
                                        <option value="">Select...</option>
                                        <option value="PRIVATE">Private</option><option value="PUBLIC">Public Listed</option><option value="GOVERNMENT">Government Owned</option><option value="PARTNERSHIP">Partnership</option>
                                    </Input>
                                    <Input label="Registration Number" id="regNumber" value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value.toUpperCase()})} className={inputStyles} />
                                </div>
                             </div>

                             <div>
                                <h4 className="font-semibold text-slate-700 mb-4 bg-slate-50 p-2 rounded">Industry Categories</h4>
                                <div className="space-y-3">
                                    {formData.industries.map((industry: any, index: number) => (
                                        <div key={index} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col md:flex-row gap-4 items-start">
                                            <div className="flex-1 w-full">
                                                <Input as="select" id={`classification_${index}`} label={`Classification ${index+1}`} value={industry.classificationId} onChange={e => handleIndustryChange(index, 'classificationId', e.target.value)} disabled={loading.classifications} containerClassName="mb-2">
                                                    <option value="">{loading.classifications ? 'Loading...' : 'Select Classification...'}</option>
                                                    {classifications.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                                </Input>
                                            </div>
                                            <div className="flex-1 w-full">
                                                 <Input as="select" id={`category_${index}`} label={`Category ${index+1}`} value={industry.categoryId} onChange={e => handleIndustryChange(index, 'categoryId', e.target.value)} disabled={!industry.classificationId}>
                                                    <option value="">Select Category...</option>
                                                    {(categories[industry.classificationId] || []).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                                </Input>
                                            </div>
                                            {formData.industries.length > 1 && (
                                                <button type="button" onClick={() => removeIndustry(index)} className="text-red-500 hover:text-red-700 mt-8">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {formData.industries.length < 4 && <Button type="button" onClick={addIndustry} variant="secondary" className="!w-auto text-sm">+ Add Industry</Button>}
                                </div>
                             </div>
                        </div>
                    )}

                    {/* SECTION 3: ADDRESS & CONTACT */}
                    {activeSection === 'address' && (
                         <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Address & Contact</h3>
                            
                            <div className="mb-8">
                                <h4 className="font-semibold text-slate-700 mb-4 bg-slate-50 p-2 rounded">Physical Address</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <Input label="Building / Street" id="physicalAddress" value={formData.physicalAddress?.building} onChange={e => handleAddressChange('physicalAddress', 'building', e.target.value)} className={inputStyles} />
                                     <Input label="City / Town" id="city" value={formData.physicalAddress?.city} onChange={e => handleAddressChange('physicalAddress', 'city', e.target.value)} className={inputStyles} />
                                     <Input label="State / Province" id="state" value={formData.physicalAddress?.state} onChange={e => handleAddressChange('physicalAddress', 'state', e.target.value)} className={inputStyles} />
                                     <Input as="select" label="Country" id="country" onChange={handleCountryChange} value={formData.physicalAddress?.countryIsoCode || ''} disabled={loading.countries}>
                                        <option value="">Select Country...</option>
                                        {countries.map(c => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
                                    </Input>
                                </div>
                                <div className="mt-4">
                                    <label className="flex items-center space-x-2 text-sm text-slate-600 mb-4 cursor-pointer">
                                        <input type="checkbox" checked={isBillingSameAsPhysical} onChange={e => setIsBillingSameAsPhysical(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                        <span>Billing Address same as Physical</span>
                                    </label>
                                    {!isBillingSameAsPhysical && (
                                         <Input label="Billing Address" id="billingAddress" value={formData.billingAddress?.building} onChange={e => handleAddressChange('billingAddress', 'building', e.target.value)} className={inputStyles} />
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-slate-700 mb-4 bg-slate-50 p-2 rounded">Contact Person</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Full Name" id="primaryContactName" value={formData.primaryContact?.name} onChange={e => handleInputChange('primaryContact', 'name', e.target.value)} required className={inputStyles} error={errors.primaryContactName} />
                                    <Input label="Title" id="primaryContactTitle" value={formData.primaryContact?.title} onChange={e => handleInputChange('primaryContact', 'title', e.target.value)} className={inputStyles} />
                                    <Input label="Mobile" id="primaryMobile" type="tel" value={formData.primaryContact?.mobile} onChange={e => handleInputChange('primaryContact', 'mobile', e.target.value)} required className={inputStyles} error={errors.primaryMobile} />
                                    <Input label="Email" id="primaryEmail" type="email" value={formData.primaryContact?.email} onChange={e => handleInputChange('primaryContact', 'email', e.target.value)} required error={errors.primaryContactEmail} />
                                    <Input label="Website" id="website" type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 4: FINANCIALS */}
                    {activeSection === 'finance' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Financial Configuration</h3>
                            
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                 <h4 className="font-bold text-blue-800 text-sm uppercase mb-3">Trading Currency</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                     <Input as="select" id="currencyContinent" label="1. Continent" value={currencyContinent} onChange={e => {setCurrencyContinent(e.target.value); setCurrencyCountry(''); }}>
                                         <option value="">Select...</option>
                                         {uniqueContinents.map(c => <option key={c} value={c}>{c}</option>)}
                                     </Input>
                                     <Input as="select" id="currencyCountry" label="2. Country" value={currencyCountry} onChange={handleCurrencySelection} disabled={!currencyContinent}>
                                         <option value="">Select...</option>
                                         {countries.filter(c => c.continent === currencyContinent).map(c => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
                                     </Input>
                                     <div className="p-2 bg-white rounded border text-center h-[42px] flex flex-col justify-center">
                                         <p className="font-bold text-lg leading-none">{formData.currency?.code || '-'}</p>
                                         <p className="text-[10px] text-slate-500">{formData.currency?.name}</p>
                                     </div>
                                 </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input label="Bank Name" id="bankName" value={formData.banking?.bankName} onChange={e => handleInputChange('banking', 'bankName', e.target.value)} required className={inputStyles} error={errors.bankName}/>
                                <Input label="Account Number" id="accountNumber" value={formData.banking?.accountNumber} onChange={e => handleInputChange('banking', 'accountNumber', e.target.value)} required className={inputStyles} />
                                <Input label="SWIFT Code" id="swiftCode" value={formData.banking?.swiftCode} onChange={e => handleInputChange('banking', 'swiftCode', e.target.value)} className={inputStyles} />
                                <Input label="Payment Terms" id="paymentTerms" value={formData.banking?.paymentTerms} onChange={e => handleInputChange('banking', 'paymentTerms', e.target.value)} className={inputStyles} />
                                <Input label="Credit Limit" id="creditLimit" type="number" value={formData.banking?.creditLimit} onChange={e => handleInputChange('banking', 'creditLimit', e.target.value)} />
                                <Input label="Default Incoterm" id="defaultIncoterm" value={formData.defaultIncoterm || ''} onChange={e => setFormData({...formData, defaultIncoterm: e.target.value.toUpperCase()})} className={inputStyles} />
                            </div>
                        </div>
                    )}

                    {/* SECTION 5: COMPLIANCE & DOCS */}
                    {activeSection === 'compliance' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Compliance & Attachments</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <Input label="Tax Clearance Expiry" id="taxExpiry" type="date" value={formData.taxClearanceExpiry || ''} onChange={e => setFormData({...formData, taxClearanceExpiry: e.target.value})} />
                                <Input label="Insurance Expiry" id="insExpiry" type="date" value={formData.insuranceExpiry || ''} onChange={e => setFormData({...formData, insuranceExpiry: e.target.value})} />
                                <Input as="select" label="Risk Rating" id="riskRating" value={formData.riskRating} onChange={e => setFormData({...formData, riskRating: e.target.value})}>
                                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                                </Input>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                <div>
                                     <h4 className="font-bold text-slate-700 mb-3 uppercase text-sm border-b pb-1">Mandatory Documents</h4>
                                     <div className="space-y-1">
                                        {mandatoryAttachmentFields.map(field => (
                                            <FileInput key={field.id} label={field.label} id={field.id} inputRef={el => mandatoryAttachmentsRef.current[field.id] = el} />
                                        ))}
                                     </div>
                                </div>
                                <div>
                                     <h4 className="font-bold text-slate-700 mb-3 uppercase text-sm border-b pb-1">Optional Documents</h4>
                                     <div className="space-y-1">
                                        {optionalAttachmentFields.map(field => (
                                            <FileInput key={field.id} label={field.label} id={field.id} isOptional inputRef={el => optionalAttachmentsRef.current[field.id] = el} />
                                        ))}
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default NewVendorTab;
