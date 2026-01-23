
import React, { useState, useMemo } from 'react';
import { RCMItem, InspectionSheet, InspectionStep, ConsequenceCategory, ComponentIntel } from '../types';
import { generateInspectionSheet } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, Clock, Activity, FileText, 
  Pencil, Trash2, Save, X, ClipboardList, Loader2,
  FileCheck, File, Printer, Copy, AlertOctagon, FilterX, User, ShieldAlert, Wrench, Search, ChevronRight, Sparkles, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Tag, ShieldCheck, Zap, ListChecks, Info, MapPin, Eye, Undo2, LayoutList
} from 'lucide-react';

interface AnalysisResultProps {
  data: RCMItem[];
  onUpdate: (newData: RCMItem[]) => void;
  onUndo: () => void;
  canUndo: boolean;
}

const CONSEQUENCE_LABELS: ConsequenceCategory[] = [
  'Hidden - Safety/Env', 
  'Hidden - Operational', 
  'Evident - Safety/Env', 
  'Evident - Operational',
  'Evident - Non-Operational'
];

const COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981'
};

const getTaskImage = (task: string): string => {
  const t = (task || '').toLowerCase();
  if (t.includes('thermal') || t.includes('infrared') || t.includes('thermography') || t.includes('heat') || t.includes('temperature')) 
    return 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80';
  if (t.includes('vibration') || t.includes('accelerometer') || t.includes('oscillation') || t.includes('align')) 
    return 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80';
  if (t.includes('oil') || t.includes('lubricat') || t.includes('grease') || t.includes('sample') || t.includes('fluid')) 
    return 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80';
  if (t.includes('motor') || t.includes('voltage') || t.includes('current') || t.includes('insulation') || t.includes('winding') || t.includes('electric')) 
    return 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80';
  if (t.includes('ultrasonic') || t.includes('sound') || t.includes('acoustic') || t.includes('nds') || t.includes('ndt')) 
    return 'https://images.unsplash.com/photo-1581092335397-9583eb92d232?auto=format&fit=crop&w=800&q=80';
  if (t.includes('visual') || t.includes('check') || t.includes('inspect') || t.includes('look') || t.includes('monitor')) 
    return 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80';
  if (t.includes('clean') || t.includes('wash') || t.includes('sweep') || t.includes('housekeeping')) 
    return 'https://images.unsplash.com/photo-1581578731117-104f8a74695b?auto=format&fit=crop&w=800&q=80';
  if (t.includes('replace') || t.includes('remove') || t.includes('install') || t.includes('bearing') || t.includes('seal') || t.includes('valve') || t.includes('pump')) 
    return 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=800&q=80';
  return 'https://images.unsplash.com/photo-1565514020176-db5b550dd707?auto=format&fit=crop&w=800&q=80';
};

