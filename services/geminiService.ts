
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RCMItem, FileData, InspectionSheet } from "../types";

// Define the expected output schema for structured JSON
const rcmSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      component: { 
        type: Type.STRING, 
        description: "Standard component name at Level 3/4 (e.g., 'Main Shaft', 'Mechanical Seal', 'Bearing Housing', 'Drive Motor')." 
      },
      componentIntel: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Plain-English explanation of what this part is." },
          location: { type: Type.STRING, description: "Where it is typically found on the asset." },
          visualCues: { type: Type.STRING, description: "What to look for (colors, shapes, textures) to identify it." }
        },
        required: ["description", "location", "visualCues"]
      },
      function: { 
        type: Type.STRING,
        description: "The primary function of the component."
      },
      functionalFailure: { 
        type: Type.STRING,
        description: "How the component fails to fulfill its function."
      },
      failureMode: { 
        type: Type.STRING,
        description: "Strictly: [Mechanism] due to [Cause]. Example: 'Erosion due to abrasive slurry' or 'Seizure due to loss of lubrication'."
      },
      failureEffect: { 
        type: Type.STRING,
        description: "The immediate impact on safety, environment, and operations."
      },
      consequenceCategory: {
        type: Type.STRING,
        enum: [
          'Hidden - Safety/Env', 
          'Hidden - Operational', 
          'Evident - Safety/Env', 
          'Evident - Operational',
          'Evident - Non-Operational'
        ],
        description: "SAE JA1011 Consequence classification."
      },
      iso14224Code: {
        type: Type.STRING,
        description: "Standard failure code (e.g., Wear, Corrosion, Fatigue, Overheating, Leakage, Breakage)."
      },
      criticality: { 
        type: Type.STRING, 
        enum: ["High", "Medium", "Low"],
        description: "Qualitative priority."
      },
      severity: {
        type: Type.INTEGER,
        description: "Severity (1-10). If safety is compromised, score 9-10. Major production loss is 8+."
      },
      occurrence: {
        type: Type.INTEGER,
        description: "Occurrence (1-10). Typical frequency in industrial settings."
      },
      detection: {
        type: Type.INTEGER,
        description: "Detection (1-10). 10 is impossible to detect visually."
      },
      maintenanceTask: { 
        type: Type.STRING,
        description: "Recommended maintenance action (e.g., 'Vibration Analysis', 'Scheduled Replacement')."
      },
      interval: { 
        type: Type.STRING,
        description: "Maintenance frequency (e.g., 'Monthly', 'Annual')."
      },
      taskType: {
        type: Type.STRING,
        enum: [
          'Condition Monitoring', 
          'Time-Based', 
          'Run-to-Failure', 
          'Redesign',
          'Failure Finding',
          'Lubrication',
          'Servicing',
          'Restoration',
          'Replacement'
        ],
        description: "Strategy category."
      }
    },
    required: ["component", "componentIntel", "function", "functionalFailure", "failureMode", "failureEffect", "consequenceCategory", "iso14224Code", "criticality", "severity", "occurrence", "detection", "maintenanceTask", "interval", "taskType"]
  }
};

const inspectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    responsibility: { type: Type.STRING },
    estimatedTime: { type: Type.STRING },
    safetyPrecautions: { type: Type.STRING },
    toolsRequired: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER },
          description: { type: Type.STRING },
          criteria: { type: Type.STRING },
          technique: { type: Type.STRING }
        },
        required: ["step", "description", "criteria", "technique"]
      }
    }
  },
  required: ["responsibility", "estimatedTime", "safetyPrecautions", "toolsRequired", "steps"]
};

export const generateRCMAnalysis = async (
  contextText: string,
  fileData: FileData | null
): Promise<RCMItem[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not set");

    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];

    if (fileData) {
      parts.push({
        inlineData: { mimeType: fileData.mimeType, data: fileData.data }
      });
      parts.push({ text: "Perform a level-4 component decomposition and RCM study based on this document." });
    }

    if (contextText) {
      parts.push({ text: `Operational Context:\n${contextText}` });
    }

    parts.push({
      text: `Perform a COMPREHENSIVE and RIGOROUS RCM/FMECA study. 
      
      ANALYSIS SCOPE:
      - Target Volume: Generate approximately 30-35 distinct failure mode items.
      - Component Level: Level 3 or 4 (e.g. 'Drive Motor', 'Main Coupling', 'Discharge Valve'). Do not be too granular (screws) or too broad (the whole machine).

      COMPONENT INTEL MANDATE:
      - For every component, provide a layman physical description, typical location, and visual identification cues.

      RISK SCORING (RPN):
      - We require realistic industrial risk assessment. 
      - SEVERITY: If a failure stops production or risks injury, use 8-10.
      - DETECTION: If internal, use 8-10.
      - Aim for RPNs that clearly highlight criticalities (range of 150-500).

      Compliance: SAE JA1011 and ISO 14224.`
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: rcmSchema,
        seed: 42, 
        thinkingConfig: { thinkingBudget: 24000 },
        systemInstruction: `You are a Senior Maintenance Engineer. You provide professional, comprehensive RCM reports that strike a balance between high-level summaries and exhaustive audits. Your risk assessments are realistic and favor safety/availability.`
      }
    });

    const rawData = JSON.parse(response.text || "[]") as Omit<RCMItem, 'id' | 'rpn'>[];
    
    return rawData.map((item, index) => {
      const s = item.severity || 8;
      const o = item.occurrence || 5;
      const d = item.detection || 6;
      return { 
        ...item, 
        severity: s,
        occurrence: o,
        detection: d,
        rpn: s * o * d,
        id: `rcm-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}` 
      };
    });

  } catch (error) {
    console.error("RCM Generation Error:", error);
    throw error;
  }
};

export const generateInspectionSheet = async (item: RCMItem): Promise<InspectionSheet> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not set");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Create a technical inspection procedure for: ${item.maintenanceTask} on ${item.component}.
    Ensure 5 clear technical steps with pass/fail criteria.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: inspectionSchema,
        seed: 42,
        thinkingConfig: { thinkingBudget: 4000 },
        systemInstruction: "Technical Procedure Author. Professional and actionable."
      }
    });

    return JSON.parse(response.text || "{}") as InspectionSheet;
  } catch (error) {
    console.error("Inspection Sheet Error", error);
    throw error;
  }
};
