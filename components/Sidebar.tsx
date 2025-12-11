import React, { useState } from 'react';
import { SavedStudy } from '../types';
import { Plus, Trash2, FileText, Calendar, Database, FolderOpen, AlertCircle } from 'lucide-react';

interface SidebarProps {
  studies: SavedStudy[];
  currentStudyId: string | null;
  onSelect: (study: SavedStudy) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  studies, 
  currentStudyId, 
  onSelect, 
  onDelete, 
  onNew,
  className = "" 
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className={`bg-white border-r border-slate-200 flex flex-col h-full ${className}`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Database size={14} />
          Your Studies
        </h2>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 transform active:scale-95"
        >
          <Plus size={18} />
          New Study
        </button>
      </div>

      {/* Studies List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-50/50">
        {studies.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-300 mb-4">
              <FolderOpen size={32} strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-600 font-medium">No saved studies</p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Create a new RCM analysis and click Save to see it here.
            </p>
          </div>
        ) : (
          studies.map((study) => (
            <div
              key={study.id}
              onClick={() => {
                setDeleteConfirm(null);
                onSelect(study);
              }}
              className={`group flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-200 relative select-none
                ${currentStudyId === study.id 
                  ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
                  : 'bg-white border-transparent hover:bg-slate-100/80 hover:border-slate-200'
                }`}
            >
              <div className={`mt-0.5 p-2 rounded-lg shrink-0 transition-colors ${currentStudyId === study.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white'}`}>
                <FileText size={18} />
              </div>
              
              <div className="flex-1 min-w-0 pr-6">
                <h3 className={`text-sm font-semibold truncate transition-colors ${currentStudyId === study.id ? 'text-indigo-900' : 'text-slate-700'}`}>
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
              
              {/* Delete Interaction */}
              {deleteConfirm === study.id ? (
                <div className="absolute inset-0 bg-red-50/95 backdrop-blur-sm rounded-lg flex items-center justify-between px-3 animate-in fade-in duration-200 z-10">
                   <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                     <AlertCircle size={12} /> Confirm?
                   </span>
                   <div className="flex gap-2">
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         onDelete(study.id);
                         setDeleteConfirm(null);
                       }}
                       className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 font-medium"
                     >
                       Yes
                     </button>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setDeleteConfirm(null);
                       }}
                       className="text-xs bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 font-medium"
                     >
                       No
                     </button>
                   </div>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(study.id);
                  }}
                  className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Study"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400 text-center">
        Local Browser Storage
      </div>
    </div>
  );
};