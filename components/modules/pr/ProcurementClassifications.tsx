
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, query, orderBy, getDocs, setDoc, WriteBatch } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { ProcurementClassification, ProcurementCategory, ProcurementSubcategory, ProcurementComponent, ComponentAttribute, AttributeType } from '../../../types/pr_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import ProcurementCategoryModal from './ProcurementCategoryModal';
// FIX: Module '"file:///components/modules/pr/ProcurementSubcategoryModal"' has no default export.
import { ProcurementSubcategoryModal } from './ProcurementSubcategoryModal';
// FIX: Changed import to be a named import to resolve "no default export" error.
import { ProcurementComponentModal } from './ProcurementComponentModal';
import { defaultServices } from '../../../constants/procurement_services';
import { defaultGoods } from '../../../constants/procurement_goods';
// FIX: The constants were missing from the provided file content for procurement_capex. They are stubbed here to resolve the error.
import { 
    CI_UTIL_Thermal,
    CI_UTIL_Air,
    CI_UTIL_Gas,
    CI_UTIL_Water,
    CI_UTIL_Energy,
    CI_BLDG_MEP,
    CI_ROAD_Infra,
    CI_RAIL_Systems,
    CI_AIRPORTS_PORTS,
    CI_ENERGY_Gen,
    CI_PROCESS_Deep,
    CI_PHARMA_A,
    CI_PHARMA_B,
} from '../../../constants/procurement_capex';


// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const defaultClassifications: Omit<ProcurementClassification, 'code'>[] = [
    { name: 'Goods and Supplies', description: 'Procurement of tangible items, including raw materials, MRO supplies, and finished products.' },
    { name: 'Services', description: 'Procurement of professional, technical, or facility services from external providers.' },
    { name: 'Capital Investment', description: 'Procurement of major long-term assets, such as machinery, buildings, or large-scale technology infrastructure.' },
];
const classificationCodes = {
    'Goods and Supplies': 'GS',
    'Services': 'SV',
    'Capital Investment': 'CI'
};

type ItemToDelete = { type: 'category', data: ProcurementCategory, parentId: string } |
                    { type: 'subcategory', data: ProcurementSubcategory, parentId: string, grandParentId: string } |
                    { type: 'component', data: ProcurementComponent, parentId: string, grandParentId: string, greatGrandParentId: string };


