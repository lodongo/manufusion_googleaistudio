
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../../types';
import type { WorkOrder, WorkOrderTask, SolutionMode, MaintenanceType, SparePart, ServiceItem } from '../../../../types/am_types';
import type { RiskAssessmentItem, SheRiskAssessmentSettings, RatingComponent, Hazard, HazardCategory, Control, ControlCategory, RatingLevel, RiskControl } from '../../../../types/she_types';
import type { ProcurementCategory, ProcurementSubcategory, Vendor } from '../../../../types/pr_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import RiskAssessmentModal from './RiskAssessmentModal';
import { collectionGroup, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import TaskGeneralTab from './task/TaskGeneralTab';
import TaskSparesTab from './task/TaskSparesTab';
import TaskServicesTab from './task/TaskServicesTab';
import TaskRisksTab from './task/TaskRisksTab';

const { Timestamp } = firebase.firestore;

interface WorkOrderTaskDetailProps {
  workOrder: WorkOrder;
  task: WorkOrderTask | null; // null for a new task
  onBack: () => void;
  currentUser: AppUser;
  organisation: Organisation;
  theme: Organisation['theme'];
  isLocked?: boolean; // Prop to indicate if edits are allowed
}

export const WorkOrderTaskDetail: React.FC<WorkOrderTaskDetailProps> = ({ workOrder, task, onBack, currentUser, organisation, theme, isLocked = false }) => {
  const isNew = !task;
  const [formData, setFormData] = useState<Partial<WorkOrderTask>>({});
  const [activeTaskTab, setActiveTaskTab] = useState('details');
  
  const [solutionModes, setSolutionModes] = useState<SolutionMode[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [allEmployees, setAllEmployees] = useState<AppUser[]>([]);
  
  const [sheMasterData, setSheMasterData] = useState<any>(null);

  const [taskTypeCategory, setTaskTypeCategory] = useState('');
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessmentItem[]>([]);
  
  const [raModalState, setRaModalState] = useState<{isOpen: boolean, assessment: RiskAssessmentItem | null}>({isOpen: false, assessment: null});
  const [assessmentToDelete, setAssessmentToDelete] = useState<RiskAssessmentItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  
  // State for warehouse selection and spares
  const [hierarchyOptions, setHierarchyOptions] = useState<{ l3: HierarchyNode[], l4: HierarchyNode[], l5: HierarchyNode[] }>({ l3: [], l4: [], l5: [] });
  const [selectedHierarchy, setSelectedHierarchy] = useState({ l3: '', l4: '', l5: '' });
  const [loadingHierarchy, setLoadingHierarchy] = useState({ l3: false, l4: false, l5: false });
  const [inventory, setInventory] = useState<MaterialMasterData[]>([]);
  const [spareSearch, setSpareSearch] = useState('');
  
  // Spare Editing State
  const [editingSpareIndex, setEditingSpareIndex] = useState<number | null>(null);
  const [spareLocationOptions, setSpareLocationOptions] = useState<{id: string, name: string, path: string, qty: number}[]>([]);
  const [loadingSpareLocs, setLoadingSpareLocs] = useState(false);

  // State for Services
  const [serviceCategories, setServiceCategories] = useState<ProcurementCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ProcurementSubcategory[]>([]);
  const [serviceVendors, setServiceVendors] = useState<Vendor[]>([]);
  const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({
      hasFramework: false,
      availabilityStatus: 'Not Contacted',
      supplier: ''
  });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const uniqueSolutionCategories = [...new Set(solutionModes.map(item => item.category))];
  const filteredSolutionModes = solutionModes.filter(item => item.category === taskTypeCategory);

    // Fetch Service Categories
    useEffect(() => {
        const ref = db.collection('modules/PR/Classifications/SV/Categories').orderBy('name');
        const unsub = ref.onSnapshot((snap) => {
            setServiceCategories(snap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementCategory)));
        });
        return () => unsub();
    }, []);

    // Fetch Service Subcategories when category selected
    useEffect(() => {
        if (!serviceForm.categoryId) {
            setServiceSubcategories([]);
            return;
        }
        const ref = db.collection(`modules/PR/Classifications/SV/Categories/${serviceForm.categoryId}/Subcategories`).orderBy('name');
        const unsub = ref.onSnapshot((snap) => {
            setServiceSubcategories(snap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementSubcategory)));
        });
        return () => unsub();
    }, [serviceForm.categoryId]);

    // Fetch Vendors for Services
    useEffect(() => {
        const fetchVendors = async () => {
            try {
                // Fetch vendors that are Active or Approved
                const vRef = db.collection(`organisations/${organisation.domain}/modules/PR/vendors`);
                const q = vRef.where('status', 'in', ['Active', 'Approved']);
                const snap = await q.get();
                setServiceVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
            } catch (e) {
                console.error("Error fetching vendors:", e);
            }
        };
        fetchVendors();
    }, [organisation.domain]);

    // Filter vendors based on selected category
    const filteredVendors = useMemo(() => {
        if (!serviceForm.categoryId) return [];
        // Filter vendors who have this category in their industries list
        return serviceVendors.filter(v => 
            v.industries?.some(ind => ind.categoryId === serviceForm.categoryId)
        ).sort((a,b) => a.legalName.localeCompare(b.legalName));
    }, [serviceVendors, serviceForm.categoryId]);


    // Fetch L3 options
    useEffect(() => {
        const { allocationLevel1Id, allocationLevel2Id } = workOrder;
        if (!allocationLevel1Id || !allocationLevel2Id) return;

        setLoadingHierarchy(prev => ({ ...prev, l3: true }));
        const l3Path = `organisations/${organisation.domain}/level_1/${allocationLevel1Id}/level_2/${allocationLevel2Id}/level_3`;
        const q = db.collection(l3Path).orderBy('name');

        const unsub = q.onSnapshot((snapshot) => {
            const l3Data = snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode));
            setHierarchyOptions(prev => ({ ...prev, l3: l3Data }));
            setSelectedHierarchy(prev => ({ ...prev, l3: workOrder.allocationLevel3Id || '' }));
            setLoadingHierarchy(prev => ({ ...prev, l3: false }));
        });

        return () => unsub();
    }, [workOrder, organisation.domain]);

    // Fetch L4 options when L3 changes
    useEffect(() => {
        if (!selectedHierarchy.l3) {
            setHierarchyOptions(prev => ({ ...prev, l4: [], l5: [] }));
            setSelectedHierarchy(prev => ({ ...prev, l4: '', l5: '' }));
            return;
        }
        const l3Node = hierarchyOptions.l3.find(node => node.id === selectedHierarchy.l3);
        if (!l3Node) return;

        setLoadingHierarchy(prev => ({ ...prev, l4: true }));
        const l4Path = `${l3Node.path}/level_4`;
        const q = db.collection(l4Path).orderBy('name');

        const unsub = q.onSnapshot((snapshot) => {
            const l4Data = snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode));
            setHierarchyOptions(prev => ({ ...prev, l4: l4Data }));
            setSelectedHierarchy(prev => ({ ...prev, l4: workOrder.allocationLevel4Id === prev.l4 ? prev.l4 : (l4Data.find(d => d.id === workOrder.allocationLevel4Id) ? workOrder.allocationLevel4Id! : '') , l5: ''}));
            setLoadingHierarchy(prev => ({ ...prev, l4: false }));
        });
        
        return () => unsub();
    }, [selectedHierarchy.l3, hierarchyOptions.l3, workOrder.allocationLevel4Id]);

    // Fetch L5 options when L4 changes
    useEffect(() => {
        if (!selectedHierarchy.l4) {
            setHierarchyOptions(prev => ({ ...prev, l5: [] }));
            setSelectedHierarchy(prev => ({ ...prev, l5: '' }));
            return;
        }
        const l4Node = hierarchyOptions.l4.find(node => node.id === selectedHierarchy.l4);
        if (!l4Node) return;

        setLoadingHierarchy(prev => ({ ...prev, l5: true }));
        const l5Path = `${l4Node.path}/level_5`;
        const q = db.collection(l5Path).where('sectionType', '>=', 'Capital Inventory').where('sectionType', '<', 'Capital Inventory\uf8ff').orderBy('sectionType').orderBy('name');

        const unsub = q.onSnapshot((snapshot) => {
            const l5Data = snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() } as HierarchyNode));
            setHierarchyOptions(prev => ({ ...prev, l5: l5Data }));
             setSelectedHierarchy(prev => ({ ...prev, l5: workOrder.allocationLevel5Id === prev.l5 ? prev.l5 : (l5Data.find(d => d.id === workOrder.allocationLevel5Id) ? workOrder.allocationLevel5Id! : '')}));
            setLoadingHierarchy(prev => ({ ...prev, l5: false }));
        });

        return () => unsub();
    }, [selectedHierarchy.l4, hierarchyOptions.l4, workOrder.allocationLevel5Id]);

    // Fetch inventory when L5 (warehouse) changes
    useEffect(() => {
        if (!selectedHierarchy.l5) {
            setInventory([]);
            return;
        }
        const l5Node = hierarchyOptions.l5.find(node => node.id === selectedHierarchy.l5);
        if (!l5Node) return;

        const inventoryPath = `${l5Node.path}/materials`;
        const q = db.collection(inventoryPath);
        const unsub = q.onSnapshot(async (snapshot) => {
            const warehouseMaterials = snapshot.docs.map(doc => doc.data());
            if (warehouseMaterials.length > 0) {
                const materialMasterIds = warehouseMaterials.map(m => (m as any).documentId).filter(Boolean) as string[];
                if(materialMasterIds.length === 0) {
                    setInventory([]);
                    return;
                }
                
                const masterDataRef = db.collection(`organisations/${organisation.domain}/modules/IN/masterData`);
                const chunks: string[][] = [];
                for (let i = 0; i < materialMasterIds.length; i += 10) {
                    chunks.push(materialMasterIds.slice(i, i + 10));
                }

                const masterDataPromises = chunks.map(chunk => 
                    masterDataRef.where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
                );
                
                const masterDataSnapshots = await Promise.all(masterDataPromises);
                
                const masterDataMap = new Map<string, MaterialMasterData>();
                masterDataSnapshots.forEach(snap => {
                    snap.docs.forEach(doc => {
                        masterDataMap.set(doc.id, { id: doc.id, ...doc.data() } as MaterialMasterData);
                    });
                });

                const warehouseMaterialMap = new Map(warehouseMaterials.map(wm => [(wm as any).documentId, wm]));
                
                const fullInventoryData: MaterialMasterData[] = [];
                materialMasterIds.forEach(masterId => {
                    const master = masterDataMap.get(masterId!);
                    const whMaterial = warehouseMaterialMap.get(masterId!);
                    if(master && whMaterial) {
                        fullInventoryData.push({
                            ...master,
                            inventoryData: (whMaterial as any).inventoryData,
                            procurementData: (whMaterial as any).procurementData,
                        });
                    }
                });
                setInventory(fullInventoryData);
            } else {
                setInventory([]);
            }
        });

        return () => unsub();
    }, [selectedHierarchy.l5, hierarchyOptions.l5, organisation.domain]);


  useEffect(() => {
    setLoadingData(true);
    const fetchData = async () => {
        try {
            const solModesRef = db.collection('modules/AM/Solution Modes');
            const maintTypesRef = db.collection('modules/AM/Maintenance Types');
            const employeesRef = db.collection('users');
            const settingsRef = db.doc(`organisations/${organisation.domain}/she_settings/riskAssessment`);
            const ratingsRef = db.collection('modules/SHE/Ratings');
            const hazardCatRef = db.collection('modules/SHE/Hazards');
            const controlCatRef = db.collection('modules/SHE/Controls');
            
            const [
                solModesSnap, maintTypesSnap, employeesSnap, settingsSnap, ratingsSnap, hazardCatSnap, controlCatSnap
            ] = await Promise.all([
                solModesRef.where('enabled', '==', true).orderBy('name').get(),
                maintTypesRef.where('enabled', '==', true).orderBy('name').get(),
                employeesRef.where('domain', '==', organisation.domain).orderBy('firstName').get(),
                settingsRef.get(),
                ratingsRef.orderBy('name').get(),
                hazardCatRef.orderBy('name').get(),
                controlCatRef.orderBy('name').get(),
            ]);

            setSolutionModes(solModesSnap.docs.map(d => ({id: d.id, ...d.data()} as SolutionMode)));
            setMaintenanceTypes(maintTypesSnap.docs.map(d => ({code: d.id, ...d.data()} as MaintenanceType)));
            setAllEmployees(employeesSnap.docs.map(d => ({uid: d.id, ...d.data()} as AppUser)));

            const riskSettings = settingsSnap.exists ? (settingsSnap.data() as SheRiskAssessmentSettings) : { riskFormula: ['SEV', 'FREQ_OCCUR'], intolerableCutoff: 15 };
            const ratingComponents = ratingsSnap.docs.map(d => ({id:d.id, code: d.id, ...d.data()} as RatingComponent));

            const hazardCategories = hazardCatSnap.docs.map(d => ({id:d.id, ...d.data()} as HazardCategory));
            const hazards: Record<string, Hazard[]> = {};
            for (const cat of hazardCategories) {
                const hazardsRef = hazardCatRef.doc(cat.id).collection('Hazards');
                const hazardsSnap = await hazardsRef.orderBy('name').get();
                hazards[cat.id] = hazardsSnap.docs.map(d => ({id:d.id, ...d.data()} as Hazard));
            }
            
            const controlCategories = controlCatSnap.docs.map(d => ({id:d.id, ...d.data()} as ControlCategory));
            const controls: Record<string, Control[]> = {};
            for (const cat of controlCategories) {
                const controlsRef = controlCatRef.doc(cat.id).collection('Controls');
                const controlsSnap = await controlsRef.orderBy('name').get();
                controls[cat.id] = controlsSnap.docs.map(d => ({id:d.id, ...d.data()} as Control));
            }
            
            setSheMasterData({
                riskSettings,
                ratingComponents,
                hazardCategories,
                hazards,
                controlCategories,
                controls
            });
            setLoadingData(false);
        } catch (e) {
            console.error(e);
            setError("Failed to load master data.");
            setLoadingData(false);
        }
    };
    fetchData();
  }, [organisation.domain]);

  useEffect(() => {
    if (task) {
        setFormData(task);
        setTaskTypeCategory(task.taskTypeCategory || '');
        setRiskAssessments(task.riskAssessments || []);
    } else {
        setFormData({ 
            taskId: `T-${uuidv4().substring(0,8).toUpperCase()}`, 
            status: 'PENDING', 
            estimatedDurationHours: 1,
            requiredSpares: [],
            requiredServices: [],
            isCritical: false
        });
        setTaskTypeCategory('Corrective');
        setRiskAssessments([]);
    }
  }, [task]);

  const handleSaveTask = async () => {
        if (!formData.taskName || !formData.description) {
            setError("Task Name and Description are required.");
            return;
        }
        
        setLoading(true);
        setError('');

        try {
            const taskData: any = {
                ...formData,
                taskTypeCategory,
                riskAssessments,
                updatedBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
                updatedAt: Timestamp.now(),
            };

            const woRef = db.collection(`organisations/${organisation.domain}/modules/AM/workOrders`).doc(workOrder.id);
            const tasksRef = woRef.collection('tasks');

            if (isNew) {
                 taskData.createdBy = { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` };
                 taskData.createdAt = Timestamp.now();
                 // Generate simpler sequential task ID if creating new
                 const countSnap = await tasksRef.get();
                 const count = countSnap.size + 1;
                 taskData.taskId = `${workOrder.woId}-T${String(count).padStart(2, '0')}`;
                 
                 await tasksRef.add(taskData);
            } else if (task && task.id) {
                 await tasksRef.doc(task.id).update(taskData);
            }
            
            onBack();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to save task.");
        } finally {
            setLoading(false);
        }
  };
  
  const handleAddSpare = (material: MaterialMasterData) => {
      const warehouse = hierarchyOptions.l5.find(n => n.id === selectedHierarchy.l5);
      if (!warehouse) return;
      
      const newSpare: SparePart = {
          materialId: material.id,
          materialCode: material.materialCode,
          name: material.procurementComponentName || 'Unknown',
          quantity: 1,
          uom: material.inventoryData?.inventoryUom || 'Each',
          warehouseId: warehouse.id || '',
          warehouseName: warehouse.name || '',
          warehousePath: warehouse.path
      };
      
      const existingSpares = formData.requiredSpares || [];
      const exists = existingSpares.find(s => s.materialId === newSpare.materialId && s.warehouseId === newSpare.warehouseId);
      
      if (exists) {
           alert("Material already added from this warehouse.");
           return;
      }
      
      setFormData(prev => ({ ...prev, requiredSpares: [...existingSpares, newSpare] }));
  };
  
  const handleEditSpare = async (index: number, materialId: string) => {
      setEditingSpareIndex(index);
      setLoadingSpareLocs(true);
      setSpareLocationOptions([]);
      
      try {
          const q = query(collectionGroup(db, 'materials'), where('documentId', '==', materialId));
          const snapshot = await getDocs(q);
          
          const options = snapshot.docs
              .filter(doc => doc.ref.path.startsWith(`organisations/${organisation.domain}`))
              .map(doc => {
                  const d = doc.data();
                  const name = d.allocationLevel5Name || d.warehouseName || 'Unknown Warehouse';
                  const path = doc.ref.parent.parent?.path || '';
                  const parts = path.split('/');
                  const id = parts[parts.length - 1]; 
                  
                  return {
                      id: id,
                      name: name,
                      path: path,
                      qty: d.inventoryData?.issuableQuantity || 0
                  };
              });
          setSpareLocationOptions(options);
      } catch (e) {
          console.error("Error fetching spare locations", e);
      } finally {
          setLoadingSpareLocs(false);
      }
  };

  const handleUpdateSpareWarehouse = (index: number, warehouseId: string) => {
      const option = spareLocationOptions.find(o => o.id === warehouseId);
      if (option) {
          const newSpares = [...(formData.requiredSpares || [])];
          newSpares[index] = {
              ...newSpares[index],
              warehouseId: option.id,
              warehouseName: option.name,
              warehousePath: option.path
          };
          setFormData(prev => ({ ...prev, requiredSpares: newSpares }));
      }
      setEditingSpareIndex(null);
  };

  const handleUpdateSpareQty = (index: number, qty: number) => {
      const spares = [...(formData.requiredSpares || [])];
      if (spares[index]) {
          spares[index].quantity = qty;
          setFormData(prev => ({ ...prev, requiredSpares: spares }));
      }
  };

  const handleRemoveSpare = (index: number) => {
       const spares = [...(formData.requiredSpares || [])];
       spares.splice(index, 1);
       setFormData(prev => ({ ...prev, requiredSpares: spares }));
  };
  
  const handleSaveService = () => {
      if (!serviceForm.categoryId || !serviceForm.subcategoryId || !serviceForm.supplier) {
          alert("Please fill in category, subcategory and supplier.");
          return;
      }
      
      const cat = serviceCategories.find(c => c.code === serviceForm.categoryId);
      const sub = serviceSubcategories.find(s => s.code === serviceForm.subcategoryId);
      
      const newService: ServiceItem = {
          id: editingServiceId || uuidv4(),
          categoryId: serviceForm.categoryId!,
          categoryName: cat?.name || (serviceForm.categoryName || ''),
          categoryDescription: cat?.description || '',
          subcategoryId: serviceForm.subcategoryId!,
          subcategoryName: sub?.name || (serviceForm.subcategoryName || ''),
          subcategoryDescription: sub?.description || '',
          supplier: serviceForm.supplier!,
          hasFramework: serviceForm.hasFramework || false,
          availabilityStatus: serviceForm.availabilityStatus || 'Not Contacted',
          tentativeDate: serviceForm.tentativeDate
      };
      
      if (editingServiceId) {
           setFormData(prev => ({
               ...prev,
               requiredServices: prev.requiredServices?.map(s => s.id === editingServiceId ? newService : s)
           }));
           setEditingServiceId(null);
      } else {
           setFormData(prev => ({ ...prev, requiredServices: [...(prev.requiredServices || []), newService] }));
      }
      setServiceForm({ hasFramework: false, availabilityStatus: 'Not Contacted', supplier: '' });
  };
  
  const handleEditService = (service: ServiceItem) => {
      setServiceForm({
          categoryId: service.categoryId,
          categoryName: service.categoryName,
          subcategoryId: service.subcategoryId,
          subcategoryName: service.subcategoryName,
          supplier: service.supplier,
          hasFramework: service.hasFramework,
          availabilityStatus: service.availabilityStatus,
          tentativeDate: service.tentativeDate
      });
      setEditingServiceId(service.id);
  };
  
  const handleUpdateServiceStatus = (serviceId: string, status: string) => {
        const newServices = [...(formData.requiredServices || [])];
        const idx = newServices.findIndex(s => s.id === serviceId);
        if (idx > -1) {
            newServices[idx] = { ...newServices[idx], availabilityStatus: status as any };
            setFormData(p => ({ ...p, requiredServices: newServices }));
        }
  };
  
  const handleCancelServiceEdit = () => {
      setServiceForm({ hasFramework: false, availabilityStatus: 'Not Contacted', supplier: '' });
      setEditingServiceId(null);
  };
  
  const handleRemoveService = (id: string) => {
      if (editingServiceId === id) handleCancelServiceEdit();
      setFormData(prev => ({ ...prev, requiredServices: prev.requiredServices?.filter(s => s.id !== id) }));
  };

  const handleSaveRiskAssessment = (assessment: RiskAssessmentItem) => {
       if (assessment.id.startsWith('temp_')) {
            assessment.id = uuidv4();
            setRiskAssessments(prev => [...prev, assessment]);
       } else {
            setRiskAssessments(prev => prev.map(ra => ra.id === assessment.id ? assessment : ra));
       }
       setRaModalState({isOpen: false, assessment: null});
  };

  const handleDeleteRiskAssessment = () => {
      if (assessmentToDelete) {
          setRiskAssessments(prev => prev.filter(ra => ra.id !== assessmentToDelete.id));
          setAssessmentToDelete(null);
      }
  };

  // --- Render ---
  if (loadingData) return <div className="p-8 text-center">Loading task data...</div>;

  return (
      <div className="p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-center mb-4">
              <div>
                  <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-1">&larr; Back to Work Order</button>
                  <h2 className="text-2xl font-bold text-slate-800">{isNew ? 'Add New Task' : `Edit Task: ${task?.taskId}`}</h2>
                  <p className="text-slate-500 text-sm">Work Order: {workOrder.woId} - {workOrder.title}</p>
              </div>
              <div className="flex gap-2">
                 {!isLocked && <Button onClick={handleSaveTask} isLoading={loading} style={{ backgroundColor: theme.colorPrimary }}>Save Task</Button>}
              </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
               <div className="border-b border-slate-200 px-6 flex space-x-6">
                   {['details', 'spares', 'services', 'risks'].map(tab => (
                       <button
                           key={tab}
                           onClick={() => setActiveTaskTab(tab)}
                           className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTaskTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                       >
                           {tab.charAt(0).toUpperCase() + tab.slice(1)}
                       </button>
                   ))}
               </div>
               
               <div className="p-6">
                   {activeTaskTab === 'details' && (
                       /* FIX: Removed unused allEmployees prop to match component definition */
                       <TaskGeneralTab 
                           formData={formData} setFormData={setFormData} isLocked={isLocked}
                           taskTypeCategory={taskTypeCategory} setTaskTypeCategory={setTaskTypeCategory}
                           solutionModes={solutionModes} uniqueSolutionCategories={uniqueSolutionCategories}
                           filteredSolutionModes={filteredSolutionModes}
                           maintenanceTypes={maintenanceTypes}
                       />
                   )}

                   {activeTaskTab === 'spares' && (
                       <TaskSparesTab 
                           formData={formData} setFormData={setFormData} isLocked={isLocked}
                           hierarchyOptions={hierarchyOptions} selectedHierarchy={selectedHierarchy} setSelectedHierarchy={setSelectedHierarchy}
                           inventory={inventory} spareSearch={spareSearch} setSpareSearch={setSpareSearch}
                           handleAddSpare={handleAddSpare} handleUpdateSpareWarehouse={handleUpdateSpareWarehouse}
                           handleEditSpare={handleEditSpare} handleUpdateSpareQty={handleUpdateSpareQty} handleRemoveSpare={handleRemoveSpare}
                           editingSpareIndex={editingSpareIndex} setEditingSpareIndex={setEditingSpareIndex}
                           spareLocationOptions={spareLocationOptions} loadingSpareLocs={loadingSpareLocs}
                       />
                   )}
                   
                   {activeTaskTab === 'services' && (
                        <TaskServicesTab 
                            formData={formData} setFormData={setFormData} isLocked={isLocked}
                            serviceForm={serviceForm} setServiceForm={setServiceForm}
                            serviceCategories={serviceCategories} serviceSubcategories={serviceSubcategories}
                            filteredVendors={filteredVendors} editingServiceId={editingServiceId}
                            handleSaveService={handleSaveService} handleCancelServiceEdit={handleCancelServiceEdit}
                            handleEditService={handleEditService} handleRemoveService={handleRemoveService}
                            handleUpdateServiceStatus={handleUpdateServiceStatus}
                        />
                   )}

                   {activeTaskTab === 'risks' && (
                       <TaskRisksTab 
                           riskAssessments={riskAssessments} isLocked={isLocked}
                           setRaModalState={setRaModalState} setAssessmentToDelete={setAssessmentToDelete}
                       />
                   )}
               </div>
          </div>
          
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
          
          {raModalState.isOpen && sheMasterData && (
              <RiskAssessmentModal 
                  isOpen={raModalState.isOpen}
                  onClose={() => setRaModalState({isOpen: false, assessment: null})}
                  onSave={handleSaveRiskAssessment}
                  assessment={raModalState.assessment}
                  sheMasterData={sheMasterData}
                  employees={allEmployees}
              />
          )}

          <ConfirmationModal 
             isOpen={!!assessmentToDelete}
             onClose={() => setAssessmentToDelete(null)}
             onConfirm={handleDeleteRiskAssessment}
             title="Delete Assessment"
             message="Are you sure you want to remove this risk assessment?"
          />
      </div>
  );
};

export default WorkOrderTaskDetail;
