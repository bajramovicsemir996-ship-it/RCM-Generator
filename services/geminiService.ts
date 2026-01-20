
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
        description: "The specific sub-component or part being analyzed (e.g., 'Pump Impeller', 'Seal')." 
      },
      function: { 
        type: Type.STRING,
        description: "The primary function of the component in this context."
      },
      functionalFailure: { 
        type: Type.STRING,
        description: "How the component fails to fulfill its function."
      },
      failureMode: { 
        type: Type.STRING,
        description: "A SINGLE specific failure mode formatted strictly as '[Mechanism] due to [Cause]'. Example: 'Surface wear due to abrasion from scale'."
      },
      failureEffect: { 
        type: Type.STRING,
        description: "The immediate effect of the failure on the system or safety."
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
        description: "Standard failure mechanism code from ISO 14224 (e.g., 'Wear', 'Corrosion', 'Fatigue', 'Overheating', 'Leakage', 'Breakage')."
      },
      criticality: { 
        type: Type.STRING, 
        enum: ["High", "Medium", "Low"],
        description: "Qualitative risk assessment."
      },
      severity: {
        type: Type.INTEGER,
        description: "FMECA Severity Score (1-10). 10 is hazardous/catastrophic, 1 is no effect."
      },
      occurrence: {
        type: Type.INTEGER,
        description: "FMECA Occurrence Score (1-10). 10 is very frequent failure, 1 is unlikely."
      },
      detection: {
        type: Type.INTEGER,
        description: "FMECA Detection Score (1-10). 10 is absolute uncertainty (cannot detect), 1 is almost certain detection before failure."
      },
      maintenanceTask: { 
        type: Type.STRING,
        description: "A SINGLE recommended maintenance action. If multiple distinct tasks are required (e.g. 'Visual Check' AND 'Vibration'), create separate items."
      },
      interval: { 
        type: Type.STRING,
        description: "Recommended frequency of the task (e.g., 'Weekly', 'Every 2000 hours')."
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
        description: "The specific category of the maintenance strategy."
      }
    },
    required: ["component", "function", "functionalFailure", "failureMode", "failureEffect", "consequenceCategory", "iso14224Code", "criticality", "severity", "occurrence", "detection", "maintenanceTask", "interval", "taskType"]
  }
};

const inspectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    responsibility: { type: Type.STRING, description: "Role responsible (e.g. Operator, Mech. Tech)" },
    estimatedTime: { type: Type.STRING, description: "Total duration e.g. '30 mins'" },
    safetyPrecautions: { type: Type.STRING, description: "Required PPE only (e.g. Gloves, Goggles). Exclude LOTO/Administrative warnings." },
    toolsRequired: { type: Type.STRING, description: "List of tools, gauges, or consumables needed." },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER },
          description: { type: Type.STRING, description: "Direct technical instruction. Start with action verb." },
          criteria: { type: Type.STRING, description: "Technical pass/fail limit or condition." },
          technique: { type: Type.STRING, description: "Method (e.g. Visual, Ultrasonic, Multimeter)" }
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
    if (!apiKey) {
      throw new Error("API_KEY environment variable is not set.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const parts: any[] = [];

    // Add file content if available
    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data,
        },
      });
      parts.push({
        text: "Analyze the uploaded document/image containing operational context or technical specifications."
      });
    }

    // Add manual text context
    if (contextText) {
      parts.push({
        text: `Operational Context provided by user:\n${contextText}`
      });
    }

    parts.push({
      text: `Perform a granular, expert-level Reliability Centered Maintenance (RCM) and FMECA analysis based on the information provided. 
      
      CRITICAL INSTRUCTIONS:
      1. **Failure Mode Formatting**: You MUST format all failure modes strictly using the structure "[Failure Mechanism] due to [Specific Cause]". 
      2. **Consequence Analysis (SAE JA1011)**: Evaluate if the failure is 'Hidden' (not apparent to the operator) or 'Evident'. Then determine if it has Safety/Env, Operational, or Non-Operational consequences.
      3. **ISO 14224 Classification**: Assign a standard Failure Mechanism classification for CMMS cleaning (e.g., Wear, Corrosion, Fatigue, Breakage, Deformation, Overheating, External Leakage).
      4. **Task Targeting**: If a failure is 'Hidden', strongly consider 'Failure Finding' tasks. If 'Evident', use Condition Monitoring or Time-Based Restoration/Replacement.
      5. **Maximum Detail**: Provide the most detailed, exhaustive, and technical analysis possible. Do not summarize. Break down every component into its specific failure modes. 
      6. **Separation**: 
         - Never combine multiple failure modes in one row. 
         - If a component has 3 failure modes, generate 3 separate items.
      
      For each item, estimate the FMECA scores (Severity, Occurrence, Detection) on a scale of 1-10 based on standard industry practices for similar equipment.`
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: rcmSchema,
        systemInstruction: "You are a World-Class Senior Reliability Engineer. Provide the most detailed, expert-level analysis possible. Strict JSON output. Adhere rigidly to SAE JA1011 RCM principles and ISO 14224 taxonomy. Do not include markdown formatting."
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response generated from Gemini.");
    }

    // Parse JSON and add ROBUST Unique IDs
    const rawData = JSON.parse(text) as Omit<RCMItem, 'id' | 'rpn'>[];
    
    return rawData.map((item, index) => ({ 
      ...item, 
      severity: item.severity || 5,
      occurrence: item.occurrence || 3,
      detection: item.detection || 3,
      rpn: (item.severity || 5) * (item.occurrence || 3) * (item.detection || 3),
      id: `rcm-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}` 
    }));

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

    const prompt = `Create a technical inspection procedure for the task: ${item.maintenanceTask}.
    
    Equipment Context:
    Component: ${item.component}
    Failure Mode: ${item.failureMode}
    Consequence Category: ${item.consequenceCategory}
    ISO 14224 Taxonomy: ${item.iso14224Code}
    
    STRICT CONTENT RULES:
    1. EXCLUDE all Lockout/Tagout (LOTO) steps or mentions.
    2. EXCLUDE all administrative preparation steps.
    3. EXCLUDE general area preparation.
    4. START IMMEDIATELY with technical steps.
    5. Provide exactly 3 to 4 sequential steps.
    6. For 'Safety Precautions', list ONLY physical PPE.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: inspectionSchema,
        systemInstruction: "You are a Senior Technical Lead. Create work instructions that are 100% technical. Focus strictly on the core mechanical/electrical/inspection steps."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text) as InspectionSheet;

  } catch (error) {
    console.error("Inspection Sheet Gen Error", error);
    throw error;
  }
};
