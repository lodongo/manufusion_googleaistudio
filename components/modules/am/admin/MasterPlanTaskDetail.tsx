import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { AppUser, Organisation, MaterialMasterData } from '../../../../types';
import type { MaintenanceMasterPlan, MasterPlanTask, SolutionMode, MaintenanceType, SparePart, ServiceItem } from '../../../../types/am_types';
import type { RiskAssessmentItem, SheRiskAssessmentSettings, RatingComponent, Hazard, HazardCategory, Control, ControlCategory } from '../../../../types/she_types';
import type { ProcurementCategory, ProcurementSubcategory, Vendor } from '../../../../types/pr_types';
import Button from '../../../Button';
import ConfirmationModal from '../../../common/ConfirmationModal';
import type { HierarchyNode } from '../../../org/HierarchyNodeModal';
import RiskAssessmentModal from '../work_orders/RiskAssessmentModal';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../context/AuthContext';

import TaskGeneralTab from '../work_orders/task/TaskGeneralTab';
import TaskSparesTab from '../work_orders/task/TaskSparesTab';
import TaskServicesTab from '../work_orders/task/TaskServicesTab';
import TaskRisksTab from '../work_orders/task/TaskRisksTab';

const { Timestamp } = firebase.firestore;

interface MasterPlanTaskDetailProps {
  plan: MaintenanceMasterPlan;
  task: MasterPlanTask | null; // null for a new task
  onBack: () => void;
  organisation: Organisation;
  theme: Organisation['theme'];
}

