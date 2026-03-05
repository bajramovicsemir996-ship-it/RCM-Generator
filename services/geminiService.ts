import { GoogleGenAI, Type } from "@google/genai";
import { RCMItem, FileData, InspectionSheet, ComponentIntel } from "../types";

// Define the expected output schema for structured JSON
const rcmSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      functionType: { 
        type: Type.STRING, 
        enum: ['Primary', 'Secondary'],
        description: "The category of the function."
      },
      function: { 
        type: Type.STRING,
        description: "The asset-level function description. Example: 'Maintain 50 bar discharge pressure' or 'Provide structural containment of lubricant'."
      },
      functionalFailure: { 
        type: Type.STRING,
        description: "The specific way the function is lost (e.g., 'Total loss of discharge pressure', 'External lubricant leakage')."
      },
      component: { 
        type: Type.STRING, 
        description: "The specific component within the assembly that contributes to this functional failure." 
      },
      componentType: {
        type: Type.STRING,
        enum: ['Electrical', 'Mechanical'],
        description: "Categorize if the component is primarily electrical or mechanical."
      },
      componentIntel: {
        type: Type.OBJECT,
        properties: {
          description: { 
            type: Type.STRING, 
            description: "Concise technical physical description. No quotes." 
          },
          location: { type: Type.STRING, description: "Location on asset." },
          visualCues: { type: Type.STRING, description: "Identification markers." }
        },
        required: ["description", "location", "visualCues"]
      },
      failureMode: { 
        type: Type.STRING,
        description: "[Mechanism] due to [Cause]. Include technical and human-induced causes."
      },
      failureEffect: { 
        type: Type.STRING,
        description: "Operational and safety impact."
      },
      consequenceCategory: {
        type: Type.STRING,
        enum: [
          'Hidden - Safety/Env', 
          'Hidden - Operational', 
          'Evident - Safety/Env', 
          'Evident - Operational',
          'Evident - Non-Operational'
        ]
      },
      iso14224Code: { 
        type: Type.STRING,
        enum: ["BRD", "LOP", "ELP", "INL", "VIB", "OHE", "STP", "FTS", "FTC", "FTO", "UST", "NOI", "LCP", "OTH"],
        description: "Strict ISO 14224 Failure Mechanism Code. Use ONLY the 3-letter shorthand code."
      },
      criticality: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
      severity: { type: Type.INTEGER, description: "1-10 Scale. Rigorous scoring: 9-10 for Safety/Env, 7-8 for total production loss." },
      occurrence: { type: Type.INTEGER, description: "1-10 Scale. Be conservative; assume higher frequencies for complex mechanical wear." },
      detection: { type: Type.INTEGER, description: "1-10 Scale. 7-10 for manual/periodic checks; 1-3 only for continuous automated monitoring." },
      maintenanceTask: { 
        type: Type.STRING,
        description: "Exactly one technical maintenance task."
      },
      interval: { type: Type.STRING },
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
          'Replacement',
          'Training',
          'Procedural Change'
        ]
      },
      inspectionSheet: {
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
      }
    },
    required: ["functionType", "component", "componentType", "componentIntel", "function", "functionalFailure", "failureMode", "failureEffect", "consequenceCategory", "iso14224Code", "criticality", "severity", "occurrence", "detection", "maintenanceTask", "interval", "taskType"]
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
    description: { type: Type.STRING },
    location: { type: Type.STRING },
    visualCues: { type: Type.STRING }
  },
  required: ["description", "location", "visualCues"]
};

const validationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      issues: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Specific logical or standard violations."
      }
    },
    required: ["id", "issues"]
  }
};

export const generateRCMAnalysis = async (
  contextText: string,
  filesData: FileData[] | null,
  language: string = 'English',
  existingItems: RCMItem[] = []
): Promise<RCMItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const fileParts = filesData ? filesData.map(file => ({
    inlineData: {
      data: file.data,
      mimeType: file.mimeType
    }
  })) : [];

  const prompt = `
    Analyze this asset as a WHOLE assembly using all provided technical documentation.
    Operational Context: ${contextText}
    Target Language: ${language}
    
    IMPORTANT: You MUST generate all technical content in ${language}.
    
    QUANTITY AND TYPE REQUIREMENTS:
    1. Generate AT LEAST 50 distinct failure modes for various technical components.
    2. Additionally, identify AT LEAST 10 failure modes specifically induced by HUMAN FACTORS (e.g., incorrect installation, improper maintenance procedure, operator oversight, or calibration error).
    3. Ensure a comprehensive breakdown of both Electrical and Mechanical components.
    
    RIGOROUS RISK SCORING PROTOCOL (RPN):
    - You MUST be conservative and aggressive in risk assessment to ensure the user clearly sees criticality.
    - Severity (S): Score 9-10 if there is ANY chance of safety or environmental impact. Score 7-8 for significant production loss or major downtime.
    - Occurrence (O): Be conservative. If a component is complex or operates in harsh environments (as per context), assume a higher likelihood of failure (score 6-9).
    - Detection (D): Score 8-10 for any failure mode that requires manual inspection or is "hidden". Only score 1-3 if there is continuous, fail-safe automated monitoring.
    - Resulting RPN scores should be high for critical items to emphasize the need for proactive maintenance.

    ISO 14224 Mapping: 'BRD', 'LOP', 'ELP', 'INL', 'VIB', 'OHE', 'STP', 'FTS', 'FTC', 'FTO', 'UST', 'NOI', 'LCP', 'OTH'.
    
    Exiting items to avoid duplicates: ${JSON.stringify(existingItems.map(i => i.failureMode))}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { 
        role: 'user', 
        parts: [
          ...fileParts,
          { text: prompt }
        ] 
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: rcmSchema,
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 0 }
    },
  });

  const parsed = JSON.parse(response.text || "[]") as RCMItem[];
  return parsed.map(item => ({
    ...item,
    id: `rcm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    rpn: (item.severity || 1) * (item.occurrence || 1) * (item.detection || 1),
    isNew: true,
    isApproved: false
  }));
};

