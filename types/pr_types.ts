
import { Timestamp } from 'firebase/firestore';

export interface ProcurementClassification {
  code: string; // Document ID
  name: string;
  description: string;
}

export interface ProcurementCategory {
  code: string; // Document ID, e.g., GS-MRO
  name: string;
  description: string;
  enabled: boolean;
}

/**
 * Added missing ProcurementSubcategory interface to resolve import errors.
 */
export interface ProcurementSubcategory {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
}

export type AttributeType = 'text' | 'number' | 'dropdown' | 'date' | 'multiselect' | 'object' | 'boolean';

export interface ComponentAttribute {
    name: string;
    dataType: AttributeType;
    isRequired: boolean;
    options?: string[];
    unit?: string;
    fields?: ComponentAttribute[]; // for object type
}

export interface ProcurementComponent {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  attributes: ComponentAttribute[];
  unspsc?: string;
}

// Global List Entries (Payment Terms, Incoterms, Return Policies)
export interface ProcurementListEntry {
    id: string; // The Codification/Code
    acronym: string;
    fullAcronym: string;
    description: string;
    value?: number; // Numeric component (e.g. 30)
    unit?: string;  // Unit component (e.g. Days)
    enabled: boolean;
}

// Vendor Data Structure
export interface VendorAddress {
    building?: string;
    city?: string;
    state?: string;
    postalAddress?: string;
    country?: string;
    countryIsoCode?: string;
}

export interface VendorContact {
    name: string;
    title?: string;
    phone?: string;
    mobile: string;
    email: string;
}

export interface VendorBanking {
    bankName: string;
    bankBranch: string;
    accountName: string;
    accountNumber: string;
    swiftCode?: string;
    paymentMethod?: string;
    paymentTerms?: string;
    creditLimit?: number;
    
    // Intermediary Bank (New)
    intermediaryBankName?: string;
    intermediarySwift?: string;
    intermediaryAccount?: string;
}

export interface VendorIndustry {
    classificationId: string;
    classificationName: string;
    categoryId: string;
    categoryName: string;
    categoryDescription?: string;
}

export interface VendorAttachment {
    name: string;
    url: string;
    uploadedAt: string;
    type?: string;
}

export type VendorStatus = 'Pending' | 'Approved' | 'Rejected' | 'Under Review' | 'Active' | 'Suspended' | 'Deactivated' | 'Deleted';

export interface Vendor {
    id?: string; // Firestore document ID
    vendorCode: string; // Sequential human-readable ID, e.g., V00001
    legalName: string;
    tradingName?: string;
    vendorType: string;
    registrationNumber?: string;
    taxId: string;
    vatNumber?: string;
    description?: string;

    // Comprehensive Corporate Details (New)
    dateOfIncorporation?: string;
    parentCompany?: string;
    ownershipType?: string; // e.g. Private, Public, Government
    
    industries: VendorIndustry[];

    physicalAddress: VendorAddress;
    billingAddress?: VendorAddress;
    shippingAddress?: VendorAddress;
    
    primaryContact: VendorContact;
    altContactName?: string;
    website?: string;
    
    banking: VendorBanking;
    currency: { code: string; name: string; symbol: string };
    
    // Commercial & Compliance (New)
    defaultIncoterm?: string;
    taxClearanceExpiry?: string;
    insuranceExpiry?: string;
    licenseExpiry?: string;
    
    // Internal fields
    status: VendorStatus;
    riskRating?: 'LOW' | 'MEDIUM' | 'HIGH';
    srmScore?: number; // Last calculated score
    department?: string;
    remarks?: string;

    attachments: VendorAttachment[];

    createdBy: {
        uid: string;
        name: string;
    };
    createdAt: any; // Firestore Timestamp
    updatedBy?: {
        uid: string;
        name: string;
    };
    updatedAt?: any;
}

export interface MrpData {
    execId: string;
    policyComponentQty: number;
    reason: string;
    reservationComponentQty: number;
    reservationNumbersDueNow: string[];
    triggerSource: string;
    updatedAt: any;
}

export interface PRPolicyData {
    annualUsageQuantity: number;
    availableNetQuantity: number;
    dailyUsage: number;
    desiredMaxEffective: number;
    dueNowReservations: string[];
    expiredQuantity: number;
    freeToIssueNow: number;
    grossNeeded: number;
    grossPolicyShort: number;
    maxStockLevel: number;
    onHandUsableNow: number;
    onHandUsableNowRaw: number;
    pipelineAllPR: number;
    pipelineOtherPR: number;
    policyTriggered: boolean;
    qtyToOrder: number;
    quarantinedQuantity: number;
    reorderPointEffective: number;
    reorderPointQty: number;
    reservationOrderNowQty: number;
    reservedAllocatedNow: number;
    safetyStockQty: number;
    targetDaysQty: number;
    targetDaysSupply: number;
    receivedQuantity: number;
    requestedQuantity: number;
    uom: string;
    warehouseId: string;
    warehousePath: string;
    notes?: string;
}

