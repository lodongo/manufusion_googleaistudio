
import React, { useState } from 'react';
import Input from '../../../Input';

// --- CONFIGURATION & HELP TEXT ---
export const FIELD_HELP: Record<string, string> = {
    // Inventory Fields
    inventoryUom: "The primary Unit of Measure used to track this item in stock (e.g., Each, Litre, Meter). All inventory movements and balances will be recorded in this unit.",
    inventoryValuationMethod: "The accounting method used to value the inventory of this item. 'Standard Cost' uses a fixed price, 'Moving Avg' updates cost with every purchase, 'FIFO' assumes first-in-first-out.",
    stockLevelDetermination: "Defines how Min/Max/Reorder levels are set. 'Manual' allows direct entry. 'Criticality Analysis' calculates levels based on risk, lead time, and usage data.",
    minStockLevel: "The absolute minimum quantity that should be on hand at any time to prevent stockouts. Falling below this triggers an urgent alert.",
    maxStockLevel: "The maximum quantity to hold to avoid overstocking costs and space issues. Replenishment should not exceed this.",
    reorderPointQty: "The inventory level at which a new order should be placed to replenish stock before it drops below the safety level.",
    safetyStockQty: "Buffer stock maintained to mitigate risk of stockouts due to supply chain delays or unexpected demand spikes.",
    shelfLifeDays: "The total number of days the product remains usable from the date of manufacture or receipt.",
    batchManaged: "Indicates if the material is tracked by batch/lot numbers for traceability.",
    serialManaged: "Indicates if each unit of the material has a unique serial number.",
    
    // Procurement Fields
    procurementType: "How the item is sourced. 'Stock' means it is bought to inventory. 'Consignment' means vendor owns it until used. 'Direct' means bought for specific jobs.",
    standardPrice: "The estimated or negotiated standard cost per unit used for valuation and budgeting purposes.",
    priceUnit: "The quantity corresponding to the standard price (e.g., Price is $10 per 100 units, so Price Unit is 100).",
    orderUnit: "The unit in which purchase orders are placed, which may differ from Inventory UoM (e.g., Buy in Case, Store in Each).",
    minimumOrderQuantity: "The smallest quantity that a supplier is willing to sell or that is economical to order.",
    purchasingProcessingDays: "Average time (days) required internally to approve a requisition and issue a Purchase Order.",
    plannedDeliveryDays: "Average time (days) to inspect, unload, and put away goods after they arrive at the dock.",
    grProcessingDays: "Average time (days) to inspect, unload, and put away goods after they arrive at the dock.",
    annualUsageQuantity: "The total expected consumption of this material over a 12-month period. Used to calculate daily demand.",
    leadTimeOverride: "Manually override the total lead time calculated from procurement data (Purchasing + Delivery + GR).",
    targetDaysSupply: "The maximum number of days of stock you wish to hold. Used to calculate Max Stock Level.",
};

// --- TYPES FOR SETTINGS ---
export interface CriticalitySettings {
    riskHSEPoints: number[];
    impactProductionPoints: number[];
    impactQualityPoints: number[];
    standbyPoints: { yes: number; no: number };
    failureFrequencyBands: number[];
    failureFrequencyPoints: number[];
    repairTimeBands: number[];
    repairTimePoints: number[];
    cutoffs: { classA: number; classB: number; classC: number; };
    serviceLevels: { classA: number; classB: number; classC: number; classD: number; };
}

export const defaultSettings: CriticalitySettings = {
    riskHSEPoints: [1, 2, 4, 8, 16],
    impactProductionPoints: [1, 2, 4, 8, 16],
    impactQualityPoints: [1, 2, 4, 8, 16],
    standbyPoints: { yes: 0, no: 10 },
    failureFrequencyBands: [1, 2, 5, 10],
    failureFrequencyPoints: [1, 2, 4, 8, 16],
    repairTimeBands: [4, 8, 24, 72],
    repairTimePoints: [1, 2, 4, 8, 16],
    cutoffs: { classA: 60, classB: 40, classC: 20 },
    serviceLevels: { classA: 99.5, classB: 98, classC: 95, classD: 90 },
};

export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative flex items-center ml-2">
            <div 
                className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold cursor-pointer hover:bg-blue-200 transition-colors border border-blue-200"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                onClick={() => setShow(!show)}
            >
                ?
            </div>
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-xs text-white bg-slate-800 rounded-md shadow-xl z-50 pointer-events-none">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    );
};

export const FormField: React.FC<React.ComponentProps<typeof Input> & { helpId?: string, required?: boolean }> = ({ label, id, helpId, required, ...props }) => {
    const helpText = helpId ? FIELD_HELP[helpId] : null;
    const hasValue = props.value !== '' && props.value !== undefined && props.value !== null;
    
    return (
      <div className={props.containerClassName}>
        <div className="flex items-center mb-1">
          <label htmlFor={id} className={`block text-sm font-medium ${required ? 'text-slate-800' : 'text-slate-700'}`}>
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {helpText && <InfoTooltip text={helpText} />}
        </div>
        <Input 
            id={id} 
            label="" 
            required={required} 
            {...props}
            className={`w-full bg-white disabled:bg-slate-100 disabled:text-slate-500 ${required && !hasValue ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-300'} ${props.className || ''}`}
        />
      </div>
    );
};

export const ConfigurationProgress: React.FC<{ 
    total: number; 
    completed: number; 
    label: string; 
    color: string;
}> = ({ total, completed, label, color }) => {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div className="flex flex-col w-full">
            <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{percentage}% Complete</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                    className="h-2 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                ></div>
            </div>
        </div>
    );
};

export const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div className="py-1">
        <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
        <dd className="mt-1 text-sm text-slate-900">{value || 'N/A'}</dd>
    </div>
);

export const yesNoOptions = [<option key="empty" value="">Select...</option>, <option key="yes" value="Yes">Yes</option>, <option key="no" value="No">No</option>];
