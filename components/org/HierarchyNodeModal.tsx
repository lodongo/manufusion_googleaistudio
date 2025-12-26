import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, MemsSection, Organisation, InventoryData, ProcurementData } from '../../types';
import type { ProcurementCategory, ProcurementSubcategory, ProcurementComponent, ComponentAttribute } from '../../types/pr_types';
import Modal from '../common/Modal';
import Input from '../Input';
import Button from '../Button';
import { addLog } from '../../services/logger';

const { Timestamp } = firebase.firestore;

export interface HierarchyNode {
  id?: string;
  path?: string;
  name: string;
  code: string;
  description: string;
  createdBy: { uid: string; email: string };
  createdAt: string;
  sectionType?: string;
  // asset-specific fields
  assetType?: string; 
  assetComponentPath?: string; 
  assetAttributes?: Record<string, any>;
  // Material Master Data fields
  inventoryData?: InventoryData;
  procurementData?: ProcurementData;
}

interface HierarchyNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionPath: string;
  nodeToEdit?: HierarchyNode | null;
  parentCode?: string | null;
  level: number;
  currentUser: AppUser;
  orgDomain: string;
  theme: Organisation['theme'];
}

export const levelInfo: Record<number, { name: string; description: string }> = {
  1: { name: 'Country/Region', description: 'A major geographical area of operation, like a country or a sales region.' },
  2: { name: 'Legal Entity', description: 'A distinct company or legal entity registered within a Country/Region.' },
  3: { name: 'Site', description: 'A specific physical location, such as a factory, warehouse, or main office.' },
  4: { name: 'Department', description: 'A major functional division within a Site, like Production, QA, or Maintenance.' },
  5: { name: 'Section', description: 'A sub-unit within a Department, for example, "Assembly Line A" or "Receiving Bay".' },
  6: { name: 'Asset', description: 'A significant piece of machinery or a distinct asset within a Section.' },
  7: { name: 'Assembly', description: 'A sub-assembly or major component of a piece of an Asset.' },
};