export interface PRLineItem {
    materialId: string;
    materialCode: string;
    description: string;
    quantity: number;
    requestedQuantity?: number; // MRP fallback
    uom?: string;
    // Status fields we might add during review
    reviewStatus?: 'Pending' | 'Reviewed' | 'RFQ Process' | 'RFQ Sent' | 'Supplier Assigned' | 'Group Assigned' | 'PROCESSED';
    assignedVendorName?: string;
    assignedVendorId?: string; // Added for persistence
    agreedPrice?: number;
    discountPercent?: number; // Sourcing discount
    agreementRef?: string;
    quoteId?: string; // Link to a Quote
    procurementGroup?: string;
    currency?: string;
    
    // PO Linking
    poId?: string;
    poNumber?: string;

    // MRP Specifics
    mrp?: MrpData;
    policy?: PRPolicyData;
}

export interface PurchaseRequisition {
    id: string;
    prNumber: string;
    createdAt: any;
    status: string;
    warehouseId: string;
    warehouseName?: string;
    warehousePath?: string; // Full firestore path to warehouse node
    notes?: string;
    source?: { kind: string };
    lines: PRLineItem[];
    requestedBy?: { name: string };
    
    // MRP Headers
    isAuto?: boolean;
    auto?: { isAuto: boolean; };
    preferredVendorId?: string;
    preferredVendorName?: string;
    type?: string;
    
    // Timestamps for Dashboard Stats
    approvedAt?: any;
    convertedAt?: any;
    closedAt?: any;
    
    // PO Linking (Header level if whole PR is linked)
    poId?: string;
    poNumber?: string;
    linkedAt?: any;
}

export interface ProcurementData {
  // Sourcing & Pricing
  procurementType?: 'Stock' | 'Consignment' | 'Make-to-Order' | 'Subcontracting';
  sourcingStrategy?: 'Single Source' | 'Dual Source' | 'Multiple Source';
  preferredVendorId?: string;
  preferredVendorName?: string;
  standardPrice?: number;
  priceUnit?: number;
  priceControl?: 'Based on PO' | 'Based on Contract';
  contractReference?: string;
  orderingCost?: number;

  // Order Modifiers
  orderUnit?: string;
  orderUnitConversion?: string;
  minimumOrderQuantity?: number;
  roundingProfile?: number;
  deliveryToleranceUnder?: number;
  deliveryToleranceOver?: number;

  // Planning & Control
  buyerPlannerId?: string;
  buyerPlannerName?: string;
  sourceListMaintained?: 'Yes' | 'No';
  quotaArrangement?: string;
  
  // Lead Times & Scheduling (Days)
  purchasingProcessingDays?: number; // Time for internal approval/PO creation
  plannedDeliveryDays?: number;      // Vendor lead time
  grProcessingDays?: number;         // Inspection/Putaway time
  totalLeadTimeDays?: number;        // Calculated or Override

  // Alternative Vendor Information
  alternativeVendor1Id?: string;
  alternativeVendor1Name?: string;
  alternativeVendor2Id?: string;
  alternativeVendor2Name?: string;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string; // YYYY-MM-DD
  
  // Logistics & Compliance
  countryOfOrigin?: string; // ISO2 code
  customsTariffNumber?: string;
  incoterms?: 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';
  incotermsLocation?: string;
  /* Added currency to ProcurementData interface */
  currency?: string;
}

export interface AssessmentSettings {
  scale_min: number;
  scale_max: number;
  scale_definition: string;
}

export interface AssessmentCategory {
  id: string;
  name: string;
  weight_percent: number;
  description: string;
  order?: number;
}

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: 'strategic' | 'situational';
  scores: 'both' | 'organisation' | 'supplier';
  rating_scale: Record<string, string>;
  order?: number;
}

// SRM Assessment Types
export interface SrmAssessment {
    id: string;
    vendorId?: string;
    vendorName?: string;
    name: string;
    type: 'Routine' | 'Triggered';
    triggerReason?: string;
    startDate: string;
    endDate: string;
    passMark: number;
    status: 'In Progress' | 'Completed';
    score: number;
    maxScore: number;
    percentage: number;
    result: 'Pass' | 'Fail';
    categories: {
        id: string;
        name: string;
        weight: number;
        questions: {
            id: string;
            text: string;
            score: number; // 1-5
            maxScore: number; // 5
            notes?: string;
            scores?: 'both' | 'organisation' | 'supplier';
            question_type?: 'strategic' | 'situational';
        }[];
    }[];
    createdBy: { uid: string; name: string };
    createdAt: any;
    completedAt?: any;
}

