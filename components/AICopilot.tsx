
import { GoogleGenAI } from "@google/genai";
import React, { useState, useRef, useEffect } from 'react';
import { RCMItem, ConsequenceCategory } from '../types';
import { 
  X, Send, Sparkles, ChevronDown, 
  Plus, CheckCircle2, Search, 
  UserCheck, ShieldAlert, Zap, Loader2, LayoutGrid, 
  ChevronRight, RotateCcw, Target, Info, AlertTriangle, Wrench, Box, Activity, FileText, ClipboardList, Database, ShieldX, ClipboardCheck
} from 'lucide-react';

interface AICopilotProps {
  data: RCMItem[] | null;
  onUpdate: (newData: RCMItem[]) => void;
  language: string;
}

interface ProposedAction {
  id: string; 
  type: 'ADD' | 'UPDATE' | 'DELETE';
  item: Partial<RCMItem>;
  reason: string;
  applied?: boolean;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  proposals?: ProposedAction[];
  isFacilitatorInsight?: boolean;
}

const FormattedMessage: React.FC<{ text: string; role: 'user' | 'model'; isFacilitator?: boolean }> = ({ text, role }) => {
  const lines = (text || '').split('\n');
  
  return (
    <div className={`space-y-2 ${role === 'model' ? 'text-slate-700' : 'text-white'}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const cleanLine = line.replace(/\*\*/g, '').replace(/#/g, '').trim();
        if (!cleanLine) return <div key={idx} className="h-2" />;

        const isQuestion = cleanLine.endsWith('?');

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <ChevronRight size={12} className={`shrink-0 mt-1 ${role === 'model' ? 'text-indigo-400' : 'text-white opacity-50'}`} />
              <span className={`flex-1 text-[13px] font-medium leading-relaxed ${isQuestion ? 'text-indigo-700 font-bold italic' : ''}`}>
                {cleanLine.replace(/^[*|-]\s*/, '')}
              </span>
            </div>
          );
        }

        return (
          <p key={idx} className={`leading-relaxed text-[13px] font-medium ${isQuestion && role === 'model' ? 'bg-indigo-50 p-2 rounded-lg border-l-4 border-indigo-600 text-indigo-900 shadow-sm' : ''}`}>
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
};

export const AICopilot: React.FC<AICopilotProps> = ({ data, onUpdate, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages, isLoading]);

  const parseAIResponse = (text: string): { cleanText: string, proposals?: ProposedAction[] } => {
    const actionRegex = /<ACTION>([\s\S]*?)<\/ACTION>/gi;
    const proposals: ProposedAction[] = [];
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
      try {
        let content = match[1].trim();
        // Remove markdown wrappers
        content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        
        // Handle cases where model might wrap in parentheses
        if (content.startsWith('(') && content.endsWith(')')) {
          content = content.substring(1, content.length - 1);
        }

        const raw = JSON.parse(content);
        const actions = Array.isArray(raw) ? raw : [raw];
        
        actions.forEach((a: any) => {
          if (a && typeof a === 'object') {
            // Check if the structure is nested or flat
            const itemData = a.item || a.data || (a.component ? a : null);
            if (itemData && (itemData.component || itemData.failureMode)) {
              proposals.push({
                id: `proposal-${Math.random().toString(36).substr(2, 9)}`,
                type: (a.type as any) || 'ADD',
                reason: a.reason || 'Strategic reliability enhancement recommendation.',
                item: itemData,
                applied: false
              });
            }
          }
        });
      } catch (e) {
        console.error("MIRA Extraction Error: Tag found but JSON invalid.", e);
      }
    }

    const textWithoutActions = text.replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '').trim();
    return { cleanText: textWithoutActions, proposals: proposals.length > 0 ? proposals : undefined };
  };

  const RCM_FIELDS_PROMPT = `
    The JSON object MUST include ALL these technical fields:
    - component (string)
    - componentType (string: 'Electrical' or 'Mechanical')
    - functionType (string: 'Primary' or 'Secondary')
    - function (string)
    - functionalFailure (string)
    - failureMode (string)
    - failureEffect (string)
    - consequenceCategory (string: 'Hidden - Safety/Env', 'Hidden - Operational', 'Evident - Safety/Env', 'Evident - Operational', 'Evident - Non-Operational')
    - iso14224Code (string: 3-letter code like BRD, LOP, VIB)
    - severity (number: 1-10)
    - occurrence (number: 1-10)
    - detection (number: 1-10)
    - maintenanceTask (string)
    - interval (string)
    - taskType (string: 'Condition Monitoring', 'Time-Based', 'Run-to-Failure', 'Redesign', 'Failure Finding', 'Lubrication', 'Servicing', 'Restoration', 'Replacement', 'Training', 'Procedural Change')
  `;

  const handleFacilitatorAudit = async () => {
    if (!data || data.length === 0) return;
    setIsLoading(true);

    try {
      // Fix: Initialize GoogleGenAI strictly using process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const studySummary = data.slice(-30).map(i => ({
        comp: i.component,
        fail: i.failureMode,
        task: i.maintenanceTask,
        rpn: i.rpn
      }));

      const prompt = `
        MIRA FACILITATOR STRATEGIC AUDIT.
        Asset Study Context: ${JSON.stringify(studySummary)}
        Target Language: ${language}
        
        OBJECTIVE:
        1. Critically evaluate the current maintenance strategy.
        2. Identify EXACTLY 3 technical gaps or missed failure modes that are critical for this asset class.
        3. For each gap, you MUST generate a complete RCM record wrapped in <ACTION> tags.
        
        CRITICAL RULES:
        - DO NOT just say "the study is good". You MUST find missing items.
        - Every recommendation MUST be an <ACTION> block containing a valid JSON object.
        
        ${RCM_FIELDS_PROMPT}
        
        Technical descriptions and tasks in the JSON MUST be in ${language}.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 32768 },
          temperature: 0.4,
          seed: 42,
          systemInstruction: `You are MIRA, the Lead RCM Facilitator. You are technical, rigorous, and proactive. Your primary job during an audit is to provide actionable <ACTION> blocks for missing failure modes in ${language}.`
        }
      });

      const { cleanText, proposals } = parseAIResponse(response.text || "");
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: cleanText || "Strategic audit complete. Recommendations generated below.", 
        proposals, 
        isFacilitatorInsight: true 
      }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "Strategic Audit system encountered a technical error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Fix: Initialize GoogleGenAI strictly using process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentItems = (data || []).slice(-15).map(i => ({ c: i.component, fm: i.failureMode }));
      
      const prompt = `
        USER REQUEST: "${userMsg}"
        CURRENT STUDY ITEMS: ${JSON.stringify(currentItems)}
        LANGUAGE: ${language}

        MIRA FACILITATOR PROTOCOL:
        1. Be a professional reliability mentor.
        2. If the user asks for suggestions or if the context warrants it, generate new technical RCM items.
        3. EVERY proposed new item or update MUST be wrapped in <ACTION> tags.
        
        ${RCM_FIELDS_PROMPT}
        
        Ensure technical strings in JSON are in ${language}.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 32768 },
          temperature: 0.4,
          seed: 42,
          systemInstruction: `You are MIRA, the Lead RCM Facilitator. You synthesize SAE JA1011 strategies in ${language}. You always provide implementable technical additions using <ACTION> tags when helping the user build their study.`
        }
      });

      const { cleanText, proposals } = parseAIResponse(response.text || "");
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: cleanText || "Analysis complete. See technical recommendations below.", 
        proposals 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Facilitator session interrupted by a network event." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applySingleAction = (proposalId: string, messageIndex: number) => {
    setMessages(prevMessages => {
      const message = prevMessages[messageIndex];
      if (!message || !message.proposals) return prevMessages;

      const proposal = message.proposals.find(p => p.id === proposalId);
      if (!proposal || proposal.applied || !proposal.item) return prevMessages;

      let newData = data ? [...data] : [];
      
      if (proposal.type === 'ADD') {
        const item = proposal.item;
        
        const getScore = (val: any, def: number) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const match = val.match(/\d+/);
            return match ? parseInt(match[0]) : def;
          }
          return def;
        };

        const s = getScore(item.severity, 5);
        const o = getScore(item.occurrence, 3);
        const d = getScore(item.detection, 4);
        const rpnValue = s * o * d;

        // Fix: Added componentType to fix RCMItem type error
        const newItem: RCMItem = {
          id: `rcm-mir-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          component: item.component || 'Synthesized Component',
          componentType: (item.componentType as any) || 'Mechanical',
          functionType: (item.functionType as any) || 'Primary',
          function: item.function || 'Functional requirement.',
          functionalFailure: item.functionalFailure || 'Loss of function.',
          failureMode: item.failureMode || 'Failure mechanism.',
          failureEffect: item.failureEffect || 'Local/System impact.',
          criticality: (item.criticality as any) || (rpnValue >= 100 ? 'High' : rpnValue >= 40 ? 'Medium' : 'Low'),
          consequenceCategory: (item.consequenceCategory as ConsequenceCategory) || 'Evident - Operational',
          iso14224Code: item.iso14224Code || 'OTH',
          severity: s,
          occurrence: o,
          detection: d,
          rpn: rpnValue,
          maintenanceTask: item.maintenanceTask || 'Inspection/Task.',
          interval: item.interval || 'Monthly',
          taskType: (item.taskType as any) || 'Condition Monitoring',
          isNew: true,
          isMiraGenerated: true,
          isApproved: false
        };
        newData.push(newItem);
      } 
      else if (proposal.type === 'UPDATE') {
        newData = newData.map(item => {
          const isMatch = proposal.item?.id ? item.id === proposal.item.id : (item.component === proposal.item?.component && item.failureMode === proposal.item?.failureMode);
          if (isMatch) {
            const updated = { ...item, ...proposal.item, isNew: false, isMiraGenerated: true };
            updated.severity = Number(updated.severity) || item.severity;
            updated.occurrence = Number(updated.occurrence) || item.occurrence;
            updated.detection = Number(updated.detection) || item.detection;
            updated.rpn = updated.severity * updated.occurrence * updated.detection;
            return updated as RCMItem;
          }
          return item;
        });
      }

      onUpdate(newData);

      return prevMessages.map((m, idx) => {
        if (idx === messageIndex && m.proposals) {
          return {
            ...m,
            proposals: m.proposals.map(p => p.id === proposalId ? { ...p, applied: true } : p)
          };
        }
        return m;
      });
    });
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 transition-all duration-500">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-3 p-4 sm:px-6 sm:py-4 rounded-[1.8rem] shadow-2xl transition-all active:scale-95 border ${isOpen ? 'bg-white text-slate-900 border-slate-100' : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700'}`}
        >
          <div className={`p-2 rounded-xl ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-white/20'}`}>
            <Zap size={22} className={isOpen ? 'fill-indigo-600' : 'fill-white'} />
          </div>
          <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">{isOpen ? 'Close MIRA' : 'Talk to MIRA'}</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[28rem] h-[36rem] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                <Zap size={20} className="text-indigo-400 fill-indigo-400" />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-tighter uppercase leading-none">MIRA Facilitator</h3>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1">Reliability Synthesis AI</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setMessages([])}
                className="p-2 text-slate-500 hover:text-white transition-colors"
                title="Clear Chat"
              >
                <RotateCcw size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
          </div>

          <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
               <ShieldAlert size={14} className="text-indigo-600" /> Strategic Hub
             </div>
             <button 
               onClick={handleFacilitatorAudit}
               disabled={!data || data.length === 0 || isLoading}
               className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30 shadow-lg shadow-indigo-100 active:scale-95"
             >
               <Sparkles size={12} /> Run Strategic Audit
             </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                  <LayoutGrid size={48} className="text-indigo-100" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">Facilitator Session</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Ask questions or run strategic reliability audits</p>
                </div>
              </div>
            )}
            
            {messages.map((m, mIdx) => (
              <div key={mIdx} className={`flex flex-col gap-3 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl shadow-sm text-sm font-medium ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none ring-1 ring-slate-50'}`}>
                  <FormattedMessage text={m.text} role={m.role} />
                </div>
                
                {m.proposals && m.proposals.length > 0 && (
                  <div className="w-full space-y-4 mt-2">
                    {m.proposals.map((p) => {
                      const s = Number(p.item.severity) || 5;
                      const o = Number(p.item.occurrence) || 3;
                      const d = Number(p.item.detection) || 4;
                      const rpnValue = s * o * d;

                      return (
                        <div key={p.id} className={`p-5 rounded-[1.8rem] border bg-white shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden group/card ${p.applied ? 'border-emerald-200 bg-emerald-50/20' : 'border-indigo-100 ring-4 ring-indigo-50/30'}`}>
                          {p.applied && <div className="absolute inset-0 bg-emerald-50/90 backdrop-blur-sm z-10 flex items-center justify-center font-black text-emerald-600 text-[10px] uppercase tracking-[0.3em]"><CheckCircle2 size={16} className="mr-2" /> Synced to Table</div>}
                          
                          <div className="flex items-center gap-3 mb-4">
                             <div className={`p-2 rounded-lg ${p.type === 'ADD' ? 'bg-indigo-600 text-white shadow-md' : 'bg-amber-500 text-white shadow-md'}`}>
                               {p.type === 'ADD' ? <Plus size={14} /> : <RotateCcw size={14} />}
                             </div>
                             <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">MIRA Recommendation</span>
                          </div>
                          
                          <div className="space-y-4 mb-5">
                             <div className="space-y-1">
                                <div className="flex items-center gap-2 opacity-50">
                                   <Box size={10} className="text-slate-500" />
                                   <span className="text-[9px] font-black uppercase tracking-widest">Component Name</span>
                                </div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tighter pl-1">{p.item.component || 'Analyzing...'}</p>
                             </div>

                             <div className="space-y-1">
                                <div className="flex items-center gap-2 opacity-50">
                                   <AlertTriangle size={10} className="text-amber-600" />
                                   <span className="text-[9px] font-black uppercase tracking-widest">Failure Mode</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-700 leading-tight uppercase tracking-tight pl-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">{p.item.failureMode}</p>
                             </div>

                             <div className="space-y-1">
                                <div className="flex items-center gap-2 opacity-50">
                                   <ClipboardList size={10} className="text-indigo-600" />
                                   <span className="text-[9px] font-black uppercase tracking-widest">Proposed Task</span>
                                </div>
                                <div className="pl-1 flex flex-col gap-1">
                                   <p className="text-[11px] font-black text-indigo-700 uppercase tracking-tight leading-tight">{p.item.maintenanceTask}</p>
                                   <p className="text-[10px] text-slate-400 font-bold italic">{p.item.interval} • {p.item.taskType}</p>
                                </div>
                             </div>

                             <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                   <Activity size={12} className="text-slate-400" />
                                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">RPN Score: {rpnValue}</span>
                                </div>
                                <div className="flex gap-1">
                                   <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black rounded border border-slate-200 uppercase">{p.item.iso14224Code}</span>
                                   <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded border border-indigo-100 uppercase">{p.item.functionType}</span>
                                </div>
                             </div>
                          </div>

                          {!p.applied && (
                            <button 
                              onClick={() => applySingleAction(p.id, mIdx)}
                              className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                            >
                              <Plus size={16} /> Implement to Table
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 ring-1 ring-slate-50">
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">MIRA is synthesizing...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-slate-50 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            <div className="flex gap-3">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Talk to your RCM Facilitator..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 font-medium"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-lg active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};