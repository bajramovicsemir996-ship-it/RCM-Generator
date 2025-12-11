
import React, { useState, useMemo } from 'react';
import { RCMItem, InspectionSheet } from '../types';
import { generateInspectionSheet } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, Clock, Activity, FileText, 
  Pencil, Trash2, Save, X, ClipboardList, Loader2,
  FileCheck, File, Printer, Copy, AlertOctagon, Info, FilterX, User
} from 'lucide-react';

interface AnalysisResultProps {
  data: RCMItem[];
  onUpdate: (newData: RCMItem[]) => void;
}

const COLORS = {
  High: '#ef4444',   // red-500
  Medium: '#f59e0b', // amber-500
  Low: '#10b981'     // emerald-500
};

const TASK_COLORS: Record<string, string> = {
  'Condition Monitoring': '#3b82f6', // Blue
  'Time-Based': '#8b5cf6', // Violet
  'Run-to-Failure': '#64748b', // Slate
  'Redesign': '#ec4899', // Pink
  'Failure Finding': '#f59e0b', // Amber
  'Lubrication': '#10b981', // Emerald
  'Servicing': '#06b6d4', // Cyan
  'Restoration': '#f97316', // Orange
  'Replacement': '#ef4444' // Red
};

// Helper for Heatmap colors in table
const getRPNColorStyle = (rpn: number) => {
  // Max RPN is 1000 (10x10x10). We create a gradient/percentage logic.
  // Critical > 200, High > 100, Med > 40
  if (rpn >= 200) return { bg: 'bg-red-100', text: 'text-red-900', bar: 'bg-red-500' };
  if (rpn >= 100) return { bg: 'bg-orange-100', text: 'text-orange-900', bar: 'bg-orange-500' };
  if (rpn >= 40) return { bg: 'bg-yellow-50', text: 'text-yellow-800', bar: 'bg-yellow-400' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-800', bar: 'bg-emerald-400' };
};

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-red-600 font-bold';
  if (score >= 5) return 'text-amber-600 font-medium';
  return 'text-slate-500';
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RCMItem | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<{s: number, o: number} | null>(null);
  
  // Inspection Sheet States
  const [generatingSheets, setGeneratingSheets] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewSheet, setViewSheet] = useState<{item: RCMItem} | null>(null);

  // Copy Feedback State
  const [copied, setCopied] = useState(false);

  // --- DERIVED DATA (SORTING & FILTERING) ---
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filter by Matrix Selection
    if (matrixFilter) {
      result = result.filter(item => 
        (item.severity || 0) === matrixFilter.s && 
        (item.occurrence || 0) === matrixFilter.o
      );
    }

    // 2. Auto-Sort by RPN (Descending) - Highest Risk First
    result.sort((a, b) => (b.rpn || 0) - (a.rpn || 0));

    return result;
  }, [data, matrixFilter]);

  // --- CHART DATA PREP ---
  const topRisks = [...data]
    .sort((a, b) => (b.rpn || 0) - (a.rpn || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.failureMode.length > 20 ? item.failureMode.substring(0, 20) + '...' : item.failureMode,
      rpn: item.rpn || 0
    }));

  // --- ACTIONS ---

  const handleDelete = (id: string) => {
    const newData = data.filter(item => item.id !== id);
    onUpdate(newData);
    if (viewSheet?.item.id === id) setViewSheet(null);
  };

  const handleEdit = (item: RCMItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSave = () => {
    if (!editForm || !editingId) return;
    const updatedForm = {
       ...editForm,
       rpn: (editForm.severity || 1) * (editForm.occurrence || 1) * (editForm.detection || 1)
    };
    const newData = data.map(item => item.id === editingId ? updatedForm : item);
    onUpdate(newData);
    setEditingId(null);
    setEditForm(null);
  };

  const handleChange = (field: keyof RCMItem, value: any) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleGenerateAllSheets = async () => {
    const itemsToProcess = data.filter(item => !item.inspectionSheet);
    if (itemsToProcess.length === 0) {
      alert("All items already have inspection sheets generated.");
      return;
    }
    setGeneratingSheets(true);
    setProgress({ current: 0, total: itemsToProcess.length });

    let currentData = [...data];
    const BATCH_SIZE = 3;
    for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
      const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        try {
          const sheet = await generateInspectionSheet(item);
          const index = currentData.findIndex(d => d.id === item.id);
          if (index !== -1) currentData[index] = { ...currentData[index], inspectionSheet: sheet };
        } catch (e) { console.error(e); }
      }));
      setProgress(prev => ({ ...prev, current: Math.min(prev.total, i + BATCH_SIZE) }));
      onUpdate([...currentData]);
    }
    setGeneratingSheets(false);
  };

  const handleGenerateSingleSheet = async (item: RCMItem) => {
    setGeneratingSheets(true);
    try {
      const sheet = await generateInspectionSheet(item);
      const newData = data.map(d => d.id === item.id ? { ...d, inspectionSheet: sheet } : d);
      onUpdate(newData);
      const updatedItem = newData.find(d => d.id === item.id);
      if (updatedItem) setViewSheet({ item: updatedItem });
    } catch (e) { alert("Failed to generate."); } finally { setGeneratingSheets(false); }
  };

  const handleCopy = async () => {
    const headers = [
      "Component", "Function", "Functional Failure", "Failure Mode", "Effect", 
      "Criticality", "S", "O", "D", "RPN",
      "Proposed Task", "Interval", "Task Type",
      "Inspection Checkpoint", "Criteria / Limits", "Responsibility", "Method", "Estimated Time", "Operator Remarks"
    ];
    // Use processedData to respect current sort/filter
    const rows = processedData.map(item => {
      const sheet = item.inspectionSheet;
      return [
        item.component, item.function, item.functionalFailure, item.failureMode, item.failureEffect,
        item.criticality, item.severity, item.occurrence, item.detection, item.rpn,
        item.maintenanceTask, item.interval, item.taskType,
        sheet?.checkPointDescription || "", 
        sheet?.criteriaLimits || sheet?.normalCondition || "", 
        sheet?.responsibility || "",
        sheet?.type || "", 
        sheet?.estimatedTime || "", 
        ""
      ].map(val => {
        const str = String(val || '');
        if (/[\t\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
      }).join("\t");
    });
    const text = [headers.join("\t"), ...rows].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { console.error(err); }
  };

  const handleMatrixClick = (s: number, o: number) => {
    if (matrixFilter?.s === s && matrixFilter?.o === o) {
      setMatrixFilter(null);
    } else {
      setMatrixFilter({ s, o });
    }
  };

  // --- COMPONENT RENDER ---

  return (
    <div className="space-y-8 animate-fade-in relative w-full">
      
      {/* Modal: Inspection Sheet */}
      {viewSheet && viewSheet.item.inspectionSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                   <ClipboardList size={20} className="text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg leading-tight">Inspection Sheet</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{viewSheet.item.component}</p>
                </div>
              </div>
              <button onClick={() => setViewSheet(null)} className="hover:bg-slate-700/50 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
               {/* Context Card */}
              <div className="flex justify-between items-start mb-8 bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm w-full">
                   <div>
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1 block">Failure Mode</span>
                      <span className="text-slate-900 font-semibold text-base block">{viewSheet.item.failureMode}</span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1 block">Task Description</span>
                      <span className="text-slate-900 font-medium block">{viewSheet.item.maintenanceTask}</span>
                   </div>
                   <div className="pt-2 border-t border-slate-200 mt-2">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1 block">Interval</span>
                      <span className="text-slate-700 font-mono">{viewSheet.item.interval}</span>
                   </div>
                   <div className="pt-2 border-t border-slate-200 mt-2">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1 block">Task Type</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                        {viewSheet.item.taskType}
                      </span>
                   </div>
                </div>
              </div>

              {/* Printable Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 w-1/4">Checkpoint Description</th>
                      <th className="px-6 py-4 w-1/5">Criteria / Limits</th>
                      <th className="px-6 py-4 w-1/6">Responsibility</th>
                      <th className="px-6 py-4 w-1/6">Method / Time</th>
                      <th className="px-6 py-4">Operator Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-6 py-5 align-top">
                        <div className="font-semibold text-slate-900 mb-2">Check / Measure:</div>
                        <p className="text-slate-600 leading-relaxed">
                          {viewSheet.item.inspectionSheet.checkPointDescription}
                        </p>
                      </td>
                      
                      {/* Criteria / Limits */}
                      <td className="px-6 py-5 align-top bg-emerald-50/20">
                        <div className="flex gap-3">
                          <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-emerald-900 font-medium">
                            {viewSheet.item.inspectionSheet.criteriaLimits || viewSheet.item.inspectionSheet.normalCondition || "N/A"}
                          </p>
                        </div>
                      </td>
                      
                      {/* Responsibility */}
                      <td className="px-6 py-5 align-top text-slate-700">
                        <div className="flex items-center gap-2">
                           <User size={16} className="text-indigo-400" />
                           <span className="font-medium">
                             {viewSheet.item.inspectionSheet.responsibility || "Operator"}
                           </span>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top text-slate-600 space-y-3">
                        <div className="inline-flex items-center px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium">
                          {viewSheet.item.inspectionSheet.type}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Clock size={14} />
                          {viewSheet.item.inspectionSheet.estimatedTime}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top border-l border-slate-50 bg-yellow-50/10">
                        <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg w-full flex items-center justify-center text-slate-300 text-xs select-none">
                          Operator Input Area
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-between shrink-0 border-t border-slate-200">
               <button 
                 onClick={() => alert("Print functionality ready.")}
                 className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
               >
                 <Printer size={16} /> Print Sheet
               </button>
               <button 
                 onClick={() => setViewSheet(null)}
                 className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Failure Modes', value: data.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Max RPN Score', value: Math.max(...data.map(i => i.rpn || 0), 0), icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Time-Based Tasks', value: data.filter(i => i.taskType === 'Time-Based').length, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Run-to-Failure', value: data.filter(i => i.taskType === 'Run-to-Failure').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
           <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Risk Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Risk Matrix Visualization */}
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={20} className="text-orange-500" />
                Risk Criticality Matrix
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Click any cell to filter the items below.
                {matrixFilter && <span className="ml-1 text-indigo-600 font-medium">(Filter Active)</span>}
              </p>
            </div>
            <div className="flex gap-2 text-xs font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-sm"></div> Low</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm"></div> Med</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm"></div> High</div>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px] flex items-center justify-center p-4 relative">
             {/* Custom HTML/CSS Grid for Matrix */}
             <div className="relative w-full max-w-lg aspect-square">
                {/* Y-Axis Label */}
                <div className="absolute -left-12 top-0 bottom-0 flex items-center justify-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest -rotate-90">Occurrence</span>
                </div>
                {/* X-Axis Label */}
                <div className="absolute left-0 right-0 -bottom-8 flex items-center justify-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Severity</span>
                </div>

                <div className="grid grid-cols-10 grid-rows-10 gap-1 w-full h-full">
                   {Array.from({ length: 100 }).map((_, idx) => {
                      const x = (idx % 10) + 1; // 1-10 (Severity)
                      const y = 10 - Math.floor(idx / 10); // 10-1 (Occurrence, flipped for visual)
                      
                      const score = x * y;
                      let bgClass = "bg-emerald-50 border-emerald-100";
                      if (score >= 50) bgClass = "bg-red-50 border-red-100";
                      else if (score >= 20) bgClass = "bg-amber-50 border-amber-100";
                      
                      const isSelected = matrixFilter?.s === x && matrixFilter?.o === y;
                      if (isSelected) bgClass = "bg-indigo-600 border-indigo-700 ring-2 ring-indigo-300 z-10";
                      else if (matrixFilter) bgClass += " opacity-40 grayscale"; // Dim others when filtering

                      // Find items in this cell
                      const itemsInCell = data.filter(d => (d.severity || 0) === x && (d.occurrence || 0) === y);
                      const count = itemsInCell.length;

                      return (
                        <button 
                          key={idx} 
                          onClick={() => handleMatrixClick(x, y)}
                          className={`border rounded-sm relative group transition-all hover:scale-110 hover:z-20 outline-none focus:ring-2 focus:ring-indigo-400 ${bgClass}`}
                          title={`Click to filter items with S:${x}, O:${y}`}
                        >
                           {count > 0 && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`
                                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-transform
                                  ${isSelected ? 'bg-white text-indigo-700 scale-100' : 'text-white scale-90 group-hover:scale-110'}
                                  ${!isSelected && (score >= 50 ? 'bg-red-500' : score >= 20 ? 'bg-amber-500' : 'bg-emerald-500')}
                                `}>
                                   {count}
                                </div>
                                {/* Tooltip (Only show if not filtering or this one is selected) */}
                                {(!matrixFilter || isSelected) && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none z-30 hidden group-hover:block text-left">
                                    <div className="font-bold mb-1 border-b border-slate-700 pb-1">S:{x} O:{y} • {count} Items</div>
                                    <ul className="list-disc pl-3 space-y-0.5">
                                      {itemsInCell.slice(0, 3).map(i => (
                                        <li key={i.id} className="truncate">{i.failureMode}</li>
                                      ))}
                                      {itemsInCell.length > 3 && <li>+ {itemsInCell.length - 3} more</li>}
                                    </ul>
                                    <div className="mt-1.5 text-slate-400 italic text-[9px]">Click to filter list</div>
                                  </div>
                                )}
                             </div>
                           )}
                        </button>
                      );
                   })}
                </div>
                
                {/* Axis Ticks */}
                <div className="absolute bottom-0 left-0 w-full flex justify-between px-1 translate-y-full pt-1 text-[10px] text-slate-400 font-mono">
                  <span>1</span><span>5</span><span>10</span>
                </div>
                <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-1 -translate-x-full pr-1 text-[10px] text-slate-400 font-mono">
                  <span>10</span><span>5</span><span>1</span>
                </div>
             </div>
          </div>
        </div>

        {/* Top Risks Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Top 5 Critical Risks (RPN)</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRisks} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: '#64748b'}} />
                <RechartsTooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Bar dataKey="rpn" radius={[0, 4, 4, 0]} barSize={24}>
                  {topRisks.map((entry, index) => (
                    <Cell key={index} fill={entry.rpn >= 150 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Analysis Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                <FileText size={20} className="text-white" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800">FMECA Analysis Details</h3>
                <p className="text-xs text-slate-500">
                  {matrixFilter 
                    ? `Showing filtered results for Severity ${matrixFilter.s} / Occurrence ${matrixFilter.o}`
                    : "Comprehensive Failure Modes & Effects List (Auto-sorted by RPN)"
                  }
                </p>
             </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-3">
            <button 
              onClick={handleGenerateAllSheets}
              disabled={generatingSheets}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all border shadow-sm
                ${generatingSheets 
                  ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-wait' 
                  : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
                }`}
            >
              {generatingSheets ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <ClipboardList size={16} />
                  Generate Inspection Sheets
                </>
              )}
            </button>

            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
            >
              {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
              {copied ? "Copied!" : "Excel Copy"}
            </button>

            <button 
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," 
                  + ["Component,Function,Functional Failure,Failure Mode,Effect,Criticality,S,O,D,RPN,Task,Interval,Type,Inspection Checkpoint,Criteria/Limits,Responsibility,Inspection Type,Time,Operator Remarks"].join(",") + "\n"
                  + processedData.map(e => {
                      const sheet = e.inspectionSheet;
                      return `"${e.component}","${e.function}","${e.functionalFailure || ''}","${e.failureMode}","${e.failureEffect}","${e.criticality}","${e.severity}","${e.occurrence}","${e.detection}","${e.rpn}","${e.maintenanceTask}","${e.interval}","${e.taskType}","${sheet?.checkPointDescription || ''}","${sheet?.criteriaLimits || sheet?.normalCondition || ''}","${sheet?.responsibility || ''}","${sheet?.type || ''}","${sheet?.estimatedTime || ''}",""`;
                    }).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "fmeca_rcm_analysis.csv");
                document.body.appendChild(link);
                link.click();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
            >
              <FileText size={16} /> Export CSV
            </button>
          </div>
        </div>
        
        {generatingSheets && (
           <div className="w-full bg-slate-100 h-1">
              <div 
                className="bg-indigo-600 h-1 transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              ></div>
           </div>
        )}

        {/* Filter Banner */}
        {matrixFilter && (
           <div className="bg-slate-800 text-white px-6 py-3 flex justify-between items-center animate-in slide-in-from-top-2 duration-200">
             <div className="flex items-center gap-3">
               <div className="p-1.5 bg-indigo-500 rounded text-white">
                 <FilterX size={16} />
               </div>
               <span className="text-sm font-medium">
                 Filtering View: <span className="text-slate-300">Severity</span> <strong className="text-white">{matrixFilter.s}</strong> × <span className="text-slate-300">Occurrence</span> <strong className="text-white">{matrixFilter.o}</strong>
               </span>
             </div>
             <button 
               onClick={() => setMatrixFilter(null)}
               className="text-xs bg-white text-slate-900 px-3 py-1.5 rounded font-bold hover:bg-slate-200 transition-colors"
             >
               Clear Filter
             </button>
           </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm sticky top-0 z-10">
                <th className="px-6 py-4 min-w-[150px]">Component</th>
                <th className="px-6 py-4 min-w-[200px]">Function</th>
                <th className="px-6 py-4 min-w-[200px]">Functional Failure</th>
                <th className="px-6 py-4 min-w-[250px]">Failure Mode & Effect</th>
                
                {/* Heatmap Headers */}
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50 border-l border-slate-200" title="Severity (1-10)">S</th>
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50" title="Occurrence (1-10)">O</th>
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50" title="Detection (1-10)">D</th>
                <th className="px-4 py-4 min-w-[120px] text-left bg-slate-100/50 border-r border-slate-200" title="Risk Priority Number">RPN Score</th>
                
                <th className="px-6 py-4 min-w-[200px]">Proposed Task</th>
                <th className="px-6 py-4 w-16 text-center">Insp.</th>
                <th className="px-6 py-4 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm bg-white">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400">
                    {matrixFilter ? "No items match this risk category." : "No analysis data available."}
                  </td>
                </tr>
              ) : (
                processedData.map((item) => {
                  const isEditing = editingId === item.id;
                  
                  if (isEditing && editForm) {
                    return (
                      <tr key={item.id} className="bg-indigo-50/30 ring-2 ring-indigo-500/20 z-10 relative shadow-lg">
                        <td className="px-6 py-4 align-top">
                          <input
                            type="text"
                            value={editForm.component}
                            onChange={(e) => handleChange('component', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <textarea
                            rows={3}
                            value={editForm.function}
                            onChange={(e) => handleChange('function', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <textarea
                            rows={3}
                            value={editForm.functionalFailure}
                            onChange={(e) => handleChange('functionalFailure', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mode</label>
                              <textarea
                                rows={2}
                                value={editForm.failureMode}
                                onChange={(e) => handleChange('failureMode', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Effect</label>
                              <textarea
                                rows={3}
                                value={editForm.failureEffect}
                                onChange={(e) => handleChange('failureEffect', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                              />
                            </div>
                          </div>
                        </td>

                        {/* FMECA Editing */}
                        <td className="px-2 py-4 align-top bg-white/50 border-l border-indigo-100">
                           <input type="number" min="1" max="10" value={editForm.severity} onChange={(e) => handleChange('severity', parseInt(e.target.value))} className="w-full px-1 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </td>
                        <td className="px-2 py-4 align-top bg-white/50">
                           <input type="number" min="1" max="10" value={editForm.occurrence} onChange={(e) => handleChange('occurrence', parseInt(e.target.value))} className="w-full px-1 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </td>
                        <td className="px-2 py-4 align-top bg-white/50">
                           <input type="number" min="1" max="10" value={editForm.detection} onChange={(e) => handleChange('detection', parseInt(e.target.value))} className="w-full px-1 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </td>
                        <td className="px-4 py-4 align-top text-center font-bold text-slate-400 bg-white/50 border-r border-indigo-100">
                           {(editForm.severity || 1) * (editForm.occurrence || 1) * (editForm.detection || 1)}
                        </td>

                        <td className="px-6 py-4 align-top">
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={editForm.maintenanceTask}
                              onChange={(e) => handleChange('maintenanceTask', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                              placeholder="Task"
                            />
                            <input
                              type="text"
                              value={editForm.interval}
                              onChange={(e) => handleChange('interval', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              placeholder="Interval"
                            />
                            <select
                              value={editForm.taskType}
                              onChange={(e) => handleChange('taskType', e.target.value as any)}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            >
                              {Object.keys(TASK_COLORS).map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-center text-slate-300">
                          <File size={20} className="mx-auto" />
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <button 
                              type="button"
                              onClick={handleSave}
                              className="p-2 bg-emerald-500 text-white rounded shadow hover:bg-emerald-600 transition-colors"
                              title="Save"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={handleCancel}
                              className="p-2 bg-slate-200 text-slate-600 rounded shadow hover:bg-slate-300 transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // --- HEATMAP STYLES ---
                  const rpn = item.rpn || 0;
                  const rpnStyle = getRPNColorStyle(rpn);
                  const rpnPercent = Math.min((rpn / 500) * 100, 100); // Scale to 500 max for visual bar

                  return (
                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 align-top leading-snug">
                        {item.component}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 text-xs leading-relaxed">
                        {item.function}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 text-xs leading-relaxed">
                        {item.functionalFailure}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div className="text-slate-900 font-semibold bg-white border border-slate-200 px-2.5 py-1.5 rounded-md inline-block text-xs shadow-sm">
                            {item.failureMode}
                          </div>
                          <div className="text-slate-500 text-xs pl-1 leading-relaxed">
                            <span className="font-bold text-slate-400 uppercase text-[10px]">Effect:</span> {item.failureEffect}
                          </div>
                        </div>
                      </td>

                      {/* FMECA Heatmap Cells */}
                      <td className="px-2 py-4 align-middle text-center border-l border-slate-100">
                        <span className={`text-sm ${getScoreColor(item.severity)}`}>{item.severity}</span>
                      </td>
                      <td className="px-2 py-4 align-middle text-center">
                        <span className={`text-sm ${getScoreColor(item.occurrence)}`}>{item.occurrence}</span>
                      </td>
                      <td className="px-2 py-4 align-middle text-center">
                        <span className={`text-sm ${getScoreColor(item.detection)}`}>{item.detection}</span>
                      </td>
                      
                      {/* RPN Heatmap Bar */}
                      <td className="px-4 py-4 align-middle border-r border-slate-100">
                         <div className="flex flex-col gap-1">
                            <span className={`text-xs font-bold ${rpnStyle.text}`}>{rpn}</span>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <div className={`h-full rounded-full ${rpnStyle.bar}`} style={{width: `${rpnPercent}%`}}></div>
                            </div>
                         </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5">
                          <div className="font-medium text-slate-800 text-sm">{item.maintenanceTask}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={12} />
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{item.interval}</span>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                            {item.taskType}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 align-middle text-center">
                         {item.inspectionSheet ? (
                           <button 
                             type="button"
                             onClick={() => setViewSheet({ item })}
                             className="group/btn relative text-emerald-500 hover:text-emerald-600 transition-all"
                           >
                             <div className="absolute inset-0 bg-emerald-100 rounded-full scale-0 group-hover/btn:scale-150 transition-transform opacity-50"></div>
                             <FileCheck size={22} strokeWidth={2} className="relative z-10" />
                           </button>
                         ) : (
                           <button 
                              type="button"
                              onClick={() => handleGenerateSingleSheet(item)}
                              className="text-slate-300 hover:text-indigo-500 transition-colors hover:scale-110 transform"
                              title="Generate Inspection Sheet"
                              disabled={generatingSheets}
                           >
                              <File size={22} />
                           </button>
                         )}
                      </td>

                      <td className="px-6 py-4 align-middle text-right">
                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
