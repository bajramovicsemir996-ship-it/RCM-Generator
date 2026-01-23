
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Loader2, CheckCircle2, MessageSquarePlus, Info, Zap, Settings, Shield, ChevronRight, Maximize2, ArrowLeft, Undo2, Pencil, Save, RotateCcw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface OperationalContextBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (context: string) => void;
  onUndo: () => void;
  canUndo: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isDraft?: boolean;
}

export const OperationalContextBuilder: React.FC<OperationalContextBuilderProps> = ({ isOpen, onClose, onComplete, onUndo, canUndo }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Welcome to the **Asset Intelligence Workstation**. \n\nI am your lead RCM facilitator. To build a world-class maintenance strategy, we first need a deep understanding of your asset's operational reality. \n\nPlease tell me: **What asset are we analyzing today?** (e.g., 'A high-pressure feed pump for a steam turbine system' or 'An overhead gantry crane in a steel mill')." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latestDraft, setLatestDraft] = useState<string | null>(null);
  const [showFullReview, setShowFullReview] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editableText, setEditableText] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !showFullReview) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, showFullReview]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      
      const prompt = `
        CONVERSATION HISTORY:
        ${history}
        
        NEW USER REQUEST: ${userMessage}
        
        TASK:
        Generate a comprehensive and highly detailed "Operational Context" draft according to SAE JA1011 standards. 
        
        REQUIRED DEPTH:
        1. System Boundaries: List main components (e.g. housing, impeller, shaft, seals, motor, bearings).
        2. Functional Requirements: Primary performance (e.g. flow/pressure) and secondary (containment, safety).
        3. Operating Conditions: Temperature, humidity, corrosive environment, and duty cycle.
        4. Failure Mechanisms: Typical wear modes (erosion, fatigue, cavitation).
        5. Maintenance Intent: Proactive vs. Reactive goals.

        FORMATTING RULES:
        - DO NOT USE # OR ## OR * SYMBOLS FOR HEADERS.
        - Use plain text but clearly separated sections with titles in CAPITAL LETTERS.
        - Use bullet points for lists but don't use symbols that look like code.
        - Wrap the FINAL full structured draft in <DRAFT> tags.
        - Provide a professional engineer-to-engineer summary before the tags.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are a world-class RCM Analyst. Your style is professional, technical, and concise. You provide extremely detailed context that includes component breakdowns, functions, and likely failure modes."
        }
      });

      const aiText = response.text || "Communication error with the RCM engine. Please try again.";
      
      const draftMatch = aiText.match(/<DRAFT>([\s\S]*?)<\/DRAFT>/);
      let draftContent = null;
      let cleanResponse = aiText.replace(/<DRAFT>[\s\S]*?<\/DRAFT>/, '').trim();

      if (draftMatch) {
        draftContent = draftMatch[1].trim();
        setLatestDraft(draftContent);
        setEditableText(draftContent);
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: cleanResponse,
        isDraft: !!draftContent 
      }]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred during technical synthesis. Please check your network." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (latestDraft) {
      onComplete(latestDraft);
      onClose();
    }
  };

  const handleStartEditing = () => {
    setEditableText(latestDraft || '');
    setIsEditingDraft(true);
  };

  const handleSaveEdit = () => {
    setLatestDraft(editableText);
    setIsEditingDraft(false);
  };

  const renderFormattedDraft = (content: string) => {
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      const cleanLine = trimmed.replace(/\*\*/g, '');

      const isHeader = /^[A-Z\s]{5,40}$/.test(cleanLine) || 
                       cleanLine.startsWith('SECTION') || 
                       cleanLine.includes('IDENTIFICATION') ||
                       cleanLine.includes('ENVIRONMENT') ||
                       cleanLine.includes('FAILURE') ||
                       cleanLine.includes('STRATEGY') ||
                       cleanLine.includes('CONTEXT');

      if (isHeader && cleanLine.length > 3) {
        return (
          <div key={i} className="mt-10 mb-6 border-b-2 border-slate-100 pb-3">
            <h4 className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.3em]">{cleanLine}</h4>
          </div>
        );
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\./)) {
        return (
          <div key={i} className="flex gap-4 ml-4 my-4">
            <ChevronRight size={18} className="text-indigo-400 mt-1 shrink-0" />
            <span className="text-[16px] text-slate-700 font-medium leading-relaxed">{trimmed.replace(/^[*|-]\s*|^\d+\.\s*/, '')}</span>
          </div>
        );
      }

      if (!trimmed) return <div key={i} className="h-6"></div>;

      return <p key={i} className="text-[16px] text-slate-700 leading-relaxed mb-4 font-medium">{cleanLine}</p>;
    });
  };

  const renderFormattedMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      const cleanLine = trimmed.replace(/\*\*/g, '');

      const isHeader = /^[A-Z\s]{5,25}$/.test(cleanLine) || 
                       cleanLine.startsWith('SECTION') || 
                       cleanLine.includes('IDENTIFICATION');

      if (isHeader && cleanLine.length > 3) {
        return (
          <div key={i} className="mt-6 mb-3 border-b border-slate-100 pb-2">
            <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">{cleanLine}</h4>
          </div>
        );
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\./)) {
        return (
          <div key={i} className="flex gap-3 ml-2 my-2">
            <ChevronRight size={14} className="text-indigo-400 mt-1 shrink-0" />
            <span className="text-[14px] text-slate-700 font-medium leading-relaxed">{trimmed.replace(/^[*|-]\s*|^\d+\.\s*/, '')}</span>
          </div>
        );
      }

      if (!trimmed) return <div key={i} className="h-4"></div>;

      return <p key={i} className="text-[14px] text-slate-700 leading-relaxed mb-3 font-medium">{cleanLine}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 sm:p-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.15)] w-full max-w-6xl h-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-white/40">
        
        {/* Workstation Header */}
        <div className="bg-white px-10 py-7 flex justify-between items-center shrink-0 border-b border-slate-50">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-2xl shadow-indigo-100 ring-4 ring-indigo-50">
              <Sparkles size={24} className="text-white fill-white/20" />
            </div>
            <div>
              <h3 className="font-black text-2xl tracking-tighter text-slate-900 uppercase">
                {showFullReview ? (isEditingDraft ? 'Editor Mode' : 'Document Review') : 'Context Intelligence Hub'}
              </h3>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] text-emerald-700 font-black uppercase tracking-widest">{isEditingDraft ? 'Unsaved Changes' : 'Live Synthesis'}</span>
                </div>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Industry standard SAE JA1011</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-3 rounded-full transition-all ${
                canUndo ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'text-slate-200 opacity-20'
              }`}
              title="Undo last action"
            >
              <Undo2 size={28} />
            </button>
            <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-all duration-300">
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Main Interface Area */}
        <div className="flex-1 flex overflow-hidden bg-white relative">
          
          {showFullReview ? (
            /* FULL SCREEN REVIEW MODE */
            <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-500">
              <div className="flex-1 overflow-y-auto px-10 py-16 bg-slate-50/30 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-center mb-10">
                    <button 
                      onClick={() => { setShowFullReview(false); setIsEditingDraft(false); }}
                      className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:-translate-x-1 transition-transform"
                    >
                      <ArrowLeft size={16} /> Back to Chat
                    </button>
                    
                    {!isEditingDraft ? (
                      <button 
                        onClick={handleStartEditing}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                      >
                        <Pencil size={14} /> Edit Context
                      </button>
                    ) : (
                      <div className="flex gap-3">
                        <button 
                          onClick={handleSaveEdit}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                        >
                          <Save size={14} /> Save Changes
                        </button>
                        <button 
                          onClick={() => setIsEditingDraft(false)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <RotateCcw size={14} /> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white p-12 sm:p-20 rounded-[3rem] shadow-2xl border border-slate-100 mb-20">
                    <div className="flex items-center gap-4 mb-12">
                      <div className={`w-1.5 h-16 ${isEditingDraft ? 'bg-amber-500' : 'bg-indigo-600'} rounded-full`}></div>
                      <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">
                          {isEditingDraft ? 'Context Refinement' : 'Operational Context Report'}
                        </h2>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">
                          {isEditingDraft ? 'Manual adjustment of technical parameters' : 'Generated for RCM Strategic Analysis'}
                        </p>
                      </div>
                    </div>
                    
                    {isEditingDraft ? (
                      <textarea
                        value={editableText}
                        onChange={(e) => setEditableText(e.target.value)}
                        className="w-full min-h-[600px] p-10 bg-slate-50 border-2 border-indigo-100 rounded-[2rem] text-slate-700 text-lg font-medium leading-relaxed focus:ring-4 focus:ring-indigo-100 outline-none shadow-inner resize-none"
                        placeholder="Refine your operational context here..."
                      />
                    ) : (
                      <div className="prose prose-slate max-w-none">
                        {latestDraft && renderFormattedDraft(latestDraft)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-10 bg-white border-t border-slate-50 flex justify-center shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
                <div className="max-w-4xl w-full flex gap-6">
                  <button
                    onClick={handleApply}
                    disabled={isEditingDraft}
                    className={`flex-1 py-6 rounded-[2rem] text-sm font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${isEditingDraft ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200'}`}
                  >
                    <CheckCircle2 size={24} />
                    Confirm & Transfer to Workspace
                  </button>
                  <button 
                    onClick={() => { setShowFullReview(false); setIsEditingDraft(false); }}
                    className="px-12 py-6 bg-white border-2 border-slate-100 text-slate-400 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Close Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* CONVERSATIONAL STREAM */
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-10 space-y-12 custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto space-y-10">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                      <div className={`flex gap-6 max-w-[90%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-12 h-12 rounded-[1.2rem] shrink-0 flex items-center justify-center shadow-2xl transition-all duration-500 ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                          {m.role === 'user' ? <User size={22} /> : <Bot size={24} />}
                        </div>
                        <div className="flex flex-col gap-4 min-w-0">
                          <div className={`p-8 rounded-[2.2rem] shadow-sm border ${
                            m.role === 'user' 
                              ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none text-lg font-bold shadow-indigo-100' 
                              : 'bg-white text-slate-800 border-slate-100 rounded-tl-none ring-1 ring-slate-50'
                          }`}>
                            {m.role === 'user' ? <p className="leading-relaxed">{m.content}</p> : renderFormattedMessage(m.content)}
                          </div>
                          
                          {m.isDraft && latestDraft && i === messages.length - 1 && (
                            <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-8 space-y-6 mt-2 animate-in fade-in zoom-in-95 duration-700">
                               <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                   <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Settings size={18} /></div>
                                   <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest">Technical Context Draft</h5>
                                 </div>
                                 <button 
                                   onClick={() => setShowFullReview(true)}
                                   className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-2 uppercase tracking-widest"
                                 >
                                   <Maximize2 size={14} /> Full Screen Review & Edit
                                 </button>
                               </div>
                               
                               <div className="bg-white p-8 rounded-[1.8rem] border border-slate-200 shadow-inner max-h-[250px] overflow-y-auto custom-scrollbar text-slate-700 text-[14px] leading-relaxed font-medium whitespace-pre-wrap">
                                 {latestDraft}
                               </div>
                               
                               <div className="flex gap-4">
                                  <button
                                    onClick={handleApply}
                                    className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 active:scale-95"
                                  >
                                    <MessageSquarePlus size={20} />
                                    Confirm & Export
                                  </button>
                                  <button
                                    onClick={() => setShowFullReview(true)}
                                    className="px-6 py-5 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                  >
                                    Edit Large
                                  </button>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-6 items-center">
                        <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-50 flex items-center justify-center animate-pulse shadow-inner">
                          <Loader2 size={24} className="text-indigo-600 animate-spin" />
                        </div>
                        <div className="px-6 py-4 bg-white border border-slate-100 rounded-full shadow-sm flex items-center gap-3">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Intelligence Synthesis</span>
                           <div className="flex gap-1.5">
                             <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                             <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                             <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Station */}
              <div className="p-10 shrink-0 border-t border-slate-50 bg-white shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
                <div className="max-w-4xl mx-auto">
                  <div className="flex gap-6">
                    <div className="flex-1 relative group">
                      <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="e.g. Help me define the context for a cooling tower fan..."
                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-[2rem] px-8 py-6 text-base font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 shadow-inner pr-24"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-300 pointer-events-none group-focus-within:opacity-0 transition-opacity">
                        <Settings size={12} /> ENTER
                      </div>
                    </div>
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="px-10 bg-slate-900 text-white rounded-[2rem] hover:bg-indigo-600 active:scale-95 disabled:opacity-20 transition-all shadow-2xl flex items-center justify-center gap-3 group"
                    >
                      <span className="font-black text-sm uppercase tracking-widest">Analyze</span>
                      <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="mt-6 flex justify-center items-center gap-8 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                     <div className="flex items-center gap-2"><Shield size={14} className="text-slate-200" /> SAE JA1011 Logic</div>
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-100"></div>
                     <div className="flex items-center gap-2"><Zap size={14} className="text-slate-200" /> ISO 14224 Mapping</div>
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-100"></div>
                     <div className="flex items-center gap-2"><Info size={14} className="text-slate-200" /> Component Breakdown</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
