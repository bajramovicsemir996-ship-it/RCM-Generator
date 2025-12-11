
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
    required: ["component", "function", "functionalFailure", "failureMode", "failureEffect", "criticality", "severity", "occurrence", "detection", "maintenanceTask", "interval", "taskType"]
  }
};

const inspectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    checkPointDescription: { type: Type.STRING, description: "Detailed instruction on what to check." },
    type: { type: Type.STRING, enum: ['Qualitative', 'Quantitative'], description: "Is the check based on measurement (Quantitative) or observation (Qualitative)?" },
    estimatedTime: { type: Type.STRING, description: "Estimated duration to complete the task (e.g. '15 mins')." },
    criteriaLimits: { type: Type.STRING, description: "Specific Pass/Fail criteria or numerical limits (e.g. '> 50 psi', 'No visible cracks')." },
    responsibility: { type: Type.STRING, description: "Role responsible for execution (e.g. 'Operator', 'Mech. Tech', 'Electrician')." }
  },
  required: ['checkPointDescription', 'type', 'estimatedTime', 'criteriaLimits', 'responsibility']
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
         - Correct Example: "Surface wear due to abrasion from bullets and scale"
         - Correct Example: "Motor burnout due to winding insulation degradation"
         - Incorrect Example: "Wear and tear"
      
      2. **Maximum Detail**: Provide the most detailed, exhaustive, and technical analysis possible. Do not summarize. Break down every component into its specific failure modes. 
      
      3. **Separation**: 
         - Never combine multiple failure modes in one row. 
         - Never combine multiple distinct maintenance tasks in one row.
         - If a component has 3 failure modes, generate 3 separate items.
         - If a failure mode requires an inspection AND a replacement, generate 2 separate items.
      
      For each item, estimate the FMECA scores (Severity, Occurrence, Detection) on a scale of 1-10 based on standard industry practices for similar equipment.`
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: rcmSchema,
        systemInstruction: "You are a World-Class Senior Reliability Engineer. Provide the most detailed, expert-level analysis possible. Strict JSON output. Adhere rigidly to the 'Mechanism due to Cause' format for failure modes. Do not include markdown formatting."
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response generated from Gemini.");
    }

    // Parse JSON and add ROBUST Unique IDs
    const rawData = JSON.parse(text) as Omit<RCMItem, 'id' | 'rpn'>[];
    
    // Using index + random ensures uniqueness even if processed in the same millisecond
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

    const prompt = `Create a maintenance inspection sheet entry for this specific task:
    
    Component: ${item.component}
    Failure Mode: ${item.failureMode}
    Proposed Task: ${item.maintenanceTask}
    
    Provide:
    1. A detailed Check Point Description (what exactly to look for/measure).
    2. Task Type (Qualitative or Quantitative).
    3. Estimated Time (e.g. "10 mins").
    4. Criteria / Limits: Specific values, limits, or pass/fail criteria (e.g. "> 40°C", "No leaks", "Vibration < 4mm/s").
    5. Responsibility: Who should perform this? (e.g. Operator, Mechanical Technician, Instrument Tech).
    
    Do NOT provide remarks. The remarks section will be left blank for the operator.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: inspectionSchema
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
