
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export type Timestamp = firebase.firestore.Timestamp;
import type { ProcurementData } from './pr_types';

export interface SpareType {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface StorageLocation {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface InventoryData {
  inventoryUom?: string;
  alternateUoms?: string;
  batchManaged?: 'Yes' | 'No';
  serialManaged?: 'Yes' | 'No';
  shelfLifeDays?: number;
  minimumRemainingShelfLifeDays?: number;
  expirationControlMethod?: 'FIFO' | 'FEFO' | 'None';
  hazardousMaterialFlag?: 'Yes' | 'No';
  hazardClass?: string;
  unNumber?: string;
  storageTemperatureRange?: string;
  storageHumidityRange?: string;
  handlingInstructions?: string;
  putawayStrategy?: 'Fixed' | 'Random' | 'Family' | 'Size-based';
  pickingStrategy?: 'FIFO' | 'FEFO' | 'LIFO' | 'Batch' | 'Zone';
  defaultWarehouse?: string;
  allowedStorageConditions?: 'Ambient' | 'Cold' | 'HazMat' | 'Outdoor';
  maxStackHeight?: number;
  maxStackWeight?: number;
  weightPerUnit?: number;
  volumePerUnit?: number;
  packagingLevels?: string;
  quantityPerPackLevel?: string;
  barcodePerLevel?: string;
  returnableContainerFlag?: 'Yes' | 'No';
  bin?: string;
  stockStatus?: 'Unrestricted' | 'Blocked' | 'Quality Hold' | 'Consigned';
  inventoryValuationMethod?: 'Standard Cost' | 'Moving Avg' | 'FIFO' | 'LIFO';
  inventoryAccount?: string;
  cycleCountClass?: 'A' | 'B' | 'C';
  countFrequency?: 'Daily' | 'Monthly' | 'Quarterly';
  inspectionRequiredOnReceipt?: 'Yes' | 'No';
  qualityHoldLocation?: string;
  reorderPolicyType?: 'Continuous Review' | 'Periodic Review';
  replenishmentSource?: string;
  crossDockAllowed?: 'Yes' | 'No';
  kittingAllowed?: 'Yes' | 'No';
  returnToVendorAllowed?: 'Yes' | 'No';
  reorderPolicySuggestion?: 'Continuous Review' | 'Periodic Review';
  issuableQuantity?: number;
  reservedQuantity?: number;
  orderedQuantity?: number;
  dimensionLength?: number;
  dimensionWidth?: number;
  dimensionHeight?: number;
  grossWeight?: number;
  netWeight?: number;
  tareWeight?: number;
  flammableFlag?: 'Yes' | 'No';
  corrosiveFlag?: 'Yes' | 'No';
  toxicFlag?: 'Yes' | 'No';
  ppeRequired?: string;
  msdsRequired?: 'Yes' | 'No';
  temperatureControlledStorage?: 'Yes' | 'No';
  autoCalculateAnalytics?: boolean;
  annualUsageQuantity?: number;
  holdingCostPercentage?: number;
  averageDailyDemand?: number;
  demandStandardDeviation?: number;
  serviceLevelTarget?: number;
  
  // Stock Level Configuration
  inventoryStrategyType?: 'V1' | 'POD' | 'CULLED' | 'OBSOLETE' | 'KITTED' | 'CONSIGNMENT';
  stockLevelDetermination?: 'Manual' | 'Criticality' | 'Forecasting and Analytics';
  safetyStockQty?: number;
  reorderPointQty?: number | undefined;
  minStockLevel?: number;
  maxStockLevel?: number;
  orderQuantity?: number; 
  reviewPeriodDays?: number;
  
  averageInventory?: number;
  inventoryTurns?: number;
  daysOfSupply?: number;
  abcClass?: 'A' | 'B' | 'C';
  xyzClass?: 'X' | 'Y' | 'Z';
  fsnClass?: 'Fast' | 'Slow' | 'Non-moving';
  slowMoverFlag?: 'Yes' | 'No';
  obsoleteFlag?: 'Yes' | 'No';
  
  // Criticality Analysis Data
  criticalityProductionImpact?: number;
  criticalitySafetyImpact?: number;
  criticalityRiskHSE?: number;
  criticalityImpactQuality?: number;
  criticalityStandbyAvailable?: 'Yes' | 'No';
  criticalityFailureFrequency?: number;
  criticalityRepairTime?: number;
  criticalitySupplyRisk?: number;
  criticalityScore?: number;
  criticalityClass?: 'A' | 'B' | 'C' | 'D';
  
