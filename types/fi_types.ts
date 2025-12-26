
// types/fi_types.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export type Timestamp = firebase.firestore.Timestamp;

export interface AccountCategory {
  id: string; // Document ID, e.g., 10000
  name: string; // e.g., 'Assets'
  description: string;
  enabled: boolean;
}

export interface AccountSubcategory {
  id: string; // Document ID, e.g., 11100
  name: string; // e.g., 'Cash and Cash Equivalents'
  description: string;
  enabled: boolean;
}

export interface AccountDetail {
  id: string; // Document ID, e.g., 11110
  name: string; // e.g., 'Cash on Hand'
  description: string;
  enabled: boolean;
}

export type Normal = 'Debit' | 'Credit' | 'Mixed';
export type Statement = 'BS' | 'PL' | 'CF' | 'OCI' | 'OffBook';

export interface JournalClass {
  code: string;
  name: string;
  description: string;
  normalBalance: Normal;
  statementImpact: Statement[];
  examples?: string[];
  enabled: boolean;
  version: number;
}

export interface PostingRule {
  id: string;
  code: string;
  name: string;
  description: string;
  journalClassCode: string;
  journalClassName: string; // Denormalized
  debitAccountPath: string;
  debitAccountName: string; // Denormalized
  creditAccountPath: string;
  creditAccountName: string; // Denormalized
  costCenterRequired: boolean;
  enabled: boolean;
}

export interface MemsCurrency {
  id: string; // Firestore document ID, same as code
  code: string;
  name: string;
  symbol: string;
  countries: string[];
  enabled: boolean;
}

export interface CurrencySettings {
  localCurrency: string;
  baseCurrency: string;
  constantRateConfig?: {
      durationMonths: number; // e.g., 3, 6, 12
      method: 'Simple Average' | 'Weighted Average' | 'Spot Rate' | 'Manual';
      manualRate?: number;
      calculatedRate?: number;
      lastCalculated?: string;
  };
}

export interface ExchangeRate {
  id?: string;
  base: string;
  code: string;
  date: string;
  fetchedAt: Timestamp;
  rate: number;
}

export interface FinancialCalendarSettings {
  cycleType: 'standard' | '445' | '454' | '544';
  fyStartDate: string; // YYYY-MM-DD. Used for Standard Calendar.
  retailYearEndRule: 'last_day_of_month' | 'closest_to_end_of_month';
  retailYearEndMonth: number; // 1-12
  retailYearEndDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday to Saturday
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday to Saturday
}

export interface FinancialPeriod {
    id?: string; // e.g., FY2024-P01
    fy: number;
    period: number;
    startDate: string;
    endDate: string;
    status: 'Open' | 'Closed' | 'Future';
}

export interface OrgGLAccount {
    id: string;
    globalPath: string;
    name: string;
    code: string;
}

export interface BudgetingSettings {
  activeFinancialYear?: number;
  planningFinancialYear?: number;
}

export interface BudgetConfig {
    budgetableGlAccountPaths: string[];
}

export interface BudgetTemplateMetadata {
  id: string; // e.g., FY2024-L2_ID
  financialYear: number;
  level2Id: string;
  level2Name: string;
  latestVersion: number;
  status: 'Enabled' | 'Disabled';
  createdAt: Timestamp;
  createdBy: { uid: string; name: string; };
  versions: { 
    version: number; 
    createdAt: Timestamp; 
    createdBy: { uid: string; name: string; };
    status: 'Open' | 'Closed';
    type: 'Budget' | 'Forecast';
  }[];
}

export interface BudgetPeriodValues {
    [periodId: string]: number; // e.g., { P01: 1000, P02: 1500 }
}

export interface BudgetLineItemTotals {
    budget: BudgetPeriodValues;
    actuals: BudgetPeriodValues;
    previous: BudgetPeriodValues;
}

export interface BudgetHierarchyNode {
    name: string;
    levelName: string;
    totals?: Record<string, BudgetLineItemTotals>; // Key is version, e.g., "v1"
}

export interface BudgetLineItemVersionData {
    budget: number;
    actuals: number;
    previousYearActual: number;
    updatedBy: { uid: string; name: string; };
    updatedAt: Timestamp;
}

export interface BudgetDetailDocument {
    name: string;
    versions: Record<string, Record<string, BudgetLineItemVersionData>>; // Key is version: "v1", then period "P01"
}

export interface ZeroBasedBudgetLineItem {
  id: string; // uuid
  description: string;
  costPerItem: number;
  notes?: string;

  calcMode: 'DIRECT' | 'DRIVER';
  driverUnit?: string; // e.g., 'Employees'
  driverRate?: number; // e.g., 2
  monthlyValues: number[]; // Can be quantities or driver units
}

export interface ZeroBasedBudgetTemplate {
  id: string; // Firestore document ID
  name: string;
  lineItems: ZeroBasedBudgetLineItem[];
  createdAt: Timestamp;
  createdBy: { uid: string; name: string; };
}

export interface JournalEntry {
    id?: string; // Document ID
    code?: string; // The codified journal ID (e.g. JN00000001)
    journalId?: string; // Sequential ID (e.g. JN000000123) - Legacy/Redundant
    reference: string;
    date: Timestamp;
    description: string;
    amount: number; // Total Debit Amount
    lines?: {
        type: 'Debit' | 'Credit';
        glDetailId: string;
        glDetailName: string;
        amount: number;
        l4Id?: string;
        l5Id?: string;
    }[]; 
    itemsSettled?: any[];
    createdBy?: { uid: string; name: string };
    createdAt?: Timestamp;
}

// Tax Types
export interface TaxRange {
    min: number;
    max: number | null; // null for infinity
    value: number;
}

export interface TaxRegime {
    id: string;
    name: string;
    code: string;
    description?: string;
    type: 'Constant' | 'Dynamic';
    calculation: 'Percentage' | 'Fixed Amount';
    value?: number; // For Constant
    ranges?: TaxRange[]; // For Dynamic
    enabled: boolean;
}
