
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { RCMItem, ConsequenceCategory } from '../types';
import { 
  MessageSquare, X, Send, Bot, Sparkles, ChevronDown, 
  Plus, Check, ListChecks, CheckCircle2,
  AlertTriangle, Wrench, Layers, Info, Tag, RotateCcw, Cpu, ChevronRight,
  Clock
} from 'lucide-react';

interface AICopilotProps {
  data: RCMItem[] | null;
  onUpdate: (newData: RCMItem[]) => void;
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
}

const FormattedMessage: React.FC<{ text: string; role: 'user' | 'model' }> = ({ text, role }) => {
  const lines = (text || '').split('\n');
  
  return (
    <div className={`space-y-2 ${role === 'model' ? 'text-slate-700' : 'text-white'}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const cleanLine = line.replace(/\*\*/g, '').replace(/#/g, '').trim();
        if (!cleanLine) return <div key={idx} className="h-2" />;

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <ChevronRight size={12} className={`shrink-0 mt-1 ${role === 'model' ? 'text-indigo-400' : 'text-white opacity-50'}`} />
              <span className="flex-1 text-[13px] font-medium leading-relaxed">{cleanLine.replace(/^[*|-]\s*/, '')}</span>
            </div>
          );
        }

        if (idx === 0 && role === 'model' && cleanLine.length < 50 && !cleanLine.endsWith('.')) {
          return (
            <h4 key={idx} className="font-black text-[11px] uppercase tracking-widest text-indigo-600 mb-2 border-b border-slate-100 pb-1">
              {cleanLine}
            </h4>
          );
        }

        return <p key={idx} className="leading-relaxed text-[13px] font-medium">{cleanLine}</p>;
      })}
    </div>
  );
};

export const AICopilot: React.FC<AICopilotProps> = ({ data, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollPos = useRef<number>(0);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      if (chatScrollPos.current > 0) {
        scrollRef.current.scrollTop = chatScrollPos.current;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (scrollRef.current) {
      chatScrollPos.current = scrollRef.current.scrollTop;
    }
  };

  useEffect(() => {
    if (isOpen && scrollRef.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, isOpen]);

  const parseAIResponse = (text: string): { cleanText: string, proposals?: ProposedAction[] } => {
    const actionRegex = /<ACTION>([\s\S]*?)<\/ACTION>/g;
    const proposals: ProposedAction[] = [];
    let cleanText = text;
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
      try {
        const rawAction = JSON.parse(match[1]);
        const actions = Array.isArray(rawAction) ? rawAction : [rawAction];
        
        actions.forEach((a: any) => {
          if (a && typeof a === 'object' && (a.item || a.type === 'DELETE')) {
            proposals.push({
              ...a,
              id: `proposal-${Math.random().toString(36).substr(2, 9)}`,
              applied: false,
              item: a.item || {} 
            });
          }
        });
        
        cleanText = cleanText.replace(match[0], '');
      } catch (e) {
        console.error("Failed to parse AI action JSON", e);
      }
    }

    return { cleanText: cleanText.trim(), proposals: proposals.length > 0 ? proposals : undefined };
  };

  const handleReset = () => {
    setMessages([]);
    chatScrollPos.current = 0;
    setInput('');
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const safeData = (data || []).filter(item => !!item);
      
      const contextSummary = safeData.slice(-20).map(i => ({
        id: i.id,
        comp: i.component,
        fail: i.failureMode,
        task: i.maintenanceTask,
        iso: i.iso14224Code
      }));

      const prompt = `
        RCM DATA CONTEXT: ${JSON.stringify(contextSummary)}
        USER REQUEST: ${userMsg}

        STRICT INSTRUCTIONS FOR MIRA:
        1. Action Requirement: If the user asks to add or change something, you MUST provide a JSON block inside <ACTION></ACTION> tags.
        2. Component Naming: You MUST provide a specific, professional technical name for any component added (e.g., 'Primary Discharge Impeller' instead of just 'Impeller').
        3. Format: Act as a Senior Reliability Engineer. Use plain text for explanation and valid JSON for actions.
        4. Logic: All added items MUST follow the table's structural logic exactly.
        5. Required Metadata: For 'ADD' items, you MUST populate 'componentIntel' with a physical description, location, and visual cues.
        
        JSON Schema for 'ADD' items:
           {
             "type": "ADD",
             "item": {
                "component": "Specific Technical Name",
                "componentIntel": {
                   "description": "Technical specs (metallurgy, construction, 2 sentences max).",
                   "location": "Specific asset coordinates.",
                   "visualCues": "Physical identifiers."
                },
                "function": "Primary design goal.",
                "functionalFailure": "Failure to perform.",
                "failureMode": "[Mechanism] due to [Cause]",
                "failureEffect": "Operational/Safety impact.",
                "consequenceCategory": "One of: Hidden - Safety/Env, Hidden - Operational, Evident - Safety/Env, Evident - Operational, Evident - Non-Operational",
                "iso14224Code": "ISO code (e.g. 'Wear')",
                "criticality": "High, Medium, or Low",
                "severity": 1-10,
                "occurrence": 1-10,
                "detection": 1-10,
                "maintenanceTask": "Specific action name",
                "interval": "Standard frequency (e.g. 'Monthly')",
                "taskType": "One of: Condition Monitoring, Time-Based, Run-to-Failure, Redesign, Failure Finding, Lubrication, Servicing, Restoration, Replacement"
             },
             "reason": "Engineering justification"
           }
        6. DO NOT use double quotes in descriptions or meta fields.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are MIRA, a world-class RCM specialist. You strictly adhere to industrial RCM/FMECA schemas. You provide high-fidelity technical data for every column in the table. You never use double quotes in your technical strings."
        }
      });

      const { cleanText, proposals } = parseAIResponse(response.text || "");
      setMessages(prev => [...prev, { role: 'model', text: cleanText || "Directives synthesized.", proposals }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "MIRA encountered a logic synchronization error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applySingleAction = (proposalId: string, messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message || !message.proposals) return;

    const proposal = message.proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.applied || !proposal.item) return;

    let newData = data ? [...data] : [];
    
    if (proposal.type === 'ADD') {
      const s = Number(proposal.item.severity) || 5;
      const o = Number(proposal.item.occurrence) || 3;
      const d = Number(proposal.item.detection) || 3;

      const newItem: RCMItem = {
        id: `rcm-ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        component: proposal.item.component || 'Auxiliary Component',
        componentIntel: {
          description: proposal.item.componentIntel?.description || 'Synchronized via MIRA Intelligence synthesis.',
          location: proposal.item.componentIntel?.location || 'Refer to asset structural diagram.',
          visualCues: proposal.item.componentIntel?.visualCues || 'Standard industrial physical cues.'
        },
        function: proposal.item.function || 'General design function.',
        functionalFailure: proposal.item.functionalFailure || 'Total loss of operational function.',
        failureMode: proposal.item.failureMode || 'General wear and degradation.',
        failureEffect: proposal.item.failureEffect || 'Local system operational impact.',
        consequenceCategory: (proposal.item.consequenceCategory as ConsequenceCategory) || 'Evident - Operational',
        iso14224Code: proposal.item.iso14224Code || 'UNC',
        criticality: proposal.item.criticality as any || (s >= 8 ? 'High' : s >= 5 ? 'Medium' : 'Low'),
        severity: s,
        occurrence: o,
        detection: d,
        rpn: s * o * d,
        maintenanceTask: proposal.item.maintenanceTask || 'Visual Inspection',
        interval: proposal.item.interval || 'Annually',
        taskType: (proposal.item.taskType as any) || 'Condition Monitoring',
        isNew: true
      };
      newData.push(newItem);
    } 
    else if (proposal.type === 'UPDATE') {
      newData = newData.map(item => {
        const isMatch = proposal.item?.id ? item.id === proposal.item.id : item.component === proposal.item?.component;
        if (isMatch) {
          const updated = { ...item, ...proposal.item, isNew: false };
          updated.severity = Number(updated.severity);
          updated.occurrence = Number(updated.occurrence);
          updated.detection = Number(updated.detection);
          updated.rpn = updated.severity * updated.occurrence * updated.detection;
          return updated;
        }
        return item;
      });
    } 
    else if (proposal.type === 'DELETE' && proposal.item.id) {
      newData = newData.filter(item => item && item.id !== proposal.item.id);
    }

    onUpdate(newData);

    setMessages(prev => prev.map((m, idx) => {
      if (idx === messageIndex && m.proposals) {
        return {
          ...m,
          proposals: m.proposals.map(p => p.id === proposalId ? { ...p, applied: true } : p)
        };
      }
      return m;
    }));
  };

  const renderProposalsSection = (message: Message, messageIndex: number) => {
    if (!message.proposals || message.proposals.length === 0) return null;

    return (
      <div className="mt-4 w-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between px-2 mb-2">
          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <ListChecks size={14} className="text-indigo-400" /> Technical Directives
          </h5>
        </div>

        <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
          {message.proposals.map((p) => {
            if (!p) return null;
            return (
              <div 
                key={p.id} 
                className={`bg-white border rounded-[1.5rem] p-4 shadow-sm transition-all border-l-[8px] ${
                  p.applied ? 'border-emerald-500 bg-emerald-50/20' : 
                  p.type === 'ADD' ? 'border-indigo-600' : 
                  p.type === 'UPDATE' ? 'border-amber-500' : 'border-red-500'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                          p.applied ? 'bg-emerald-500 text-white' : 
                          p.type === 'ADD' ? 'bg-indigo-600 text-white' : 
                          p.type === 'UPDATE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {p.applied ? 'COMMITTED' : p.type}
                        </span>
                        <span className="text-[11px] font-black text-slate-900 truncate block uppercase tracking-tight">
                          {p.item?.component || 'Unspecified Component'}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-slate-600 leading-snug bg-slate-50/50 p-2 rounded-xl border border-slate-100 italic">
                          {p.item?.failureMode || 'No mode description provided'}
                        </div>
                        
                        {!p.applied && (
                          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 mt-1">
                            {p.item?.maintenanceTask && (
                               <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                 <Wrench size={10} /> {p.item.maintenanceTask}
                               </div>
                            )}
                            {p.item?.interval && (
                               <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                 <Clock size={10} /> {p.item.interval}
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                   </div>
                   
                   {!p.applied && (
                     <button 
                       onClick={() => applySingleAction(p.id, messageIndex)}
                       className="p-2 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-all shrink-0 shadow-lg active:scale-95"
                     >
                       <Plus size={18} />
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[520px] h-[650px] bg-white rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] border-2 border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Cpu size={80} className="rotate-12" />
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-2 bg-indigo-500/10 rounded-[1.2rem] border border-indigo-400/30 shadow-inner backdrop-blur-md">
                <Sparkles size={18} className="text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl tracking-tighter leading-none uppercase">MIRA</h3>
                    <span className="text-[8px] px-1.5 py-0.5 bg-indigo-600 rounded-md font-black tracking-widest opacity-80 uppercase">Co-pilot</span>
                </div>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em] mt-1">Reliability Intelligence Assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-all active:scale-95"><ChevronDown size={28} /></button>
          </div>

          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-8">
                <div className="w-20 h-20 bg-white text-indigo-600 rounded-[1.8rem] flex items-center justify-center shadow-2xl -rotate-3 border border-indigo-50 ring-4 ring-indigo-50/30"><Layers size={36} className="opacity-80" /></div>
                <div className="space-y-4">
                  <p className="text-xl font-black text-slate-900 tracking-tighter uppercase">Consult MIRA</p>
                  <p className="text-[13px] text-slate-500 font-medium italic px-6">Ask me to add components, adjust risks, or refine your strategy based on SAE standards.</p>
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[95%] p-5 rounded-[2rem] shadow-lg leading-relaxed relative ${m.role === 'user' ? 'bg-slate-900 text-white rounded-br-none font-bold text-[14px] shadow-slate-200' : 'bg-white text-slate-800 border-2 border-indigo-50 rounded-bl-none shadow-indigo-100/10'}`}>
                  <FormattedMessage text={m.text} role={m.role} />
                </div>
                {renderProposalsSection(m, i)}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-indigo-50 p-5 rounded-[2rem] rounded-bl-none shadow-lg flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-slate-100 shrink-0">
            <div className="flex gap-4">
              <button onClick={handleReset} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-[1.5rem] transition-all border border-slate-100 flex items-center justify-center shrink-0 shadow-inner"><RotateCcw size={20} /></button>
              <div className="flex-1 relative">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Request directives..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] px-6 py-4 text-[14px] focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-bold shadow-inner" />
              </div>
              <button onClick={handleSend} disabled={!input.trim() || isLoading} className="p-4 bg-indigo-600 text-white rounded-[1.5rem] hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setIsOpen(!isOpen)} className={`relative w-16 h-16 rounded-[1.8rem] flex items-center justify-center text-white shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all hover:scale-110 active:scale-95 z-[60] border-2 border-white ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-indigo-600'}`}>
        {isOpen ? <X size={28} /> : <Bot size={28} />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-lg flex items-center justify-center shadow-lg">
            <Sparkles size={10} className="text-white fill-white" />
          </div>
        )}
      </button>
    </div>
  );
};
