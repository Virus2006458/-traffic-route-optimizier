import React from 'react';
import { ModeComparisonItem, TransportMode } from '../types';
import { Footprints, Car, Truck, ArrowRight, Check } from 'lucide-react';

interface CompareModesViewProps {
  comparisonList: ModeComparisonItem[];
  activeMode: TransportMode;
  onSelectMode: (mode: TransportMode) => void;
  isLoading: boolean;
}

export const CompareModesView: React.FC<CompareModesViewProps> = ({
  comparisonList,
  activeMode,
  onSelectMode,
  isLoading
}) => {
  const getModeIcon = (mode: TransportMode) => {
    switch (mode) {
      case 'walking': return <Footprints className="w-4 h-4 text-emerald-400" />;
      case 'car': return <Car className="w-4 h-4 text-blue-400" />;
      case 'heavy': return <Truck className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-800 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">Transport Mode Comparison</h3>
          <p className="text-xs text-slate-400">Evaluate cost, travel time, and traffic suitability across all 3 transport modes.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
          Evaluating graph algorithms for Walking, Car, and Heavy Vehicles...
        </div>
      ) : comparisonList.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          Click &ldquo;Compare Modes&rdquo; to analyze routes across all transport modes simultaneously.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
                <th className="p-3">Transport Mode</th>
                <th className="p-3">Distance</th>
                <th className="p-3">Travel Time</th>
                <th className="p-3">Traffic Level</th>
                <th className="p-3">Graph Cost</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {comparisonList.map((item, idx) => {
                const isSelected = item.mode === activeMode;
                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectMode(item.mode)}
                    className={`border-b border-slate-800/60 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-l-4 border-l-blue-500 font-semibold text-white'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="p-3 flex items-center gap-2">
                      {getModeIcon(item.mode)}
                      <span>{item.mode_label}</span>
                    </td>
                    <td className="p-3">{item.distance_km ? `${item.distance_km} km` : '-'}</td>
                    <td className="p-3 font-semibold text-slate-100">{item.travel_time_min ? `${item.travel_time_min} min` : '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.traffic_level === 'Severe' ? 'bg-rose-500/20 text-rose-400' :
                        item.traffic_level === 'High' ? 'bg-orange-500/20 text-orange-400' :
                        item.traffic_level === 'Moderate' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.traffic_level || 'Low'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-400">{item.cost ? item.cost.toFixed(2) : '-'}</td>
                    <td className="p-3">
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      ) : (
                        <span className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]">
                          Switch <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
