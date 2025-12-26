
// types/em_types.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export type Timestamp = firebase.firestore.Timestamp;

export type EnergyComponentType = 'Consumption' | 'Demand' | 'Fixed' | 'Levy' | 'Tax' | 'Adjustment';
export type EnergyCalcMethod = 'Flat' | 'PerUnit' | 'Tiered' | 'Percentage' | 'TimeOfUse' | 'RateTimesSubtotal';
export type EnergyUnitBasis = 'kWh' | 'kVA' | 'kVARh' | 'Manual';

export interface EnergyCategory {
    id: string;
    name: string;
    description: string;
    order: number;
}

export interface BillingTier {
    from: number;
    to: number | null; 
}

export interface TOUSlot {
    id: string;
    name: string;
    startHour: number; 
    endHour: number;
}

export interface TariffUpdateLog {
    id: string;
    timestamp: Timestamp;
    updatedBy: { uid: string; name: string };
    values: Record<string, number>; 
}

export interface EnergyBillingComponent {
    id: string;
    order: number;
    categoryId: string; // Mandatory link
    name: string;
    type: EnergyComponentType;
    method: EnergyCalcMethod;
    unitBasis?: EnergyUnitBasis;
    
    // Structure only
    tiers?: BillingTier[];
    touSlots?: TOUSlot[];
    basisComponentIds?: string[]; 
    subtotalBasisType?: 'RecordedValues' | 'CalculatedCost'; 
    
    minCharge?: number;
    maxCharge?: number;
    description?: string;
    enabled: boolean;
    isMonthlyAdjustment: boolean;
}

export interface EnergyUtilitySettings {
    meterNumber: string; 
    meterFactor: number;
    providerName: string;
    accountNumber: string;
    currency: string;
    isTouEnabled: boolean;
    billingDay: number;
}

export interface Meter {
    id: string;
    name: string;
    serialNumber: string;
    ipAddress: string;
    enabled: boolean;
    createdAt: Timestamp;
}

export type MeteringType = 'Metered' | 'Summation' | 'Manual';

export interface LinkedMeter {
    meterId: string;
    operation: 'add' | 'subtract';
}

export type ParameterAggregationMethod = 'Sum' | 'Min' | 'Max' | 'Avg' | 'Latest';

export interface ParameterConfig {
    parameterId: string; // Source telemetry ID
    method: ParameterAggregationMethod;
    enabled: boolean;
    customLabel?: string; // For "Extra" versions
    isCustom?: boolean;
}

export interface TopographyNode {
    id: string;
    name: string;
    description?: string;
    path: string;
    level: number;
    createdAt: Timestamp;
    hasChildren?: boolean;
    
    // Metering Config
    meteringType?: MeteringType;
    linkedMeters?: LinkedMeter[]; 
    
    // Parameter Processing Logic
    parameterConfigs?: Record<string, ParameterConfig>;
    
    // Consumer Mapping
    consumerIds?: string[]; // IDs of EnergyConsumerSubSubcategory
}

export interface EnergyConsumerCategory {
    id: string;
    code: string;
    name: string;
    description?: string;
    enabled: boolean;
}

export interface EnergyConsumerSubcategory {
    id: string;
    code: string;
    name: string;
    description?: string;
    enabled: boolean;
}

export interface EnergyConsumerSubSubcategory {
    id: string;
    name: string;
    enabled: boolean;
}