const getRPNColorStyle = (rpn: number) => {
  if (rpn >= 120) return { bg: 'bg-red-100', text: 'text-red-900', bar: 'bg-red-500' };
  if (rpn >= 75) return { bg: 'bg-orange-100', text: 'text-orange-900', bar: 'bg-orange-500' };
  if (rpn >= 40) return { bg: 'bg-yellow-50', text: 'text-yellow-800', bar: 'bg-yellow-400' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-800', bar: 'bg-emerald-400' };
};

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-red-600 font-bold';
  if (score >= 5) return 'text-amber-600 font-medium';
  return 'text-slate-500';
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, onUpdate, onUndo, canUndo }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RCMItem | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<{s: number, o: number} | null>(null);
  const [barFilter, setBarFilter] = useState<string | null>(null);
  const [selectedIntel, setSelectedIntel] = useState<RCMItem | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof RCMItem | 'rpn'; direction: 'asc' | 'desc' }>({ key: 'rpn', direction: 'desc' });
  const [searchFilters, setSearchFilters] = useState({
    component: '',
    function: '',
    failureMode: '',
    consequenceCategory: '',
    iso14224Code: ''
  });
  
  const [generatingSheets, setGeneratingSheets] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewSheet, setViewSheet] = useState<{item: RCMItem} | null>(null);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [classicalCopied, setClassicalCopied] = useState(false);

  const processedData = useMemo(() => {
    let result = (data || []).filter(item => item !== null && item !== undefined);

    if (matrixFilter) {
      result = result.filter(item => 
        (item.severity || 0) === matrixFilter.s && 
        (item.occurrence || 0) === matrixFilter.o
      );
    }

    if (barFilter) {
      result = result.filter(item => item.id === barFilter);
    }

    if (searchFilters.component) {
      result = result.filter(item => (item.component || '').toLowerCase().includes(searchFilters.component.toLowerCase()));
    }
    if (searchFilters.function) {
      result = result.filter(item => (item.function || '').toLowerCase().includes(searchFilters.function.toLowerCase()));
    }
    if (searchFilters.failureMode) {
      result = result.filter(item => (item.failureMode || '').toLowerCase().includes(searchFilters.failureMode.toLowerCase()));
    }
    if (searchFilters.consequenceCategory) {
      result = result.filter(item => (item.consequenceCategory || '').toLowerCase().includes(searchFilters.consequenceCategory.toLowerCase()));
    }
    if (searchFilters.iso14224Code) {
      result = result.filter(item => (item.iso14224Code || '').toLowerCase().includes(searchFilters.iso14224Code.toLowerCase()));
    }

    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });

    return result;
  }, [data, matrixFilter, barFilter, sortConfig, searchFilters]);

  const handleInternalUndo = () => {
    onUndo();
    setTimeout(() => {
       if (viewSheet) {
          const updatedItem = data.find(i => i.id === viewSheet.item.id);
          if (updatedItem) setViewSheet({ item: updatedItem });
       }
       if (selectedIntel) {
          const updatedItem = data.find(i => i.id === selectedIntel.id);
          if (updatedItem) setSelectedIntel(updatedItem);
       }
    }, 0);
  };

  const requestSort = (key: keyof RCMItem | 'rpn') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSearchChange = (field: keyof typeof searchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

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

  const handleSave = async () => {
    if (!editForm || !editingId) return;
    const originalItem = data.find(d => d.id === editingId);
    if (!originalItem) return;
    const hasCriticalChanges = 
      editForm.maintenanceTask !== originalItem.maintenanceTask ||
      editForm.failureMode !== originalItem.failureMode ||
      editForm.component !== originalItem.component;
    const needsRegeneration = hasCriticalChanges && !!originalItem.inspectionSheet;
    const updatedForm = {
       ...editForm,
       rpn: (editForm.severity || 1) * (editForm.occurrence || 1) * (editForm.detection || 1),
       inspectionSheet: needsRegeneration ? undefined : editForm.inspectionSheet
    };
    const newData = data.map(item => item.id === editingId ? updatedForm : item);
    onUpdate(newData);
    setEditingId(null);
    setEditForm(null);
    if (needsRegeneration) {
      setRegeneratingIds(prev => new Set(prev).add(updatedForm.id));
      try {
        const newSheet = await generateInspectionSheet(updatedForm);
        const finalData = newData.map(item => 
          item.id === updatedForm.id ? { ...item, inspectionSheet: newSheet } : item
        );
        onUpdate(finalData);
      } catch (err) { console.error("Failed to auto-regenerate sheet", err); } finally {
        setRegeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(updatedForm.id);
          return next;
        });
      }
    }
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
    setRegeneratingIds(prev => new Set(prev).add(item.id));
    try {
      const sheet = await generateInspectionSheet(item);
      const newData = data.map(d => d.id === item.id ? { ...d, inspectionSheet: sheet } : d);
      onUpdate(newData);
      const updatedItem = newData.find(d => d.id === item.id);
      if (updatedItem) setViewSheet({ item: updatedItem });
    } catch (e) { alert("Failed to generate."); } finally { 
      setGeneratingSheets(false); 
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const updateItemInMainData = (updatedItem: RCMItem) => {
    const newData = data.map(d => d.id === updatedItem.id ? updatedItem : d);
    onUpdate(newData);
  };

  const handleDeleteStep = (idx: number) => {
    if (!viewSheet) return;
    const item = viewSheet.item;
    const sheet = item.inspectionSheet;
    if (!sheet || !sheet.steps) return;
    const newSteps = sheet.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
    const updatedItem = { ...item, inspectionSheet: { ...sheet, steps: newSteps } };
    setViewSheet({ item: updatedItem });
    updateItemInMainData(updatedItem);
  };

  const handleAddStep = () => {
    if (!viewSheet) return;
    const item = viewSheet.item;
    const sheet = item.inspectionSheet || { responsibility: 'Operator', estimatedTime: '10m', safetyPrecautions: 'Standard PPE', toolsRequired: 'None', steps: [] };
    const newStep: InspectionStep = {
      step: (sheet.steps?.length || 0) + 1,
      description: 'New inspection action',
      criteria: 'Pass/Fail criteria',
      technique: 'Visual'
    };
    const updatedItem = { ...item, inspectionSheet: { ...sheet, steps: [...(sheet.steps || []), newStep] } };
    setViewSheet({ item: updatedItem });
    updateItemInMainData(updatedItem);
    setEditingStepIdx((sheet.steps?.length || 0));
  };

  const handleUpdateStepField = (idx: number, field: keyof InspectionStep, value: string | number) => {
    if (!viewSheet) return;
    const item = viewSheet.item;
    const sheet = item.inspectionSheet;
    if (!sheet || !sheet.steps) return;
    const newSteps = [...sheet.steps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    const updatedItem = { ...item, inspectionSheet: { ...sheet, steps: newSteps } };
    setViewSheet({ item: updatedItem });
    updateItemInMainData(updatedItem);
  };

  const handleCopy = async () => {
    const headers = [
      "Component", "Function", "Functional Failure", "Failure Mode", "Effect", 
      "Consequence Cat.", "ISO 14224 Code",
      "Criticality", "S", "O", "D", "RPN",
      "Proposed Task", "Interval", "Task Type",
      "Step #", "Action", "Method/Technique", "Acceptance Criteria"
    ];
    const rows: string[] = [];
    processedData.forEach(item => {
      const sheet = item.inspectionSheet;
      const baseRow = [
        item.component, item.function, item.functionalFailure, item.failureMode, item.failureEffect,
        item.consequenceCategory, item.iso14224Code,
        item.criticality, item.severity, item.occurrence, item.detection, item.rpn,
        item.maintenanceTask, item.interval, item.taskType
      ];
      if (sheet && sheet.steps && sheet.steps.length > 0) {
        sheet.steps.forEach(step => {
          const stepRow = [step.step, step.description, step.technique, step.criteria];
          const finalRow = [...baseRow, ...stepRow].map(val => {
            const str = String(val || '');
            if (/[\t\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
            return str;
          }).join("\t");
          rows.push(finalRow);
        });
      } else {
        const legacyInfo = sheet?.checkPointDescription || "";
        const stepRow = ["", legacyInfo, sheet?.type || "", sheet?.criteriaLimits || ""];
        const finalRow = [...baseRow, ...stepRow].map(val => {
          const str = String(val || '');
          if (/[\t\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
          return str;
        }).join("\t");
        rows.push(finalRow);
      }
    });
    const text = [headers.join("\t"), ...rows].join("\n");
    try { 
      await navigator.clipboard.writeText(text); 
      setCopied(true); 
      setTimeout(() => setCopied(false), 2000); 
    } catch (err) { console.error(err); }
  };

  const handleClassicalCopy = async () => {
    const headers = [
      "Component", "Failure mode", "Proposed Task", "Frequency", "Type of task", "Step number", "Actions"
    ];
    const rows: string[] = [];
    
    let lastComponent = "";
    
    processedData.forEach(item => {
      const sheet = item.inspectionSheet;
      const componentToShow = item.component === lastComponent ? "" : item.component;
      lastComponent = item.component;

      const baseInfo = [
        componentToShow,
        item.failureMode,
        item.maintenanceTask,
        item.interval,
        item.taskType
      ];

      if (sheet && sheet.steps && sheet.steps.length > 0) {
        sheet.steps.forEach((step, idx) => {
          // Only show failure mode info on the first step row of this item
          const rowData = idx === 0 
            ? [...baseInfo, step.step, step.description]
            : ["", "", "", "", "", step.step, step.description];
          
          const finalRow = rowData.map(val => {
            const str = String(val || '');
            if (/[\t\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
            return str;
          }).join("\t");
          rows.push(finalRow);
        });
      } else {
        const finalRow = [...baseInfo, "", ""].map(val => {
          const str = String(val || '');
          if (/[\t\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
          return str;
        }).join("\t");
        rows.push(finalRow);
      }
    });

    const text = [headers.join("\t"), ...rows].join("\n");
    try { 
      await navigator.clipboard.writeText(text); 
      setClassicalCopied(true); 
      setTimeout(() => setClassicalCopied(false), 2000); 
    } catch (err) { console.error(err); }
  };

  const handleMatrixClick = (s: number, o: number) => {
    if (matrixFilter?.s === s && matrixFilter?.o === o) {
      setMatrixFilter(null);
    } else {
      setMatrixFilter({ s, o });
    }
  };

  const handleBarClick = (id: string) => {
    if (barFilter === id) {
      setBarFilter(null);
    } else {
      setBarFilter(id);
    }
  };

  const clearAllFilters = () => {
    setMatrixFilter(null);
    setBarFilter(null);
    setSearchFilters({ component: '', function: '', failureMode: '', consequenceCategory: '', iso14224Code: '' });
    setSortConfig({ key: 'rpn', direction: 'desc' });
  };

  const topRisks = data
    .sort((a, b) => (b.rpn || 0) - (a.rpn || 0))
    .slice(0, 5)
    .map(item => ({
      id: item.id,
      name: (item.failureMode || '').length > 20 ? (item.failureMode || '').substring(0, 20) + '...' : (item.failureMode || ''),
      rpn: item.rpn || 0
    }));

  const renderSortIcon = (key: keyof RCMItem | 'rpn') => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />;
  };

  const renderComponentIntelModal = () => {
    if (!selectedIntel) return null;
    const intel = selectedIntel.componentIntel;
    
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
          <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                <Info size={24} className="text-indigo-200" />
              </div>
              <div>
                <h3 className="font-black text-xl leading-none uppercase tracking-tight">{selectedIntel.component}</h3>
                <p className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-widest font-bold">Physical Component Intel</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInternalUndo}
                disabled={!canUndo}
                className={`p-2 rounded-full transition-all ${
                  canUndo ? 'hover:bg-white/10 text-white' : 'text-slate-600 opacity-20'
                }`}
                title="Undo last action"
              >
                <Undo2 size={24} />
              </button>
              <button onClick={() => setSelectedIntel(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-8 space-y-8 bg-slate-50/30">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileText size={18} />
                <h4 className="text-xs font-black uppercase tracking-widest">Description</h4>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium bg-white p-4 rounded-2xl border border-slate-100 shadow-sm italic">
                {intel?.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <MapPin size={18} />
                  <h4 className="text-xs font-black uppercase tracking-widest">Location</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-[80px]">
                  {intel?.location || "Location context unavailable."}
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Eye size={18} />
                  <h4 className="text-xs font-black uppercase tracking-widest">Visual Cues</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-[80px]">
                  {intel?.visualCues || "Identification cues not defined."}
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 bg-white border-t border-slate-50 flex justify-end">
             <button 
               onClick={() => setSelectedIntel(null)}
               className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
             >
               Understood
             </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInspectionSheet = () => {
    if (!viewSheet || !viewSheet.item.inspectionSheet) return null;
    const { item } = viewSheet;
    const sheet = item.inspectionSheet;
    const taskImage = getTaskImage(item.maintenanceTask);
    const steps = sheet.steps || [];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0 rounded-t-xl">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                 <ClipboardList size={24} className="text-indigo-200" />
              </div>
              <div>
                <h3 className="font-bold text-xl leading-tight">Maintenance Inspection Procedure</h3>
                <p className="text-sm text-slate-400 font-mono mt-0.5">{item.component} • {item.id.split('-').pop()?.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleInternalUndo}
                disabled={!canUndo}
                className={`p-2.5 rounded-xl transition-all ${
                  canUndo ? 'bg-white/10 text-white hover:bg-white/20' : 'text-slate-600 opacity-20'
                }`}
                title="Undo last action"
              >
                <Undo2 size={24} />
              </button>
              <button onClick={() => setViewSheet(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2 flex flex-col sm:flex-row overflow-hidden group">
                 <div className="w-full sm:w-1/3 relative h-48 sm:h-auto overflow-hidden bg-slate-200">
                    <img src={taskImage} alt={item.maintenanceTask} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent sm:bg-indigo-900/10 sm:group-hover:bg-transparent transition-colors"></div>
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-800 shadow-sm border border-slate-100">{item.taskType}</div>
                 </div>
                 <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-start justify-between mb-2">
                           <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Failure Mode</span>
                                <h4 className="text-lg font-bold text-slate-800 leading-snug mt-1">{item.failureMode}</h4>
                                <div className="flex gap-2 mt-2">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1"><ShieldCheck size={10} /> {item.consequenceCategory}</span>
                                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1"><Tag size={10} /> {item.iso14224Code}</span>
                                </div>
                           </div>
                        </div>
                        <div className="mt-4">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Maintenance Task</span>
                           <p className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">{item.maintenanceTask}</p>
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-6 border-t border-slate-100 pt-4">
                        <div>
                           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Frequency</span>
                           <span className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded"><Clock size={12} /> {item.interval}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-100"></div>
                        <div>
                           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Risk Level (RPN)</span>
                           <span className={`text-sm font-bold flex items-center gap-1.5 ${getScoreColor(item.severity || 0)}`}><AlertOctagon size={14} /> {item.rpn}</span>
                        </div>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-center">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0"><ShieldAlert size={20} /></div>
                    <div>
                       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Safety & PPE</span>
                       <p className="text-xs text-slate-700 leading-relaxed font-medium">{sheet.safetyPrecautions || "Standard PPE required."}</p>
                    </div>
                 </div>
                 <div className="w-full h-px bg-slate-100"></div>
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0"><Wrench size={20} /></div>
                    <div>
                       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tools Required</span>
                       <p className="text-xs text-slate-700 leading-relaxed font-medium">{sheet.toolsRequired || "Standard hand tools."}</p>
                    </div>
                 </div>
                 <div className="w-full h-px bg-slate-100"></div>
                 <div className="flex justify-between items-center text-xs pt-1">
                    <div className="flex items-center gap-2 text-slate-500"><User size={14} /> <span>Resp: <strong className="text-slate-700">{sheet.responsibility}</strong></span></div>
                    <div className="flex items-center gap-2 text-slate-500"><Clock size={14} /> <span>Est: <strong className="text-slate-700">{sheet.estimatedTime}</strong></span></div>
                 </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Search size={18} className="text-slate-400" />
                    Inspection Procedure Steps
                 </h4>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={handleAddStep}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-md border border-indigo-100 transition-colors"
                    >
                      <Plus size={14} /> Add Step
                    </button>
                    <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{steps.length} Steps</span>
                 </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 w-16 text-center">#</th>
                    <th className="px-6 py-4 w-[40%]">Action / Description</th>
                    <th className="px-6 py-4 w-[15%]">Method</th>
                    <th className="px-6 py-4 w-[25%]">Acceptance Criteria</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {steps.map((step, idx) => {
                    const isStepEditing = editingStepIdx === idx;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-5 text-center align-top">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">{step.step}</span>
                        </td>
                        <td className="px-6 py-5 align-top">
                          {isStepEditing ? (
                            <textarea 
                              value={step.description} 
                              onChange={(e) => handleUpdateStepField(idx, 'description', e.target.value)}
                              className="w-full p-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                            />
                          ) : (
                            <p className="text-slate-800 font-medium text-base leading-relaxed">{step.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-5 align-top">
                          {isStepEditing ? (
                            <input 
                              type="text" 
                              value={step.technique} 
                              onChange={(e) => handleUpdateStepField(idx, 'technique', e.target.value)}
                              className="w-full p-1.5 text-xs border border-indigo-300 rounded outline-none"
                            />
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-sm">
                              <Activity size={12} className="text-indigo-400" />
                              {step.technique}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 align-top">
                          {isStepEditing ? (
                            <textarea 
                              value={step.criteria} 
                              onChange={(e) => handleUpdateStepField(idx, 'criteria', e.target.value)}
                              className="w-full p-2 text-xs border border-indigo-300 rounded outline-none min-h-[60px]"
                            />
                          ) : (
                            <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                               <CheckCircle size={14} className="mt-0.5 shrink-0" />
                               <span className="text-sm font-medium">{step.criteria}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 align-middle text-center">
                           <div className="flex items-center justify-center gap-2">
                              {isStepEditing ? (
                                <button onClick={() => setEditingStepIdx(null)} className="p-2 bg-emerald-500 text-white rounded-md shadow hover:bg-emerald-600 transition-colors" title="Save Step"><CheckCircle size={16} /></button>
                              ) : (
                                <>
                                  <button onClick={() => setEditingStepIdx(idx)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Edit Step"><Pencil size={14} /></button>
                                  <button onClick={() => handleDeleteStep(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete Step"><Trash2 size={14} /></button>
                                  <div className="w-6 h-6 border-2 border-slate-300 rounded bg-white cursor-pointer hover:border-indigo-500 transition-colors ml-1"></div>
                                </>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white px-8 py-5 flex justify-between shrink-0 border-t border-slate-200 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
             <button onClick={() => alert("Print Dialog would open here.")} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"><Printer size={18} /> Print Sheet</button>
             <button onClick={() => setViewSheet(null)} className="px-8 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 hover:-translate-y-0.5">Close Procedure</button>
          </div>
        </div>
      </div>
    );
  };

  const isFiltered = !!matrixFilter || !!barFilter || !!searchFilters.component || !!searchFilters.function || !!searchFilters.failureMode || !!searchFilters.consequenceCategory || !!searchFilters.iso14224Code;

  const stats = [
    { label: 'Total Failure Modes', value: data.length, icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Max RPN Score', value: Math.max(...data.map(i => i.rpn || 0), 0), icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Condition Monitoring', value: data.filter(i => i.taskType === 'Condition Monitoring').length, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Time-Based Tasks', value: data.filter(i => i.taskType === 'Time-Based').length, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Failure Finding', value: data.filter(i => i.taskType === 'Failure Finding').length, icon: Search, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Run-to-Failure', value: data.filter(i => i.taskType === 'Run-to-Failure').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8 animate-fade-in relative w-full">
      {renderInspectionSheet()}
      {renderComponentIntelModal()}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
           <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-none mb-1.5">{stat.label}</p>
                <h3 className="text-xl font-bold text-slate-800 leading-none">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={20} className="text-orange-500" />Risk Criticality Matrix</h3><p className="text-sm text-slate-500 mt-1">Click any cell to filter the items below.</p></div>
            <div className="flex gap-2 text-xs font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-sm"></div> Low</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm"></div> Med</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm"></div> High</div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] flex items-center justify-center p-4 relative">
             <div className="relative w-full max-w-lg aspect-square">
                <div className="absolute -left-12 top-0 bottom-0 flex items-center justify-center"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest -rotate-90">Occurrence</span></div>
                <div className="absolute left-0 right-0 -bottom-8 flex items-center justify-center"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Severity</span></div>
                <div className="grid grid-cols-10 grid-rows-10 gap-1 w-full h-full">
                   {Array.from({ length: 100 }).map((_, idx) => {
                      const x = (idx % 10) + 1; const y = 10 - Math.floor(idx / 10); const score = x * y;
                      let bgClass = "bg-emerald-50 border-emerald-100"; if (score >= 50) bgClass = "bg-red-50 border-red-100"; else if (score >= 20) bgClass = "bg-amber-50 border-amber-100";
                      const isSelected = matrixFilter?.s === x && matrixFilter?.o === y;
                      if (isSelected) bgClass = "bg-indigo-600 border-indigo-700 ring-2 ring-indigo-300 z-10"; else if (matrixFilter) bgClass += " opacity-40 grayscale"; 
                      const itemsInCell = data.filter(d => (d.severity || 0) === x && (d.occurrence || 0) === y);
                      const count = itemsInCell.length;
                      return (<button key={idx} onClick={() => handleMatrixClick(x, y)} className={`border rounded-sm relative group transition-all hover:scale-110 hover:z-20 outline-none focus:ring-2 focus:ring-indigo-400 ${bgClass}`}>{count > 0 && (<div className="absolute inset-0 flex items-center justify-center"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-transform ${isSelected ? 'bg-white text-indigo-700 scale-100' : 'text-white scale-90 group-hover:scale-110'} ${!isSelected && (score >= 50 ? 'bg-red-500' : score >= 20 ? 'bg-amber-500' : 'bg-emerald-500')}`}>{count}</div></div>)}</button>);
                   })}
                </div>
             </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Top 5 Critical Risks (RPN)</h3>
            <p className="text-sm text-slate-500 mt-1">Click bars to isolate failure modes.</p>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={topRisks} 
                layout="vertical" 
                margin={{ left: 10, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: '#64748b'}} />
                <RechartsTooltip 
                  cursor={{fill: '#f1f5f9'}} 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Bar 
                  dataKey="rpn" 
                  radius={[0, 4, 4, 0]} 
                  barSize={24}
                  onClick={(data) => handleBarClick(data.id)}
                  className="cursor-pointer"
                >
                  {topRisks.map((entry, index) => {
                    const isSelected = barFilter === entry.id;
                    const baseColor = entry.rpn >= 120 ? '#ef4444' : '#f59e0b';
                    return (
                      <Cell 
                        key={index} 
                        fill={isSelected ? '#4f46e5' : baseColor} 
                        opacity={barFilter && !isSelected ? 0.3 : 1}
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-lg shadow-sm"><FileText size={20} className="text-white" /></div><div><h3 className="text-lg font-bold text-slate-800">FMECA Analysis Details</h3><p className="text-xs text-slate-500">SAE JA1011 & ISO 14224 Compliant Analysis</p></div></div>
          <div className="flex flex-wrap justify-center items-center gap-3">
            <button onClick={handleGenerateAllSheets} disabled={generatingSheets} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all border shadow-sm ${generatingSheets ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-wait' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'}`}>{generatingSheets ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}{generatingSheets ? `Generating ${progress.current}/${progress.total}` : "Generate Sheets"}</button>
            <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm">{copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}{copied ? "Copied!" : "Excel Flat Copy"}</button>
            <button onClick={handleClassicalCopy} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors border border-indigo-200 shadow-sm">{classicalCopied ? <CheckCircle size={16} className="text-indigo-600" /> : <LayoutList size={16} />}{classicalCopied ? "Sheet Copied!" : "Classical Decision Copy"}</button>
          </div>
        </div>

        {isFiltered && (
           <div className="bg-slate-800 text-white px-6 py-3 flex justify-between items-center animate-in slide-in-from-top-2 duration-200">
             <div className="flex items-center gap-3"><span className="text-sm font-medium flex items-center gap-1.5"><Filter size={14} className="text-indigo-400" />Active Filters Applied</span>
               <div className="flex gap-2">
                 {matrixFilter && <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">Matrix: S{matrixFilter.s} O{matrixFilter.o}</span>}
                 {barFilter && <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">Chart Isolation: On</span>}
                 {searchFilters.component && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Comp: {searchFilters.component}</span>}
                 {searchFilters.function && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Func: {searchFilters.function}</span>}
                 {searchFilters.failureMode && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Fail: {searchFilters.failureMode}</span>}
                 {searchFilters.consequenceCategory && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Cons: {searchFilters.consequenceCategory}</span>}
                 {searchFilters.iso14224Code && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">ISO: {searchFilters.iso14224Code}</span>}
               </div>
             </div>
             <button onClick={clearAllFilters} className="text-xs bg-white text-slate-900 px-3 py-1.5 rounded font-bold hover:bg-slate-200">Clear All Filters</button>
           </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                <th className="px-6 py-4 min-w-[150px]"><div className="flex flex-col gap-2"><button onClick={() => requestSort('component')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Component {renderSortIcon('component')}</button><div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.component} onChange={(e) => handleSearchChange('component', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div></div></th>
                <th className="px-6 py-4 min-w-[150px]"><div className="flex flex-col gap-2"><button onClick={() => requestSort('consequenceCategory')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Consequence {renderSortIcon('consequenceCategory')}</button><div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.consequenceCategory} onChange={(e) => handleSearchChange('consequenceCategory', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div></div></th>
                <th className="px-6 py-4 min-w-[120px]"><div className="flex flex-col gap-2"><button onClick={() => requestSort('iso14224Code')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">ISO 14224 {renderSortIcon('iso14224Code')}</button><div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.iso14224Code} onChange={(e) => handleSearchChange('iso14224Code', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div></div></th>
                <th className="px-6 py-4 min-w-[200px]"><div className="flex flex-col gap-2"><button onClick={() => requestSort('failureMode')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Failure Mode {renderSortIcon('failureMode')}</button><div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.failureMode} onChange={(e) => handleSearchChange('failureMode', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" /></div></div></th>
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50 border-l border-slate-200">S</th>
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50">O</th>
                <th className="px-2 py-4 w-12 text-center bg-slate-100/50">D</th>
                <th className="px-4 py-4 min-w-[100px] text-left bg-slate-100/50 border-r border-slate-200"><button onClick={() => requestSort('rpn')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">RPN {renderSortIcon('rpn')}</button></th>
                <th className="px-6 py-4 min-w-[180px]">Proposed Task</th>
                <th className="px-6 py-4 w-16 text-center">Insp.</th>
                <th className="px-6 py-4 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm bg-white">
              {processedData.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-20 bg-slate-50/30"><div className="flex flex-col items-center gap-2 text-slate-400"><FilterX size={48} strokeWidth={1} /><p className="font-medium">No matches found for active filters.</p><button onClick={clearAllFilters} className="text-indigo-600 text-xs hover:underline mt-2">Clear all filters</button></div></td></tr>
              ) : (
                processedData.map((item) => {
                  if (!item) return null;
                  const isEditing = editingId === item.id; const isRegenerating = regeneratingIds.has(item.id);
                  if (isEditing && editForm) {
                    return (
                      <tr key={item.id} className="bg-indigo-50/30 ring-2 ring-indigo-500/20 z-10 relative">
                        <td className="px-6 py-4 align-top"><input type="text" value={editForm.component} onChange={(e) => handleChange('component', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        <td className="px-6 py-4 align-top">
                          <select 
                            value={editForm.consequenceCategory} 
                            onChange={(e) => handleChange('consequenceCategory', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                          >
                            {CONSEQUENCE_LABELS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 align-top"><input type="text" value={editForm.iso14224Code} onChange={(e) => handleChange('iso14224Code', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                        <td className="px-6 py-4 align-top"><div className="space-y-2"><textarea rows={2} value={editForm.failureMode} onChange={(e) => handleChange('failureMode', e.target.value)} className="w-full px-2 py-1 border rounded" /><textarea rows={3} value={editForm.failureEffect} onChange={(e) => handleChange('failureEffect', e.target.value)} className="w-full px-2 py-1 border rounded" /></div></td>
                        <td className="px-2 py-4 align-top bg-white/50 border-l"><input type="number" min="1" max="10" value={editForm.severity} onChange={(e) => handleChange('severity', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                        <td className="px-2 py-4 align-top bg-white/50"><input type="number" min="1" max="10" value={editForm.occurrence} onChange={(e) => handleChange('occurrence', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                        <td className="px-2 py-4 align-top bg-white/50"><input type="number" min="1" max="10" value={editForm.detection} onChange={(e) => handleChange('detection', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                        <td className="px-4 py-4 align-top text-center font-bold bg-white/50 border-r">{(editForm.severity || 1) * (editForm.occurrence || 1) * (editForm.detection || 1)}</td>
                        <td className="px-6 py-4 align-top"><div className="space-y-2"><textarea rows={3} value={editForm.maintenanceTask} onChange={(e) => handleChange('maintenanceTask', e.target.value)} className="w-full border rounded" /><input type="text" value={editForm.interval} onChange={(e) => handleChange('interval', e.target.value)} className="w-full border rounded" /></div></td>
                        <td className="px-6 py-4 align-top text-center text-slate-300"><File size={20} className="mx-auto" /></td>
                        <td className="px-6 py-4 align-top text-right"><div className="flex flex-col gap-2 items-end"><button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded"><Save size={16} /></button><button onClick={handleCancel} className="p-2 bg-slate-200 text-slate-600 rounded"><X size={16} /></button></div></td>
                      </tr>
                    );
                  }
                  const rpn = item.rpn || 0; const rpnStyle = getRPNColorStyle(rpn);
                  const consCat = item.consequenceCategory || '';
                  return (
                    <tr key={item.id} className={`group hover:bg-slate-50 ${isRegenerating ? 'opacity-60 bg-slate-50' : ''} ${barFilter === item.id ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-6 py-4 font-medium align-top leading-tight text-xs">
                        <div className="flex items-center gap-2">
                           <span className="flex-1">{item.component}</span>
                           <button onClick={() => setSelectedIntel(item)} className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all opacity-0 group-hover:opacity-100" title="Physical Component Intel"><Info size={14} /></button>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${consCat.includes('Hidden') ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {consCat}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                          {item.iso14224Code}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top"><div className="space-y-2"><div className="font-semibold text-[11px] border p-1 rounded inline-block bg-white shadow-sm leading-tight">{item.failureMode}</div><div className="text-slate-500 text-[10px] leading-relaxed line-clamp-2">{item.failureEffect}</div></div></td>
                      <td className="px-2 py-4 align-middle text-center border-l"><span className={getScoreColor(item.severity || 0)}>{item.severity || 0}</span></td>
                      <td className="px-2 py-4 align-middle text-center"><span className={getScoreColor(item.occurrence || 0)}>{item.occurrence || 0}</span></td>
                      <td className="px-2 py-4 align-middle text-center"><span className={getScoreColor(item.detection || 0)}>{item.detection || 0}</span></td>
                      <td className="px-4 py-4 align-middle border-r"><div className="flex flex-col gap-1"><span className={`text-xs font-bold ${rpnStyle.text}`}>{rpn}</span><div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${rpnStyle.bar}`} style={{width: `${Math.min((rpn/400)*100, 100)}%`}}></div></div></div></td>
                      <td className="px-6 py-4 align-top"><div className="font-medium text-xs leading-tight">{item.maintenanceTask}</div><div className="text-[10px] text-slate-400 font-mono mt-1">{item.interval}</div></td>
                      <td className="px-6 py-4 align-middle text-center">
                         {isRegenerating ? <RefreshCw size={20} className="animate-spin text-indigo-500 mx-auto" /> : item.inspectionSheet ? <button onClick={() => setViewSheet({ item })} className="text-emerald-500 hover:scale-110 transition-transform"><FileCheck size={22} /></button> : <button onClick={() => handleGenerateSingleSheet(item)} className="text-slate-300 hover:text-indigo-500"><File size={22} /></button>}
                      </td>
                      <td className="px-6 py-4 align-middle text-right opacity-0 group-hover:opacity-100 transition-opacity"><div className="flex justify-end gap-1"><button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={16} /></button><button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button></div></td>
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