const MasterPlanTaskDetail: React.FC<MasterPlanTaskDetailProps> = ({ plan, task, onBack, organisation, theme }) => {
  const { currentUserProfile } = useAuth();
  const isNew = !task;
  const [formData, setFormData] = useState<Partial<MasterPlanTask>>({});
  const [activeTaskTab, setActiveTaskTab] = useState('details');
  
  const [solutionModes, setSolutionModes] = useState<SolutionMode[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [allEmployees, setAllEmployees] = useState<AppUser[]>([]);
  const [sheMasterData, setSheMasterData] = useState<any>(null);

  const [taskTypeCategory, setTaskTypeCategory] = useState('Preventive');
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessmentItem[]>([]);
  const [raModalState, setRaModalState] = useState<{isOpen: boolean, assessment: RiskAssessmentItem | null}>({isOpen: false, assessment: null});
  const [assessmentToDelete, setAssessmentToDelete] = useState<RiskAssessmentItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  
  const [hierarchyOptions, setHierarchyOptions] = useState<{ l3: HierarchyNode[], l4: HierarchyNode[], l5: HierarchyNode[] }>({ l3: [], l4: [], l5: [] });
  const [selectedHierarchy, setSelectedHierarchy] = useState({ l3: '', l4: '', l5: '' });
  const [inventory, setInventory] = useState<MaterialMasterData[]>([]);
  const [spareSearch, setSpareSearch] = useState('');

  const [serviceCategories, setServiceCategories] = useState<ProcurementCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ProcurementSubcategory[]>([]);
  const [serviceVendors, setServiceVendors] = useState<Vendor[]>([]);
  const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({ hasFramework: false, availabilityStatus: 'Not Contacted', supplier: '' });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const uniqueSolutionCategories = [...new Set(solutionModes.map(item => item.category))];
  const filteredSolutionModes = solutionModes.filter(item => item.category === taskTypeCategory);

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
            const hazards: Record<string, any[]> = {};
            for (const cat of hazardCategories) {
                const hRef = db.collection(`modules/SHE/Hazards/${cat.id}/Hazards`);
                const hSnap = await hRef.orderBy('name').get();
                hazards[cat.id] = hSnap.docs.map(d => ({id:d.id, ...d.data()}));
            }
            
            const controlCategories = controlCatSnap.docs.map(d => ({id:d.id, ...d.data()} as ControlCategory));
            const controls: Record<string, any[]> = {};
            for (const cat of controlCategories) {
                const cRef = db.collection(`modules/SHE/Controls/${cat.id}/Controls`);
                const cSnap = await cRef.orderBy('name').get();
                controls[cat.id] = cSnap.docs.map(d => ({id:d.id, ...d.data()}));
            }
            
            setSheMasterData({ riskSettings, ratingComponents, hazardCategories, hazards, controlCategories, controls });
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
    const scRef = db.collection('modules/PR/Classifications/SV/Categories');
    scRef.orderBy('name').onSnapshot((snap) => setServiceCategories(snap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementCategory))));
    const vRef = db.collection(`organisations/${organisation.domain}/modules/PR/vendors`);
    vRef.where('status', 'in', ['Active', 'Approved']).get().then(snap => setServiceVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))));
  }, [organisation.domain]);

  useEffect(() => {
    if (!serviceForm.categoryId) { setServiceSubcategories([]); return; }
    const ref = db.collection(`modules/PR/Classifications/SV/Categories/${serviceForm.categoryId}/Subcategories`);
    ref.orderBy('name').onSnapshot((snap) => setServiceSubcategories(snap.docs.map(doc => ({ code: doc.id, ...doc.data() } as ProcurementSubcategory))));
  }, [serviceForm.categoryId]);

  useEffect(() => {
      const fetchInventory = async () => {
          const pathParts = plan.assemblyPath.split('/');
          const l3 = pathParts[7]; const l4 = pathParts[9]; const l5 = pathParts[11];
          setSelectedHierarchy({ l3, l4, l5 });
          
          const l3Doc = await db.doc(`organisations/${organisation.domain}/level_1/${pathParts[3]}/level_2/${pathParts[5]}/level_3/${l3}`).get();
          const l4Doc = await db.doc(`${l3Doc.ref.path}/level_4/${l4}`).get();
          const l5Doc = await db.doc(`${l4Doc.ref.path}/level_5/${l5}`).get();

          setHierarchyOptions({
              l3: [{ id: l3, name: l3Doc.data()?.name, path: l3Doc.ref.path } as any],
              l4: [{ id: l4, name: l4Doc.data()?.name, path: l4Doc.ref.path } as any],
              l5: [{ id: l5, name: l5Doc.data()?.name, path: l5Doc.ref.path } as any],
          });
      };
      fetchInventory();
  }, [plan.assemblyPath, organisation.domain]);

  useEffect(() => {
    if (!selectedHierarchy.l5) return;
    const l5Node = hierarchyOptions.l5.find(n => n.id === selectedHierarchy.l5);
    if (!l5Node) return;
    const unsub = db.collection(`${l5Node.path}/materials`).onSnapshot(async (snap) => {
        const materialMasterIds = snap.docs.map(doc => doc.data().documentId).filter(Boolean);
        if (materialMasterIds.length === 0) { setInventory([]); return; }
        const masterRef = db.collection(`organisations/${organisation.domain}/modules/IN/masterData`);
        const mSnap = await masterRef.where(firebase.firestore.FieldPath.documentId(), 'in', materialMasterIds.slice(0, 10)).get();
        setInventory(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialMasterData)));
    });
    return () => unsub();
  }, [selectedHierarchy.l5, hierarchyOptions.l5, organisation.domain]);

  useEffect(() => {
    if (task) {
        setFormData(task);
        setTaskTypeCategory('Preventive');
        setRiskAssessments(task.riskAssessments || []);
    } else {
        setFormData({ taskId: `T-${uuidv4().substring(0,6).toUpperCase()}`, estimatedDurationHours: 1, requiredSpares: [], requiredServices: [], isCritical: false, enabled: true });
        setTaskTypeCategory('Preventive');
        setRiskAssessments([]);
    }
  }, [task]);

  const handleSaveTask = async () => {
        if (!formData.taskName || !formData.description) { setError("Task Name and Description are required."); return; }
        setLoading(true);
        try {
            // Task inherits discipline from the parent Master Plan header
            const taskData: any = { 
                ...formData, 
                taskTypeCategory: 'Preventive',
                discipline: plan.disciplineName, 
                riskAssessments, 
                updatedAt: Timestamp.now() 
            };
            
            const tasksRef = db.collection(`organisations/${organisation.domain}/modules/AM/masterPlans/${plan.id}/tasks`);
            if (isNew) {
                 taskData.createdBy = { uid: currentUserProfile?.uid, name: `${currentUserProfile?.firstName} ${currentUserProfile?.lastName}` };
                 taskData.createdAt = Timestamp.now();
                 const countSnap = await tasksRef.get();
                 taskData.taskId = `T${String(countSnap.size + 1).padStart(2, '0')}`;
                 await tasksRef.add(taskData);
            } else if (task && task.id) {
                 await tasksRef.doc(task.id).update(taskData);
            }
            onBack();
        } catch (err: any) { setError(err.message || "Failed to save task."); } finally { setLoading(false); }
  };

  const handleAddSpare = (material: MaterialMasterData) => {
      const warehouse = hierarchyOptions.l5.find(n => n.id === selectedHierarchy.l5);
      const newSpare: SparePart = { materialId: material.id, materialCode: material.materialCode, name: material.procurementComponentName || 'Unknown', quantity: 1, uom: material.inventoryData?.inventoryUom || 'Each', warehouseId: warehouse?.id || '', warehouseName: warehouse?.name || '', warehousePath: warehouse?.path };
      const existingSpares = formData.requiredSpares || [];
      if (existingSpares.find(s => s.materialId === newSpare.materialId)) { alert("Material already added."); return; }
      setFormData(prev => ({ ...prev, requiredSpares: [...existingSpares, newSpare] }));
  };

  const handleSaveService = () => {
      if (!serviceForm.categoryId || !serviceForm.subcategoryId || !serviceForm.supplier) { alert("Please fill in required fields."); return; }
      const cat = serviceCategories.find(c => c.code === serviceForm.categoryId);
      const sub = serviceSubcategories.find(s => s.code === serviceForm.subcategoryId);
      const newService: ServiceItem = { 
          id: uuidv4(), 
          categoryId: serviceForm.categoryId!, 
          categoryName: cat?.name || '', 
          categoryDescription: cat?.description || '',
          subcategoryId: serviceForm.subcategoryId!, 
          subcategoryName: sub?.name || '', 
          subcategoryDescription: sub?.description || '',
          supplier: serviceForm.supplier!, 
          hasFramework: serviceForm.hasFramework || false, 
          availabilityStatus: serviceForm.availabilityStatus || 'Not Contacted', 
          tentativeDate: serviceForm.tentativeDate 
      };
      setFormData(prev => ({ ...prev, requiredServices: [...(prev.requiredServices || []), newService] }));
      setServiceForm({ hasFramework: false, availabilityStatus: 'Not Contacted', supplier: '' }); setEditingServiceId(null);
  };

  if (loadingData) return <div className="p-12 text-center text-slate-500 italic">Initializing task designer...</div>;

  return (
      <div className="p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
              <div>
                  <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-1">&larr; Back to Task List</button>
                  <h2 className="text-2xl font-bold text-slate-800">{isNew ? 'New Template Task' : `Edit Template Task: ${task?.taskId}`}</h2>
                  <p className="text-slate-500 text-sm">Master Plan: {plan.code}</p>
              </div>
              <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-600 uppercase">Template Active:</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.enabled !== false} 
                                onChange={(e) => setFormData(p => ({...p, enabled: e.target.checked}))}
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                    <Button onClick={handleSaveTask} isLoading={loading} style={{ backgroundColor: theme.colorPrimary }} className="!w-auto px-8">Save Task Template</Button>
              </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="border-b border-slate-200 px-6 flex space-x-6 bg-slate-50">
                   {['details', 'spares', 'services', 'risks'].map(tab => (
                       <button
                           key={tab}
                           onClick={() => setActiveTaskTab(tab)}
                           className={`py-4 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTaskTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                       >
                           {tab}
                       </button>
                   ))}
               </div>
               
               <div className="p-8">
                   {activeTaskTab === 'details' && (
                       <TaskGeneralTab 
                           formData={formData} setFormData={setFormData} isLocked={false}
                           taskTypeCategory={taskTypeCategory} setTaskTypeCategory={setTaskTypeCategory}
                           solutionModes={solutionModes} uniqueSolutionCategories={uniqueSolutionCategories}
                           filteredSolutionModes={filteredSolutionModes}
                           maintenanceTypes={maintenanceTypes}
                       />
                   )}

                   {activeTaskTab === 'spares' && (
                       <TaskSparesTab 
                           formData={formData} setFormData={setFormData} isLocked={false}
                           hierarchyOptions={hierarchyOptions} selectedHierarchy={selectedHierarchy} setSelectedHierarchy={setSelectedHierarchy}
                           inventory={inventory} spareSearch={spareSearch} setSpareSearch={setSpareSearch}
                           handleAddSpare={handleAddSpare} 
                           handleUpdateSpareWarehouse={(i, id) => {}} 
                           handleEditSpare={(i, id) => {}} 
                           handleUpdateSpareQty={(i, q) => { const s = [...(formData.requiredSpares || [])]; s[i].quantity = q; setFormData(p => ({...p, requiredSpares: s})); }} 
                           handleRemoveSpare={(i) => { const s = [...(formData.requiredSpares || [])]; s.splice(i, 1); setFormData(p => ({...p, requiredSpares: s})); }}
                           editingSpareIndex={null} setEditingSpareIndex={() => {}}
                           spareLocationOptions={[]} loadingSpareLocs={false}
                       />
                   )}
                   
                   {activeTaskTab === 'services' && (
                        <TaskServicesTab 
                            formData={formData} setFormData={setFormData} isLocked={false}
                            serviceForm={serviceForm} setServiceForm={setServiceForm}
                            serviceCategories={serviceCategories} serviceSubcategories={serviceSubcategories}
                            filteredVendors={serviceVendors} editingServiceId={editingServiceId}
                            handleSaveService={handleSaveService} handleCancelServiceEdit={() => { setServiceForm({}); setEditingServiceId(null); }}
                            handleEditService={(s) => { setServiceForm(s); setEditingServiceId(s.id); }} 
                            handleRemoveService={(id) => setFormData(p => ({...p, requiredServices: p.requiredServices?.filter(s => s.id !== id)}))}
                            handleUpdateServiceStatus={(id, st) => {}}
                        />
                   )}

                   {activeTaskTab === 'risks' && (
                       <TaskRisksTab 
                           riskAssessments={riskAssessments} isLocked={false}
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
                  onSave={(ra) => {
                      if (ra.id.startsWith('temp_')) { ra.id = uuidv4(); setRiskAssessments(p => [...p, ra]); }
                      else setRiskAssessments(p => p.map(x => x.id === ra.id ? ra : x));
                      setRaModalState({isOpen: false, assessment: null});
                  }}
                  assessment={raModalState.assessment}
                  sheMasterData={sheMasterData}
                  employees={allEmployees}
              />
          )}

          <ConfirmationModal 
             isOpen={!!assessmentToDelete}
             onClose={() => setAssessmentToDelete(null)}
             onConfirm={() => { setRiskAssessments(p => p.filter(x => x.id !== assessmentToDelete!.id)); setAssessmentToDelete(null); }}
             title="Delete Template Assessment"
             message="Are you sure you want to remove this risk assessment from the task template?"
          />
      </div>
  );
};

export default MasterPlanTaskDetail;