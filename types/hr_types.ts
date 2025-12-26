

export interface FamilyMember {
    id: string;
    firstName: string;
    lastName: string;
    relationship: 'Mother' | 'Father' | 'Sibling' | 'Child' | 'Spouse' | 'Grandmother' | 'Grandfather' | 'Mother-In-Law' | 'Father-In-Law' | 'Grandmother-In-Law' | 'Grandfather-In-Law';
    dateOfBirth?: string;
    gender?: 'Male' | 'Female' | 'Other';
}

export interface NextOfKin {
    id: string;
    firstName: string;
    lastName: string;
    relationship: 'Friend' | 'Colleague' | 'Sibling' | 'Child' | 'Spouse' | 'Other';
    phoneNumber: string;
    email?: string;
}

export interface EducationEntry {
    id: string;
    institution: string;
    qualificationPath: string; // Path to HR/Qualifications
    qualificationName: string; // Denormalized
    yearCompleted: string;
}

export interface EmployeeSkill {
    id: string;
    skillPath: string; // Path to HR/Skills
    skillName: string; // Denormalized
    proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

export interface EmploymentHistoryEntry {
    id: string;
    roleId: string;
    roleName: string;
    startDate: string;
    endDate: string; // Can be a date string or 'To Date'
    employmentType: 'Temporary' | 'Contract' | 'Permanent' | 'Acting';
    contractEndDate?: string;
    actingEndDate?: string;
    reportsToRoleId?: string | null;
    reportsToPersonUid?: string;
    reportsToPersonName?: string;
    reasonForLeaving?: 'Promotion' | 'New Assignment' | 'Retirement' | 'Resignation' | 'Dismissal' | 'Death' | 'Expired' | 'End of Contract' | 'End of Acting Period' | 'Other';
    archived?: boolean;
}

export interface CareerProfession {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface CareerLevel {
  id: string;
  name: string;
  description: string;
  order: number;
  enabled: boolean;
}

export interface CareerCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface Qualification {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface QualificationLevel {
  id: string;
  name: string;
  description: string;
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

export interface SkillSubcategory {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

export interface SkillCategory {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  abbreviation: string;
  level: number;
  description: string;
  reportsToRoleId: string | null;
  departmentPath: string; // Firestore path to the OrgHierarchy node
  departmentName: string; // Denormalized name for display
  careerProfessionPath: string; // Firestore path to the HR/Careers profession
  careerProfessionName: string; // Denormalized name for display
}

// Payroll Types
export interface GlAccount {
    id: string;
    name: string;
    description: string;
}

export interface DeductionBracket {
    from: number;
    to: number | null; // null for infinity
    rate: number; // as a percentage, e.g., 10 for 10%
}

export interface MandatoryDeduction {
    id: string;
    name: string;
    type: 'Flatrate' | 'Percentage';
    percentageOf?: 'Gross';
    hasBrackets?: boolean;
    brackets?: DeductionBracket[];
    settlementGlAccountId: string;
    settlementGlAccountName: string;
}

export interface Allowance {
    id: string;
    name: string;
    type: 'Flatrate' | 'Percentage';
    percentageOf?: 'Gross';
    settlementGlAccountId: string;
    settlementGlAccountName: string;
}