export interface ProcurementRFQ {
    id: string;
    rfqNumber: string; // RFQ-000000001
    status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'AWARDED';
    
    categoryId: string; // Procurement Category Code e.g. "GS-MRO"
    categoryName: string;
    
    // Items to be quoted
    items: {
        prId: string; // ID of the Purchase Request
        prNumber: string;
        lineId: string; // usually index
        materialId: string;
        materialCode: string;
        materialName: string;
        quantity: number;
        uom: string;
    }[];

    validUntil?: string;
    notes?: string;

    createdBy: { uid: string; name: string };
    createdAt: any;
    updatedAt?: any;
}

export interface ProcurementQuote {
    id: string;
    rfqId?: string; // Link to parent RFQ
    rfqNumber?: string; // Human readable link
    
    quoteNumber: string; // Q-000000001 (Individual Supplier Quote ID)
    status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'AWARDED' | 'CANCELLED';
    supplierId: string;
    supplierName: string;
    supplierContactName?: string;
    supplierEmail?: string;
    categoryId: string; 
    categoryName: string;
    
    details?: string; 

    // Items (Mirrors RFQ items but with pricing)
    items: {
        prId: string; 
        prNumber: string;
        lineId: string; 
        materialId: string;
        materialCode: string;
        materialName: string;
        quantity: number;
        uom: string;
        
        // Response Fields
        quotedUnitPrice?: number;
        quotedDiscount?: number; // percentage
        quotedTotalPrice?: number; // (Unit * Qty) - Discount
        leadTimeValue?: number;
        leadTimeUnits?: 'Days' | 'Weeks' | 'Months';
        
        // Tracking info for conversions
        originalQuotedPrice?: number;
        originalCurrency?: string;
        exchangeRateUsed?: number;
    }[];
    
    // Tracking
    sentDate?: string; 
    sentHistory?: string[];

    // Response Header
    supplierResponse?: {
        referenceNumber?: string; // Supplier's own quote ref
        quoteDate?: string;
        receivedAt?: any; 
        taxPercentage?: number;
        overallDiscount?: number;
        currency?: string;
        attachmentName?: string;
        attachmentUrl?: string;
        paymentTerms?: string;
        incoterm?: string;
    };

    validUntil?: string;
    totalValue?: number;
    notes?: string;

    createdBy: { uid: string; name: string };
    createdAt: any;
    
    // Award Information
    awardedAt?: any;
    awardedBy?: { uid: string; name: string };
    awardReason?: string;
    
    // Exception Link
    exceptionNoticeId?: string;
}

export interface ExceptionNotice {
    id: string;
    noticeNumber: string; // EX-000001
    quoteId: string;
    quoteNumber: string;
    supplierName: string;
    quoteValue: number;
    thresholdLimit: number;
    
    violationType: 'Insufficient Quotes' | 'Threshold Exceeded' | 'Other';
    justification: string;
    awardReason: string;
    
    createdAt: any;
    createdBy: { uid: string; name: string };
    
    status: 'Logged' | 'Reviewed';
}

export interface POItem {
    lineNo: number; // 10, 20, etc.
    description: string;
    itemNumber: string; // From material master OCM/OEM Part Number
    partNumber?: string;
    oemPartNumber?: string;
    metaData?: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    priceUnit: number; // Quantity corresponding to standard price
    currency: string;
    discountPercent: number; // Item-specific discount %
    discountAmount: number; // Calculated absolute discount
    taxPercent: number; // 0-100
    deliveryDate?: string;
    netAmount: number; // (Price * Qty) - All Discounts
    taxAmount: number;
    totalAmount: number; // Net + Tax
    materialId?: string; // Optional link to material master
    warehousePath?: string; // Path to warehouse record for deep linking
    quoteId?: string; // Optional link to quote source
    quoteNumber?: string; // Human readable ref
    quoteItemId?: string; // Unique link to specific quote item to prevent dupes
    
    // PR Linking
    prId?: string;
    prNumber?: string;

    // Sourcing Info (From agreement/warehouse)
    paymentTerms?: string;
    incoterm?: string;
    returnPolicy?: string;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string; // PO00000001
    status: 'CREATED' | 'ISSUED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED' | 'REJECTED';
    
    vendorId: string;
    vendorName: string;
    vendorAddress?: string;
    vendorContact?: string;
    
    categoryId: string;
    categoryName: string;
    
    currency: string;
    items: POItem[];
    
    subTotal: number; // Net Excl VAT
    totalTax: number;
    grandTotal: number;
    globalDiscountPercentage?: number; // Header level discount to be added to line items

    notes?: string;
    termsAndConditions?: string;
    
    issueDate?: string;
    expectedDeliveryDate?: string;
    paymentTerms?: string;
    incoterm?: string;
    
    createdAt: any;
    createdBy: { uid: string; name: string };
    updatedAt?: any;
}
