
import React, { useState } from 'react';
import { X, AlertTriangle, Activity, Eye, BookOpen, Undo2 } from 'lucide-react';

interface SODReferenceProps {
  isOpen: boolean;
  onClose: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

const SEVERITY_DATA = [
  { score: 10, label: "Hazardous w/o Warning", desc: "Safety hazard, failure occurs without warning." },
  { score: 9, label: "Hazardous w/ Warning", desc: "Safety hazard, failure occurs with warning." },
  { score: 8, label: "Very High", desc: "Major disruption, loss of primary function." },
  { score: 7, label: "High", desc: "Significant disruption, reduced performance." },
  { score: 6, label: "Moderate", desc: "Minor disruption, comfort/convenience issue." },
  { score: 5, label: "Low", desc: "Minor performance loss." },
  { score: 4, label: "Very Low", desc: "Minor defect, fit/finish." },
  { score: 3, label: "Minor", desc: "Minor annoyance, noticed by some." },
  { score: 2, label: "Very Minor", desc: "Unnoticed by most users." },
  { score: 1, label: "None", desc: "No discernible effect." },
];

const OCCURRENCE_DATA = [
  { score: 10, label: "Very High", desc: "Failure almost inevitable (> 1 in 2)." },
  { score: 9, label: "Very High", desc: "Repeated failures (1 in 3)." },
  { score: 8, label: "High", desc: "Failures often (1 in 8)." },
  { score: 7, label: "High", desc: "Failures moderately frequent (1 in 20)." },
  { score: 6, label: "Moderate", desc: "Occasional failures (1 in 80)." },
  { score: 5, label: "Moderate", desc: "Infrequent failures (1 in 400)." },
  { score: 4, label: "Low", desc: "Few failures (1 in 2,000)." },
  { score: 3, label: "Low", desc: "Isolated failures (1 in 15,000)." },
  { score: 2, label: "Very Low", desc: "Only isolated failures associated (1 in 150,000)." },
  { score: 1, label: "Remote", desc: "Failure unlikely (< 1 in 1,500,000)." },
];

const DETECTION_DATA = [
  { score: 10, label: "Absolute Uncertainty", desc: "Defect cannot be detected." },
  { score: 9, label: "Very Remote", desc: "Very remote chance of detection." },
  { score: 8, label: "Remote", desc: "Remote chance of detection." },
  { score: 7, label: "Very Low", desc: "Very low chance of detection." },
  { score: 6, label: "Low", desc: "Low chance of detection." },
  { score: 5, label: "Moderate", desc: "Moderate chance of detection." },
  { score: 4, label: "Moderately High", desc: "Moderately high chance of detection." },
  { score: 3, label: "High", desc: "High chance of detection." },
  { score: 2, label: "Very High", desc: "Very high chance of detection." },
  { score: 1, label: "Almost Certain", desc: "Defect will be detected." },
];

export const SODReference: React.FC<SODReferenceProps> = ({ isOpen, onClose, onUndo, canUndo }) => {
  const [activeTab, setActiveTab] = useState<'S' | 'O' | 'D'>('S');

  if (!isOpen) return null;

  const renderTable = (data: typeof SEVERITY_DATA, colorClass: string) => (
    <div className="overflow-hidden border border-slate-200 rounded-lg shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 w-16 text-center">Score</th>
            <th className="px-4 py-3 w-40">Classification</th>
            <th className="px-4 py-3">Description / Criteria</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((row) => (
            <tr key={row.score} className="hover:bg-slate-50 transition-colors">
              <td className={`px-4 py-3 text-center font-bold ${colorClass}`}>{row.score}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
              <td className="px-4 py-3 text-slate-600">{row.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <BookOpen size={20} className="text-indigo-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg">FMECA Scoring Criteria</h3>
              <p className="text-xs text-slate-400">Standard 1-10 Industry Scale</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 rounded-full transition-all ${
                canUndo ? 'hover:bg-white/10 text-white' : 'text-slate-600 opacity-20'
              }`}
              title="Undo last action"
            >
              <Undo2 size={20} />
            </button>
            <button onClick={onClose} className="hover:bg-slate-700/50 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('S')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'S' 
                ? 'border-red-500 text-red-600 bg-red-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle size={16} /> Severity (S)
          </button>
          <button
            onClick={() => setActiveTab('O')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'O' 
                ? 'border-amber-500 text-amber-600 bg-amber-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Activity size={16} /> Occurrence (O)
          </button>
          <button
            onClick={() => setActiveTab('D')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'D' 
                ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Eye size={16} /> Detection (D)
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {activeTab === 'S' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
               <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800">
                 <strong>Definition:</strong> Severity ranks the potential failure mode effect on the system, process, or user.
               </div>
               {renderTable(SEVERITY_DATA, 'text-red-600')}
            </div>
          )}
          {activeTab === 'O' && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="mb-4 p-3 bg-amber-50 border-amber-100 rounded-lg text-xs text-amber-800">
                 <strong>Definition:</strong> Occurrence ranks the likelihood that a specific failure mode will happen.
               </div>
               {renderTable(OCCURRENCE_DATA, 'text-amber-600')}
            </div>
          )}
          {activeTab === 'D' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="mb-4 p-3 bg-blue-50 border-blue-100 rounded-lg text-xs text-blue-800">
                 <strong>Definition:</strong> Detection ranks the probability that the failure will be detected <em>before</em> the system fails.
               </div>
               {renderTable(DETECTION_DATA, 'text-blue-600')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
