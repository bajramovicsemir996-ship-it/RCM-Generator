
import { GoogleGenAI, Type } from "@google/genai";
import { RCMItem, FileData, InspectionSheet, ComponentIntel } from "../types";

// Define the expected output schema for structured JSON
const rcmSchema = {
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
          description: { 
            type: Type.STRING, 
            description: "A concise technical physical description (2-3 sentences). Detail metallurgy and construction. DO NOT use double quotes or mention images." 
          },
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

const inspectionSchema = {
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

const componentIntelSchema = {
  type: Type.OBJECT,
  properties: {
    description: { 
      type: Type.STRING, 
      description: "A concise technical physical description (2-3 sentences). Detail metallurgy and construction. DO NOT use double quotes." 
    },
    location: { type: Type.STRING, description: "Where it is typically found on the asset." },
    visualCues: { type: Type.STRING, description: "What to look for (colors, shapes, textures) to identify it." }
  },
  required: ["description", "location", "visualCues"]
};

export const generateRCMAnalysis = async (
  contextText: string,
  fileData: FileData | null,
  existingItems: RCMItem[] = []
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

    let avoidanceInstruction = "";
    if (existingItems.length > 0) {
      const existingSummary = existingItems.map(i => `${i.component} (${i.failureMode})`).join(", ");
      avoidanceInstruction = `\n\nIMPORTANT: Avoid duplicating these existing failure modes already analyzed: ${existingSummary}. Focus on discovering ADDITIONAL or missed failure mechanisms and components within the Level 4 scope.`;
    }

    parts.push({
      text: `Perform a COMPREHENSIVE and RIGOROUS RCM/FMECA study. ${avoidanceInstruction}
      
      ANALYSIS SCOPE:
      - Target Volume: Generate approximately ${existingItems.length > 0 ? '10-15 NEW' : '30-35'} distinct failure mode items.
      - Component Level: Level 3 or 4 (e.g. 'Drive Motor', 'Main Coupling', 'Discharge Valve').

      COMPONENT INTEL MANDATE:
      - Provide a concise technical physical description for every component (2-3 sentences).
      - Detail materials and primary construction.
      - DO NOT mention anything about "sketches", "images", or "drawings".
      - DO NOT use double quotes in your text response.

      RISK SCORING (RPN):
      - We require realistic industrial risk assessment. 
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
        systemInstruction: `You are a Senior Maintenance Engineer. You provide professional, comprehensive RCM reports. Your component descriptions are strictly concise technical physical breakdowns. You never include meta-commentary or disclaimers about image generation capabilities. You never use double quotes in descriptions.`
      }
    });

    const responseText = response.text || "[]";
    const rawData = JSON.parse(responseText) as Omit<RCMItem, 'id' | 'rpn'>[];
    
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
        id: `rcm-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        isNew: true
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
    Ensure 5 clear technical steps with pass/fail criteria. The 'technique' or 'method' field MUST be extremely short (1-2 words only). DO NOT use double quotes in the response text.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: inspectionSchema,
        seed: 42,
        thinkingConfig: { thinkingBudget: 4000 },
        systemInstruction: "Technical Procedure Author. Your task is to produce strictly actionable maintenance steps. You favor brevity in the 'technique' field and never use double quotes."
      }
    });

    return JSON.parse(response.text || "{}") as InspectionSheet;
  } catch (error) {
    console.error("Inspection Sheet Error", error);
    throw error;
  }
};

export const generateComponentIntel = async (componentName: string): Promise<ComponentIntel> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not set");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Provide concise technical physical intelligence for the component: ${componentName}.
    Include a technical description (metallurgy/construction, 2-3 sentences), typical location on an industrial asset, and visual identification cues. DO NOT use double quotes.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: componentIntelSchema,
        seed: 42,
        thinkingConfig: { thinkingBudget: 4000 },
        systemInstruction: "Senior Maintenance Engineer. You provide professional, concise technical physical breakdowns for industrial components. You never use double quotes."
      }
    });

    return JSON.parse(response.text || "{}") as ComponentIntel;
  } catch (error) {
    console.error("Component Intel Error", error);
    throw error;
  }
};

export const extractOperationalContext = async (fileData: FileData): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not set");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      TASK:
      Analyze the attached technical document and extract a comprehensive RCM "Operational Context" draft according to SAE JA1011 standards. 

      STRUCTURE THE OUTPUT INTO THESE SECTIONS (CAPITALIZED):
      1. SYSTEM BOUNDARIES: List main components and boundaries.
      2. FUNCTIONAL REQUIREMENTS: Primary and secondary functions.
      3. OPERATING CONDITIONS: Environment, duty cycle, etc.
      4. FAILURE MECHANISMS: Likely wear/failure modes mentioned or implied.
      5. MAINTENANCE INTENT: The strategic goal for this asset.

      FORMATTING:
      - Plain text only.
      - Use clear section headers.
      - Use bullet points (-).
      - No markdown symbols like # or **.
      - DO NOT use double quotes in the text.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: "You are a Senior Reliability Analyst. You read technical documentation and synthesize structured SAE JA1011 Operational Context drafts."
      }
    });

    return response.text || "No operational context could be extracted.";
  } catch (error) {
    console.error("Context Extraction Error:", error);
    throw error;
  }
};
