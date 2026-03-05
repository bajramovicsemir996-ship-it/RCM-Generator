
import React, { useState, useMemo } from 'react';
import { RCMItem, InspectionSheet, InspectionStep, ConsequenceCategory, ComponentIntel } from '../types';
import { generateInspectionSheet, generateComponentIntel, validateRCMAnalysis } from '../services/geminiService';
import { IntervalOptimizerModal } from './IntervalOptimizerModal';
import { CMMSBridgeModal } from './CMMSBridgeModal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, Clock, Activity, FileText, 
  Pencil, Trash2, Save, X, ClipboardList, Loader2,
  FileCheck, File, Printer, AlertOctagon, FilterX, User, ShieldAlert, Wrench, Search, ChevronRight, Sparkles, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Tag, ShieldCheck, Zap, ListChecks, Info, MapPin, Eye, Undo2, Target, Palette, Image as ImageIcon, Box, Layers, UserPlus, Copy, LayoutList, Download, ShieldX, ChevronDown, FileOutput,
  FileSpreadsheet, CheckCircle2, Check, Minus, Maximize2, Minimize2
} from 'lucide-react';

interface AnalysisResultProps {
  data: RCMItem[];
  studyName: string;
  onUpdate: (newData: RCMItem[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  language: string;
}

const CONSEQUENCE_LABELS: ConsequenceCategory[] = [
  'Hidden - Safety/Env', 
  'Hidden - Operational', 
  'Evident - Safety/Env', 
  'Evident - Operational',
  'Evident - Non-Operational'
];

const headerTranslations: Record<string, string[]> = {
  English: ["Function", "Functional failure", "Component", "Type", "Component Description", "Failure mode", "ISO 14224 Code", "Proposed Task", "Frequency", "Step", "Action", "Responsibility", "Duration", "Acceptance Criteria"],
  Spanish: ["Función", "Fallo funcional", "Componente", "Tipo", "Descripción del componente", "Modo de fallo", "Código ISO 14224", "Tarea propuesta", "Frecuencia", "Paso", "Acción", "Responsabilidad", "Duración", "Criterios de aceptación"],
  French: ["Fonction", "Défaillance fonctionnelle", "Composant", "Type", "Description du composant", "Mode de défaillance", "Code ISO 14224", "Tâche proposée", "Fréquence", "Étape", "Action", "Responsabilité", "Durée", "Critères d'acceptation"],
  German: ["Funktion", "Funktionsstörung", "Komponente", "Typ", "Komponentenbeschreibung", "Fehlermodus", "ISO 14224 Code", "Vorgeschlagene Aufgabe", "Intervall", "Schritt", "Action", "Verantwortung", "Dauer", "Abnahmekriterien"],
  Polish: ["Funkcja", "Usterka funkcjonalna", "Komponent", "Typ", "Opis komponentu", "Tryb awarii", "Kod ISO 14224", "Proponowane zadanie", "Częstotliwość", "Krok", "Działanie", "Odpowiedzialność", "Czas trwania", "Kryteria akceptacji"]
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

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, studyName, onUpdate, onUndo, canUndo, language }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RCMItem | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<{s: number, o: number} | null>(null);
  const [barFilter, setBarFilter] = useState<string | null>(null);
  const [selectedIntel, setSelectedIntel] = useState<RCMItem | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['riskGroup']));
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof RCMItem | 'rpn' | 'status_color' | 'inspectionSheet'; direction: 'asc' | 'desc' }>({ key: 'functionType', direction: 'asc' });
  const [searchFilters, setSearchFilters] = useState({
    component: '',
    componentType: '',
    functionType: '',
    function: '',
    failureMode: '',
    consequenceCategory: '',
    iso14224Code: ''
  });
  
  const [generatingSheets, setGeneratingSheets] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [generatingIntelIds, setGeneratingIntelIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewSheet, setViewSheet] = useState<{item: RCMItem} | null>(null);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [optimizingItem, setOptimizingItem] = useState<RCMItem | null>(null);
  const [showCMMSBridge, setShowCMMSBridge] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  const toggleColumn = (key: string) => {
    const next = new Set(collapsedColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsedColumns(next);
  };

  const isCollapsed = (key: string) => collapsedColumns.has(key);

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
    if (searchFilters.componentType) {
      result = result.filter(item => (item.componentType || '').toLowerCase() === searchFilters.componentType.toLowerCase());
    }
    if (searchFilters.functionType) {
      result = result.filter(item => (item.functionType || '').toLowerCase() === searchFilters.functionType.toLowerCase());
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
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

      const secondarySort = (x: RCMItem, y: RCMItem) => {
        const ft = (x.functionType || '').localeCompare(y.functionType || '');
        if (ft !== 0) return ft;
        const f = (x.function || '').localeCompare(y.function || '');
        if (f !== 0) return f;
        const ff = (x.functionalFailure || '').localeCompare(y.functionalFailure || '');
        if (ff !== 0) return ff;
        const comp = (x.component || '').localeCompare(y.component || '');
        if (comp !== 0) return comp;
        return (x.failureMode || '').localeCompare(y.failureMode || '');
      };

      if (sortConfig.key === 'status_color') {
        const aVal = (a.isNew ? 1 : 0) * 1000 + (a.rpn || 0);
        const bVal = (b.isNew ? 1 : 0) * 1000 + (b.rpn || 0);
        if (aVal === bVal) return secondarySort(a, b);
        return (bVal - aVal) * multiplier;
      }

      if (sortConfig.key === 'inspectionSheet') {
        const aHas = a.inspectionSheet ? 1 : 0;
        const bHas = b.inspectionSheet ? 1 : 0;
        if (aHas === bHas) return secondarySort(a, b);
        return (aHas - bHas) * multiplier;
      }

      const aVal = a[sortConfig.key as keyof RCMItem];
      const bVal = b[sortConfig.key as keyof RCMItem];
      
      if (aVal === bVal) return secondarySort(a, b);
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
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

  const requestSort = (key: keyof RCMItem | 'rpn' | 'status_color' | 'inspectionSheet') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (key === 'rpn' || key === 'status_color' || key === 'inspectionSheet') {
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

  const handleToggleApproved = (id: string) => {
    const newData = data.map(item => 
      item.id === id ? { ...item, isApproved: !item.isApproved } : item
    );
    onUpdate(newData);
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
       inspectionSheet: needsRegeneration ? undefined : editForm.inspectionSheet,
       isNew: false
    };
    const newData = data.map(item => item.id === editingId ? updatedForm : item);
    onUpdate(newData);
    setEditingId(null);
    setEditForm(null);
    if (needsRegeneration) {
      setRegeneratingIds(prev => new Set(prev).add(updatedForm.id));
      try {
        const newSheet = await generateInspectionSheet(updatedForm, language);
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
          const sheet = await generateInspectionSheet(item, language);
          const index = currentData.findIndex(d => d.id === item.id);
          if (index !== -1) currentData[index] = { ...currentData[index], inspectionSheet: sheet };
        } catch (e) { console.error(e); }
      }));
      setProgress(prev => ({ ...prev, current: Math.min(prev.total, i + BATCH_SIZE) }));
      onUpdate([...currentData]);
    }
    setGeneratingSheets(false);
  };

  const handleValidateLogic = async () => {
    if (data.length === 0) return;
    setIsValidating(true);
    try {
      const issues = await validateRCMAnalysis(data, language);
      const newData = data.map(item => {
        const match = issues.find(issue => issue.id === item.id);
        return { ...item, validationIssues: match ? match.issues : [] };
      });
      onUpdate(newData);
    } catch (e) {
      console.error(e);
      alert("Logic validation engine failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleIntelClick = async (item: RCMItem) => {
    if (item.componentIntel && item.componentIntel.description) {
      setSelectedIntel(item);
      return;
    }

    setGeneratingIntelIds(prev => new Set(prev).add(item.id));
    try {
      const intel = await generateComponentIntel(item.component, language);
      const newItem = { ...item, componentIntel: intel };
      const newData = data.map(d => d.id === item.id ? newItem : d);
      onUpdate(newData);
      setSelectedIntel(newItem);
    } catch (e) {
      console.error(e);
      alert("Failed to synthesize component metadata.");
    } finally {
      setGeneratingIntelIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleGenerateSingleSheet = async (item: RCMItem) => {
    setRegeneratingIds(prev => new Set(prev).add(item.id));
    try {
      const sheet = await generateInspectionSheet(item, language);
      const newData = data.map(d => d.id === item.id ? { ...d, inspectionSheet: sheet } : d);
      onUpdate(newData);
      const updatedItem = newData.find(d => d.id === item.id);
      if (updatedItem) setViewSheet({ item: updatedItem });
    } catch (e) { 
      alert("Failed to generate."); 
    } finally { 
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleApplyOptimizedInterval = (newInterval: string) => {
    if (!optimizingItem) return;
    const newData = data.map(d => d.id === optimizingItem.id ? { ...d, interval: newInterval } : d);
    onUpdate(newData);
    setOptimizingItem(null);
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

  const handleUpdateSheetHeaderField = (field: keyof InspectionSheet, value: string) => {
    if (!viewSheet) return;
    const item = viewSheet.item;
    const sheet = item.inspectionSheet;
    if (!sheet) return;
    const updatedItem = { ...item, inspectionSheet: { ...sheet, [field]: value } };
    setViewSheet({ item: updatedItem });
    updateItemInMainData(updatedItem);
  };

  const cleanStrForCSV = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    const cleaned = str
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
    return cleaned.replace(/"/g, '""');
  };

  const handleExcelTechnicalExtract = (targetLang: string = 'English') => {
    setIsExtracting(true);
    const headers = headerTranslations[targetLang] || headerTranslations['English'];
    const rows: string[] = [];
    
    let lastFunc = "";
    let lastFF = "";
    let lastComp = "";
    let lastFM = "";

    const sortedForExport = [...processedData].sort((a, b) => {
        const ft = (a.functionType || '').localeCompare(b.functionType || '');
        if (ft !== 0) return ft;
        const f = (a.function || '').localeCompare(b.function || '');
        if (f !== 0) return f;
        const ff = (a.functionalFailure || '').localeCompare(b.functionalFailure || '');
        if (ff !== 0) return ff;
        const comp = (a.component || '').localeCompare(b.component || '');
        if (comp !== 0) return comp;
        return (a.failureMode || '').localeCompare(b.failureMode || '');
    });

    sortedForExport.forEach(item => {
      const steps = item.inspectionSheet?.steps || [];
      const responsibility = item.inspectionSheet?.responsibility || "";
      const duration = item.inspectionSheet?.estimatedTime || "";

      const showFunc = item.function !== lastFunc;
      const showFF = showFunc || item.functionalFailure !== lastFF;
      const showComp = showFF || item.component !== lastComp;
      const showFM = showComp || item.failureMode !== lastFM;

      lastFunc = item.function;
      lastFF = item.functionalFailure;
      lastComp = item.component;
      lastFM = item.failureMode;

      const metadataCols = [
        showFunc ? item.function : "",
        showFF ? item.functionalFailure : "",
        showComp ? item.component : "",
        showComp ? (item.componentType || "") : "",
        showComp ? (item.componentIntel?.description || "") : "",
        showFM ? item.failureMode : "",
        showFM ? item.iso14224Code : ""
      ];

      if (steps.length > 0) {
        steps.forEach((step, idx) => {
          const taskInfo = idx === 0 ? [item.maintenanceTask, item.interval] : ["", ""];
          const headerInfo = (idx === 0 && showFM) ? metadataCols : ["", "", "", "", "", "", ""];
          
          const rowData = [
            ...headerInfo,
            ...taskInfo,
            step.step,
            step.description,
            idx === 0 ? responsibility : "",
            idx === 0 ? duration : "",
            step.criteria
          ];
          
          rows.push(rowData.map(v => `"${cleanStrForCSV(v)}"`).join(","));
        });
      } else {
        const rowData = [
          showFM ? item.function : "",
          showFF ? item.functionalFailure : "",
          showComp ? item.component : "",
          showComp ? (item.componentType || "") : "",
          showComp ? (item.componentIntel?.description || "") : "",
          showFM ? item.failureMode : "",
          showFM ? item.iso14224Code : "",
          item.maintenanceTask,
          item.interval,
          "", "", "", "", ""
        ];
        rows.push(rowData.map(v => `"${cleanStrForCSV(v)}"`).join(","));
      }
    });

    const csvContent = "\uFEFFsep=,\n" + [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const fileNameBase = studyName ? studyName.trim().replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '_') : 'RCM_Decision_Sheet';
    link.setAttribute('download', `${fileNameBase}_${targetLang}_Decision_Sheet.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => setIsExtracting(false), 1500);
  };

  const handleWordTechnicalExtract = (targetLang: string = 'English') => {
    setIsExtracting(true);
    
    const allLabels: Record<string, any> = {
      English: { title: "RCM Strategy Report", func: "Function", ff: "Functional Failure", comp: "Component", strategy: "Maintenance Strategy", insp: "Inspection Protocol" },
      Spanish: { title: "Informe de Estrategia RCM", func: "Función", ff: "Fallo Funcional", comp: "Componente", strategy: "Estrategia de Mantenimiento", insp: "Protocolo de Inspección" },
      French: { title: "Rapport de Stratégie RCM", func: "Fonction", ff: "Défaillance Fonctionnelle", comp: "Composant", strategy: "Stratégie de Maintenance", insp: "Protocole d'Inspection" },
      German: { title: "RCM-Strategiebericht", func: "Funktion", ff: "Funktionsstörung", comp: "Komponente", strategy: "Instandhaltungsstrategie", insp: "Inspektionsprotokoll" },
      Polish: { title: "Raport Strategii RCM", func: "Funkcja", ff: "Usterka Funkcjonalna", comp: "Komponent", strategy: "Strategia Utrzymania", insp: "Protokół Inspekcji" }
    };
    const labels = allLabels[targetLang] || allLabels['English'];

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; }
          h1 { color: #1e293b; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-top: 40px; }
          h2 { color: #334155; margin-top: 30px; background: #f8fafc; padding: 5px; }
          h3 { color: #475569; border-left: 4px solid #6366f1; padding-left: 10px; }
          .meta-box { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 11pt; }
          th { background-color: #1e293b; color: white; text-transform: uppercase; font-size: 9pt; }
          .task-cell { font-weight: bold; color: #4f46e5; }
          .step-num { font-weight: bold; text-align: center; width: 30px; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 50px;">
          <h1 style="font-size: 28pt; border: none;">${studyName || labels.title}</h1>
          <p style="color: #64748b;">${new Date().toLocaleDateString(targetLang)} | SAE JA1011 Reliability Compliance Report</p>
        </div>
    `;

    const grouped: Record<string, Record<string, RCMItem[]>> = {};
    processedData.forEach(item => {
      if (!grouped[item.function]) grouped[item.function] = {};
      if (!grouped[item.function][item.functionalFailure]) grouped[item.function][item.functionalFailure] = [];
      grouped[item.function][item.functionalFailure].push(item);
    });

    Object.entries(grouped).forEach(([funcName, failures]) => {
      htmlContent += `<h1>${labels.func}: ${funcName}</h1>`;
      
      Object.entries(failures).forEach(([ffName, items]) => {
        htmlContent += `<h2>${labels.ff}: ${ffName}</h2>`;
        
        items.forEach(item => {
          htmlContent += `
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <h3>${labels.comp}: ${item.component} (${item.componentType})</h3>
              <div class="meta-box">
                <p><strong>Failure Mode:</strong> ${item.failureMode}</p>
                <p><strong>Effect:</strong> ${item.failureEffect}</p>
                <p><strong>Criticality:</strong> ${item.criticality} (RPN: ${item.rpn}) | <strong>ISO 14224:</strong> ${item.iso14224Code}</p>
              </div>
              
              <h4>${labels.strategy}</h4>
              <table>
                <thead>
                  <tr><th>Task Description</th><th>Interval</th><th>Type</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="task-cell">${item.maintenanceTask}</td>
                    <td>${item.interval}</td>
                    <td>${item.taskType}</td>
                  </tr>
                </tbody>
              </table>
          `;

          if (item.inspectionSheet && item.inspectionSheet.steps && item.inspectionSheet.steps.length > 0) {
            htmlContent += `
              <h4>${labels.insp}</h4>
              <p style="font-size: 9pt; color: #64748b;">Responsibility: ${item.inspectionSheet.responsibility} | Est. Time: ${item.inspectionSheet.estimatedTime}</p>
              <table>
                <thead>
                  <tr><th style="width: 40px;">#</th><th>Action Step</th><th>Acceptance Criteria</th></tr>
                </thead>
                <tbody>
            `;
            item.inspectionSheet.steps.forEach(step => {
              htmlContent += `
                <tr>
                  <td class="step-num">${step.step}</td>
                  <td>${step.description}</td>
                  <td>${step.criteria}</td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }

          htmlContent += `</div><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;">`;
        });
      });
    });

    htmlContent += `</body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileNameBase = studyName ? studyName.trim().replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '_') : 'RCM_Report';
    link.setAttribute('download', `${fileNameBase}_${targetLang}_Report.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => setIsExtracting(false), 1500);
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
    setSearchFilters({ component: '', componentType: '', functionType: '', function: '', failureMode: '', consequenceCategory: '', iso14224Code: '' });
    setSortConfig({ key: 'functionType', direction: 'asc' });
  };

  const topRisks = data
    .sort((a, b) => (b.rpn || 0) - (a.rpn || 0))
    .slice(0, 5)
    .map(item => ({
      id: item.id,
      name: (item.failureMode || '').length > 20 ? (item.failureMode || '').substring(0, 20) + '...' : (item.failureMode || ''),
      rpn: item.rpn || 0
    }));

  const renderSortIcon = (key: keyof RCMItem | 'rpn' | 'status_color' | 'inspectionSheet') => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />;
  };

  const renderColumnToggle = (key: string, label?: string) => {
    const collapsed = isCollapsed(key);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleColumn(key); }}
        className={`group/toggle flex items-center justify-center p-1.5 rounded-full border transition-all shadow-md shrink-0 mb-2
          ${collapsed 
            ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 w-8 h-8' 
            : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 w-8 h-8'
          }`}
        title={collapsed ? "Expand Column" : "Minimize Column"}
      >
        {collapsed ? (
          <Plus size={16} strokeWidth={4} />
        ) : (
          <Minus size={16} strokeWidth={4} />
        )}
      </button>
    );
  };

  const renderInspectionSheet = () => {
    if (!viewSheet) return null;
    const item = viewSheet.item;
    const sheet = item.inspectionSheet;
    if (!sheet) return null;
    const isRegenerating = regeneratingIds.has(item.id);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[95vh]">
          {/* Header */}
          <div className="bg-slate-900 px-10 py-8 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-emerald-500/20 rounded-[1.5rem] border border-emerald-500/30 shadow-inner">
                <FileCheck size={32} className="text-emerald-200" />
              </div>
              <div>
                <h3 className="font-black text-2xl tracking-tighter uppercase leading-none">Maintenance Inspection Protocol</h3>
                <div className="flex items-center gap-3 mt-2.5">
                   <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{item.component}</span>
                   <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                   <span className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em]">Validated Asset Route</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleInternalUndo}
                disabled={!canUndo}
                className={`p-3 rounded-full transition-all ${
                  canUndo ? 'bg-white/10 text-white hover:bg-white/20' : 'text-slate-600 opacity-20'
                }`}
                title="Undo last action"
              >
                <Undo2 size={28} />
              </button>
              <button onClick={() => setViewSheet(null)} className="p-3 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white rounded-full transition-all">
                <X size={28} />
              </button>
            </div>
          </div>

          <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
            <div className="bg-white p-8 rounded-[1.8rem] border border-slate-200 shadow-sm mb-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-2 opacity-60">
                     <Tag size={14} className="text-indigo-600" />
                     <span className="text-[9px] font-black uppercase tracking-widest">Component</span>
                  </div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.component} ({item.componentType})</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 opacity-60">
                     <AlertTriangle size={14} className="text-amber-600" />
                     <span className="text-[9px] font-black uppercase tracking-widest">Failure Mode</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-tight uppercase">{item.failureMode}</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 opacity-60">
                     <Target size={14} className="text-emerald-600" />
                     <span className="text-[9px] font-black uppercase tracking-widest">Proposed Task</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-tight uppercase">{item.maintenanceTask}</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 opacity-60">
                     <RefreshCw size={14} className="text-indigo-600" />
                     <span className="text-[9px] font-black uppercase tracking-widest">Frequency</span>
                  </div>
                  <p className="text-xs font-black text-indigo-700 uppercase tracking-tight">{item.interval}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
              <div className="bg-white p-6 rounded-[1.8rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                   <User size={14} className="text-slate-900" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Responsibility</span>
                </div>
                <input 
                  type="text"
                  value={sheet.responsibility}
                  onChange={(e) => handleUpdateSheetHeaderField('responsibility', e.target.value)}
                  className="w-full text-sm font-black text-slate-900 uppercase tracking-tight bg-transparent border-b border-transparent focus:border-indigo-200 outline-none"
                />
              </div>
              <div className="bg-white p-6 rounded-[1.8rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                   <Clock size={14} className="text-slate-900" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Est. Duration</span>
                </div>
                <input 
                  type="text"
                  value={sheet.estimatedTime}
                  onChange={(e) => handleUpdateSheetHeaderField('estimatedTime', e.target.value)}
                  className="w-full text-sm font-black text-slate-900 uppercase tracking-tight bg-transparent border-b border-transparent focus:border-indigo-200 outline-none"
                />
              </div>
              <div className="bg-white p-6 rounded-[1.8rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                   <ShieldAlert size={14} className="text-red-600" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Safety Req.</span>
                </div>
                <textarea 
                  value={sheet.safetyPrecautions}
                  onChange={(e) => handleUpdateSheetHeaderField('safetyPrecautions', e.target.value)}
                  className="w-full text-[11px] font-bold text-slate-700 leading-tight bg-transparent border-b border-transparent focus:border-indigo-200 outline-none resize-none"
                  rows={2}
                />
              </div>
              <div className="bg-white p-6 rounded-[1.8rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                   <Wrench size={14} className="text-indigo-600" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Tooling</span>
                </div>
                <textarea 
                  value={sheet.toolsRequired}
                  onChange={(e) => handleUpdateSheetHeaderField('toolsRequired', e.target.value)}
                  className="w-full text-[11px] font-bold text-slate-700 leading-tight bg-transparent border-b border-transparent focus:border-indigo-200 outline-none resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="bg-white rounded-[2.2rem] border border-slate-200 overflow-hidden shadow-2xl">
              <table className="w-full text-left table-fixed">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-8 py-5 w-16 text-center">Step</th>
                    <th className="px-8 py-5 flex-1">Technical Action Sequence</th>
                    <th className="px-8 py-5 w-48 text-center">Method</th>
                    <th className="px-8 py-5 w-72">Acceptance Criteria</th>
                    <th className="px-8 py-5 w-24 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sheet.steps?.map((step, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50 transition-all">
                      <td className="px-8 py-6 text-xs font-black text-indigo-600 text-center">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto">
                          {editingStepIdx === idx ? (
                            <input 
                              type="number"
                              value={step.step}
                              onChange={(e) => handleUpdateStepField(idx, 'step', parseInt(e.target.value))}
                              className="w-full bg-transparent text-center font-black text-indigo-600 outline-none"
                            />
                          ) : step.step}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {editingStepIdx === idx ? (
                          <textarea 
                            value={step.description}
                            onChange={(e) => handleUpdateStepField(idx, 'description', e.target.value)}
                            className="w-full p-4 text-sm bg-slate-50 border-2 border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-medium resize-none"
                            rows={3}
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm font-bold text-slate-800 leading-relaxed uppercase tracking-tight">{step.description}</p>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                         <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg w-full">
                            {editingStepIdx === idx ? (
                              <input 
                                type="text"
                                value={step.technique}
                                onChange={(e) => handleUpdateStepField(idx, 'technique', e.target.value)}
                                className="w-full bg-transparent text-[9px] font-black text-indigo-700 uppercase tracking-tighter outline-none"
                              />
                            ) : (
                              <span className="text-[9px] font-black text-indigo-700 uppercase tracking-tighter truncate max-w-[100px]">{step.technique}</span>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-start gap-3 p-3 bg-emerald-50/30 rounded-xl border border-emerald-100/50 h-full">
                            <CheckCircle size={12} className="mt-0.5 text-emerald-600 shrink-0" />
                            {editingStepIdx === idx ? (
                              <textarea 
                                value={step.criteria}
                                onChange={(e) => handleUpdateStepField(idx, 'criteria', e.target.value)}
                                className="w-full bg-transparent text-[11px] font-bold text-emerald-800 leading-tight outline-none resize-none"
                                rows={2}
                              />
                            ) : (
                              <p className="text-[11px] font-bold text-emerald-800 leading-tight">{step.criteria}</p>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingStepIdx === idx ? (
                            <button onClick={() => setEditingStepIdx(null)} className="p-2 bg-emerald-500 text-white rounded-xl transition-all"><CheckCircle size={14} /></button>
                          ) : (
                            <button onClick={() => setEditingStepIdx(idx)} className="p-2 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Pencil size={14} /></button>
                          )}
                          <button onClick={() => handleDeleteStep(idx)} className="p-2 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-center">
                <button 
                  onClick={handleAddStep}
                  className="flex items-center gap-3 px-8 py-3 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md rounded-2xl transition-all active:scale-95"
                >
                  <Plus size={16} /> Insert Operational Checkpoint
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              <div>
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Procedural Release v4.0</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Standards Complaince SAE JA1011</span>
              </div>
            </div>
            <div className="flex gap-6">
               <button 
                 onClick={() => handleGenerateSingleSheet(item)}
                 disabled={isRegenerating}
                 className="flex items-center gap-3 px-8 py-4 bg-indigo-50 text-indigo-600 rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.15em] hover:bg-indigo-100 transition-all active:scale-95 shadow-inner disabled:opacity-50"
               >
                 <RefreshCw size={16} className={isRegenerating ? "animate-spin" : ""} /> {isRegenerating ? "Synthesizing..." : "Regenerate Inspection Protocol"}
               </button>
               <button 
                 onClick={() => setViewSheet(null)}
                 className="px-14 py-4 bg-slate-900 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95"
               >
                 Confirm Protocol
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderComponentIntelModal = () => {
    if (!selectedIntel) return null;
    const intel = selectedIntel.componentIntel;
    
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
          <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <Info size={24} className="text-indigo-200" />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-tighter uppercase leading-none">Asset Architecture</h3>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1">{selectedIntel.component}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInternalUndo}
                disabled={!canUndo}
                className={`p-2 rounded-full transition-all ${
                  canUndo ? 'bg-white/10 text-white hover:bg-white/20' : 'text-slate-600 opacity-20'
                }`}
                title="Undo last action"
              >
                <Undo2 size={20} />
              </button>
              <button onClick={() => setSelectedIntel(null)} className="p-2 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6 bg-slate-50/30 overflow-y-auto custom-scrollbar flex-1 max-h-[75vh]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText size={16} className="text-indigo-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Technical Breakdown</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">Provides a comprehensive engineering overview of the component's internal architecture, material properties, and specific functional role within the system.</p>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600/10 group-hover:bg-indigo-600 transition-colors"></div>
                 <p className="text-sm text-slate-800 leading-relaxed font-bold tracking-tight">
                   {intel?.description || "Engineering specs unavailable."}
                 </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <MapPin size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Location</h4>
                </div>
                <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">Defines the precise spatial coordinates, mounting configuration, and physical surroundings of the component for accurate field identification.</p>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                   <p className="text-xs text-slate-700 font-black uppercase tracking-tight leading-relaxed">{intel?.location || "N/A"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Eye size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Indicators</h4>
                </div>
                <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">Highlights unique visual characteristics, branding, serial number placements, and observable wear markers used to verify component identity.</p>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                   <p className="text-xs text-slate-700 font-black uppercase tracking-tight leading-relaxed">{intel?.visualCues || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end shrink-0">
             <button 
               onClick={() => setSelectedIntel(null)}
               className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
             >
               Exit Spec
             </button>
          </div>
        </div>
      </div>
    );
  };

  const isFiltered = !!matrixFilter || !!barFilter || !!searchFilters.component || !!searchFilters.componentType || !!searchFilters.functionType || !!searchFilters.function || !!searchFilters.failureMode || !!searchFilters.consequenceCategory || !!searchFilters.iso14224Code;

  const stats = [
    { label: 'Total Failure Modes', value: data.length, icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Max RPN Score', value: Math.max(...data.map(i => i.rpn || 0), 0), icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Condition Monitoring', value: data.filter(i => i.taskType === 'Condition Monitoring').length, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Human factor fixes', value: data.filter(i => i.taskType === 'Training' || i.taskType === 'Procedural Change').length, icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Failure Finding', value: data.filter(i => i.taskType === 'Failure Finding').length, icon: Search, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Run-to-Failure', value: data.filter(i => i.taskType === 'Run-to-Failure').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8 animate-fade-in relative w-full">
      {renderInspectionSheet()}
      {renderComponentIntelModal()}
      {optimizingItem && (
        <IntervalOptimizerModal 
          item={optimizingItem} 
          isOpen={!!optimizingItem} 
          onClose={() => setOptimizingItem(null)} 
          onApply={handleApplyOptimizedInterval}
        />
      )}
      <CMMSBridgeModal 
        data={data} 
        isOpen={showCMMSBridge} 
        onClose={() => setShowCMMSBridge(false)} 
      />

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
            <div className="relative group/export">
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                disabled={isExtracting}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-black uppercase tracking-widest rounded-lg transition-all border shadow-sm ${isExtracting ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                {isExtracting ? <Loader2 size={16} className="text-emerald-600 animate-spin" /> : <FileOutput size={16} className="text-indigo-600" />}
                {isExtracting ? "Extracting..." : "Tech Extract"}
                <ChevronDown size={14} className={`ml-1 opacity-50 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isExportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-[22rem] bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 origin-top-right">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Excel Column */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 pb-2 border-b border-slate-100">
                          <FileSpreadsheet size={12} className="text-emerald-600" /> Excel (CSV)
                        </div>
                        {['English', 'Spanish', 'French', 'German', 'Polish'].map((lang) => (
                          <button
                            key={lang}
                            onClick={() => { handleExcelTechnicalExtract(lang); setIsExportMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between"
                          >
                            {lang} <ChevronRight size={10} className="opacity-30" />
                          </button>
                        ))}
                      </div>
                      
                      {/* Word Column */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 pb-2 border-b border-slate-100">
                          <FileText size={12} className="text-indigo-600" /> Word (DOC)
                        </div>
                        {['English', 'Spanish', 'French', 'German', 'Polish'].map((lang) => (
                          <button
                            key={lang}
                            onClick={() => { handleWordTechnicalExtract(lang); setIsExportMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                          >
                            {lang} <ChevronRight size={10} className="opacity-30" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button 
              onClick={handleValidateLogic} 
              disabled={isValidating || data.length === 0}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border shadow-sm ${isValidating ? 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-wait' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              title="Run Automated Engineering Peer Review"
            >
              {isValidating ? <Loader2 size={16} className="text-indigo-600 animate-spin" /> : <ShieldCheck size={16} className="text-indigo-600" />}
              {isValidating ? "Validating..." : "Validate Logic"}
            </button>
            <button 
              onClick={() => setShowCMMSBridge(true)} 
              className="flex items-center gap-2 px-4 py-2 text-sm font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-indigo-600 rounded-lg transition-all border border-slate-900 shadow-xl shadow-slate-200 active:scale-95"
            >
              <Layers size={16} />
              CMMS Implementation
            </button>
            <button 
              onClick={() => requestSort('status_color')} 
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border shadow-sm ${sortConfig.key === 'status_color' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              title="Sort by New Status & Risk Level"
            >
              <Palette size={16} />
              {sortConfig.key === 'status_color' ? "Grouped by Color" : "Sort by Status/Color"}
            </button>
            <button onClick={handleGenerateAllSheets} disabled={generatingSheets} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all border shadow-sm ${generatingSheets ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-wait' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'}`}>{generatingSheets ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}{generatingSheets ? `Generating ${progress.current}/${progress.total}` : "Generate Sheets"}</button>
          </div>
        </div>

        {isFiltered && (
           <div className="bg-slate-800 text-white px-6 py-3 flex justify-between items-center animate-in slide-in-from-top-2 duration-200">
             <div className="flex items-center gap-3"><span className="text-sm font-medium flex items-center gap-1.5"><Filter size={14} className="text-indigo-400" />Active Filters Applied</span>
               <div className="flex gap-2">
                 {matrixFilter && <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">Matrix: S{matrixFilter.s} O{matrixFilter.o}</span>}
                 {barFilter && <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">Chart Isolation: On</span>}
                 {searchFilters.component && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Comp: {searchFilters.component}</span>}
                 {searchFilters.componentType && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Type: {searchFilters.componentType}</span>}
                 {searchFilters.functionType && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded border border-slate-600">Fn: {searchFilters.functionType}</span>}
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
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                <th className={`py-4 transition-all duration-300 text-center ${isCollapsed('approved') ? 'w-10' : 'w-16'}`}>
                  <div className="flex flex-col items-center px-1">
                    {renderColumnToggle('approved')}
                    {!isCollapsed('approved') && <span>Rev.</span>}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('functionType') ? 'w-10' : 'w-[120px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('functionType')}</div>
                    {!isCollapsed('functionType') && (
                      <>
                        <button onClick={() => requestSort('functionType')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Type {renderSortIcon('functionType')}</button>
                        <select value={searchFilters.functionType} onChange={(e) => handleSearchChange('functionType', e.target.value)} className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-indigo-500 outline-none transition-all"><option value="">All Types</option><option value="Primary">Primary</option><option value="Secondary">Secondary</option></select>
                      </>
                    )}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('function') ? 'w-10' : 'w-[180px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('function')}</div>
                    {!isCollapsed('function') && (
                      <>
                        <button onClick={() => requestSort('function')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Function Name {renderSortIcon('function')}</button>
                        <div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.function} onChange={(e) => handleSearchChange('function', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div>
                      </>
                    )}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('functionalFailure') ? 'w-10' : 'w-[180px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('functionalFailure')}</div>
                    {!isCollapsed('functionalFailure') && <span className="text-slate-500">Functional Failure</span>}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('component') ? 'w-10' : 'w-[150px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('component')}</div>
                    {!isCollapsed('component') && (
                      <>
                        <button onClick={() => requestSort('component')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Component {renderSortIcon('component')}</button>
                        <div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.component} onChange={(e) => handleSearchChange('component', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div>
                      </>
                    )}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('componentType') ? 'w-10' : 'w-[120px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('componentType')}</div>
                    {!isCollapsed('componentType') && (
                      <>
                        <button onClick={() => requestSort('componentType')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Asset Type {renderSortIcon('componentType')}</button>
                        <select value={searchFilters.componentType} onChange={(e) => handleSearchChange('componentType', e.target.value)} className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-indigo-500 outline-none transition-all"><option value="">All</option><option value="Electrical">Electrical</option><option value="Mechanical">Mechanical</option></select>
                      </>
                    )}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('consequenceCategory') ? 'w-10' : 'w-[150px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('consequenceCategory')}</div>
                    {!isCollapsed('consequenceCategory') && (
                      <>
                        <button onClick={() => requestSort('consequenceCategory')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Consequence {renderSortIcon('consequenceCategory')}</button>
                        <div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.consequenceCategory} onChange={(e) => handleSearchChange('consequenceCategory', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" /></div>
                      </>
                    )}
                  </div>
                </th>
                <th className={`py-4 transition-all duration-300 ${isCollapsed('failureMode') ? 'w-10' : 'w-[200px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('failureMode')}</div>
                    {!isCollapsed('failureMode') && (
                      <>
                        <button onClick={() => requestSort('failureMode')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">Failure Mode {renderSortIcon('failureMode')}</button>
                        <div className="relative group/search"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchFilters.failureMode} onChange={(e) => handleSearchChange('failureMode', e.target.value)} className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-normal lowercase focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" /></div>
                      </>
                    )}
                  </div>
                </th>

                {/* Risk Factors Group */}
                {!isCollapsed('riskGroup') && (
                  <>
                    <th className="py-4 text-center bg-slate-100/50 border-l border-slate-200 w-12 font-bold uppercase tracking-wider text-slate-500">S</th>
                    <th className="py-4 text-center bg-slate-100/50 w-12 font-bold uppercase tracking-wider text-slate-500">O</th>
                    <th className="py-4 text-center bg-slate-100/50 w-12 font-bold uppercase tracking-wider text-slate-500">D</th>
                  </>
                )}
                <th className={`py-4 bg-slate-100/50 border-r border-slate-200 transition-all duration-300 ${isCollapsed('riskGroup') ? 'w-20 border-l' : 'w-[120px]'}`}>
                  <div className="flex flex-col items-center">
                    {renderColumnToggle('riskGroup')}
                    {!isCollapsed('riskGroup') ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Risk Profile</span>
                        <button onClick={() => requestSort('rpn')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors mx-auto text-[10px] font-bold">RPN {renderSortIcon('rpn')}</button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-slate-400 mt-1">Risk Result</span>
                    )}
                  </div>
                </th>

                <th className={`py-4 transition-all duration-300 ${isCollapsed('maintenanceTask') ? 'w-10' : 'w-[180px]'}`}>
                  <div className="flex flex-col gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('maintenanceTask')}</div>
                    {!isCollapsed('maintenanceTask') && <span>Proposed Task</span>}
                  </div>
                </th>
                <th className={`py-4 text-center transition-all duration-300 ${isCollapsed('inspectionSheet') ? 'w-10' : 'w-16'}`}>
                  <div className="flex flex-col items-center gap-1">
                    {renderColumnToggle('inspectionSheet')}
                    {!isCollapsed('inspectionSheet') && (
                      <button onClick={() => requestSort('inspectionSheet')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors mx-auto">
                        Insp. {renderSortIcon('inspectionSheet')}
                      </button>
                    )}
                  </div>
                </th>
                <th className={`py-4 text-right transition-all duration-300 ${isCollapsed('actions') ? 'w-10' : 'w-20'}`}>
                  <div className="flex flex-col items-end gap-2 px-2">
                    <div className="self-center">{renderColumnToggle('actions')}</div>
                    {!isCollapsed('actions') && <span>Actions</span>}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm bg-white">
              {processedData.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-20 bg-slate-50/30"><div className="flex flex-col items-center gap-2 text-slate-400"><FilterX size={48} strokeWidth={1} /><p className="font-medium">No matches found for active filters.</p><button onClick={clearAllFilters} className="text-indigo-600 text-xs hover:underline mt-2">Clear all filters</button></div></td></tr>
              ) : (
                processedData.map((item, idx) => {
                  if (!item) return null;
                  const isEditing = editingId === item.id; const isRegenerating = regeneratingIds.has(item.id);
                  const isGeneratingIntel = generatingIntelIds.has(item.id);
                  const hasIssues = item.validationIssues && item.validationIssues.length > 0;
                  
                  const prevItem = idx > 0 ? processedData[idx - 1] : null;
                  const showFunctionType = !prevItem || prevItem.functionType !== item.functionType;
                  const showFunction = showFunctionType || prevItem.function !== item.function;
                  const showFunctionalFailure = showFunction || prevItem.functionalFailure !== item.functionalFailure;
                  const showComponent = showFunctionalFailure || prevItem.component !== item.component;

                  if (isEditing && editForm) {
                    const rpnVal = (editForm.severity || 1) * (editForm.occurrence || 1) * (editForm.detection || 1);
                    return (
                      <tr key={item.id} className="bg-indigo-50/30 ring-2 ring-indigo-500/20 z-10 relative">
                        <td className="align-top text-center py-4">{!isCollapsed('approved') && <div className="w-6 h-6 rounded-full bg-slate-100 mx-auto border-2 border-slate-200"></div>}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('functionType') && <select value={editForm.functionType} onChange={(e) => handleChange('functionType', e.target.value)} className="w-full px-2 py-1 border rounded text-[10px] font-black uppercase"><option value="Primary">Primary</option><option value="Secondary">Secondary</option></select>}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('function') && <textarea rows={2} value={editForm.function} onChange={(e) => handleChange('function', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('functionalFailure') && <textarea rows={2} value={editForm.functionalFailure} onChange={(e) => handleChange('functionalFailure', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('component') && <input type="text" value={editForm.component} onChange={(e) => handleChange('component', e.target.value)} className="w-full px-2 py-1 border rounded" />}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('componentType') && <select value={editForm.componentType} onChange={(e) => handleChange('componentType', e.target.value)} className="w-full px-2 py-1 border rounded text-[10px] font-black uppercase"><option value="Electrical">Electrical</option><option value="Mechanical">Mechanical</option></select>}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('consequenceCategory') && <select value={editForm.consequenceCategory} onChange={(e) => handleChange('consequenceCategory', e.target.value)} className="w-full px-2 py-1 border rounded text-xs">{CONSEQUENCE_LABELS.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>}</td>
                        <td className="align-top py-4 px-1">{!isCollapsed('failureMode') && <div className="space-y-2"><textarea rows={2} value={editForm.failureMode} onChange={(e) => handleChange('failureMode', e.target.value)} className="w-full px-2 py-1 border rounded" /><textarea rows={3} value={editForm.failureEffect} onChange={(e) => handleChange('failureEffect', e.target.value)} className="w-full px-2 py-1 border rounded" /></div>}</td>
                        
                        {!isCollapsed('riskGroup') && (
                          <>
                            <td className="align-top py-4 bg-white/50 border-l"><input type="number" min="1" max="10" value={editForm.severity} onChange={(e) => handleChange('severity', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                            <td className="align-top py-4 bg-white/50"><input type="number" min="1" max="10" value={editForm.occurrence} onChange={(e) => handleChange('occurrence', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                            <td className="align-top py-4 bg-white/50"><input type="number" min="1" max="10" value={editForm.detection} onChange={(e) => handleChange('detection', parseInt(e.target.value))} className="w-full text-center border rounded" /></td>
                          </>
                        )}
                        <td className={`align-top py-4 text-center font-bold bg-white/50 border-r ${isCollapsed('riskGroup') ? 'border-l' : ''}`}>
                          {rpnVal}
                        </td>

                        <td className="align-top py-4 px-1">{!isCollapsed('maintenanceTask') && <div className="space-y-2"><textarea rows={3} value={editForm.maintenanceTask} onChange={(e) => handleChange('maintenanceTask', e.target.value)} className="w-full border rounded" /><input type="text" value={editForm.interval} onChange={(e) => handleChange('interval', e.target.value)} className="w-full border rounded" /></div>}</td>
                        <td className="align-top py-4 text-center text-slate-300">{!isCollapsed('inspectionSheet') && <File size={20} className="mx-auto" />}</td>
                        <td className="align-top py-4 text-right px-1">{!isCollapsed('actions') && <div className="flex flex-col gap-2 items-end"><button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded"><Save size={16} /></button><button onClick={handleCancel} className="p-2 bg-slate-200 text-slate-600 rounded"><X size={16} /></button></div>}</td>
                      </tr>
                    );
                  }
                  const rpn = item.rpn || 0; const rpnStyle = getRPNColorStyle(rpn);
                  const consCat = item.consequenceCategory || '';
                  const isNew = item.isNew === true;
                  const isMiraGenerated = item.isMiraGenerated === true;
                  const isPrimary = item.functionType === 'Primary';
                  const isApproved = item.isApproved === true;
                  const isRiskCollapsed = isCollapsed('riskGroup');

                  return (
                    <tr key={item.id} className={`group hover:bg-slate-50 ${isRegenerating || isGeneratingIntel ? 'opacity-60 bg-slate-50' : ''} ${barFilter === item.id ? 'bg-indigo-50/50' : ''} ${isMiraGenerated ? 'bg-blue-50/80 border-l-4 border-l-blue-500' : isNew ? 'bg-emerald-50/60' : ''} transition-all duration-300 ${hasIssues ? 'border-l-4 border-l-red-500 bg-red-50/20' : ''}`}>
                      <td className="align-middle text-center py-4">
                        {!isCollapsed('approved') ? (
                          <button 
                            onClick={() => handleToggleApproved(item.id)}
                            className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${isApproved ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200 scale-110' : 'bg-white border-slate-200 text-transparent hover:border-emerald-300 hover:text-emerald-300'}`}
                            title={isApproved ? "Approved" : "Mark as Approved"}
                          >
                            <Check size={14} strokeWidth={4} />
                          </button>
                        ) : (
                          <div className={`w-2 h-6 mx-auto rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        )}
                      </td>
                      <td className="align-top py-4 px-2 overflow-hidden">
                        {!isCollapsed('functionType') && showFunctionType ? (
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${isPrimary ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>
                            {item.functionType}
                          </span>
                        ) : null}
                      </td>
                      <td className={`align-top py-4 px-2 text-[11px] leading-tight overflow-hidden ${isPrimary ? 'text-slate-900 font-black uppercase' : 'text-slate-600 font-bold'}`}>
                        {!isCollapsed('function') && showFunction ? item.function : null}
                      </td>
                      <td className="align-top py-4 px-2 text-[11px] leading-tight text-slate-600 italic overflow-hidden">
                        {!isCollapsed('functionalFailure') && showFunctionalFailure ? item.functionalFailure : null}
                      </td>
                      <td className="font-medium align-top py-4 px-2 leading-tight text-xs overflow-hidden">
                        {!isCollapsed('component') && showComponent ? (
                          <div className="flex items-center gap-2">
                            <span className="flex-1 text-slate-700">{item.component}</span>
                            <button 
                              onClick={() => handleIntelClick(item)} 
                              disabled={isGeneratingIntel}
                              className={`p-1.5 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                                isGeneratingIntel 
                                  ? 'bg-amber-50 text-amber-500 border-amber-200 cursor-wait' 
                                  : item.componentIntel && item.componentIntel.description
                                    ? 'text-indigo-500 border-indigo-100 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'
                                    : 'bg-amber-100 text-amber-600 border-amber-300 hover:bg-amber-200 hover:scale-110 shadow-sm'
                              }`} 
                              title={item.componentIntel?.description ? "Component Intelligence" : "Synthesize Physical Intel"}
                            >
                              {isGeneratingIntel ? <RefreshCw size={12} className="animate-spin" /> : <Info size={14} />}
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td className="align-top py-4 px-2 overflow-hidden">
                        {!isCollapsed('componentType') && showComponent ? (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${item.componentType === 'Electrical' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {item.componentType}
                          </span>
                        ) : null}
                      </td>
                      <td className="align-top py-4 px-2 overflow-hidden">
                        {!isCollapsed('consequenceCategory') ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${consCat.includes('Hidden') ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {consCat}
                          </span>
                        ) : null}
                      </td>
                      <td className="align-top py-4 px-2 overflow-hidden">
                        {!isCollapsed('failureMode') ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="font-semibold text-[11px] border p-1 rounded inline-block bg-white shadow-sm leading-tight flex-1">
                                {item.failureMode}
                              </div>
                              {hasIssues && (
                                <div className="group/issue relative shrink-0 mt-0.5 cursor-help">
                                  <ShieldX size={18} className="text-red-500 animate-pulse" />
                                  <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white p-3 rounded-xl text-[10px] font-bold shadow-2xl z-50 opacity-0 group-hover/issue:opacity-100 transition-opacity pointer-events-none">
                                    <div className="flex items-center gap-2 mb-2 text-red-400">
                                      <AlertOctagon size={12} />
                                      <span className="uppercase tracking-widest">Logic Violation</span>
                                    </div>
                                    <ul className="space-y-1.5">
                                      {item.validationIssues?.map((issue, i) => (
                                        <li key={i} className="flex gap-2">
                                          <ChevronRight size={10} className="shrink-0 mt-0.5 text-indigo-400" />
                                          <span>{issue}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-slate-500 text-[10px] leading-relaxed line-clamp-2">{item.failureEffect}</div>
                          </div>
                        ) : null}
                      </td>

                      {!isRiskCollapsed && (
                        <>
                          <td className="align-middle text-center border-l py-4 overflow-hidden"><span className={getScoreColor(item.severity || 0)}>{item.severity || 0}</span></td>
                          <td className="align-middle text-center py-4 overflow-hidden"><span className={getScoreColor(item.occurrence || 0)}>{item.occurrence || 0}</span></td>
                          <td className="align-middle text-center py-4 overflow-hidden"><span className={getScoreColor(item.detection || 0)}>{item.detection || 0}</span></td>
                        </>
                      )}
                      <td className={`align-middle border-r py-4 overflow-hidden ${isRiskCollapsed ? 'border-l' : ''}`}>
                        <div className="flex flex-col gap-1 px-2 text-center">
                          <span className={`text-xs font-bold ${rpnStyle.text}`}>{rpn}</span>
                          {!isRiskCollapsed && (
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${rpnStyle.bar}`} style={{width: `${Math.min((rpn/400)*100, 100)}%`}}></div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="align-top group/interval py-4 px-2 overflow-hidden">
                        {!isCollapsed('maintenanceTask') && (
                          <>
                            <div className="font-medium text-xs leading-tight">
                               {item.maintenanceTask}
                               {(item.taskType === 'Training' || item.taskType === 'Procedural Change') && (
                                 <span className="ml-2 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black uppercase rounded border border-purple-100">Human Factor Fix</span>
                               )}
                            </div>
                            <button 
                              onClick={() => setOptimizingItem(item)}
                              className="text-[10px] text-slate-400 font-mono mt-1 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 group-hover/interval:border group-hover/interval:border-indigo-100"
                            >
                              <Target size={10} className="opacity-0 group-hover/interval:opacity-100" />
                              {item.interval}
                            </button>
                          </>
                        )}
                      </td>
                      <td className="align-middle text-center py-4 overflow-hidden">
                        {!isCollapsed('inspectionSheet') && (
                          isRegenerating ? <RefreshCw size={20} className="animate-spin text-indigo-500 mx-auto" /> : item.inspectionSheet ? <button onClick={() => setViewSheet({ item })} className="text-emerald-500 hover:scale-110 transition-transform"><FileCheck size={22} /></button> : <button onClick={() => handleGenerateSingleSheet(item)} className="text-slate-300 hover:text-indigo-500"><File size={22} /></button>
                        )}
                      </td>
                      <td className="align-middle text-right opacity-0 group-hover:opacity-100 transition-opacity py-4 px-2 overflow-hidden">
                        {!isCollapsed('actions') && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={16} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                          </div>
                        )}
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
