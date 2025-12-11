
export interface InspectionSheet {
  checkPointDescription: string;
  type: 'Qualitative' | 'Quantitative';
  estimatedTime: string;
  criteriaLimits: string; // Replaces normalCondition
  responsibility: string; // New field for "Who should do it"
  
  // Legacy field for backward compatibility with previously saved studies
  normalCondition?: string; 
}

export interface RCMItem {
  id: string;
  component: string;
  function: string;
  functionalFailure: string;
  failureMode: string;
  failureEffect: string;
  criticality: 'High' | 'Medium' | 'Low';
  
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
