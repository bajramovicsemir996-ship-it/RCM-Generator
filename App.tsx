
import React, { useState, useEffect, useRef } from 'react';
import { generateRCMAnalysis, extractOperationalContext } from './services/geminiService';
import { getAllStudies, saveStudyToDB, deleteStudyFromDB } from './services/db';
import { RCMItem, FileData, SavedStudy } from './types';
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
  FileSearch
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [contextText, setContextText] = useState('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<RCMItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // Undo System State
  const [history, setHistory] = useState<RCMItem[][]>([]);

  // Study Management State
  const [savedStudies, setSavedStudies] = useState<SavedStudy[]>([]);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
  const [studyName, setStudyName] = useState<string>("Untitled Analysis");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  // Reference, Builder & Logic Modal State
  const [showSODReference, setShowSODReference] = useState(false);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [showDecisionLogic, setShowDecisionLogic] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Auto-save refs to avoid stale closures in interval
  const resultsRef = useRef(results);
  const contextTextRef = useRef(contextText);
  const fileDataRef = useRef(fileData);
  const studyNameRef = useRef(studyName);
  const currentStudyIdRef = useRef(currentStudyId);
  const savedStudiesRef = useRef(savedStudies);

  useEffect(() => {
    resultsRef.current = results;
    contextTextRef.current = contextText;
    fileDataRef.current = fileData;
    studyNameRef.current = studyName;
    currentStudyIdRef.current = currentStudyId;
    savedStudiesRef.current = savedStudies;
  }, [results, contextText, fileData, studyName, currentStudyId, savedStudies]);

  // Load studies and handle welcome modal visibility
  useEffect(() => {
    const initData = async () => {
      const welcomeShown = localStorage.getItem('rcm_welcome_shown');
      if (!welcomeShown) {
        setShowWelcome(true);
      }

      try {
        const studies = await getAllStudies();
        setSavedStudies(studies);
      } catch (e) {
        console.error("Failed to initialize data", e);
        setError("Could not load saved studies. Please refresh.");
      }
    };
    initData();
  }, []);

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
    localStorage.setItem('rcm_welcome_shown', 'true');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("File size exceeds 50MB limit.");
      return;
    }
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setFileData({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64String
        });
        setError(null);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError("Failed to read file.");
    }
  };

  const handleExtractContext = async () => {
    if (!fileData) return;
    setIsExtracting(true);
    setError(null);
    try {
      const extractedText = await extractOperationalContext(fileData);
      setContextText(extractedText);
      setActiveTab('manual');
      // Scroll to top of manual tab area
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError("Document analysis failed. Please ensure the file is not corrupted.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!contextText && !fileData) {
      setError("Please provide operational context text or upload a file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    if (!isMerging) {
      setResults(null);
      setHistory([]);
    }
    
    try {
      const data = await generateRCMAnalysis(contextText, fileData, isMerging ? (results || []) : []);
      
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

  const clearFile = () => {
    setFileData(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Global Save Function
  const handleSaveStudy = async (isAutoSave: boolean = false) => {
    const currentResults = resultsRef.current;
    const currentContext = contextTextRef.current;
    const currentFile = fileDataRef.current;
    const currentName = studyNameRef.current;
    const currentId = currentStudyIdRef.current;
    const studies = savedStudiesRef.current;

    if (!currentResults && !currentContext && !currentFile) return;

    const nameToSave = currentName.trim() || "Untitled Analysis";
    const idToSave = currentId || `study-${Date.now()}`;

    // Find the existing study to preserve timestamp during auto-saves so it stays in its list position
    const existingStudy = studies.find(s => s.id === idToSave);
    const timestampToUse = (isAutoSave && existingStudy) ? existingStudy.timestamp : Date.now();

    const newStudy: SavedStudy = {
      id: idToSave,
      name: nameToSave,
      timestamp: timestampToUse,
      items: (currentResults || []).map(item => ({ ...item, isNew: false })),
      contextText: currentContext,
      fileName: currentFile?.name
    };

    try {
      await saveStudyToDB(newStudy);
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      if (!currentId) {
        setCurrentStudyId(idToSave);
      }
      
      // Feedback mechanism: turn button green
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

  const handleLoadStudy = (study: SavedStudy) => {
    setResults(study.items.map(item => ({ ...item, isNew: false })));
    setHistory([]);
    setContextText(study.contextText);
    setCurrentStudyId(study.id);
    setStudyName(study.name);
    setFileData(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleNewStudy = () => {
    setResults(null);
    setHistory([]);
    setContextText('');
    setFileData(null);
    setCurrentStudyId(null);
    setStudyName("Untitled Analysis");
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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <WelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
      <SODReference isOpen={showSODReference} onClose={() => setShowSODReference(false)} onUndo={handleUndo} canUndo={history.length > 0} />
      <OperationalContextBuilder isOpen={showContextBuilder} onClose={() => setShowContextBuilder(false)} onComplete={(builtContext) => setContextText(builtContext)} onUndo={handleUndo} canUndo={history.length > 0} />
      <DecisionLogicModal isOpen={showDecisionLogic} onClose={() => setShowDecisionLogic(false)} onUndo={handleUndo} canUndo={history.length > 0} />
      <AICopilot data={results} onUpdate={handleResultsUpdate} />

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed md:static inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out shadow-lg md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar studies={savedStudies} currentStudyId={currentStudyId} onSelect={handleLoadStudy} onDelete={handleDeleteStudy} onNew={handleNewStudy} />
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
                 <div className="flex items-center gap-2"><input type="text" value={studyName} onChange={(e) => setStudyName(e.target.value)} placeholder="Untitled Analysis" className="text-lg font-black text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none transition-all w-full sm:w-80 truncate" /></div>
                 <p className="hidden sm:block text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mt-1">{currentStudyId ? "System Repository" : "Temporary Workspace"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 pr-3 mr-1">
                <button onClick={() => setShowSODReference(true)} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-bold text-xs uppercase tracking-tight"><BookOpen size={16} />S/O/D Guide</button>
                <button onClick={() => setShowDecisionLogic(true)} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all font-bold text-xs uppercase tracking-tight"><GitBranch size={16} />Logic Tree</button>
              </div>
              <div className="hidden sm:flex items-center text-[10px] font-black uppercase tracking-widest transition-opacity duration-300 mr-2">{justSaved ? (<span className="text-emerald-600 flex items-center gap-1.5 font-bold animate-pulse"><Check size={14} strokeWidth={3} /> Synced</span>) : (<span className="text-slate-300">{results ? 'Local draft' : ''}</span>)}</div>
              <div className="flex items-center gap-2">
                <button onClick={handleUndo} disabled={history.length === 0} className={`p-2.5 rounded-xl transition-all ${history.length > 0 ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm' : 'text-slate-200 cursor-not-allowed'}`} title="Undo last action"><Undo2 size={20} /></button>
                <button onClick={() => handleSaveStudy(false)} disabled={!results && !contextText} className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${justSaved ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200 scale-[1.02]' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100 hover:shadow-indigo-200'} ${(!results && !contextText) ? 'opacity-30 cursor-not-allowed' : ''}`}>
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
                    <div className="flex justify-between items-center"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Context Description</label><button onClick={() => setShowContextBuilder(true)} className="group relative flex items-center gap-2.5 px-6 py-2.5 overflow-hidden rounded-[1.2rem] transition-all duration-300 active:scale-95 shadow-lg hover:shadow-indigo-500/20"><div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] group-hover:scale-105 transition-transform duration-500"></div><div className="relative flex items-center gap-2"><div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md"><Sparkles size={16} className="text-white fill-white animate-pulse" /></div><span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">Open Context Wizard</span></div></button></div>
                    <textarea className="w-full h-56 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none text-slate-800 placeholder:text-slate-300 font-medium shadow-inner" placeholder="e.g., Centrifugal Pump P-101 is critical for line availability. It operates in a high-temperature environment..." value={contextText} onChange={(e) => setContextText(e.target.value)} />
                  </div>
                )}
                {activeTab === 'upload' && (
                  <div className="space-y-4 animate-fade-in">
                     <div className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/30 transition-all cursor-pointer relative group"><input type="file" id="file-upload" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".txt,.pdf,.png,.jpg,.jpeg,.docx" onChange={handleFileUpload} />{!fileData ? (<><div className="w-16 h-16 bg-white shadow-xl text-indigo-600 rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500"><Upload size={28} /></div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Click to upload technical documentation</p><p className="text-[10px] text-slate-300 mt-2 font-bold italic">Supports PDF, DOCX, TXT and Images</p></>) : (<div className="flex items-center gap-5 w-full max-w-md p-6 bg-white rounded-[2rem] shadow-2xl border border-indigo-100 z-10 animate-in zoom-in-95"><div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl shadow-inner"><FileCheck size={28} /></div><div className="flex-1 min-w-0"><p className="text-sm font-black text-slate-900 truncate tracking-tight">{fileData.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Ready for Analysis</p></div><button onClick={(e) => { e.preventDefault(); clearFile(); }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20} /></button></div>)}</div>
                     {fileData && (
                       <div className="flex justify-center mt-6">
                         <button 
                           onClick={handleExtractContext} 
                           disabled={isExtracting}
                           className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isExtracting ? 'bg-indigo-400 text-white cursor-wait' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-indigo-100/50'}`}
                         >
                           {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
                           {isExtracting ? "Synthesizing Document..." : "Extract & Structure Context"}
                         </button>
                       </div>
                     )}
                  </div>
                )}
                {error && (<div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3 animate-in shake-in-from-right duration-500"><AlertTriangle size={18} />{error}</div>)}
                <div className="mt-8 flex flex-col sm:flex-row justify-end items-center gap-4">{results && results.length > 0 && (<label className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-white transition-all"><input type="checkbox" checked={isMerging} onChange={(e) => setIsMerging(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-600 uppercase tracking-tight">Merge with existing items</span></label>)}<button onClick={handleGenerate} disabled={isLoading || isExtracting} className={`flex items-center gap-3 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all active:scale-95 ${isLoading ? 'bg-indigo-400 shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1'} ${(isLoading || isExtracting) ? 'opacity-50' : ''}`}>{isLoading ? <Loader2 size={20} className="animate-spin" /> : (isMerging ? <PlusCircle size={20} /> : <Zap size={20} className="fill-white" />)}{isLoading ? "Running Intelligence Engine..." : (isMerging ? "Append New Insights" : "Initiate FMEA Synthesis")}</button></div>
              </div>
            </div>
            {results && <AnalysisResult data={results} onUpdate={handleResultsUpdate} onUndo={handleUndo} canUndo={history.length > 0} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
