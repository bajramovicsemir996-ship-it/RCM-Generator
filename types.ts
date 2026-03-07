
export interface InspectionStep {
  step: number;
  description: string;
  criteria: string;
  technique: string;
}

export interface InspectionSheet {
  responsibility: string;
  estimatedTime: string;
  safetyPrecautions: string;
  toolsRequired: string;
  steps: InspectionStep[];
  
  checkPointDescription?: string;
  type?: 'Qualitative' | 'Quantitative';
  criteriaLimits?: string; 
  normalCondition?: string; 
}

export interface ComponentIntel {
  description: string;
  location: string;
  visualCues: string;
}

export type ConsequenceCategory = 
  | 'Hidden - Safety/Env' 
  | 'Hidden - Operational' 
  | 'Evident - Safety/Env' 
  | 'Evident - Operational'
  | 'Evident - Non-Operational';

export interface RCMItem {
  id: string;
  component: string;
  componentType: 'Electrical' | 'Mechanical';
  functionType: 'Primary' | 'Secondary';
  function: string;
  functionalFailure: string;
  failureMode: string;
  failureEffect: string;
  criticality: 'High' | 'Medium' | 'Low';
  
  consequenceCategory: ConsequenceCategory;
  iso14224Code: string;

  severity: number;
  occurrence: number;
  detection: number;
  rpn: number;

  maintenanceTask: string;
  interval: string;
  pfInterval?: string; // New field for reliability optimization
  taskType: 'Condition Monitoring' | 'Time-Based' | 'Run-to-Failure' | 'Redesign' | 'Failure Finding' | 'Lubrication' | 'Servicing' | 'Restoration' | 'Replacement' | 'Training' | 'Procedural Change';
  inspectionSheet?: InspectionSheet;
  componentIntel?: ComponentIntel;
  isNew?: boolean;
  isMiraGenerated?: boolean;
  isApproved?: boolean;
  validationIssues?: string[];
}

export interface AnalysisStats {
  totalItems: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}

export type InputMode = 'manual' | 'upload';

export interface FileData {
  name: string;
  mimeType: string;
  data: string;
}

export interface Folder {
  id: string;
  name: string;
  timestamp: number;
}

export interface SavedStudy {
  id: string;
  name: string;
  timestamp: number;
  items: RCMItem[];
  contextText: string;
  language?: string;
  fileName?: string;
  folderId?: string;
  isFinished?: boolean;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}