  // Calculation Params
  targetDaysSupply?: number; // Desired days of stock to hold (for Max calc)
  leadTimeOverride?: number; // If different from procurement data
}

export interface MaterialMasterData {
  id: string;
  materialCode: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  allocationLevel1Id?: string;
  allocationLevel1Name?: string;
  allocationLevel2Id?: string;
  allocationLevel2Name?: string;
  allocationLevel3Id?: string;
  allocationLevel3Name?: string;
  allocationLevel4Id?: string;
  allocationLevel4Name?: string;
  allocationLevel5Id?: string;
  allocationLevel5Name?: string;
  storageLocationId: string;
  storageLocationName: string;
  materialTypeCode: string;
  materialTypeName: string;
  materialTypeDescription: string;
  procurementCategoryCode: string;
  procurementCategoryName: string;
  procurementSubcategoryCode: string;
  procurementSubcategoryName: string;
  procurementComponentCode: string;
  procurementComponentName: string;
  procurementComponentDescription: string;
  source: 'OEM' | 'OCM' | 'General Suppliers';
  oemName?: string;
  oemPartNumber?: string;
  ocmName?: string;
  ocmPartNumber?: string;
  attributes: Record<string, any>;
  inventoryData?: InventoryData;
  procurementData?: ProcurementData;
  approver1: boolean;
  approver1By?: { uid: string; name: string; };
  approver1At?: Timestamp;
  approver2: boolean;
  approver2By?: { uid: string; name: string; };
  approver2At?: Timestamp;
  approver3: boolean;
  approver3By?: { uid: string; name: string; };
  approver3At?: Timestamp;
  rejectionReason?: string;
  rejectedBy?: { uid: string; name: string; };
  rejectedAt?: Timestamp;
  approvedBy?: { uid: string; name: string; };
  approvedAt?: Timestamp;
  createdBy: { uid: string; name: string; };
  createdAt: Timestamp;
  updatedBy?: { uid: string; name: string; };
  updatedAt?: Timestamp;
}

export interface JournalLineConfig {
    type: 'Debit' | 'Credit';
    l4Id?: string;
    l5Id?: string;
    glCategoryId?: string;
    glSubcategoryId?: string;
    glDetailId?: string;
    glDetailName?: string;
    percentage?: number;
}

export interface SalesOrder {
  id: string;
  code: string;
  workOrderId: string;
  workOrderDisplayId: string;
  maintenancePlanId: string;
  status: 'CREATED' | 'PRINTED' | 'PARTIALLY_ISSUED' | 'ISSUED' | 'SETTLED';
  totalCost: number;
  journalConfig?: JournalLineConfig[];
  items: {
    taskId: string;
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    issuedQuantity: number;
    settledQuantity?: number;
    uom: string;
    unitCost: number;
    totalCost: number;
    reservationId?: string;
    warehousePath?: string;
    warehouseName?: string;
    // Source Work Order Location Info
    allocationLevel3Id?: string;
    allocationLevel4Id?: string;
    allocationLevel5Id?: string;
    // Source Warehouse Info
    bin?: string;
  }[];
  assetDetails: {
    name: string;
    location: string;
  };
  allocationLevel1Id?: string;
  allocationLevel1Name?: string;
  allocationLevel2Id?: string;
  allocationLevel2Name?: string;
  allocationLevel3Id?: string;
  allocationLevel3Name?: string;
  allocationLevel4Id?: string;
  allocationLevel4Name?: string;
  allocationLevel5Id?: string;
  allocationLevel5Name?: string;
  createdBy: { uid: string; name: string };
  createdAt: Timestamp;
  printedAt?: Timestamp;
  printedBy?: { uid: string; name: string };
}

export interface MaterialMovement {
  id?: string;
  organisationId?: string;
  movementId: string;
  type: 'ISSUE' | 'RECEIPT' | 'RETURN' | 'ADJUSTMENT';
  salesOrderCode?: string;
  workOrderId?: string;
  taskId?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  warehousePath?: string;
  warehouseName?: string;
  allocationLevel2Name?: string;
  allocationLevel3Name?: string;
  allocationLevel4Name?: string;
  journalEntryId?: string;
  reason?: string;
  date: Timestamp;
  createdBy: { uid: string; name: string };
}

export interface StockTakeConfig {
  id: string;
  name: string;
  type: 'FULL' | 'CYCLE' | 'ADHOC';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'ADHOC';
  durationDays?: number;
  blindCount: boolean;
  freezeInventory: boolean;
  createdBy?: { uid: string; name: string; };
  createdAt?: Timestamp;
}

export interface StockTakeSession {
  id: string;
  configId?: string;
  configName?: string;
  type: 'FULL' | 'CYCLE' | 'ADHOC';
  frequency?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  warehousePath: string;
  warehouseName: string;
  startDate: string;
  endDate: string;
  totalItemsInScope: number;
  totalItemsCounted: number;
  scopeMaterialIds?: string[];
  processedMaterialIds?: string[];
  createdBy: { uid: string; name: string; };
  createdAt: Timestamp;
}

export interface CountSheetItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  binLocation: string;
  systemQuantity: number;
  countedQuantity?: number;
  unitCost?: number;
  uom: string;
  status?: 'PENDING' | 'POSTED' | 'PARTIALLY_POSTED' | 'SETTLED'; 
  postedQuantity?: number; // Tracks amount already adjusted in inventory
  settledQuantity?: number; // Tracks amount already financially settled
}

export interface StockTakeCountSheet {
  id: string;
  piNumber: string;
  batchName: string;
  scheduledDate: string;
  sessionId: string;
  status: 'CREATED' | 'PRINTED' | 'COUNTED' | 'POSTED' | 'SETTLED' | 'PARTIAL' | 'PARTIALLY_POSTED';
  settlementStatus?: 'Pending' | 'Completed';
  journalEntryId?: string;
  items: CountSheetItem[];
  createdAt: Timestamp;
  createdBy: { uid: string; name: string; };
  countedBy?: string;
  countedAt?: Timestamp;
  varianceStats?: {
      totalValueVariance: number;
      totalQtyVariance: number;
      itemsWithVariance: number;
  };
}

export interface SupplierEvaluationCriterion {
  id: string;
  name: string;
  description?: string;
  scoringGuidelines?: string;
  weight?: number;
  enabled: boolean;
}

export interface SupplierEvaluationCategory {
  id: string;
  name: string;
  weight?: number;
  description?: string;
  enabled: boolean;
  criteria?: SupplierEvaluationCriterion[];
}
