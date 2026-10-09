import React from 'react';

export const TrafficLegend: React.FC = () => {
  return (
    <div className="glass-panel rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-200 border border-slate-700/80 shadow-xl flex items-center gap-3">
      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Traffic:</span>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
        <span className="text-slate-300">Low</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
        <span className="text-slate-300">Moderate</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></span>
        <span className="text-slate-300">High</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
        <span className="text-slate-300">Severe</span>
      </div>
    </div>
  );
};