const HierarchyNodeModal: React.FC<HierarchyNodeModalProps> = ({ isOpen, onClose, collectionPath, nodeToEdit, parentCode, level, currentUser, orgDomain, theme }) => {
  const [formData, setFormData] = useState({ name: '', description: '', sectionType: '' });
  const [codeSuffix, setCodeSuffix] = useState('');
  const [parentPrefix, setParentPrefix] = useState('');
  const [siblingCodes, setSiblingCodes] = useState<string[]>([]);
  const [sectionTypes, setSectionTypes] = useState<MemsSection[]>([]);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // New state for asset creation (level 6)
  const [assetState, setAssetState] = useState<{
    categories: ProcurementCategory[];
    subcategories: ProcurementSubcategory[];
    components: (ProcurementComponent & { path: string })[];
    selectedCategoryCode: string;
    selectedSubcategoryCode: string;
    selectedComponentCode: string;
    selectedComponent: (ProcurementComponent & { path: string }) | null;
    attributesFormData: Record<string, any>;
    loading: { categories: boolean; subcategories: boolean; components: boolean; };
  }>({
    categories: [], subcategories: [], components: [],
    selectedCategoryCode: '', selectedSubcategoryCode: '', selectedComponentCode: '',
    selectedComponent: null, attributesFormData: {},
    loading: { categories: false, subcategories: false, components: false },
  });

  const isEditing = !!nodeToEdit;
  const { name: levelName, description: levelDescription } = levelInfo[level] || { name: 'Item', description: 'A standard item.'};

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setErrors({});

    const fetchSiblings = async () => {
        if (!collectionPath) return [];
        const siblingsRef = db.collection(collectionPath);
        const snapshot = await siblingsRef.get();
        const codes = snapshot.docs.map(doc => doc.data().code as string);
        setSiblingCodes(codes);
        return codes;
    };
    
    fetchSiblings().then(codes => {
        if (isEditing && nodeToEdit) {
            const code = nodeToEdit.code || '';
            const prefix = parentCode || '';
            const suffix = code.substring(prefix.length);
            
            setParentPrefix(prefix);
            setCodeSuffix(suffix);
            setFormData({ name: nodeToEdit.name, description: nodeToEdit.description, sectionType: nodeToEdit.sectionType || '' });
            if (level === 6 && nodeToEdit.assetAttributes) {
                setAssetState(prev => ({ ...prev, attributesFormData: nodeToEdit.assetAttributes || {} }));
            }
        } else {
            setParentPrefix(parentCode || '');
            setFormData({ name: '', description: '', sectionType: '' });

            const numericSuffixes = codes
                .map(c => c.substring(parentCode?.length || 0))
                .filter(s => /^\d{3}$/.test(s))
                .map(s => parseInt(s, 10));
            const maxNum = numericSuffixes.length > 0 ? Math.max(...numericSuffixes) : 0;
            const suggestedSuffix = (maxNum + 1).toString().padStart(3, '0');
            setCodeSuffix(suggestedSuffix);
        }
        setIsLoading(false);
    });

    if (level === 5) {
        setAssetState(prev => ({ ...prev, loading: { ...prev.loading, categories: true }}));
        const fetchSectionTypes = async () => {
            const sectionsRef = db.collection('settings/memsSetup/sections');
            const q = sectionsRef.orderBy('name');
            const snapshot = await q.get();
            setSectionTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MemsSection)));
            setAssetState(prev => ({ ...prev, loading: { ...prev.loading, categories: false }}));
        };
        fetchSectionTypes();
    }
    
    if (level === 6 && !isEditing) {
        setAssetState(prev => ({...prev, loading: {...prev.loading, categories: true}}));
        const fetchAssetCategories = async () => {
            const catRef = db.collection('modules/PR/Classifications/CI/Categories');
            const q = catRef.where('enabled', '==', true).orderBy('name');
            const snapshot = await q.get();
            const cats = snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementCategory));
            setAssetState(prev => ({ ...prev, categories: cats, loading: {...prev.loading, categories: false} }));
        };
        fetchAssetCategories();
    }
  }, [isOpen, nodeToEdit, parentCode, collectionPath, level, isEditing]);

  // Asset selection cascade effects
  useEffect(() => {
    if (!assetState.selectedCategoryCode) {
        setAssetState(p => ({ ...p, subcategories: [], components: [], selectedSubcategoryCode: '', selectedComponentCode: '', selectedComponent: null }));
        return;
    };
    setAssetState(prev => ({...prev, subcategories: [], components: [], selectedSubcategoryCode: '', selectedComponentCode: '', selectedComponent: null, loading: {...prev.loading, subcategories: true}}));
    const fetchSubcategories = async () => {
        const subcatRef = db.collection('modules/PR/Classifications/CI/Categories').doc(assetState.selectedCategoryCode).collection('Subcategories');
        const q = subcatRef.where('enabled', '==', true).orderBy('name');
        const snapshot = await q.get();
        const subcats = snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementSubcategory));
        setAssetState(prev => ({ ...prev, subcategories: subcats, loading: {...prev.loading, subcategories: false} }));
    };
    fetchSubcategories();
  }, [assetState.selectedCategoryCode]);

  useEffect(() => {
    if (!assetState.selectedSubcategoryCode) {
        setAssetState(p => ({...p, components: [], selectedComponentCode: '', selectedComponent: null }));
        return;
    };
     setAssetState(prev => ({...prev, components: [], selectedComponentCode: '', selectedComponent: null, loading: {...prev.loading, components: true}}));
    const fetchComponents = async () => {
        const compRef = db.collection('modules/PR/Classifications/CI/Categories').doc(assetState.selectedCategoryCode).collection('Subcategories').doc(assetState.selectedSubcategoryCode).collection('Components');
        const q = compRef.where('enabled', '==', true).orderBy('name');
        const snapshot = await q.get();
        const comps = snapshot.docs.map(doc => ({ code: doc.id, path: doc.ref.path, ...doc.data() } as ProcurementComponent & { path: string }));
        setAssetState(prev => ({ ...prev, components: comps, loading: {...prev.loading, components: false} }));
    };
    fetchComponents();
  }, [assetState.selectedSubcategoryCode]);

  useEffect(() => {
    if (!assetState.selectedComponentCode) {
        setAssetState(prev => ({ ...prev, selectedComponent: null, attributesFormData: {} }));
        return;
    };
    const component = assetState.components.find(c => c.code === assetState.selectedComponentCode) || null;
    setAssetState(prev => ({ ...prev, selectedComponent: component, attributesFormData: {} }));
    if(component) {
        setFormData(prev => ({...prev, name: component.name, description: component.description }));
    }
  }, [assetState.selectedComponentCode, assetState.components]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!codeSuffix.trim()) newErrors.code = 'Code suffix is required.';
    else if (codeSuffix.length > 3) newErrors.code = 'Code suffix cannot exceed 3 characters.';
    else if (!/^[A-Z0-9]+$/.test(codeSuffix)) newErrors.code = 'Code can only contain uppercase letters and numbers.';
    
    const fullCode = `${parentPrefix}${codeSuffix}`;
    if ((!isEditing || (isEditing && nodeToEdit?.code !== fullCode)) && siblingCodes.includes(fullCode)) {
        newErrors.code = `Code "${fullCode}" already exists at this level.`;
    }

    if (level === 5 && !formData.sectionType) newErrors.sectionType = 'Section type is required.';

    if (level === 6 && !isEditing) {
        if (!assetState.selectedComponent) newErrors.component = 'You must select an asset component.';
        assetState.selectedComponent?.attributes.forEach(attr => {
            if (attr.isRequired && !assetState.attributesFormData[attr.name]) {
                newErrors[`attr_${attr.name}`] = `${attr.name} is a required attribute.`;
            }
        });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    
    const fullCode = `${parentPrefix}${codeSuffix}`;

    try {
      const dataToSave: Partial<HierarchyNode> = {
        name: formData.name,
        code: fullCode,
        description: formData.description,
      };

      if (level === 5) dataToSave.sectionType = formData.sectionType;

      if (level === 6 && !isEditing && assetState.selectedComponent) {
          dataToSave.assetType = assetState.selectedComponent.name;
          dataToSave.assetComponentPath = assetState.selectedComponent.path;
          dataToSave.assetAttributes = assetState.attributesFormData;
      }

      if (isEditing && nodeToEdit?.id) {
        const docRef = db.collection(collectionPath).doc(nodeToEdit.id);
        await docRef.update(dataToSave);
        await addLog({ action: 'Hierarchy Node Updated', performedBy: { uid: currentUser.uid, email: currentUser.email }, details: `Updated Level ${level} node "${formData.name}" in ${orgDomain}.`});
      } else {
        const payload: HierarchyNode = {
          ...dataToSave,
          name: dataToSave.name!, code: dataToSave.code!, description: dataToSave.description!,
          createdBy: { uid: currentUser.uid, email: currentUser.email },
          createdAt: new Date().toISOString(),
        };
        await db.collection(collectionPath).add(payload);
        await addLog({ action: 'Hierarchy Node Created', performedBy: { uid: currentUser.uid, email: currentUser.email }, details: `Created Level ${level} node "${formData.name}" in ${orgDomain}.`});
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving hierarchy node:', err);
      setErrors({ form: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAttributeFormChange = (attrName: string, value: any) => {
      setAssetState(prev => ({
          ...prev,
          attributesFormData: {
              ...prev.attributesFormData,
              [attrName]: value,
          }
      }));
  };

  const renderStandardForm = () => (
    <div className="space-y-4">
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            <strong>Guide:</strong> {levelDescription}
        </div>
        <Input
          id="name"
          label={`${levelName} Name`}
          value={formData.name}
          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          error={errors.name}
          required
        />
        <div>
            <label className="block text-sm font-medium text-gray-700">Code</label>
            <div className="mt-1 flex items-stretch gap-0">
                {parentPrefix && <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-500 font-mono text-sm">{parentPrefix}</span>}
                <Input id="code" label="" value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} error={errors.code} required maxLength={3} containerClassName="flex-grow" />
            </div>
        </div>

        {level === 5 && (
            <div>
                <label htmlFor="sectionType" className="block text-sm font-medium text-gray-700">Section Type</label>
                <select id="sectionType" value={formData.sectionType} onChange={(e) => setFormData(p => ({ ...p, sectionType: e.target.value }))} disabled={assetState.loading.categories} required className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.sectionType ? 'border-red-500' : ''}`}>
                    <option value="">{assetState.loading.categories ? 'Loading types...' : 'Select a type...'}</option>
                    {sectionTypes.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}
                </select>
                {errors.sectionType && <p className="mt-2 text-xs text-red-600">{errors.sectionType}</p>}
            </div>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea id="description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={4} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
    </div>
  );

  const renderAssetForm = () => {
    if (isEditing && nodeToEdit) {
        return (
            <div className="space-y-4">
                 <Input id="name" label={`${levelName} Name`} value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} error={errors.name} required />
                 {/* Code and description fields from standard form */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">Code</label>
                    <div className="mt-1 flex items-stretch gap-0">
                        {parentPrefix && <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-500 font-mono text-sm">{parentPrefix}</span>}
                        <Input id="code" label="" value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} error={errors.code} required maxLength={3} containerClassName="flex-grow" />
                    </div>
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea id="description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-800">Asset Information (Read-Only)</h4>
                    <p className="text-sm text-gray-600"><strong>Type:</strong> {nodeToEdit.assetType}</p>
                    <ul className="list-disc list-inside mt-2 text-sm text-gray-700">
                        {Object.entries(nodeToEdit.assetAttributes || {}).map(([key, value]) => (
                            <li key={key}><strong>{key}:</strong> {String(value)}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
             <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                <strong>Guide:</strong> Select an asset type from the Capital Investment catalog. This will generate a form for its specific attributes.
            </div>
            {/* Step 1: Category */}
            <div>
                <label htmlFor="assetCategory" className="block text-sm font-medium text-gray-700">1. Select Asset Category</label>
                <select id="assetCategory" value={assetState.selectedCategoryCode} onChange={e => setAssetState(p => ({...p, selectedCategoryCode: e.target.value}))} disabled={assetState.loading.categories} className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md">
                    <option value="">{assetState.loading.categories ? 'Loading...' : 'Select Category...'}</option>
                    {assetState.categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {!assetState.loading.categories && assetState.categories.length === 0 && (
                    <p className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md">
                        No asset categories found. An administrator must seed the "Capital Investment" classification data in <strong className="font-semibold">Admin Dashboard &gt; Modules &gt; Procurement (Setup)</strong>.
                    </p>
                )}
            </div>
            {/* Step 2: Subcategory */}
            {assetState.selectedCategoryCode && (
                <div>
                    <label htmlFor="assetSubcategory" className="block text-sm font-medium text-gray-700">2. Select Subcategory</label>
                    <select id="assetSubcategory" value={assetState.selectedSubcategoryCode} onChange={e => setAssetState(p => ({...p, selectedSubcategoryCode: e.target.value}))} disabled={assetState.loading.subcategories} className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md">
                        <option value="">{assetState.loading.subcategories ? 'Loading...' : 'Select Subcategory...'}</option>
                        {assetState.subcategories.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                </div>
            )}
            {/* Step 3: Component */}
            {assetState.selectedSubcategoryCode && (
                <div>
                    <label htmlFor="assetComponent" className="block text-sm font-medium text-gray-700">3. Select Asset Component</label>
                    <select id="assetComponent" value={assetState.selectedComponentCode} onChange={e => setAssetState(p => ({...p, selectedComponentCode: e.target.value}))} disabled={assetState.loading.components} className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md">
                        <option value="">{assetState.loading.components ? 'Loading...' : 'Select Component...'}</option>
                        {assetState.components.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    {errors.component && <p className="mt-2 text-xs text-red-600">{errors.component}</p>}
                </div>
            )}

            {assetState.selectedComponent && (
                <div className="pt-4 mt-4 border-t space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Asset Details</h3>
                    {renderStandardForm()}

                    <div className="pt-4 border-t">
                        <h4 className="text-md font-semibold text-gray-800 mb-2">Attributes for {assetState.selectedComponent.name}</h4>
                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                           {assetState.selectedComponent.attributes.map((attr, index) => {
                               const inputId = `attr_${index}_${attr.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                               const errorId = `attr_${attr.name}`;
                               const inputProps: any = { id: inputId, label: `${attr.name}${attr.unit ? ` (${attr.unit})` : ''}`, value: assetState.attributesFormData[attr.name] || '', onChange: (e: any) => handleAttributeFormChange(attr.name, e.target.type === 'checkbox' ? e.target.checked : e.target.value), required: attr.isRequired, error: errors[errorId]};
                               
                               if (attr.dataType === 'dropdown' && attr.options?.length === 2 && attr.options.includes('Yes') && attr.options.includes('No')) {
                                   return (<div key={inputId} className={`flex items-center pt-6 ${attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''}`}>
                                       <input type="checkbox" id={inputId} checked={assetState.attributesFormData[attr.name] === 'Yes'} onChange={e => handleAttributeFormChange(attr.name, e.target.checked ? 'Yes' : 'No')} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                       <label htmlFor={inputId} className="ml-2 block text-sm font-medium text-slate-700">{attr.name}{attr.isRequired && <span className="text-red-500 ml-1">*</span>}</label>
                                   </div>)
                               }

                               if (attr.dataType === 'dropdown' || attr.dataType === 'multiselect') {
                                   return <Input as="select" {...inputProps} key={inputId} containerClassName={attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''}><option value="">Select...</option>{(attr.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}</Input>;
                               }
                               return <Input type={attr.dataType as any} {...inputProps} key={inputId} containerClassName={attr.isRequired ? 'border-l-2 border-red-500 pl-2' : ''} />;
                           })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} ${levelName}`} size={level === 6 ? '5xl' : undefined}>
      <div className="space-y-4">
        {level === 6 ? renderAssetForm() : renderStandardForm()}
        
        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} isLoading={isLoading} style={{ backgroundColor: theme.colorPrimary }}>
            {isEditing ? 'Save Changes' : `Add ${levelName}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default HierarchyNodeModal;