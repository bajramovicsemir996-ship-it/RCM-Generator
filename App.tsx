
import React, { useState, useEffect } from 'react';
import { generateRCMAnalysis } from './services/geminiService';
import { getAllStudies, saveStudyToDB, deleteStudyFromDB } from './services/db';
import { RCMItem, FileData, SavedStudy } from './types';
import { AnalysisResult } from './components/AnalysisResult';
import { Sidebar } from './components/Sidebar';
import { SODReference } from './components/SODReference';
import { 
  Cpu, 
  Upload, 
  Type, 
  Zap, 
  Loader2, 
  FileCheck,
  Trash2,
  Info,
  Menu,
  Save,
  Check,
  AlertTriangle,
  BookOpen
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [contextText, setContextText] = useState('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RCMItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Study Management State
  const [savedStudies, setSavedStudies] = useState<SavedStudy[]>([]);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
  const [studyName, setStudyName] = useState<string>("Untitled Analysis");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  // Reference Modal State
  const [showSODReference, setShowSODReference] = useState(false);

  // Load studies from DB on mount and migrate old data if needed
  useEffect(() => {
    const initData = async () => {
      try {
        // 1. Check for legacy localStorage data
        const legacyData = localStorage.getItem('rcm_studies');
        if (legacyData) {
          try {
            const parsed = JSON.parse(legacyData) as SavedStudy[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("Migrating legacy data to IndexedDB...");
              // Migrate each study to IndexedDB
              await Promise.all(parsed.map(study => saveStudyToDB(study)));
              // Clear legacy storage to avoid confusion
              localStorage.removeItem('rcm_studies');
            }
          } catch (e) {
            console.warn("Failed to parse legacy data", e);
          }
        }

        // 2. Load fresh data from IndexedDB
        const studies = await getAllStudies();
        setSavedStudies(studies);
      } catch (e) {
        console.error("Failed to initialize data", e);
        setError("Could not load saved studies. Please refresh.");
      }
    };

    initData();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Increased limit to 50MB since we now use IndexedDB
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
          mimeType: file.type,
          data: base64String
        });
        setError(null);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError("Failed to read file.");
    }
  };

  const handleGenerate = async () => {
    if (!contextText && !fileData) {
      setError("Please provide operational context text or upload a file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const data = await generateRCMAnalysis(contextText, fileData);
      setResults(data);
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

  // Study Manager Actions
  const handleSaveStudy = async () => {
    if (!results && !contextText && !fileData) return;

    const nameToSave = studyName.trim() || "Untitled Analysis";
    const idToSave = currentStudyId || `study-${Date.now()}`;

    const newStudy: SavedStudy = {
      id: idToSave,
      name: nameToSave,
      timestamp: Date.now(),
      items: results || [],
      contextText: contextText,
      fileName: fileData?.name
    };

    try {
      // Save to IndexedDB
      await saveStudyToDB(newStudy);
      
      // Update local state to reflect changes immediately
      const freshStudies = await getAllStudies();
      setSavedStudies(freshStudies);
      
      if (!currentStudyId) {
        setCurrentStudyId(idToSave);
      }

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      console.error("Save failed", e);
      setError("Failed to save study. Storage might be full.");
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
    setResults(study.items);
    setContextText(study.contextText);
    setCurrentStudyId(study.id);
    setStudyName(study.name);
    setFileData(null); // File data is heavy, usually handled separately or re-uploaded if needed for context
    
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleNewStudy = () => {
    setResults(null);
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
    setResults(newData);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Reference Modal */}
      <SODReference isOpen={showSODReference} onClose={() => setShowSODReference(false)} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out shadow-lg md:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar 
          studies={savedStudies}
          currentStudyId={currentStudyId}
          onSelect={handleLoadStudy}
          onDelete={handleDeleteStudy}
          onNew={handleNewStudy}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm relative">
          <div className="h-16 px-4 flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 min-w-0">
              <button 
                className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
              
              <div className="hidden sm:flex p-1.5 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg text-white shadow-sm">
                <Cpu size={20} />
              </div>
              
              {/* Editable Title */}
              <div className="flex flex-col min-w-0">
                 <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={studyName}
                      onChange={(e) => setStudyName(e.target.value)}
                      placeholder="Untitled Analysis"
                      className="text-lg font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors w-full sm:w-64 truncate"
                    />
                 </div>
                 <p className="hidden sm:block text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                   {currentStudyId ? "Saved Study" : "Unsaved Draft"}
                 </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Status Indicator */}
              <div className="hidden sm:flex items-center text-xs font-medium transition-opacity duration-300">
                {justSaved ? (
                  <span className="text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>
                ) : (
                   <span className="text-slate-400">{results ? 'Unsaved changes' : ''}</span>
                )}
              </div>

              {/* Reference Guide Button (NEW) */}
              <button
                onClick={() => setShowSODReference(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="FMECA Scoring Criteria"
              >
                <BookOpen size={18} />
                <span className="text-xs font-medium">S/O/D Guide</span>
              </button>

              {/* Main Save Action */}
              <button
                onClick={handleSaveStudy}
                disabled={!results && !contextText}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm
                  ${justSaved 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  }
                  ${(!results && !contextText) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                 {justSaved ? <Check size={18} /> : <Save size={18} />}
                 <span className="hidden sm:inline">{justSaved ? "Saved" : "Save"}</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <span>Gemini 2.5</span>
                <Zap size={14} className="text-yellow-500 fill-yellow-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:px-6 bg-slate-50/50">
          <div className="w-full px-2 py-6">
            
            {/* Intro Section - Only show when no results */}
            {!results && (
              <div className="mb-8 text-center sm:text-left animate-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">Generate Maintenance Strategies</h2>
                <p className="text-slate-600 max-w-2xl text-lg leading-relaxed">
                  Start by giving your study a name above, then upload context documents or enter details to generate a comprehensive Reliability Centered Maintenance analysis.
                </p>
              </div>
            )}

            {/* Input Card */}
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-10 transition-all duration-300 ${!results ? 'max-w-7xl mx-auto' : ''}`}>
              <div className="border-b border-slate-200 bg-slate-50/80 px-6 pt-4 flex gap-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'manual' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Type size={16} />
                  Manual Entry
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'upload' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Upload size={16} />
                  Document Upload
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'manual' && (
                  <div className="space-y-4 animate-fade-in">
                    <label className="block text-sm font-medium text-slate-700">
                      Operational Context Description
                    </label>
                    <textarea
                      className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-slate-800 placeholder:text-slate-400"
                      placeholder="e.g., Centrifugal Pump P-101 is critical for cooling water circulation in Unit 2. It operates continuously at 3600 RPM. The fluid is river water containing some sediment..."
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                    />
                  </div>
                )}

                {activeTab === 'upload' && (
                  <div className="space-y-4 animate-fade-in">
                     <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
                        <input 
                          type="file" 
                          id="file-upload"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept=".txt,.pdf,.png,.jpg,.jpeg"
                          onChange={handleFileUpload}
                        />
                        {!fileData ? (
                          <>
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                              <Upload size={24} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                            <p className="text-xs text-slate-500 mt-1">PDF, TXT, or Images (Max 50MB)</p>
                          </>
                        ) : (
                          <div className="flex items-center gap-4 w-full max-w-md p-4 bg-white rounded-lg shadow-sm border border-slate-200 z-10">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                              <FileCheck size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{fileData.name}</p>
                              <p className="text-xs text-slate-500">{fileData.mimeType}</p>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                clearFile();
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                     </div>
                     {fileData && (
                       <div className="text-sm text-slate-500 flex items-center gap-2">
                          <Info size={14} />
                          Additional context can still be added in the manual tab.
                       </div>
                     )}
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-pulse">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className={`
                      flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all
                      ${isLoading 
                        ? 'bg-indigo-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1'
                      }
                    `}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={18} className="fill-indigo-200" />
                        Generate Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {results && (
              <AnalysisResult 
                data={results} 
                onUpdate={handleResultsUpdate}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
