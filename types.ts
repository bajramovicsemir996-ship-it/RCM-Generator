
export interface InspectionStep {
  step: number;
  description: string;
  criteria: string;
  technique: string;
}

export interface InspectionSheet {
  responsibility: string;
  estimatedTime: string;
  safetyPrecautions: string; // New: Safety warnings/PPE
  toolsRequired: string;     // New: Tools list
  steps: InspectionStep[];   // New: List of steps
  
  // Legacy fields for backward compatibility
  checkPointDescription?: string;
  type?: 'Qualitative' | 'Quantitative';
  criteriaLimits?: string; 
  normalCondition?: string; 
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
  
  // Consequence Analysis (SAE JA1011)
  consequenceCategory: ConsequenceCategory;
  
  // CMMS Taxonomy (ISO 14224)
  iso14224Code: string; // e.g., "Wear", "Fatigue", "Corrosion"

  // FMECA Fields
  severity: number;    // 1-10
  occurrence: number;  // 1-10
  detection: number;   // 1-10
  rpn: number;         // Calculated (S * O * D)

  maintenanceTask: string;
  interval: string;
  taskType: 'Condition Monitoring' | 'Time-Based' | 'Run-to-Failure' | 'Redesign' | 'Failure Finding' | 'Lubrication' | 'Servicing' | 'Restoration' | 'Replacement';
  inspectionSheet?: InspectionSheet;
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
  data: string; // base64
}

export interface SavedStudy {
  id: string;
  name: string;
  timestamp: number;
  items: RCMItem[];
  contextText: string;
  fileName?: string;
}
