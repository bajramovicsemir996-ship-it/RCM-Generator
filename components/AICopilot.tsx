
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { RCMItem } from '../types';
import { 
  MessageSquare, X, Send, Bot, Sparkles, ChevronDown, 
  Plus, Check, ListChecks, CheckCircle2,
  AlertTriangle, Wrench, Layers, Info, Tag
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

/**
 * FormattedMessage component to handle technical text organization
 */
const FormattedMessage: React.FC<{ text: string; role: 'user' | 'model' }> = ({ text, role }) => {
  const lines = (text || '').split('\n');
  
  return (
    <div className={`space-y-2 ${role === 'model' ? 'text-slate-700' : 'text-white'}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        const formatInline = (content: string) => {
          return content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={idx + '-' + i} className="font-extrabold">{part.slice(2, -2)}</strong>;
            }
            return part;
          });
        };

        if (trimmed.startsWith('###')) {
          return (
            <div key={idx} className="mt-4 mb-1 border-b border-slate-100 pb-1">
              <h4 className={`font-black text-sm uppercase tracking-tight ${role === 'model' ? 'text-indigo-600' : 'text-white underline'}`}>
                {formatInline(trimmed.replace(/^###\s*/, ''))}
              </h4>
            </div>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const content = trimmed.replace(/^[*|-]\s*/, '');
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <span className={`shrink-0 mt-2 w-1 h-1 rounded-full bg-current ${role === 'model' ? 'opacity-40' : 'opacity-70'}`}></span>
              <span className="flex-1 text-[13px]">{formatInline(content)}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <span className={`shrink-0 font-bold text-[10px] mt-0.5 ${role === 'model' ? 'opacity-40' : 'opacity-70'}`}>
                {numMatch[1]}.
              </span>
              <span className="flex-1 text-[13px]">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        if (!trimmed) return <div key={idx} className="h-1"></div>;

        return <p key={idx} className="leading-relaxed text-[13px]">{formatInline(line)}</p>;
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
        comp: i.component,
        fail: i.failureMode,
        rpn: i.rpn,
        task: i.maintenanceTask,
        iso: i.iso14224Code
      }));

      const prompt = `
        RCM DATA CONTEXT: ${JSON.stringify(contextSummary)}
        USER QUESTION/REQUEST: ${userMsg}

        RELIABILITY LEAD INSTRUCTIONS:
        1. Act as a world-class RCM Lead. Answer technical questions or consult on strategy conversationally.
        2. If providing an implementation (ADD), generate HIGH-FIDELITY rows.
        3. MANDATORY: 'iso14224Code' MUST be a standard mechanism code (e.g., 'Wear', 'Corrosion', 'Fatigue', 'Erosion', 'Overheating', 'Leakage', 'Breakage', 'Vibration', 'Control failure').
        4. MANDATORY: 'component' name MUST be specific.
        5. For 'failureMode', use format 'Mechanism due to Cause' (e.g., 'Surface wear due to abrasion'). CRITICAL: DO NOT use brackets [ ] or generic placeholders in the final text.
        6. For 'consequenceCategory', you MUST use the exact strings: 'Hidden - Safety/Env', 'Hidden - Operational', 'Evident - Safety/Env', 'Evident - Operational', or 'Evident - Non-Operational'.
        7. For ADD actions, include ALL RCMItem fields: component, function, functionalFailure, failureMode, failureEffect, consequenceCategory, iso14224Code, criticality, severity (1-10), occurrence (1-10), detection (1-10), maintenanceTask, interval, taskType.
        8. Machine-readable format: <ACTION>[{"type": "ADD|UPDATE|DELETE", "reason": "...", "item": {...}}]</ACTION>
        9. Use SAE JA1011 standards.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are the Senior Reliability Co-pilot. You provide expert FMEA/RCM consultation. You strictly follow ISO 14224 taxonomy and SAE JA1011 for RCM logic. Every proposed component must have a correct ISO 14224 code. Ensure failure modes are plain text without brackets and consequence categories match the project enum exactly."
        }
      });

      const { cleanText, proposals } = parseAIResponse(response.text || "");
      setMessages(prev => [...prev, { role: 'model', text: cleanText || "Analysis integrated.", proposals }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Expert consultation currently unavailable. Please check your connection." }]);
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
      const newItem: RCMItem = {
        id: `rcm-ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        component: proposal.item.component || 'New Subsystem',
        function: proposal.item.function || 'Perform intended work',
        functionalFailure: proposal.item.functionalFailure || 'Loss of function',
        failureMode: proposal.item.failureMode || 'Wear due to Cause',
        failureEffect: proposal.item.failureEffect || 'Local/System effects',
        consequenceCategory: proposal.item.consequenceCategory || 'Evident - Operational',
        iso14224Code: proposal.item.iso14224Code || 'Wear',
        criticality: proposal.item.criticality || 'Medium',
        severity: proposal.item.severity || 5,
        occurrence: proposal.item.occurrence || 3,
        detection: proposal.item.detection || 3,
        rpn: (proposal.item.severity || 5) * (proposal.item.occurrence || 3) * (proposal.item.detection || 3),
        maintenanceTask: proposal.item.maintenanceTask || 'Inspection/Task',
        interval: proposal.item.interval || 'Weekly',
        taskType: (proposal.item.taskType as any) || 'Condition Monitoring',
        ...proposal.item,
      };
      newData.push(newItem);
    } 
    else if (proposal.type === 'UPDATE' && (proposal.item.id || proposal.item.component)) {
      newData = newData.map(item => {
        const isMatch = proposal.item?.id ? item.id === proposal.item.id : item.component === proposal.item?.component;
        if (isMatch) {
          const updated = { ...item, ...proposal.item };
          updated.rpn = (updated.severity || 1) * (updated.occurrence || 1) * (updated.detection || 1);
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

  const applyAllActions = (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message || !message.proposals) return;
    
    const unapplied = message.proposals.filter(p => !p.applied && p.item);
    if (unapplied.length === 0) return;

    let newData = data ? [...data] : [];

    unapplied.forEach(proposal => {
      if (!proposal.item) return;
      if (proposal.type === 'ADD') {
        const newItem: RCMItem = {
          id: `rcm-ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          component: proposal.item.component || 'New Subsystem',
          function: proposal.item.function || 'Intended Work',
          functionalFailure: proposal.item.functionalFailure || 'Total Failure',
          failureMode: proposal.item.failureMode || 'Wear due to Cause',
          failureEffect: proposal.item.failureEffect || 'Local Effect',
          consequenceCategory: proposal.item.consequenceCategory || 'Evident - Operational',
          iso14224Code: proposal.item.iso14224Code || 'Wear',
          criticality: proposal.item.criticality || 'Medium',
          severity: proposal.item.severity || 5,
          occurrence: proposal.item.occurrence || 3,
          detection: proposal.item.detection || 3,
          rpn: (proposal.item.severity || 5) * (proposal.item.occurrence || 3) * (proposal.item.detection || 3),
          maintenanceTask: proposal.item.maintenanceTask || 'Inspection',
          interval: proposal.item.interval || 'Monthly',
          taskType: (proposal.item.taskType as any) || 'Condition Monitoring',
          ...proposal.item,
        };
        newData.push(newItem);
      } 
      else if (proposal.type === 'UPDATE' && (proposal.item.id || proposal.item.component)) {
        newData = newData.map(item => {
          const isMatch = proposal.item?.id ? item.id === proposal.item.id : item.component === proposal.item?.component;
          if (isMatch) {
            const updated = { ...item, ...proposal.item };
            updated.rpn = (updated.severity || 1) * (updated.occurrence || 1) * (updated.detection || 1);
            return updated;
          }
          return item;
        });
      } 
      else if (proposal.type === 'DELETE' && proposal.item.id) {
        newData = newData.filter(item => item && item.id !== proposal.item.id);
      }
    });

    onUpdate(newData);

    setMessages(prev => prev.map((m, idx) => {
      if (idx === messageIndex && m.proposals) {
        return { ...m, proposals: m.proposals.map(p => ({ ...p, applied: true })) };
      }
      return m;
    }));
  };

  const renderProposalsSection = (message: Message, messageIndex: number) => {
    if (!message.proposals || message.proposals.length === 0) return null;
    const unappliedCount = message.proposals.filter(p => !p.applied).length;

    return (
      <div className="mt-4 w-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between px-2 mb-2">
          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ListChecks size={14} /> Engineering Draft Suggestions
          </h5>
          {unappliedCount > 1 && (
            <button 
              onClick={() => applyAllActions(messageIndex)}
              className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1.5 border border-indigo-100 shadow-sm uppercase tracking-tighter"
            >
              <CheckCircle2 size={12} /> Implement All
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
          {message.proposals.map((p) => {
            if (!p) return null;
            return (
              <div 
                key={p.id} 
                className={`bg-white border rounded-3xl p-5 shadow-sm transition-all border-l-8 ${
                  p.applied ? 'border-emerald-500 bg-emerald-50/20' : 
                  p.type === 'ADD' ? 'border-indigo-600' : 
                  p.type === 'UPDATE' ? 'border-amber-500' : 'border-red-500'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                          p.applied ? 'bg-emerald-500 text-white' : 
                          p.type === 'ADD' ? 'bg-indigo-600 text-white' : 
                          p.type === 'UPDATE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {p.applied ? 'In Study' : p.type}
                        </span>
                        <span className="text-[13px] font-black text-slate-900 truncate block uppercase tracking-tight">
                          {p.item?.component || 'New Subsystem'}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="text-[12px] font-medium text-slate-600 leading-snug bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 italic">
                          "{p.item?.failureMode || 'No failure mode description'}"
                        </div>
                        
                        {!p.applied && p.item && (
                          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 mt-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <AlertTriangle size={12} /> RISK: <span className="text-slate-900">{(p.item?.severity || 0) * (p.item?.occurrence || 0) * (p.item?.detection || 0)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <Tag size={12} className="text-emerald-500" /> <span className="text-emerald-700 uppercase tracking-tighter">{p.item?.iso14224Code || 'TBD'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <Wrench size={12} /> <span className="text-indigo-600 uppercase tracking-tighter">{p.item?.taskType || 'TBD'}</span>
                            </div>
                          </div>
                        )}
                        
                        {p.applied && (
                           <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Check size={12}/> Successfully integrated into analysis table.</p>
                        )}
                      </div>
                   </div>
                   
                   {!p.applied && (
                     <button 
                       onClick={() => applySingleAction(p.id, messageIndex)}
                       className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all shrink-0 shadow-xl shadow-slate-200 group/btn"
                       title="Implement into Table"
                     >
                       <Plus size={22} className="group-hover/btn:scale-110 transition-transform" />
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
        <div className="mb-4 w-[350px] sm:w-[620px] h-[780px] bg-white rounded-[3rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600/20 rounded-[1.5rem] border border-indigo-500/30 shadow-inner"><Bot size={28} className="text-indigo-400" /></div>
              <div>
                <h3 className="font-black text-xl tracking-tighter leading-none uppercase">Expert Co-pilot</h3>
                <div className="flex items-center gap-2 mt-2.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20"></div>
                   <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Consultation Engine Online</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="hover:bg-white/10 p-2.5 rounded-full transition-colors"
            >
              <ChevronDown size={32} />
            </button>
          </div>

          <div 
            ref={scrollRef} 
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-8 space-y-10 bg-slate-50 custom-scrollbar"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-8">
                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-sm -rotate-6 hover:rotate-0 transition-all duration-700 ring-8 ring-indigo-50/50"><Layers size={48} /></div>
                <div className="space-y-4">
                  <p className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Interactive FMEA Lead</p>
                  <p className="text-[14px] text-slate-500 leading-relaxed px-10 font-medium italic opacity-70">
                    "Perform a complete FMEA for a conveyor divert actuator" or "Explain the P-F interval for ceramic bearings"
                  </p>
                  <div className="pt-8 flex flex-wrap justify-center gap-3">
                    <span className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 shadow-sm uppercase tracking-widest">Asset Decomposition</span>
                    <span className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 shadow-sm uppercase tracking-widest">ISO 14224 Codes</span>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[95%] p-6 rounded-[2rem] shadow-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none font-bold text-[15px]' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-indigo-100/10'
                }`}>
                  <FormattedMessage text={m.text} role={m.role} />
                </div>
                
                {renderProposalsSection(m, i)}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-6 rounded-[2rem] rounded-bl-none shadow-sm flex items-center gap-5">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Processing Analysis</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-white border-t border-slate-100">
            <div className="flex gap-5">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about reliability or suggest additions..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-[1.5rem] px-8 py-5 text-[15px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-bold shadow-inner"
              />
              <button 
                onClick={handleSend} 
                disabled={!input.trim() || isLoading} 
                className="p-5 bg-indigo-600 text-white rounded-[1.5rem] hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-2xl shadow-indigo-200"
              >
                <Send size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 z-[60] ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-indigo-600'}`}
      >
        {isOpen ? <X size={32} /> : <MessageSquare size={32} />}
        {!isOpen && <div className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full"></div>}
      </button>
    </div>
  );
};