const ProcurementClassifications: React.FC = () => {
    const [classifications, setClassifications] = useState<ProcurementClassification[]>([]);
    const [categories, setCategories] = useState<Record<string, ProcurementCategory[]>>({});
    const [subcategories, setSubcategories] = useState<Record<string, ProcurementSubcategory[]>>({});
    const [components, setComponents] = useState<Record<string, ProcurementComponent[]>>({});
    
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState<Record<string, boolean>>({});
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

    // Modal States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
    const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    
    const [selectedClassification, setSelectedClassification] = useState<ProcurementClassification | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ProcurementCategory | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<ProcurementSubcategory | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<ProcurementComponent | null>(null);
    const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

    const classificationsRef = collection(db, 'modules/PR/Classifications');

    useEffect(() => {
        const q = query(classificationsRef, orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setClassifications(snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementClassification)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const toggleAccordion = useCallback(async (code: string, level: 'classification' | 'category' | 'subcategory' | 'component', parentIds?: { classification?: string; category?: string; subcategory?: string }) => {
        const isOpen = !openAccordions[code];
        setOpenAccordions(prev => ({ ...prev, [code]: isOpen }));

        if (!isOpen) return;

        if (level === 'classification' && !categories[code]) {
            const categoriesRef = collection(classificationsRef, code, 'Categories');
            onSnapshot(query(categoriesRef, orderBy('name')), (snapshot) => {
                setCategories(prev => ({ ...prev, [code]: snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementCategory)) }));
            });
        }

        if (level === 'category' && parentIds?.classification && !subcategories[code]) {
            const subcategoriesRef = collection(classificationsRef, parentIds.classification, 'Categories', code, 'Subcategories');
            onSnapshot(query(subcategoriesRef, orderBy('name')), (snapshot) => {
                setSubcategories(prev => ({ ...prev, [code]: snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementSubcategory)) }));
            });
        }
        
        if (level === 'subcategory' && parentIds?.classification && parentIds?.category && !components[code]) {
            const componentsRef = collection(classificationsRef, parentIds.classification, 'Categories', parentIds.category, 'Subcategories', code, 'Components');
            onSnapshot(query(componentsRef, orderBy('name')), (snapshot) => {
                setComponents(prev => ({ ...prev, [code]: snapshot.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementComponent)) }));
            });
        }
    }, [openAccordions, categories, subcategories, components]);

    const handleSeedData = async (classification: ProcurementClassification) => {
        setIsSeeding(prev => ({ ...prev, [classification.code]: true }));
        try {
            let dataToSeed;

            const flattenAttributes = (attributes: any[], prefix = ''): ComponentAttribute[] => {
                return attributes.flatMap(attr => {
                    const name = prefix ? `${prefix} - ${attr.name}` : attr.name;
                    if (attr.dataType === 'object' && attr.fields) {
                        return flattenAttributes(attr.fields, name);
                    } else {
                        let dataType: AttributeType = 'text';
                        if (attr.dataType === 'number') {
                            dataType = 'number';
                        } else if (['dropdown', 'boolean', 'multiselect'].includes(attr.dataType)) {
                            dataType = 'dropdown';
                        }
            
                        let options = attr.options;
                        if (attr.dataType === 'boolean') {
                            options = ['Yes', 'No'];
                        }
            
                        const newAttr: ComponentAttribute = {
                            name,
                            dataType,
                            isRequired: attr.isRequired,
                        };
            
                        if (options !== undefined) {
                            newAttr.options = options;
                        }
                        if (attr.unit !== undefined) {
                            newAttr.unit = attr.unit;
                        }
            
                        return [newAttr];
                    }
                });
            };

            const transformCapexData = (rawCapexCategory: any) => {
                return {
                    ...rawCapexCategory,
                    subcategories: rawCapexCategory.subcategories.map((sub: any) => ({
                        ...sub,
                        components: (sub.installations || []).map((inst: any) => ({
                            ...inst,
                            attributes: flattenAttributes(inst.attributes),
                        })),
                    })),
                };
            };

            if (classification.code === 'GS') dataToSeed = defaultGoods;
            else if (classification.code === 'SV') dataToSeed = defaultServices;
            else if (classification.code === 'CI') {
                const allCapexCategories = [
                    CI_UTIL_Thermal,
                    CI_UTIL_Air,
                    CI_UTIL_Gas,
                    CI_UTIL_Water,
                    CI_UTIL_Energy,
                    CI_BLDG_MEP,
                    CI_ROAD_Infra,
                    CI_RAIL_Systems,
                    CI_AIRPORTS_PORTS,
                    CI_ENERGY_Gen,
                    CI_PROCESS_Deep,
                    CI_PHARMA_A,
                    CI_PHARMA_B,
                ];
                dataToSeed = allCapexCategories.map(cat => transformCapexData(cat));
            }
            else return;
            
            const batch = writeBatch(db);
            const categoriesRef = collection(classificationsRef, classification.code, 'Categories');

            for (const categoryData of dataToSeed) {
                const categoryRef = doc(categoriesRef, categoryData.code);
                batch.set(categoryRef, { name: categoryData.name, description: categoryData.description, enabled: true });

                for (const subcategoryData of (categoryData.subcategories || [])) {
                    const subcategoryRef = doc(collection(categoryRef, 'Subcategories'), subcategoryData.code);
                    batch.set(subcategoryRef, { name: subcategoryData.name, description: subcategoryData.description, enabled: subcategoryData.enabled });

                    if ('components' in subcategoryData) {
                        for (const componentData of (subcategoryData.components || [])) {
                            const componentRef = doc(collection(subcategoryRef, 'Components'), componentData.code);
                            batch.set(componentRef, {
                                name: componentData.name,
                                description: componentData.description,
                                enabled: componentData.enabled,
                                attributes: componentData.attributes
                            });
                        }
                    }
                }
            }
            await batch.commit();
        } catch (error) {
            console.error(`Error seeding ${classification.name}:`, error);
        } finally {
            setIsSeeding(prev => ({ ...prev, [classification.code]: false }));
        }
    };
    
    const handleSaveCategory = async (data: Omit<ProcurementCategory, 'code'>, code: string) => {
        if (!selectedClassification) return;
        await setDoc(doc(classificationsRef, selectedClassification.code, 'Categories', code), data);
    };

    const handleSaveSubcategory = async (data: Omit<ProcurementSubcategory, 'code'>, code: string) => {
        if (!selectedClassification || !selectedCategory) return;
        await setDoc(doc(classificationsRef, selectedClassification.code, 'Categories', selectedCategory.code, 'Subcategories', code), data);
    };

    const handleSaveComponent = async (data: Omit<ProcurementComponent, 'code'>, code: string) => {
        if (!selectedClassification || !selectedCategory || !selectedSubcategory) return;
        await setDoc(doc(classificationsRef, selectedClassification.code, 'Categories', selectedCategory.code, 'Subcategories', selectedSubcategory.code, 'Components', code), data);
    };

    const deleteCollection = async (batch: WriteBatch, collectionPath: string) => {
        const snapshot = await getDocs(query(collection(db, collectionPath)));
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    };
    
    const handleDelete = async () => {
        if (!itemToDelete) return;

        const { type, data } = itemToDelete;
        const batch = writeBatch(db);

        try {
            if (type === 'component') {
                const { greatGrandParentId, grandParentId, parentId } = itemToDelete;
                batch.delete(doc(classificationsRef, greatGrandParentId, 'Categories', grandParentId, 'Subcategories', parentId, 'Components', data.code));
            } else if (type === 'subcategory') {
                const { grandParentId, parentId } = itemToDelete;
                const componentsPath = `modules/PR/Classifications/${grandParentId}/Categories/${parentId}/Subcategories/${data.code}/Components`;
                await deleteCollection(batch, componentsPath);
                batch.delete(doc(classificationsRef, grandParentId, 'Categories', parentId, 'Subcategories', data.code));
            } else if (type === 'category') {
                const { parentId } = itemToDelete;
                const subcategoriesRef = collection(classificationsRef, parentId, 'Categories', data.code, 'Subcategories');
                const subcategoriesSnap = await getDocs(query(subcategoriesRef));
                for (const subDoc of subcategoriesSnap.docs) {
                    const componentsPath = subDoc.ref.path + '/Components';
                    await deleteCollection(batch, componentsPath);
                    batch.delete(subDoc.ref);
                }
                batch.delete(doc(classificationsRef, parentId, 'Categories', data.code));
            }

            await batch.commit();
        } catch (error) {
            console.error("Cascading delete failed:", error);
        } finally {
            setIsConfirmModalOpen(false);
            setItemToDelete(null);
        }
    };

    const handleSeedClassifications = async () => {
        setIsSeeding(prev => ({...prev, root: true}));
        const batch = writeBatch(db);
        defaultClassifications.forEach(c => {
            const code = classificationCodes[c.name as keyof typeof classificationCodes];
            batch.set(doc(classificationsRef, code), c)
        });
        await batch.commit();
        setIsSeeding(prev => ({...prev, root: false}));
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return <Button onClick={handleSeedClassifications} isLoading={isSeeding['root']}>Seed Top-Level Classifications</Button>;

    const renderAttributeTable = (component: ProcurementComponent) => (
        <div className="p-3 bg-gray-50 border-t">
            <h5 className="text-sm font-semibold text-gray-600 mb-2">Attributes:</h5>
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Details</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500">Required</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {component.attributes.map(attr => (
                        <tr key={attr.name}>
                            <td className="px-3 py-2 font-medium text-gray-800">{attr.name}</td>
                            <td className="px-3 py-2 text-gray-600 capitalize">{attr.dataType}</td>
                            <td className="px-3 py-2 text-gray-600">
                                {attr.dataType === 'dropdown' && `Options: ${attr.options?.join(', ')}`}
                                {attr.dataType === 'number' && attr.unit && `Unit: ${attr.unit}`}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">{attr.isRequired ? 'Yes' : 'No'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-4">
            {classifications.map(c => (
                <div key={c.code} className="border border-gray-200 rounded-lg">
                    <div className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100">
                        <button onClick={() => toggleAccordion(c.code, 'classification')} className="flex-1 flex items-center text-left focus:outline-none">
                            <h3 className="font-bold text-lg text-gray-800">{c.name} <span className="text-gray-400 font-mono text-sm">({c.code})</span></h3>
                            <div className={`ml-4 ${openAccordions[c.code] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                        </button>
                        <Button onClick={() => { setSelectedClassification(c); setSelectedCategory(null); setIsCategoryModalOpen(true); }} className="!py-1 !px-3 text-xs">Add Category</Button>
                    </div>

                    {openAccordions[c.code] && (
                        <div className="p-4 space-y-2">
                            {categories[c.code] === undefined ? <div className="p-4 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>
                            : categories[c.code].length === 0 ? (
                                <div className="text-center p-4 bg-gray-50 rounded-md">
                                    <p className="text-gray-600 mb-3">No categories found for {c.name}.</p>
                                    <Button onClick={() => handleSeedData(c)} isLoading={isSeeding[c.code]}>Seed Default {c.name}</Button>
                                </div>
                            ) : (
                                categories[c.code].map(cat => (
                                    <div key={cat.code} className="border border-gray-200 rounded-md ml-4">
                                        <div className="w-full flex justify-between items-center p-3 bg-white hover:bg-gray-50">
                                            <button onClick={() => toggleAccordion(cat.code, 'category', { classification: c.code })} className="flex-1 flex items-center text-left focus:outline-none">
                                                <h4 className="font-semibold text-gray-700">{cat.name} <span className="text-gray-400 font-mono text-xs">({cat.code})</span></h4>
                                                <div className={`ml-3 text-gray-400 ${openAccordions[cat.code] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                                            </button>
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => { setSelectedClassification(c); setSelectedCategory(cat); setSelectedSubcategory(null); setIsSubcategoryModalOpen(true); }} className="!py-1 !px-2 text-xs">Add Sub</Button>
                                                <button onClick={() => { setSelectedClassification(c); setSelectedCategory(cat); setIsCategoryModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                                <button onClick={() => { setItemToDelete({ type: 'category', data: cat, parentId: c.code }); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                            </div>
                                        </div>
                                        {openAccordions[cat.code] && (
                                            <div className="p-3 border-t bg-gray-50/50 space-y-1">
                                                {subcategories[cat.code] === undefined ? <p className="p-2 text-xs text-gray-500">Loading...</p>
                                                : subcategories[cat.code].length === 0 ? <p className="p-2 text-sm text-gray-500">No subcategories defined.</p>
                                                : (
                                                    subcategories[cat.code].map(sub => (
                                                        <div key={sub.code} className="border border-gray-200 rounded-md ml-4">
                                                            <div className="w-full flex justify-between items-center p-2 bg-white hover:bg-gray-50">
                                                                <button onClick={() => toggleAccordion(sub.code, 'subcategory', { classification: c.code, category: cat.code })} className="flex-1 flex items-center text-left focus:outline-none">
                                                                    <p className="text-sm font-medium text-gray-800">{sub.name} <span className="text-gray-400 font-mono text-xs">({sub.code})</span></p>
                                                                    {(c.code === 'GS' || c.code === 'CI') && <div className={`ml-3 text-gray-400 ${openAccordions[sub.code] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>}
                                                                </button>
                                                                <div className="flex items-center space-x-1">
                                                                    {(c.code === 'GS' || c.code === 'CI') && <Button onClick={() => { setSelectedClassification(c); setSelectedCategory(cat); setSelectedSubcategory(sub); setSelectedComponent(null); setIsComponentModalOpen(true); }} className="!py-1 !px-2 text-xs">Add Comp</Button>}
                                                                    <button onClick={() => { setSelectedClassification(c); setSelectedCategory(cat); setSelectedSubcategory(sub); setIsSubcategoryModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                                                    <button onClick={() => { setItemToDelete({ type: 'subcategory', data: sub, parentId: cat.code, grandParentId: c.code }); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                                                </div>
                                                            </div>
                                                            {(c.code === 'GS' || c.code === 'CI') && openAccordions[sub.code] && (
                                                                <div className="p-2 border-t bg-gray-50/50 space-y-1">
                                                                    {components[sub.code] === undefined ? <p className="p-1 text-xs text-gray-500">Loading...</p>
                                                                    : components[sub.code].length === 0 ? <p className="p-1 text-sm text-gray-500">No components defined.</p>
                                                                    : components[sub.code].map(comp => (
                                                                        <div key={comp.code} className="border border-gray-200 rounded-md ml-4">
                                                                            <div className="w-full flex justify-between items-center p-2 bg-white hover:bg-gray-50">
                                                                                <button onClick={() => toggleAccordion(comp.code, 'component')} className="flex-1 flex items-center text-left focus:outline-none">
                                                                                    <p className="text-sm text-gray-800">{comp.name} <span className="text-gray-400 font-mono text-xs">({comp.code})</span></p>
                                                                                    <div className={`ml-3 text-gray-400 ${openAccordions[comp.code] ? 'rotate-180' : ''}`}><ChevronDownIcon /></div>
                                                                                </button>
                                                                                <div className="flex items-center space-x-1">
                                                                                    <button onClick={() => { setSelectedClassification(c); setSelectedCategory(cat); setSelectedSubcategory(sub); setSelectedComponent(comp); setIsComponentModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                                                                    <button onClick={() => { setItemToDelete({ type: 'component', data: comp, parentId: sub.code, grandParentId: cat.code, greatGrandParentId: c.code }); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                                                                </div>
                                                                            </div>
                                                                            {openAccordions[comp.code] && renderAttributeTable(comp)}
                                                                        </div>
                                                                    ))
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            ))}
            <ProcurementCategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} category={selectedCategory} parentClassificationCode={selectedClassification?.code} />
            <ProcurementSubcategoryModal isOpen={isSubcategoryModalOpen} onClose={() => setIsSubcategoryModalOpen(false)} onSave={handleSaveSubcategory} subcategory={selectedSubcategory} parentCategoryCode={selectedCategory?.code}/>
            <ProcurementComponentModal isOpen={isComponentModalOpen} onClose={() => setIsComponentModalOpen(false)} onSave={handleSaveComponent} component={selectedComponent} parentSubcategoryCode={selectedSubcategory?.code} />
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDelete} title="Confirm Deletion" message={`Are you sure you want to permanently delete "${itemToDelete?.data.name}"? If this is a category or subcategory, all its children will also be deleted. This cannot be undone.`} />
        </div>
    );
};

export default ProcurementClassifications;
