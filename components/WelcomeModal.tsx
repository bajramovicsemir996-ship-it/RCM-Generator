
import React from 'react';
import { X, Sparkles, Zap, ShieldCheck, FileCheck, ClipboardList, Cpu, ArrowRight } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const features = [
    {
      icon: <Sparkles className="text-indigo-500" size={20} />,
      title: "Context Intelligence",
      description: "Build robust operational contexts using our interactive RCM facilitator wizard."
    },
    {
      icon: <Cpu className="text-indigo-500" size={20} />,
      title: "AI FMECA Synthesis",
      description: "Generate SAE JA1011 compliant failure modes, effects, and risk assessments automatically."
    },
    {
      icon: <ClipboardList className="text-indigo-500" size={20} />,
      title: "Inspection Procedures",
      description: "Automatically produce detailed technical inspection sheets with pass/fail criteria."
    },
    {
      icon: <ShieldCheck className="text-indigo-500" size={20} />,
      title: "Risk Visualization",
      description: "Interact with RPN criticality matrices to identify and prioritize high-risk assets."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-white/20">
        
        {/* Decorative Header */}
        <div className="bg-slate-900 px-10 py-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Cpu size={180} className="rotate-12" />
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-2xl mb-6">
              <Cpu size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">Welcome to RCM Pro</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Maintenance Intelligence Platform</span>
              <div className="w-1 h-1 rounded-full bg-slate-700"></div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">v4.0 Enterprise</span>
            </div>
          </div>
        </div>

        <div className="p-10 bg-white">
          <div className="mb-10 text-center">
            <p className="text-slate-500 font-medium leading-relaxed italic">
              Empower your maintenance strategy with high-fidelity Reliability Centered Maintenance analysis driven by advanced AI synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
            {features.map((f, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors shrink-0 h-fit">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tight mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={onClose}
              className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98]"
            >
              Start Synthesis <ArrowRight size={18} />
            </button>
            <p className="text-[9px] text-slate-300 text-center font-bold uppercase tracking-widest">
              Compliant with SAE JA1011 & ISO 14224 Standards
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
};
