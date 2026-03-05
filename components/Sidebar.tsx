
import React, { useState, useRef } from 'react';
import { SavedStudy, Folder } from '../types';
import { Plus, Trash2, FileText, Calendar, Database, FolderOpen, AlertCircle, FolderPlus, ChevronRight, ChevronDown, Move, Download, Upload, CheckCircle2, Pencil, Copy, Globe } from 'lucide-react';

interface SidebarProps {
  studies: SavedStudy[];
  folders: Folder[];
  currentStudyId: string | null;
  onSelect: (study: SavedStudy) => void;
  onDelete: (id: string) => void;
  onDuplicate: (study: SavedStudy) => void;
  onNew: () => void;
  onNewFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveStudy: (studyId: string, folderId?: string) => void;
  onExport: (study: SavedStudy) => void;
  onExportFolder: (folder: Folder) => void;
  onImport: (file: File) => void;
  onToggleFinished: (studyId: string) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  languages: { code: string; label: string; flag: string; }[];
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  studies, 
  folders,
  currentStudyId, 
  onSelect, 
  onDelete, 
  onDuplicate,
  onNew,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveStudy,
  onExport,
  onExportFolder,
  onImport,
  onToggleFinished,
  selectedLanguage,
  onLanguageChange,
  languages,
  className = "" 
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'study' | 'folder', id: string } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(folders.map(f => f.id)));
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) onNewFolder(name);
  };

  const handleRenameFolderPrompt = (id: string, currentName: string) => {
    const name = prompt("Enter new folder name:", currentName);
    if (name && name !== currentName) onRenameFolder(id, name);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const renderStudyItem = (study: SavedStudy) => (
    <div
      key={study.id}
      onClick={() => {
        setDeleteConfirm(null);
        onSelect(study);
      }}
      className={`group flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-200 relative select-none mb-2
        ${currentStudyId === study.id 
          ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
          : 'bg-white border-transparent hover:bg-slate-100/80 hover:border-slate-200'
        }`}
    >
      <div className="flex flex-col items-center shrink-0 gap-2">
        <div className={`mt-0.5 p-2 rounded-lg transition-colors ${currentStudyId === study.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white'}`}>
          <FileText size={18} />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFinished(study.id);
          }}
          className={`transition-all duration-300 ${study.isFinished ? 'text-emerald-500 scale-110' : 'text-slate-200 hover:text-slate-400'}`}
          title={study.isFinished ? "Study Finished" : "Mark as Finished"}
        >
          <CheckCircle2 size={16} fill={study.isFinished ? "currentColor" : "none"} strokeWidth={study.isFinished ? 3 : 2} className={study.isFinished ? "fill-emerald-500/20" : ""} />
        </button>
      </div>
      
      <div className="flex-1 min-w-0 pr-10">
        <h3 className={`text-sm font-semibold truncate transition-colors ${currentStudyId === study.id ? 'text-indigo-900' : 'text-slate-700'} ${study.isFinished ? 'opacity-70' : ''}`}>
          {study.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
            <Calendar size={10} />
            {new Date(study.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
            {study.items.length} Items
          </span>
        </div>
      </div>
      
      {/* Interaction Icons */}
      <div className="absolute right-2 top-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-white/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-slate-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(study);
          }}
          className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md"
          title="Duplicate Study"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExport(study);
          }}
          className="p-1 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-md"
          title="Export JSON"
        >
          <Download size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(showMoveMenu === study.id ? null : study.id);
          }}
          className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md"
          title="Move to Folder"
        >
          <Move size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ type: 'study', id: study.id });
          }}
          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md"
          title="Delete Study"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Move Menu Popover */}
      {showMoveMenu === study.id && (
        <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 min-w-[160px] p-2 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Move to Folder</div>
          <button 
            onClick={() => { onMoveStudy(study.id); setShowMoveMenu(null); }}
            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2"
          >
            <FolderOpen size={14} className="text-slate-400" /> Uncategorized
          </button>
          {folders.map(f => (
            <button 
              key={f.id}
              onClick={() => { onMoveStudy(study.id, f.id); setShowMoveMenu(null); }}
              className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2"
            >
              <FolderPlus size={14} className="text-indigo-400" /> {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteConfirm?.type === 'study' && deleteConfirm.id === study.id && (
        <div className="absolute inset-0 bg-red-50/95 backdrop-blur-sm rounded-lg flex items-center justify-between px-3 animate-in fade-in duration-200 z-10">
           <span className="text-xs font-bold text-red-600 flex items-center gap-1">
             <AlertCircle size={12} /> Delete?
           </span>
           <div className="flex gap-2">
             <button onClick={(e) => { e.stopPropagation(); onDelete(study.id); setDeleteConfirm(null); }} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 font-medium">Yes</button>
             <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="text-xs bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 font-medium">No</button>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white border-r border-slate-200 flex flex-col h-full ${className}`}>
      {/* Hidden Import Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />

      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Database size={14} />
          Your Studies
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-md shadow-indigo-100 transform active:scale-95"
          >
            <Plus size={18} />
            New Study
          </button>
          <button
            onClick={handleImportClick}
            className="p-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-xl transition-all active:scale-95"
            title="Import Study JSON"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={handleCreateFolder}
            className="p-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all active:scale-95"
            title="New Folder"
          >
            <FolderPlus size={18} />
          </button>
        </div>
      </div>

      {/* Folders and Studies List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-50/50">
        {folders.length === 0 && studies.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-300 mb-4">
              <FolderOpen size={32} strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-600 font-medium">No saved studies</p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Create a new RCM analysis, import a shared file, or add a folder.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Folder Sections */}
            {folders.map(folder => {
              const folderStudies = studies.filter(s => s.folderId === folder.id);
              const isExpanded = expandedFolders.has(folder.id);
              
              return (
                <div key={folder.id} className="space-y-1">
                  <div className={`group flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-white'}`}>
                    <button onClick={() => toggleFolder(folder.id)} className="p-1 text-slate-400 hover:text-indigo-600">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div onClick={() => toggleFolder(folder.id)} className="flex-1 flex items-center gap-2">
                      <FolderPlus size={16} className={`${isExpanded ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-black uppercase tracking-widest truncate max-w-[120px] ${isExpanded ? 'text-indigo-700' : 'text-slate-500'}`}>{folder.name}</span>
                      <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 font-bold">{folderStudies.length}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRenameFolderPrompt(folder.id, folder.name); }}
                        className="p-1 text-slate-300 hover:text-indigo-600 transition-all"
                        title="Rename Folder"
                      >
                        <Pencil size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onExportFolder(folder); }}
                        className="p-1 text-slate-300 hover:text-indigo-600 transition-all"
                        title="Export Folder Bundle"
                      >
                        <Download size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'folder', id: folder.id }); }}
                        className="p-1 text-slate-300 hover:text-red-500 transition-all"
                        title="Delete Folder"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="pl-4 border-l border-indigo-100/50 ml-4 animate-in slide-in-from-top-1 duration-200">
                      {folderStudies.length === 0 ? (
                        <div className="py-2 px-3 text-[10px] text-slate-300 italic font-medium">Empty Folder</div>
                      ) : (
                        folderStudies.map(renderStudyItem)
                      )}
                    </div>
                  )}

                  {/* Folder Delete Confirmation */}
                  {deleteConfirm?.type === 'folder' && deleteConfirm.id === folder.id && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                      <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full text-center">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle size={24} />
                        </div>
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Delete Folder?</h4>
                        <p className="text-sm text-slate-500 mb-6">All studies inside this folder will be <b>permanently deleted</b>. This action cannot be undone.</p>
                        <div className="flex gap-3">
                          <button onClick={() => { onDeleteFolder(folder.id); setDeleteConfirm(null); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all">Yes, Delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized Section */}
            <div>
              <div className="flex items-center gap-2 p-2 mb-2">
                <FolderOpen size={16} className="text-slate-300" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Uncategorized</span>
              </div>
              {studies.filter(s => !s.folderId).map(renderStudyItem)}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Info & Language Selector */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-4">
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
           <Globe size={14} className="text-indigo-600 shrink-0" />
           <select 
             value={selectedLanguage}
             onChange={(e) => onLanguageChange(e.target.value)}
             className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none cursor-pointer flex-1"
           >
             {languages.map(lang => (
               <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
             ))}
           </select>
        </div>
        <div className="text-[10px] text-slate-400 text-center font-bold tracking-tight uppercase">
          Reliability Intelligence Repository
        </div>
      </div>
    </div>
  );
};