export const extractOperationalContext = async (filesData: FileData[], language: string = 'English'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const fileParts = filesData.map(file => ({
    inlineData: {
      data: file.data,
      mimeType: file.mimeType
    }
  }));

  const prompt = `
    Analyze all the uploaded technical documents.
    TASK: Synthesize a comprehensive "Operational Context" for this asset following SAE JA1011 standards in ${language}.
    
    Include:
    1. Operational Profile (how it is used).
    2. Environmental Conditions.
    3. Performance Standards required.
    4. Known critical components.
    5. System boundaries.
    
    Format the response as a clear, professional technical summary in ${language}. Do not use bolding or markdown headers.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { 
        role: 'user', 
        parts: [
          ...fileParts,
          { text: prompt }
        ] 
      }
    ],
    config: {
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 }
    },
  });

  return response.text || "No context extracted.";
};

export const generateInspectionSheet = async (item: RCMItem, language: string = 'English'): Promise<InspectionSheet> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Generate a highly technical field inspection sheet for the following failure mode:
    Component: ${item.component}
    Failure Mode: ${item.failureMode}
    Maintenance Task: ${item.maintenanceTask}
    Target Language: ${language}
    
    Requirement: 3 to 5 clear operational steps with technical acceptance criteria.
    Output MUST be in ${language}.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: inspectionSchema,
      temperature: 0.4
    },
  });

  return JSON.parse(response.text || "{}") as InspectionSheet;
};

export const generateComponentIntel = async (componentName: string, language: string = 'English'): Promise<ComponentIntel> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Provide engineering intelligence for the industrial component: "${componentName}".
    Speak in: ${language}.
    Required: Physical description, typical mounting location, and visual cues for identification.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: componentIntelSchema,
      temperature: 0.3
    }
  });

  return JSON.parse(response.text || "{}") as ComponentIntel;
};

export const validateRCMAnalysis = async (items: RCMItem[], language: string = 'English'): Promise<{id: string, issues: string[]}[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Review the following RCM analysis for technical logical consistency and adherence to SAE JA1011 standards in ${language}.
    Analysis: ${JSON.stringify(items.map(i => ({ id: i.id, comp: i.component, fm: i.failureMode, task: i.maintenanceTask })))}
    
    Identify if any tasks are technically ineffective for the failure mode, or if RPN scores seem logically inconsistent.
    Output in ${language}.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: validationSchema,
      temperature: 0.1
    }
  });

  return JSON.parse(response.text || "[]");
};

export const translateRCMAnalysis = async (items: RCMItem[], targetLanguage: string): Promise<RCMItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Batch processing to avoid token limits
  const BATCH_SIZE = 10;
  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
    try {
      const prompt = `
        Translate the following RCM Analysis technical data into ${targetLanguage}.
        Maintain strict technical accuracy for engineering terms.
        
        Input Data: ${JSON.stringify(chunk)}
        
        Return the exact same JSON structure, but with all string values translated to ${targetLanguage}.
        
        DO NOT TRANSLATE (Keep English/Original):
        - id, rpn, severity, occurrence, detection, iso14224Code
        - Enums: criticality, consequenceCategory, functionType, componentType, taskType
        
        TRANSLATE THESE FIELDS:
        - function
        - functionalFailure
        - component
        - failureMode
        - failureEffect
        - maintenanceTask
        - interval
        - componentIntel (description, location, visualCues)
        - inspectionSheet (responsibility, safetyPrecautions, toolsRequired, steps[].description, steps[].criteria, steps[].technique)
        
        Output MUST be a valid JSON array of RCMItems.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: rcmSchema,
          temperature: 0.1
        }
      });

      const parsedChunk = JSON.parse(response.text || "[]") as RCMItem[];
      
      // Restore metadata for this chunk
      return parsedChunk.map((item, index) => {
        const original = chunk[index];
        return {
          ...item,
          id: original?.id || item.id,
          rpn: original?.rpn || item.rpn,
          isNew: original?.isNew,
          isApproved: original?.isApproved,
          // Ensure enums are preserved if translation messed them up (fallback)
          criticality: original?.criticality || item.criticality,
          consequenceCategory: original?.consequenceCategory || item.consequenceCategory,
          iso14224Code: original?.iso14224Code || item.iso14224Code
        };
      });
    } catch (error) {
      console.error("Translation chunk failed", error);
      // Fallback: return original chunk if translation fails
      return chunk;
    }
  }));

  // Flatten the array of arrays
  return translatedChunks.flat();
};

export const translateContext = async (text: string, targetLanguage: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Translate the following Operational Context technical description into ${targetLanguage}.
    Maintain professional engineering tone and terminology.
    
    Text:
    ${text}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      temperature: 0.1
    }
  });

  return response.text || text;
};
