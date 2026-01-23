
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
  taskType: 'Condition Monitoring' | 'Time-Based' | 'Run-to-Failure' | 'Redesign' | 'Failure Finding' | 'Lubrication' | 'Servicing' | 'Restoration' | 'Replacement';
  inspectionSheet?: InspectionSheet;
  componentIntel?: ComponentIntel;
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

export interface SavedStudy {
  id: string;
  name: string;
  timestamp: number;
  items: RCMItem[];
  contextText: string;
  fileName?: string;
}
