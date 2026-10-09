import React from 'react';
import { RouteResult } from '../types';
import { Cpu, Sliders, CheckCircle, Zap } from 'lucide-react';

interface AlgorithmViewProps {
  bestRoute?: RouteResult; // computed by A*
  shortestRoute?: RouteResult; // computed by Dijkstra
  weights: { alpha: number; beta: number; gamma: number; delta: number };
  setWeights: React.Dispatch<React.SetStateAction<{ alpha: number; beta: number; gamma: number; delta: number }>>;
  onApplyWeights: () => void;
}

export const AlgorithmView: React.FC<AlgorithmViewProps> = ({
  bestRoute,
  shortestRoute,
  weights,
  setWeights,
  onApplyWeights
}) => {
  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-800 flex flex-col gap-5">
      <div>
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-400" /> Graph Algorithm Comparison (Dijkstra vs A*)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Empirical comparison between uninformed Dijkstra&apos;s algorithm and heuristics-guided A* search on the C++ engine.
        </p>
      </div>

      {/* Algorithm Benchmarks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* A* Search Card */}
        <div className="bg-slate-900/80 border border-blue-500/40 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> A* Search (Best Route)
            </span>
            <span className="bg-blue-600/20 text-blue-300 text-[11px] px-2 py-0.5 rounded font-mono font-bold">
              Traffic-Aware
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-1">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400">Nodes Expanded</div>
              <div className="text-lg font-extrabold text-white">{bestRoute?.nodes_expanded || 0}</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400">Runtime (µs)</div>
              <div className="text-lg font-extrabold text-emerald-400">{bestRoute?.runtime_us || 0} <span className="text-xs font-normal">µs</span></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Uses Haversine lower-bound admissible heuristic $h(n)$ to prune graph exploration.
          </div>
        </div>

        {/* Dijkstra Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-400" /> Dijkstra (Shortest Route)
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded font-mono font-bold">
              Uninformed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-1">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400">Nodes Expanded</div>
              <div className="text-lg font-extrabold text-white">{shortestRoute?.nodes_expanded || 0}</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400">Runtime (µs)</div>
              <div className="text-lg font-extrabold text-emerald-400">{shortestRoute?.runtime_us || 0} <span className="text-xs font-normal">µs</span></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Binary heap priority queue exploring all frontier nodes uniformly by distance.
          </div>
        </div>
      </div>

      {/* Cost Formula & Live Weight Sliders */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" /> Cost Function Weight Calculator
          </div>
          <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Live Recalculation
          </div>
        </div>

        <div className="text-xs font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
          Cost = <span className="text-blue-400 font-bold">α</span>·NormDist + <span className="text-cyan-400 font-bold">β</span>·NormTime + <span className="text-amber-400 font-bold">γ</span>·TrafficPenalty·NormDist + <span className="text-rose-400 font-bold">δ</span>·RoadPenalty
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-1">
          {/* Alpha */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>α (Distance Weight):</span>
              <span className="font-bold text-blue-400 font-mono">{weights.alpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.05"
              value={weights.alpha}
              onChange={(e) => setWeights({ ...weights, alpha: parseFloat(e.target.value) })}
              className="accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Beta */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>β (Time Weight):</span>
              <span className="font-bold text-cyan-400 font-mono">{weights.beta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.05"
              value={weights.beta}
              onChange={(e) => setWeights({ ...weights, beta: parseFloat(e.target.value) })}
              className="accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Gamma */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>γ (Traffic Congestion Weight):</span>
              <span className="font-bold text-amber-400 font-mono">{weights.gamma.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="3.0"
              step="0.1"
              value={weights.gamma}
              onChange={(e) => setWeights({ ...weights, gamma: parseFloat(e.target.value) })}
              className="accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Delta */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>δ (Road Suitability Weight):</span>
              <span className="font-bold text-rose-400 font-mono">{weights.delta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.05"
              value={weights.delta}
              onChange={(e) => setWeights({ ...weights, delta: parseFloat(e.target.value) })}
              className="accent-rose-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onApplyWeights}
          className="mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Sliders className="w-4 h-4" />
          <span>Apply Custom Weights & Recalculate C++ Route</span>
        </button>
      </div>
    </div>
  );
};
