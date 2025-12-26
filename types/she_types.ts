
// types/she_types.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export type Timestamp = firebase.firestore.Timestamp;

export interface SheCategory {
    id: string; // Firestore document ID
    code: string;
    name: string;
    description: string;
    enabled: boolean;
}

export interface SheItem {
    id: string; // Firestore document ID
    name: string;
    description: string;
    enabled: boolean;
}

export interface HazardCategory extends SheCategory {}
export interface Hazard extends SheItem {}

export interface InjuryCategory extends SheCategory {}
export interface Injury extends SheItem {}

export interface ControlCategory extends SheCategory {}
export interface Control extends SheItem {}

export interface RatingLevel {
    id: string; // Auto-generated
    name: string;
    score: number;
    description: string;
}

export interface RatingComponent {
    id: string; // Document ID (same as code)
    code: string;
    name: string;
    description: string;
    levels: RatingLevel[];
}

export interface OperatingMode {
    id: string; // Firestore document ID, will be the level as a string
    level: number;
    name: string;
    description: string;
    enabled: boolean;
}

export interface SheRiskAssessmentSettings {
    id?: string;
    riskFormula: string[]; // Array of RatingComponent codes
    intolerableCutoff: number;
    updatedAt?: Timestamp;
    updatedBy?: {
        uid: string;
        name: string;
    };
}

export interface RiskControl {
    controlCategoryCode: string;
    controlCategoryName: string;
    controlId: string;
    controlName: string;
    controlDescription: string;
    // Pre-task execution fields
    isPreTask?: boolean;
    durationMinutes?: number;
    assignedToUid?: string;
    assignedToName?: string;
}

export interface RiskAssessmentItem {
  id: string;
  hazardCategoryCode: string;
  hazardCategoryName: string;
  hazardId: string;
  hazardName: string;
  hazardDescription: string;
  initialRatings: Record<string, number>;
  initialScore: number;
  isIntolerable: boolean;
  controls: RiskControl[];
  controlDetails: string;
  residualRatings: Record<string, number>;
  residualScore: number;
  isResidualTolerable: boolean;
}
