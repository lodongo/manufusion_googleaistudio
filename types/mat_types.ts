// types/mat_types.ts
// FIX: Add Timestamp type from firebase compat to be used in Answer interface.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export type Timestamp = firebase.firestore.Timestamp;

export interface Pillar {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface OrgPillarConfig {
    id: string;
    enabled: boolean;
    name: string;
    code: string;
    description: string;
}

export interface Stage {
  id: string;
  code: string;
  name: string;
}

export interface Theme {
  id: string;
  code: string;
  name: string;
}

export interface Question {
  id: string;
  code: string;
  text: string;
  audit_guidelines: string[];
}

export interface FullPillar extends Pillar {
    stages: FullStage[];
}

export interface FullStage extends Stage {
    themes: FullTheme[];
    totalQuestions: number;
}

export interface FullTheme extends Theme {
    questions: Question[];
}

export interface AssessmentPeriod {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'Open' | 'Closed';
    // Optional fields used in admin
    targetLevel?: number;
    targetId?: string;
    targetName?: string;
    targetCode?: string;
}

export interface Assessment {
    id: string;
    periodId: string;
    pillarId: string;
    pillarName: string;
    status: 'Not Started' | 'In Progress' | 'Completed';
    overallScore?: number;
    previousScore?: number;
    scoresByStage?: Record<string, number>; // key: stageId
    scoresByTheme?: Record<string, number>; // key: themeId
    updatedAt?: Timestamp;
    updatedBy?: { uid: string, name: string };
    periodName?: string; // Added to fix error
}

// FIX: Update evidence type to match the richer EvidenceItem type used in mat_user.tsx. This resolves a type conflict.
// Also defining and exporting Answer interface.
export interface EvidenceItem {
  name: string;
  url: string;
  comment?: string;
  uploadedBy?: string;
  uploadedAt?: Timestamp;
  storagePath?: string;
}

export interface Answer {
  id: string;
  questionText: string;
  stageId: string;
  stageName: string;
  themeId: string;
  themeName: string;
  checkedGuidelines: string[];
  isQualified: boolean;
  comments: string;
  evidence: EvidenceItem[];
  updatedAt: Timestamp;
  updatedBy: {
    uid: string;
    name: string;
  };
}