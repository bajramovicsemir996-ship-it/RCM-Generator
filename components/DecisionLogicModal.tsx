
import React from 'react';
import { X, GitBranch, ShieldCheck, AlertCircle, Zap, Clock, Search, HelpCircle, ArrowRight, ArrowDown, ChevronRight, Redo2, Undo2 } from 'lucide-react';

interface DecisionLogicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

const DecisionNode = ({ label, icon: Icon, color = "indigo" }: { label: string, icon: any, color?: string }) => (
  <div className={`relative z-10 bg-white border-2 border-${color}-600 p-4 rounded-2xl shadow-lg w-full max-w-[280px] group hover:scale-105 transition-transform duration-300`}>
    <div className={`absolute -top-4 -left-4 w-10 h-10 bg-${color}-600 rounded-xl flex items-center justify-center text-white shadow-xl`}>
      <Icon size={20} />
    </div>
    <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug pt-1">{label}</p>
  </div>
);

const OutcomeNode = ({ label, type, icon: Icon, color = "emerald" }: { label: string, type: string, icon: any, color?: string }) => (
  <div className={`relative z-10 bg-white border-2 border-${color}-500 p-4 rounded-xl shadow-md w-full max-w-[240px] flex items-center gap-3 hover:shadow-xl transition-all border-dashed`}>
    <div className={`p-2 bg-${color}-50 text-${color}-600 rounded-lg`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{type}</p>
      <p className="text-sm font-bold text-slate-900 leading-none">{label}</p>
    </div>
  </div>
);

const Connector = ({ label, horizontal = false }: { label: string, horizontal?: boolean }) => (
  <div className={`flex ${horizontal ? 'items-center px-4' : 'flex-col items-center py-4'} justify-center relative shrink-0`}>
    <div className={`${horizontal ? 'h-0.5 w-12' : 'w-0.5 h-12'} bg-slate-200`}></div>
    <span className={`absolute bg-white px-2 py-0.5 border border-slate-100 rounded text-[9px] font-black uppercase tracking-tighter ${horizontal ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2'} ${label === 'Yes' ? 'text-emerald-600' : 'text-slate-400'}`}>
      {label}
    </span>
  </div>
);

export const DecisionLogicModal: React.FC<DecisionLogicModalProps> = ({ isOpen, onClose, onUndo, canUndo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Header */}
        <div className="bg-slate-900 px-10 py-8 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-500/20 rounded-[1.5rem] border border-indigo-500/30 shadow-inner">
              <GitBranch size={32} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="font-black text-2xl tracking-tighter uppercase leading-none">RCM Decision Diagram</h3>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">SAE JA1011 Reference Flow</span>
                <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Proactive Strategy Logic</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-3 rounded-full transition-all ${
                canUndo ? 'bg-white/10 text-white hover:bg-white/20' : 'text-slate-600 opacity-20'
              }`}
              title="Undo last action"
            >
              <Undo2 size={28} />
            </button>
            <button onClick={onClose} className="p-3 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white rounded-full transition-all">
              <X size={28} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-12 bg-[#f8fafc] flex flex-col items-center">
          
          <div className="max-w-4xl w-full space-y-2 mb-16 text-center">
            <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Decision Flowchart</h4>
            <p className="text-sm text-slate-500 font-medium italic">Standardized logic for determining if a proactive task is technically feasible and worth doing.</p>
          </div>

          {/* THE DIAGRAM */}
          <div className="flex flex-col items-center w-full min-w-[900px]">
            
            {/* START */}
            <DecisionNode label="Is the failure evident to the operator under normal circumstances?" icon={HelpCircle} />
            
            <div className="flex w-full justify-center">
              {/* HIDDEN PATH */}
              <div className="flex flex-col items-center px-12 border-l border-slate-100 mt-4">
                <Connector label="No" />
                <div className="p-3 bg-amber-50 rounded-full mb-4 border border-amber-100 shadow-sm"><AlertCircle size={20} className="text-amber-600" /></div>
                <p className="text-[10px] font-black text-amber-600 uppercase mb-4 tracking-widest">Hidden Failure Path</p>
                <OutcomeNode label="Failure Finding Task" type="Mandatory" icon={Search} color="amber" />
                <Connector label="Next" />
                <DecisionNode label="Is Safety or Environment threatened?" icon={ShieldCheck} color="red" />
                <Connector label="No" />
                <OutcomeNode label="Run to Failure / Redesign" type="Economic Decision" icon={Redo2} color="slate" />
              </div>

              {/* EVIDENT PATH */}
              <div className="flex flex-col items-center px-12 border-r border-slate-100 mt-4">
                <Connector label="Yes" />
                <div className="p-3 bg-indigo-50 rounded-full mb-4 border border-indigo-100 shadow-sm"><ArrowRight size={20} className="text-indigo-600" /></div>
                <p className="text-[10px] font-black text-indigo-600 uppercase mb-4 tracking-widest">Evident Failure Path</p>
                <DecisionNode label="Does failure cause hazard to safety or environment?" icon={AlertCircle} color="red" />
                
                <div className="flex gap-16 mt-4">
                  <div className="flex flex-col items-center">
                    <Connector label="Yes" />
                    <OutcomeNode label="Condition Monitoring" type="Highest Priority" icon={Zap} color="red" />
                    <Connector label="If not feasible" />
                    <OutcomeNode label="Scheduled Replacement" type="Hard Time" icon={Clock} color="red" />
                    <Connector label="If still unsafe" />
                    <div className="p-5 bg-red-600 text-white rounded-2xl shadow-xl font-black text-xs uppercase tracking-widest">Mandatory Redesign</div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <Connector label="No" />
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest">Operational Path</p>
                    <OutcomeNode label="Condition Monitoring" type="Proactive" icon={Zap} color="emerald" />
                    <Connector label="Or" />
                    <OutcomeNode label="Scheduled Restoration" type="Proactive" icon={Redo2} color="emerald" />
                    <Connector label="If not justified" />
                    <OutcomeNode label="Run to Failure" type="Economic" icon={ArrowDown} color="slate" />
                  </div>
                </div>
              </div>

            </div>

          </div>

          <div className="mt-20 max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Goal 1</h5>
              <p className="text-sm font-bold text-slate-800 leading-relaxed italic">"Prevent or reduce the consequences of failure, not just the failure itself."</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Goal 2</h5>
              <p className="text-sm font-bold text-slate-800 leading-relaxed italic">"Optimize the maintenance spend by applying tasks only where technically effective."</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Goal 3</h5>
              <p className="text-sm font-bold text-slate-800 leading-relaxed italic">"Prioritize safety and environmental protection above operational availability."</p>
            </div>
          </div>
        </div>

        <div className="bg-white px-10 py-6 border-t border-slate-100 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interactive Logic Guide v4.0</span>
           </div>
           <button 
             onClick={onClose}
             className="px-10 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95"
           >
             Return to Synthesis
           </button>
        </div>
      </div>
    </div>
  );
};
