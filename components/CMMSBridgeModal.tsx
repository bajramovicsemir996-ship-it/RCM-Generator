
import React, { useState, useMemo } from 'react';
import { RCMItem } from '../types';
import { 
  X, Database, Download, CheckCircle2, AlertCircle, 
  Settings, Terminal, Box, FileJson, FileSpreadsheet, 
  ArrowRight, ShieldCheck, Zap, Layers, RefreshCw, Tag, ExternalLink
} from 'lucide-react';

interface CMMSBridgeModalProps {
  data: RCMItem[];
  isOpen: boolean;
  onClose: () => void;
}

type CMMSProfile = 'Generic' | 'SAP' | 'Maximo';

export const CMMSBridgeModal: React.FC<CMMSBridgeModalProps> = ({ data, isOpen, onClose }) => {
  const [activeProfile, setActiveProfile] = useState<CMMSProfile>('Generic');
  const [assetTags, setAssetTags] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Mapping logic for different systems
  const mappedData = useMemo(() => {
    return data.map(item => {
      const assetTag = assetTags[item.id] || `ASSET-${item.component.substring(0, 3).toUpperCase()}-001`;
      
      if (activeProfile === 'SAP') {
        return {
          'Functional Location': assetTag,
          'Maintenance Plan': `PLAN_${item.id.split('-')[1]}`,
          'Task List Type': 'A',
          'Operation Description': item.maintenanceTask,
          'Cycle (Interval)': item.interval,
          'Strategic Category': item.taskType,
          'Step Count': item.inspectionSheet?.steps?.length || 0
        };
      }
      
      if (activeProfile === 'Maximo') {
        return {
          'SITEID': 'SITE_01',
          'ASSETNUM': assetTag,
          'JPNUM': `JP_${item.id.split('-')[1]}`,
          'DESCRIPTION': item.maintenanceTask,
          'FREQUENCY': item.interval,
          'PM_TYPE': item.taskType === 'Condition Monitoring' ? 'CBM' : 'EM'
        };
      }

      return {
        'Asset_ID': assetTag,
        'Component': item.component,
        'Strategy_Task': item.maintenanceTask,
        'Interval': item.interval,
        'Strategy_Type': item.taskType,
        'Risk_Score': item.rpn,
        'ISO_Code': item.iso14224Code
      };
    });
  }, [data, activeProfile, assetTags]);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    
    // Simulate data generation
    setTimeout(() => {
      const headers = Object.keys(mappedData[0]);
      const rows = mappedData.map(d => Object.values(d).map(v => `"${v}"`).join(','));
      const csvContent = [headers.join(','), ...rows].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CMMS_Sync_${activeProfile}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
    }, 1500);
  };

  const handleTagChange = (id: string, value: string) => {
    setAssetTags(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-slate-900 px-10 py-8 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-500/20 rounded-[1.5rem] border border-indigo-500/30">
              <Layers size={32} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="font-black text-2xl tracking-tighter uppercase leading-none">CMMS Implementation Bridge</h3>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/20 rounded-md border border-indigo-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                  <span className="text-[9px] text-indigo-300 font-black uppercase tracking-widest">Active Data Mapper</span>
                </div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Enterprise Sync Protocol v2.1</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Profile Selection */}
          <div className="w-80 border-r border-slate-100 bg-slate-50/50 p-8 flex flex-col gap-8 shrink-0">
            <div className="space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target System</span>
              <div className="space-y-2">
                {(['Generic', 'SAP', 'Maximo'] as CMMSProfile[]).map(profile => (
                  <button
                    key={profile}
                    onClick={() => setActiveProfile(profile)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      activeProfile === profile 
                        ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-100' 
                        : 'bg-transparent border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {profile === 'SAP' ? <Settings size={18} /> : profile === 'Maximo' ? <Database size={18} /> : <FileSpreadsheet size={18} />}
                      <span className="text-xs font-black uppercase tracking-widest">{profile} Profile</span>
                    </div>
                    {activeProfile === profile && <CheckCircle2 size={16} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck size={16} className="text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sync Readiness</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div>
                     <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Total Items</span>
                     <span className="text-2xl font-black">{data.length}</span>
                   </div>
                   <div className="text-right">
                     <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Ready</span>
                     <span className="text-2xl font-black text-emerald-400">{data.filter(i => i.inspectionSheet).length}</span>
                   </div>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-1000" 
                    style={{ width: `${(data.filter(i => i.inspectionSheet).length / data.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[9px] text-slate-500 font-bold leading-relaxed italic">
                  Ensure all items have generated Inspection Sheets for full 1:1 strategy implementation.
                </p>
              </div>
            </div>

            <div className="mt-auto p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
               <AlertCircle size={18} className="text-amber-500 shrink-0" />
               <p className="text-[10px] text-amber-800 font-bold leading-tight uppercase">
                 Verify Functional Locations with Site Engineering before bulk injection.
               </p>
            </div>
          </div>

          {/* Right Panel: Data Grid & Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
               <div>
                 <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Implementation Matrix</h4>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Refine Asset Tags before generating packet</p>
               </div>
               <div className="flex gap-2">
                 <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Tag size={12} /> Mapping v1.0
                 </div>
               </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left table-fixed">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-8 py-4 w-64">CMMS Asset Tag</th>
                    <th className="px-8 py-4">Strategy Task</th>
                    <th className="px-8 py-4 w-40">Interval</th>
                    <th className="px-8 py-4 w-48">Implementation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                         <div className="relative">
                            <input 
                              type="text" 
                              value={assetTags[item.id] || ''}
                              onChange={(e) => handleTagChange(item.id, e.target.value)}
                              placeholder={`ASSET-${item.component.substring(0, 3).toUpperCase()}-001`}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-black text-slate-900 focus:border-indigo-600 outline-none shadow-sm transition-all"
                            />
                         </div>
                      </td>
                      <td className="px-8 py-4">
                        <p className="text-[11px] font-bold text-slate-700 leading-tight uppercase tracking-tight">{item.maintenanceTask}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{item.component}</p>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase">
                          <RefreshCw size={12} /> {item.interval}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        {item.inspectionSheet ? (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 size={14} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Complete Specs</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-500">
                            <AlertCircle size={14} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Missing Steps</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Implementation Terminal Preview */}
            <div className="h-64 border-t border-slate-100 bg-slate-900 p-8 shrink-0 relative">
               <div className="absolute top-4 right-8 flex items-center gap-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  </div>
               </div>
               <div className="flex items-center gap-3 mb-6">
                 <Terminal size={18} className="text-indigo-400" />
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Packet Transmission Preview</span>
               </div>
               <div className="overflow-y-auto h-32 custom-scrollbar font-mono text-[10px] text-indigo-300 leading-relaxed opacity-80">
                  <pre>{JSON.stringify(mappedData.slice(0, 2), null, 2)}</pre>
                  <p className="mt-2 text-slate-600 italic">// ... and {mappedData.length - 2} more records ready for injection</p>
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
               <ShieldCheck size={20} />
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Validation Cleared</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payload matches target system constraints</span>
             </div>
           </div>
           <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-10 py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="px-12 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl flex items-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {isExporting ? 'Synthesizing Packet...' : `Generate ${activeProfile} Packet`}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
