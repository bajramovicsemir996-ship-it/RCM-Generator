
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Clock, Zap, Target, Calculator, CheckCircle2, Bot, Send, User, Loader2, Sparkles, Activity, AlertTriangle, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { RCMItem } from '../types';

interface IntervalOptimizerModalProps {
  item: RCMItem;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newInterval: string, pfInfo?: string) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PFCurve: React.FC<{ pfValue: number; taskInterval: number; unit: string }> = ({ pfValue, taskInterval, unit }) => {
  // SVG Dimensions
  const width = 300;
  const height = 150;
  const padding = 20;

  // Points for a smooth curve (Ease-in drop)
  const curvePoints = useMemo(() => {
    const points = [];
    for (let x = 0; x <= 100; x += 5) {
      // Exponential decay or sigmoid curve for failure progression
      const normalizedX = x / 100;
      const y = 1 - Math.pow(normalizedX, 2); 
      points.push(`${(normalizedX * (width - 2 * padding)) + padding},${(1 - y) * (height - 2 * padding) + padding}`);
    }
    return points.join(' ');
  }, [width, height, padding]);

  // Map PF Value (0-100) to curve
  const pX = padding + (0.3 * (width - 2 * padding)); // Fixed P start
  const fX = padding + ((0.3 + (pfValue / 150)) * (width - 2 * padding)); // F moves based on interval estimate
  
  const getY = (x: number) => {
    const normX = (x - padding) / (width - 2 * padding);
    const yVal = 1 - Math.pow(normX, 2);
    return (1 - yVal) * (height - 2 * padding) + padding;
  };

  const pY = getY(pX);
  const fY = getY(fX);

  return (
    <div className="relative w-full bg-slate-900/50 rounded-2xl p-4 border border-white/10 overflow-hidden">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reliability P-F Curve</span>
        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Active Visualizer</span>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-lg">
        {/* Grid Lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="white" strokeOpacity="0.1" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="white" strokeOpacity="0.1" strokeWidth="1" />
        
        {/* The Curve */}
        <polyline
          points={curvePoints}
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        <defs>
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* P Point */}
        <circle cx={pX} cy={pY} r="4" fill="#10b981" className="animate-pulse" />
        <text x={pX} y={pY - 8} textAnchor="middle" className="fill-emerald-400 text-[10px] font-black">P</text>
        
        {/* F Point */}
        <circle cx={fX} cy={fY} r="4" fill="#ef4444" />
        <text x={fX} y={fY + 15} textAnchor="middle" className="fill-red-400 text-[10px] font-black">F</text>

        {/* P-F Interval Bracket */}
        <path d={`M ${pX} ${height - padding + 5} L ${pX} ${height - padding + 10} L ${fX} ${height - padding + 10} L ${fX} ${height - padding + 5}`} fill="none" stroke="#6366f1" strokeWidth="1" />
        <text x={(pX + fX) / 2} y={height - 2} textAnchor="middle" className="fill-indigo-300 text-[8px] font-bold uppercase tracking-widest">Lead Time ({unit})</text>

        {/* Task Markers */}
        <line x1={pX + (fX - pX) / 2} y1={padding} x2={pX + (fX - pX) / 2} y2={height - padding} stroke="#6366f1" strokeDasharray="3,3" strokeWidth="1" />
        <text x={pX + (fX - pX) / 2} y={padding - 5} textAnchor="middle" className="fill-indigo-400 text-[7px] font-black uppercase tracking-widest">Ideal Inspection</text>
      </svg>
      
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-black/20 p-2 rounded-lg">
          <p className="text-[7px] text-slate-500 font-black uppercase mb-1">P-Point</p>
          <p className="text-[9px] text-emerald-400 font-bold leading-tight">Potential failure first detectable.</p>
        </div>
        <div className="bg-black/20 p-2 rounded-lg">
          <p className="text-[7px] text-slate-500 font-black uppercase mb-1">F-Point</p>
          <p className="text-[9px] text-red-400 font-bold leading-tight">Functional failure / Breakdown.</p>
        </div>
      </div>
    </div>
  );
};

