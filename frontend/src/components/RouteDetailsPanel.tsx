import React from 'react';
import { RouteResult } from '../types';
import { Clock, Navigation, AlertTriangle, Cpu, CheckCircle2, Zap, ArrowRightLeft } from 'lucide-react';

interface RouteDetailsPanelProps {
  activeRoute?: RouteResult;
  shortestRoute?: RouteResult;
  fastestRoute?: RouteResult;
  alternatives?: RouteResult[];
  reason?: string;
  warning?: string;
  dbPersisted?: boolean;
  routePreference: 'shortest' | 'fastest';
  setRoutePreference: (pref: 'shortest' | 'fastest') => void;
  onSelectRoute: (route: RouteResult) => void;
}

export const RouteDetailsPanel: React.FC<RouteDetailsPanelProps> = ({
  activeRoute,
  shortestRoute,
  fastestRoute,
  alternatives = [],
  reason,
  warning,
  dbPersisted,
  routePreference,
  setRoutePreference,
  onSelectRoute
}) => {
  if (!activeRoute) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
        <Navigation className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-slate-200">No Route Selected</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Enter Start & Destination locations and click &ldquo;Find Best Route&rdquo; to calculate real-road navigation paths.
        </p>
      </div>
    );
  }

  const distKm = (activeRoute.distance_m / 1000).toFixed(1);
  const timeMin = Math.round(activeRoute.travel_time_s / 60);
  const freeTimeMin = Math.round(activeRoute.free_flow_time_s / 60);
  const delayMin = Math.max(0, timeMin - freeTimeMin);

  const getTrafficBadge = (level: string) => {
    switch (level) {
      case 'Severe':
        return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-md text-xs font-semibold">🔴 Severe Traffic</span>;
      case 'High':
        return <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-md text-xs font-semibold">🟠 High Traffic</span>;
      case 'Moderate':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md text-xs font-semibold">🟡 Moderate Traffic</span>;
      case 'Low':
      default:
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-xs font-semibold">🟢 Low Traffic</span>;
    }
  };

  // Other candidate route for comparison sentences
  const otherCandidates = alternatives.filter(
    r => r.route_id !== activeRoute.route_id && Math.abs(r.distance_m - activeRoute.distance_m) > 10
  );

  // Generate dynamic reason sentence according to Google Maps specification
  let selectedReason = '';
  if (routePreference === 'shortest' || activeRoute.is_shortest) {
    if (otherCandidates.length > 0) {
      const nextCandidate = otherCandidates[0];
      const diffKm = Math.abs((nextCandidate.distance_m - activeRoute.distance_m) / 1000).toFixed(1);
      selectedReason = `Selected because it is the shortest distance: ${distKm} km (${diffKm} km shorter than ${nextCandidate.name || 'Route 2'}).`;
    } else {
      selectedReason = `Selected because it is the shortest distance route: ${distKm} km.`;
    }
  } else {
    // Fastest
    if (shortestRoute && Math.abs(activeRoute.distance_m - shortestRoute.distance_m) > 50) {
      const shortTimeMin = Math.round(shortestRoute.travel_time_s / 60);
      const timeSaved = shortTimeMin - timeMin;
      if (timeSaved > 0) {
        selectedReason = `Selected because it is the fastest route: ${timeMin} min (saves ${timeSaved} min in traffic vs shortest route).`;
      } else {
        selectedReason = `Selected because it has the lowest traffic-adjusted cost (${activeRoute.total_cost.toFixed(2)}).`;
      }
    } else {
      selectedReason = `Selected because it is the fastest route with free-flow traffic.`;
    }
  }

  return (
    <div className="flex flex-col gap-3.5 max-h-full overflow-y-auto pr-1">
      {/* 1. ROUTE PREFERENCE TOGGLE: [ Shortest distance ] [ Fastest (traffic) ] */}
      <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex items-center">
        <button
          type="button"
          onClick={() => {
            setRoutePreference('shortest');
            if (shortestRoute) onSelectRoute(shortestRoute);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            routePreference === 'shortest'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Shortest distance</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setRoutePreference('fastest');
            const targetFast = fastestRoute || alternatives.find(r => r.is_fastest) || activeRoute;
            if (targetFast) onSelectRoute(targetFast);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            routePreference === 'fastest'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Fastest (traffic)</span>
        </button>
      </div>

      {/* Optional Warning banner if live traffic offline */}
      {warning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>{warning}</span>
        </div>
      )}

      {/* 2. SELECTED ROUTE CARD ON TOP */}
      <div className="glass-panel border-blue-500/50 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="badge-best px-2.5 py-0.5 rounded-lg text-xs font-extrabold flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Selected
            </span>
            {activeRoute.is_shortest ? (
              <span className="bg-blue-900/60 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-md text-[11px] font-bold">
                Shortest distance route
              </span>
            ) : activeRoute.is_fastest ? (
              <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md text-[11px] font-bold">
                Fastest route
              </span>
            ) : (
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                Alternative
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-400" />
            <span>Cost: <strong className="text-white font-bold">{activeRoute.total_cost.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Large Text: "19 min (12.4 km)" */}
        <div className="my-2">
          <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">
            {timeMin} min <span className="text-slate-400 text-lg font-normal">({distKm} km)</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {getTrafficBadge(activeRoute.traffic_level)}
            {delayMin > 0 ? (
              <span className="text-xs text-amber-400 font-medium">+{delayMin} min traffic delay</span>
            ) : (
              <span className="text-xs text-emerald-400 font-medium">Free-flow speed</span>
            )}
          </div>
        </div>

        {/* Reason sentence */}
        <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 leading-relaxed mt-3">
          <div className="font-semibold text-blue-400 mb-0.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Route Selection Rationale
          </div>
          <p className="font-medium text-slate-200">
            {selectedReason || reason || activeRoute.explanation || 'Optimal physical path calculated on road network.'}
          </p>
        </div>
      </div>

      {/* 3. ALTERNATIVE ROUTE CARDS (Below Selected Route) */}
      {otherCandidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Alternative Routes ({otherCandidates.length})</span>
          </h4>

          <div className="flex flex-col gap-2">
            {otherCandidates.map((route, idx) => {
              const rDistKm = (route.distance_m / 1000).toFixed(1);
              const rTimeMin = Math.round(route.travel_time_s / 60);

              // Comparison sentence relative to selected route
              const distDiff = ((route.distance_m - activeRoute.distance_m) / 1000).toFixed(1);
              const timeDiff = timeMin - rTimeMin;
              let compText = '';
              if (parseFloat(distDiff) > 0) {
                compText = `+${distDiff} km longer`;
              } else if (parseFloat(distDiff) < 0) {
                compText = `${Math.abs(parseFloat(distDiff))} km shorter`;
              } else {
                compText = `Same distance`;
              }

              if (timeDiff > 0) {
                compText += `, ${timeDiff} min faster`;
              } else if (timeDiff < 0) {
                compText += `, ${Math.abs(timeDiff)} min slower`;
              } else {
                compText += `, same time`;
              }

              return (
                <button
                  key={route.route_id || idx}
                  type="button"
                  onClick={() => onSelectRoute(route)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all flex flex-col gap-1 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-200 group-hover:text-blue-300 transition-colors">
                        {route.name || `Route ${idx + 2}`}
                      </span>
                      {route.is_shortest && (
                        <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Shortest
                        </span>
                      )}
                      {route.is_fastest && (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Fastest
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-blue-400 font-semibold group-hover:underline">
                      Select
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-bold text-white">{rTimeMin} min</span>
                    <span>•</span>
                    <span>{rDistKm} km</span>
                    <span>•</span>
                    <span>{getTrafficBadge(route.traffic_level)}</span>
                  </div>

                  {compText && (
                    <div className="text-[11px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded mt-1">
                      {compText}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Single, small database offline indicator at bottom */}
      {dbPersisted === false && (
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
          <span>Database offline • Saved to local session</span>
        </div>
      )}
    </div>
  );
};
