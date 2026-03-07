import React, { useState, useEffect, useRef } from 'react';
import { generateRCMAnalysis, extractOperationalContext } from './services/geminiService';
import { getAllStudies, saveStudyToDB, deleteStudyFromDB, getAllFolders, saveFolderToDB, deleteFolderFromDB } from './services/db';
import { RCMItem, FileData, SavedStudy, Folder } from './types';
import { AnalysisResult } from './components/AnalysisResult';
import { Sidebar } from './components/Sidebar';
import { SODReference } from './components/SODReference';
import { OperationalContextBuilder } from './components/OperationalContextBuilder';
import { AICopilot } from './components/AICopilot';
import { DecisionLogicModal } from './components/DecisionLogicModal';
import { WelcomeModal } from './components/WelcomeModal';
import { 
  Cpu, 
  Upload, 
  Type, 
  Zap, 
  Loader2, 
  FileCheck,
  Trash2,
  Menu,
  Save,
  Check,
  AlertTriangle,
  BookOpen,
  Sparkles,
  GitBranch,
  Undo2,
  PlusCircle,
  FileSearch,
  CheckCircle2,
  Globe,
  FileText,
  X
} from 'lucide-react';

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇺🇸' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'Polish', label: 'Polski', flag: '🇵🇱' }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [contextText, setContextText] = useState('');
  const [filesData, setFilesData] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsLoadingExtracting] = useState(false);
  const [results, setResults] = useState<RCMItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  // Undo System State
  const [history, setHistory] = useState<RCMItem[][]>([]);

  // Study Management State
  const [savedStudies, setSavedStudies] = useState<SavedStudy[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
  const [studyName, setStudyName] = useState<string>("Untitled Analysis");
  const [isFinished, setIsFinished] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Reference, Builder & Logic Modal State
  const [showSODReference, setShowSODReference] = useState(false);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [showDecisionLogic, setShowDecisionLogic] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Auto-save refs to avoid stale closures in interval
  const resultsRef = useRef(results);
  const contextTextRef = useRef(contextText);
  const filesDataRef = useRef(filesData);
  const studyNameRef = useRef(studyName);
  const currentStudyIdRef = useRef(currentStudyId);
  const savedStudiesRef = useRef(savedStudies);
  const isFinishedRef = useRef(isFinished);
  const selectedLanguageRef = useRef(selectedLanguage);

  useEffect(() => {
    resultsRef.current = results;
    contextTextRef.current = contextText;
    filesDataRef.current = filesData;
    studyNameRef.current = studyName;
    currentStudyIdRef.current = currentStudyId;
    savedStudiesRef.current = savedStudies;
    isFinishedRef.current = isFinished;
    selectedLanguageRef.current = selectedLanguage;
  }, [results, contextText, filesData, studyName, currentStudyId, savedStudies, isFinished, selectedLanguage]);

  // Load studies on initialization
  useEffect(() => {
    const initData = async () => {
      try {
        const [studies, fetchedFolders] = await Promise.all([
          getAllStudies(),
          getAllFolders()
        ]);
        setSavedStudies(studies);
        setFolders(fetchedFolders);
      } catch (e) {
        console.error("Failed to initialize data", e);
        setError("Could not load saved studies. Please refresh.");
      }
    };
    initData();
  }, []);

  // Check for API Key (Paid Tier Support)
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
      // Reload to ensure the new key is picked up by the service
      window.location.reload(); 
    }
  };

  // Automatic Save Timer (Every 30 seconds)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const hasContent = (resultsRef.current && resultsRef.current.length > 0) || contextTextRef.current.trim().length > 0;
      if (hasContent) {
        handleSaveStudy(true);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, []);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (filesData.length + files.length > 10) {
      setError("Maximum 10 technical documents allowed per analysis.");
      return;
    }

    const newFiles: FileData[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newFiles.push({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64
        });
      } catch (e) {
        console.error(`Failed to read file: ${file.name}`);
      }
    }

    setFilesData(prev => [...prev, ...newFiles]);
    setError(null);
    // Reset input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setFilesData(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractContext = async () => {
    if (filesData.length === 0) return;
    setIsLoadingExtracting(true);
    setError(null);
    try {
      const extractedText = await extractOperationalContext(filesData, selectedLanguage);
      setContextText(extractedText);
      setActiveTab('manual');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError("Document analysis failed. Please ensure the files are not corrupted.");
    } finally {
      setIsLoadingExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!contextText && filesData.length === 0) {
      setError("Please provide operational context text or upload at least one technical file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    if (!isMerging) {
      setResults(null);
      setHistory([]);
    }
    
    try {
      const data = await generateRCMAnalysis(contextText, filesData.length > 0 ? filesData : null, selectedLanguage, isMerging ? (results || []) : []);
      
      if (isMerging && results) {
        setResults([...results.map(item => ({ ...item, isNew: false })), ...data]);
      } else {
        setResults(data);
      }
      
    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllFiles = () => {
    setFilesData([]);
  };

  // Global Save Function
  const handleSaveStudy = async (isAutoSave: boolean = false) => {
    const currentResults = resultsRef.current;
    const currentContext = contextTextRef.current;
    const currentFiles = filesDataRef.current;
    const currentName = studyNameRef.current;
    const currentId = currentStudyIdRef.current;
    const currentFinished = isFinishedRef.current;
    const studies = savedStudiesRef.current;
    const currentLang = selectedLanguageRef.current;

    if (!currentResults && !currentContext && currentFiles.length === 0) return;

    const nameToSave = currentName.trim() || "Untitled Analysis";
    const idToSave = currentId || `study-${Date.now()}`;

    const existingStudy = studies.find(s => s.id === idToSave);
    const timestampToUse = (isAutoSave && existingStudy) ? existingStudy.timestamp : Date.now();

    const newStudy: SavedStudy = {
      id: idToSave,
      name: nameToSave,
      timestamp: timestampToUse,
      items: (currentResults || []).map(item => ({ ...item, isNew: false })),
      contextText: currentContext,
      language: currentLang,
      fileName: currentFiles.length > 0 ? `${currentFiles.length} files` : undefined,
      folderId: existingStudy?.folderId,
      isFinished: currentFinished
    };

    try {
      await saveStudyToDB(newStudy);
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      if (!currentId) {
        setCurrentStudyId(idToSave);
      }
      
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      
    } catch (e) {
      console.error("Save failed", e);
      if (!isAutoSave) setError("Failed to save study.");
    }
  };

  const handleDeleteStudy = async (id: string) => {
    try {
      await deleteStudyFromDB(id);
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      if (currentStudyId === id) {
        handleNewStudy();
      }
    } catch (e) {
      console.error("Delete failed", e);
      setError("Failed to delete study.");
    }
  };

  const handleDuplicateStudy = async (study: SavedStudy) => {
    const newId = `study-copy-${Date.now()}`;
    const duplicatedStudy: SavedStudy = {
      ...study,
      id: newId,
      name: `${study.name} (Copy)`,
      timestamp: Date.now(),
      folderId: undefined,
      isFinished: false
    };

    try {
      await saveStudyToDB(duplicatedStudy);
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      handleLoadStudy(duplicatedStudy);
    } catch (e) {
      console.error("Duplicate failed", e);
      setError("Failed to duplicate study.");
    }
  };

  const handleLoadStudy = (study: SavedStudy) => {
    setResults(study.items.map(item => ({ ...item, isNew: false })));
    setHistory([]);
    setContextText(study.contextText);
    setCurrentStudyId(study.id);
    setStudyName(study.name);
    setIsFinished(!!study.isFinished);
    setSelectedLanguage(study.language || 'English');
    setFilesData([]);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleNewStudy = () => {
    setResults(null);
    setHistory([]);
    setContextText('');
    setFilesData([]);
    setCurrentStudyId(null);
    setStudyName("Untitled Analysis");
    setIsFinished(false);
    setSelectedLanguage('English');
    setError(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleResultsUpdate = (newData: RCMItem[]) => {
    if (results) {
      setHistory(prev => [...prev.slice(-29), results]);
    }
    setResults(newData);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setResults(lastState);
  };

  // Folder Actions
  const handleNewFolder = async (name: string) => {
    const folder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      timestamp: Date.now()
    };
    try {
      await saveFolderToDB(folder);
      const freshFolders = await getAllFolders();
      setFolders(freshFolders);
    } catch (e) {
      console.error("New folder failed", e);
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    try {
      await saveFolderToDB({ ...folder, name });
      const freshFolders = await getAllFolders();
      setFolders(freshFolders);
    } catch (e) {
      console.error("Rename folder failed", e);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      const studiesToDelete = savedStudies.filter(s => s.folderId === id);
      for (const study of studiesToDelete) {
        await deleteStudyFromDB(study.id);
      }
      
      await deleteFolderFromDB(id);
      
      const [freshFolders, freshStudies] = await Promise.all([
        getAllFolders(),
        getAllStudies()
      ]);
      setFolders(freshFolders);
      setSavedStudies(freshStudies);

      if (currentStudyId && studiesToDelete.some(s => s.id === currentStudyId)) {
        handleNewStudy();
      }
    } catch (e) {
      console.error("Delete folder failed", e);
    }
  };

  const handleMoveStudyToFolder = async (studyId: string, folderId?: string) => {
    const study = savedStudies.find(s => s.id === studyId);
    if (!study) return;
    
    try {
      await saveStudyToDB({ ...study, folderId });
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
    } catch (e) {
      console.error("Move to folder failed", e);
    }
  };

  const handleToggleStudyFinished = async (studyId: string) => {
    const study = savedStudies.find(s => s.id === studyId);
    if (!study) return;
    
    const nextStatus = !study.isFinished;
    
    try {
      await saveStudyToDB({ ...study, isFinished: nextStatus });
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      
      if (currentStudyId === studyId) {
        setIsFinished(nextStatus);
      }
    } catch (e) {
      console.error("Toggle finished failed", e);
    }
  };

  // Export/Import Logic
  const handleExportStudy = (study: SavedStudy) => {
    const dataStr = JSON.stringify(study, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${study.name.replace(/\s+/g, '_')}_RCM_Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFolder = (folder: Folder) => {
    const folderStudies = savedStudies.filter(s => s.folderId === folder.id);
    const bundle = {
      type: 'folder_bundle',
      folder: folder,
      studies: folderStudies
    };
    const dataStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folder.name.replace(/\s+/g, '_')}_RCM_Bundle.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportStudy = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        
        if (importedData.type === 'folder_bundle') {
          const newFolderId = `folder-imported-${Date.now()}`;
          const newFolder: Folder = {
            ...importedData.folder,
            id: newFolderId,
            timestamp: Date.now()
          };
          
          await saveFolderToDB(newFolder);
          
          for (const study of importedData.studies) {
            const finalStudy: SavedStudy = {
              ...study,
              id: `study-imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              timestamp: Date.now(),
              folderId: newFolderId
            };
            await saveStudyToDB(finalStudy);
          }
          
          const [freshFolders, freshStudies] = await Promise.all([
            getAllFolders(),
            getAllStudies()
          ]);
          setFolders(freshFolders);
          setSavedStudies(freshStudies);
          
        } else {
          const importedStudy = importedData as SavedStudy;
          if (!importedStudy.name || !importedStudy.items) {
            throw new Error("Invalid study format");
          }

          const finalStudy: SavedStudy = {
            ...importedStudy,
            id: `study-imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            folderId: undefined
          };

          await saveStudyToDB(finalStudy);
          const freshStudies = await getAllStudies();
          setSavedStudies(freshStudies);
          handleLoadStudy(finalStudy);
        }
        
      } catch (err) {
        console.error("Import failed", err);
        setError("Failed to import. Ensure the file is a valid RCM Pro JSON or Bundle.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <WelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
      <SODReference isOpen={showSODReference} onClose={() => setShowSODReference(false)} onUndo={handleUndo} canUndo={history.length > 0} />
      <OperationalContextBuilder 
        isOpen={showContextBuilder} 
        onClose={() => setShowContextBuilder(false)} 
        onComplete={(builtContext) => setContextText(builtContext)} 
        onUndo={handleUndo} 
        canUndo={history.length > 0}
        language={selectedLanguage}
      />
      <DecisionLogicModal isOpen={showDecisionLogic} onClose={() => setShowDecisionLogic(false)} onUndo={handleUndo} canUndo={history.length > 0} />
      <AICopilot data={results} onUpdate={handleResultsUpdate} language={selectedLanguage} />

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed md:static inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out shadow-lg md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar 
          studies={savedStudies} 
          folders={folders}
          currentStudyId={currentStudyId} 
          onSelect={handleLoadStudy} 
          onDelete={handleDeleteStudy} 
          onDuplicate={handleDuplicateStudy}
          onNew={handleNewStudy} 
          onNewFolder={handleNewFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveStudy={handleMoveStudyToFolder}
          onExport={handleExportStudy}
          onExportFolder={handleExportFolder}
          onImport={handleImportStudy}
          onToggleFinished={handleToggleStudyFinished}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          languages={LANGUAGES}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm relative">
          <div className="h-20 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <button className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
              <div className="hidden lg:flex items-center gap-4 pr-6 border-r border-slate-100 group text-nowrap">
                <div className="p-2.5 bg-slate-900 rounded-[1.2rem] text-white shadow-2xl shadow-indigo-100 ring-2 ring-indigo-50/50 group-hover:bg-indigo-600 transition-all duration-500 group-hover:-rotate-6"><Cpu size={22} className="text-indigo-400 group-hover:text-white" /></div>
                <div className="flex flex-col"><span className="text-lg font-black tracking-tighter text-slate-900 leading-none">RCM</span><div className="flex items-center gap-1 mt-1"><span className="text-[11px] font-black tracking-[0.25em] text-indigo-600 leading-none">GENERATOR</span><span className="text-[11px] font-black text-slate-400 leading-none">PRO</span></div></div>
              </div>
              <div className="flex flex-col min-w-0">
                 <div className="flex items-center gap-2">
                   <input type="text" value={studyName} onChange={(e) => setStudyName(e.target.value)} placeholder="Untitled Analysis" className="text-lg font-black text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none transition-all w-full sm:w-80 truncate" />
                   {isFinished && (
                     <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md animate-in zoom-in-95">
                        <CheckCircle2 size={12} fill="currentColor" className="fill-emerald-600/20" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Finished</span>
                     </div>
                   )}
                 </div>
                 <p className="hidden sm:block text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mt-1">{currentStudyId ? "System Repository" : "Temporary Workspace"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSelectApiKey}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${!hasApiKey ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Sparkles size={14} /> {!hasApiKey ? "Connect Paid Tier" : "Update API Key"}
              </button>
              <div className="hidden lg:flex items-center gap-2 pr-3 mr-1">
                <button onClick={() => setShowSODReference(true)} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-bold text-xs uppercase tracking-tight"><BookOpen size={16} />S/O/D Guide</button>
                <button onClick={() => setShowDecisionLogic(true)} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all font-bold text-xs uppercase tracking-tight"><GitBranch size={16} />Logic Tree</button>
              </div>
              <div className="hidden sm:flex items-center text-[10px] font-black uppercase tracking-widest transition-opacity duration-300 mr-2">{justSaved ? (<span className="text-emerald-600 flex items-center gap-1.5 font-bold animate-pulse"><Check size={14} strokeWidth={3} /> Synced</span>) : (<span className="text-slate-300">{results ? 'Local draft' : ''}</span>)}</div>
              <div className="flex items-center gap-2">
                <button onClick={handleUndo} disabled={history.length === 0} className={`p-2.5 rounded-xl transition-all ${history.length > 0 ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm' : 'text-slate-200 cursor-not-allowed'}`} title="Undo last action"><Undo2 size={20} /></button>
                <button onClick={() => handleSaveStudy(false)} disabled={!results && !contextText && filesData.length === 0} className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${justSaved ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200 scale-[1.02]' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100 hover:shadow-indigo-200'} ${(!results && !contextText && filesData.length === 0) ? 'opacity-30 cursor-not-allowed' : ''}`}>
                   {justSaved ? <Check size={18} /> : <Save size={18} />}
                   <span className="hidden sm:inline">{justSaved ? "Analysis Saved" : "Save Study"}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:px-6 bg-slate-50/50">
          <div className="w-full px-2 py-6">
            {!results && (
              <div className="mb-8 text-center sm:text-left animate-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Generate Maintenance Strategies</h2>
                <p className="text-slate-500 max-w-2xl text-lg leading-relaxed font-medium italic opacity-70">Provide operational context to generate a comprehensive Reliability Centered Maintenance analysis based on SAE JA1011 standards.</p>
              </div>
            )}
            <div className={`bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden mb-10 transition-all duration-300 ${!results ? 'max-w-7xl mx-auto' : ''}`}>
              <div className="border-b border-slate-100 bg-slate-50/50 px-8 pt-5 flex gap-8 overflow-x-auto">
                <button onClick={() => setActiveTab('manual')} className={`pb-5 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2.5 ${activeTab === 'manual' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Type size={14} />Manual Synthesis</button>
                <button onClick={() => setActiveTab('upload')} className={`pb-5 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2.5 ${activeTab === 'upload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Upload size={14} />Knowledge Upload</button>
              </div>
              <div className="p-8">
                {activeTab === 'manual' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex justify-between items-center"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Context Description ({selectedLanguage})</label><button onClick={() => setShowContextBuilder(true)} className="group relative flex items-center gap-2.5 px-6 py-2.5 overflow-hidden rounded-[1.2rem] transition-all duration-300 active:scale-95 shadow-lg hover:shadow-indigo-500/20"><div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] group-hover:scale-105 transition-transform duration-500"></div><div className="relative flex items-center gap-2"><div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md"><Sparkles size={16} className="text-white fill-white animate-pulse" /></div><span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">Open Context Wizard</span></div></button></div>
                    <textarea className="w-full h-[600px] p-6 bg-slate-50 border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none text-slate-800 placeholder:text-slate-300 font-medium shadow-inner" placeholder={`e.g., Centrifugal Pump P-101 is critical for line availability... (Enter details in ${selectedLanguage})`} value={contextText} onChange={(e) => setContextText(e.target.value)} />
                  </div>
                )}
                {activeTab === 'upload' && (
                  <div className="space-y-6 animate-fade-in">
                     <div className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/30 transition-all cursor-pointer relative group">
                       <input 
                         type="file" 
                         id="file-upload" 
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                         multiple 
                         accept=".txt,.pdf,.png,.jpg,.jpeg,.docx" 
                         onChange={handleFileUpload} 
                       />
                       <div className="w-16 h-16 bg-white shadow-xl text-indigo-600 rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                         <Upload size={28} />
                       </div>
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400 text-center">Click or Drag to Upload Technical Documentation</p>
                       <p className="text-[10px] text-slate-300 mt-2 font-bold italic">Max 10 files • 50MB per file • PDF, DOCX, TXT, Images</p>
                     </div>

                     {filesData.length > 0 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                         {filesData.map((file, idx) => (
                           <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95">
                             <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
                               <FileText size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{file.name}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ready</p>
                             </div>
                             <button 
                               onClick={() => removeFile(idx)} 
                               className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                             >
                               <X size={16} />
                             </button>
                           </div>
                         ))}
                       </div>
                     )}

                     {filesData.length > 0 && (
                       <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                         <button 
                           onClick={handleExtractContext} 
                           disabled={isExtracting}
                           className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isExtracting ? 'bg-indigo-400 text-white cursor-wait' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-indigo-100/50'}`}
                         >
                           {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
                           {isExtracting ? `Synthesizing ${filesData.length} documents...` : `Extract & Merge operational context`}
                         </button>
                         <button 
                           onClick={clearAllFiles} 
                           className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 px-4 py-2 transition-colors"
                         >
                           Clear All Files
                         </button>
                       </div>
                     )}
                  </div>
                )}
                {error && (<div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3 animate-in shake-in-from-right duration-500"><AlertTriangle size={18} />{error}</div>)}
                <div className="mt-8 flex flex-col sm:flex-row justify-end items-center gap-4">{results && results.length > 0 && (<label className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-white transition-all"><input type="checkbox" checked={isMerging} onChange={(e) => setIsMerging(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-600 uppercase tracking-tight">Merge with existing items</span></label>)}<button onClick={handleGenerate} disabled={isLoading || isExtracting} className={`flex items-center gap-3 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all active:scale-95 ${isLoading ? 'bg-indigo-400 shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-indigo-300 hover:shadow-indigo-300 hover:-translate-y-1'} ${(isLoading || isExtracting) ? 'opacity-50' : ''}`}>{isLoading ? <Loader2 size={20} className="animate-spin" /> : (isMerging ? <PlusCircle size={20} /> : <Zap size={20} className="fill-white" />)}{isLoading ? "Running Intelligence Engine..." : (isMerging ? "Append New Insights" : "Initiate RCM Analysis")}</button></div>
              </div>
            </div>
            {results && <AnalysisResult data={results} studyName={studyName} onUpdate={handleResultsUpdate} onUndo={handleUndo} canUndo={history.length > 0} language={selectedLanguage} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