const FormattedChatMessage: React.FC<{ content: string; role: 'user' | 'assistant' }> = ({ content, role }) => {
  return (
    <div className="space-y-2">
      {content.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        // Handle simple bullet points if AI still uses them
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <ChevronRight size={12} className="mt-1 shrink-0 opacity-50" />
              <span className="text-[13px] leading-relaxed">{trimmed.replace(/^[-*]\s*/, '')}</span>
            </div>
          );
        }

        return <p key={i} className="text-[13px] leading-relaxed font-medium">{trimmed.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
};

export const IntervalOptimizerModal: React.FC<IntervalOptimizerModalProps> = ({ item, isOpen, onClose, onApply }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [optimizedInterval, setOptimizedInterval] = useState(item.interval);
  
  // Interactive PF States
  const [pfValue, setPfValue] = useState(40); // 0-100 visual length
  const [pfTimeUnit, setPfTimeUnit] = useState('Days');
  const [pfDuration, setPfDuration] = useState(30);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([{
        role: 'assistant',
        content: `I am ready to optimize the maintenance frequency for ${item.component}. \n\nCurrent strategy: ${item.maintenanceTask} set at ${item.interval} intervals. \n\nTo ensure this is technically efficient, we need to consider the P-F Interval (the time from first detection of the failure mechanism to functional failure). \n\nBased on your site experience or manual data, how long does this failure typically take to progress once detected?`
      }]);
    }
  }, [isOpen, item]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `
        FAILURE MODE CONTEXT:
        Component: ${item.component}
        Failure Mode: ${item.failureMode}
        Current Task: ${item.maintenanceTask}
        Current Interval: ${item.interval}
        RPN: ${item.rpn} (S:${item.severity}, O:${item.occurrence}, D:${item.detection})

        USER INPUT: ${userText}

        STRICT INSTRUCTIONS:
        1. DO NOT use markdown characters like ** for bolding or # for headers.
        2. Respond in plain, professional English text.
        3. Analyze the user's input regarding P-F interval or MTBF.
        4. Apply RCM Standard SAE JA1011 logic: A task interval should typically be no more than half the P-F interval to be effective.
        5. Recommend a specific "Optimized Interval". 
        6. Wrap ONLY the final recommended interval value in <INTERVAL>Value</INTERVAL> tags (e.g. <INTERVAL>Monthly</INTERVAL>).
        7. Wrap a numeric P-F duration estimate in <PF_VAL>Number</PF_VAL> and unit in <PF_UNIT>Unit</PF_UNIT> tags for the visualizer.
        8. Provide a technical explanation of why this frequency is more efficient without using bolding or special symbols.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an RCM Interval Optimization Engine. You use technical lead times and reliability statistics to calculate effective maintenance frequencies. You avoid all markdown formatting, bolding, and special characters in your output."
        }
      });

      const aiText = response.text || "Calculation error.";
      const intervalMatch = aiText.match(/<INTERVAL>([\s\S]*?)<\/INTERVAL>/);
      const pfValMatch = aiText.match(/<PF_VAL>([\s\S]*?)<\/PF_VAL>/);
      const pfUnitMatch = aiText.match(/<PF_UNIT>([\s\S]*?)<\/PF_UNIT>/);
      
      if (intervalMatch) setOptimizedInterval(intervalMatch[1].trim());
      if (pfValMatch) {
        const val = parseInt(pfValMatch[1]);
        setPfDuration(val);
        setPfValue(Math.min(val * 2, 100)); // Just for visual scaling
      }
      if (pfUnitMatch) setPfTimeUnit(pfUnitMatch[1].trim());

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiText.replace(/<INTERVAL>[\s\S]*?<\/INTERVAL>|<PF_VAL>[\s\S]*?<\/PF_VAL>|<PF_UNIT>[\s\S]*?<\/PF_UNIT>/g, '').trim() 
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "MIRA encountered a logic error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualPfChange = (val: number) => {
    setPfValue(val);
    // Rough calculation for optimized interval based on slider
    // In a real scenario, this would be more complex
    if (val > 80) setOptimizedInterval("Quarterly");
    else if (val > 50) setOptimizedInterval("Monthly");
    else if (val > 20) setOptimizedInterval("Weekly");
    else setOptimizedInterval("Daily");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
              <Calculator size={24} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="font-black text-xl uppercase tracking-tighter">Interval Optimization Workspace</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">SAE JA1011 Feasibility Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Reliability Visualizer */}
          <div className="w-[22rem] border-r border-slate-100 bg-slate-50/50 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Interactive P-F Workstation</span>
              <PFCurve pfValue={pfValue} taskInterval={pfDuration / 2} unit={pfTimeUnit} />
            </div>

            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust Lead Time</span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Manual Override</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={pfValue}
                  onChange={(e) => handleManualPfChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 mb-2"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Short</span>
                  <span>Long P-F Interval</span>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-200">
                 <div className="flex items-center gap-2 mb-4">
                   <Target size={14} className="text-indigo-400" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Strategy</span>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Current</span>
                        <span className="text-sm font-black text-slate-400">{item.interval}</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-700 mb-1" />
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase block">Optimized</span>
                        <span className="text-xl font-black text-white">{optimizedInterval}</span>
                      </div>
                    </div>
                    <div className="h-px bg-slate-800"></div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                        Rule: Task Frequency &lt; P-F Interval / 2. This ensures at least two chances to detect potential failure before actual breakdown.
                      </p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Failure Mode Parameters</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Sev</span>
                  <span className="text-xs font-black text-red-600">{item.severity}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Occ</span>
                  <span className="text-xs font-black text-amber-600">{item.occurrence}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Det</span>
                  <span className="text-xs font-black text-blue-600">{item.detection}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Discussion Dialogue */}
          <div className="flex-1 flex flex-col bg-white">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white ${m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                      {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                      <FormattedChatMessage content={m.content} role={m.role} />
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consulting Reliability Database...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
               <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder="Discuss technical lead times with MIRA..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium shadow-sm"
                    />
                  </div>
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
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Interval Validation Protocol</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-lg transition-all">Cancel</button>
            <button 
              onClick={() => onApply(optimizedInterval)}
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={16} /> Confirm Strategy Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
