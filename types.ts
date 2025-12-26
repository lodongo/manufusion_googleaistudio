

import { FamilyMember, NextOfKin, EducationEntry, EmployeeSkill, EmploymentHistoryEntry } from './types/hr_types';
// We export everything from pr_types, which becomes the canonical source for ProcurementData.
// Then we export everything from in_types EXCEPT for its duplicate ProcurementData.
export * from './types/pr_types';
export type {
  SpareType,
  StorageLocation,
  InventoryData,
  MaterialMasterData,
  SalesOrder,
  JournalLineConfig,
  MaterialMovement,
  StockTakeConfig,
  StockTakeSession,
  StockTakeCountSheet,
  CountSheetItem
} from './types/in_types';
// fi_types will be the source of Timestamp.
export * from './types/fi_types';
// Explicitly export types from mat_types to avoid re-exporting Timestamp.
export type {
  Pillar,
  OrgPillarConfig,
  Stage,
  Theme,
  Question,
  FullPillar,
  FullStage,
  FullTheme,
  AssessmentPeriod,
  Assessment,
  EvidenceItem,
  Answer,
} from './types/mat_types';


export interface Country {
  name: string;
  code: string;
  dial_code: string;
}

export interface AppUser {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  domain: string;
  phoneNumber?: string;
  createdAt: string;
  photoURL?: string;
  accessLevel?: 1 | 2 | 3 | 4 | 5;
  status?: 'active' | 'disabled' | 'deleted';
  mustChangePassword?: boolean;
  personalEmail?: string;

  // New Employee Data Fields
  employeeCode?: string;
  dateOfBirth?: string;
  startDate?: string;
  gender?: 'Male' | 'Female' | 'Other';
  nationality?: string; // Will now store ISO2 code
  nationalId?: string;
  passportNumber?: string;
  jobTitle?: string; // Legacy, use employmentHistory
  reportsTo?: string; // Legacy, use role hierarchy

  familyMembers?: FamilyMember[];
  nextOfKin?: NextOfKin[];
  education?: EducationEntry[];
  skills?: EmployeeSkill[];
  employmentHistory?: EmploymentHistoryEntry[];

  // Bank & Tax Info
  taxPin?: string;
  bankName?: string;
  bankBranch?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;

  // Allocation
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
}

export interface ActivityLogEntry {
  id?: string;
  timestamp: string;
  action: string;
  performedBy: {
    uid: string;
    email: string;
  };
  targetUser?: {
    uid: string;
    email: string;
  };
  details: string;
}

export interface Module {
  id: string; // Document ID, same as code
  name: string;
  code: string;
  description: string;
  active: boolean;
  isCore: boolean;
  monthlyCost: number;
  monthlyDiscount: number;
  annualCost: number;
  annualDiscount: number;
}

export interface Organisation {
  id?: string; // domain
  name: string;
  domain: string;
  industryCategory: string;
  industrySubcategory: string;
  currency: Currency;
  address: {
    continent: string;
    country: string;
    countryIsoCode: string;
    town: string;
    road: string;
    block: string;
  };
  phoneNumber: string;
  website: string;
  theme: {
    slogan: string;
    logoURL: string;
    colorPrimary: string;
    colorSecondary: string;
    colorAccent: string;
  };
  createdBy: string;
  createdAt: string;
}

export interface SubscribedModule {
  id: string; // Document ID, same as module code
  paid: boolean;
  activated: boolean;
}

export interface MemsSettings {
  defaultPassword?: string;
}

export interface IndustryCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface IndustrySubcategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface CountryData {
  id: string; // Document ID (iso2)
  name: string;
  iso2: string;
  iso3: string;
  capital: string;
  currency: Currency;
  dialCode: string;
  continent: string;
  enabled: boolean;
}

export interface Continent {
  id: string; // Document ID
  name: string;
  description: string;
}

export interface MemsSection {
    id: string;
    name: string;
    description: string;
}

export interface ModuleRight {
  id: string; // Firestore document ID (will be same as code)
  code: string; // e.g., PR_CREATE_REQUISITION
  name: string; // e.g., Create Purchase Requisition
  description: string;
  type: 'Action' | 'Approval' | 'Configuration' | 'Reporting' | 'View'; // The category of the right
}

export type UnitSystem = 'Metric' | 'Imperial' | 'US Customary' | 'General' | 'Time' | 'Data';
export type UnitClassification = 'Count' | 'Weight/Mass' | 'Length/Distance' | 'Area' | 'Volume/Liquid' | 'Volume/Dry' | 'Temperature' | 'Time' | 'Speed' | 'Pressure' | 'Energy' | 'Power' | 'Data' | 'Flow Rate' | 'Torque' | 'Force';

export interface UnitOfMeasure {
    id: string; // Document ID (usually code)
    name: string; // e.g. Kilogram
    code: string; // e.g. kg
    type: UnitSystem;
    classification: UnitClassification;
    description?: string;
    enabled: boolean;
}