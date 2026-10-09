import React, { useState, useEffect, useCallback } from 'react';
import { SearchCard } from '../components/SearchCard';
import { MapView } from '../components/MapView';
import { RouteDetailsPanel } from '../components/RouteDetailsPanel';
import { CompareModesView } from '../components/CompareModesView';
import { AlgorithmView } from '../components/AlgorithmView';
import { TrafficLegend } from '../components/TrafficLegend';
import { fetchRoute, compareModes } from '../api';
import { OptimizeApiResponse, RouteResult, TransportMode, ModeComparisonItem, LocationPoint } from '../types';
import { RefreshCw, MapPin, BarChart2, Sliders } from 'lucide-react';

interface PlannerPageProps {
  toastMessage?: string;
  setToastMessage: (msg: string | undefined) => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({ setToastMessage }) => {
  const [fromLocation, setFromLocation] = useState('Charminar, Hyderabad');
  const [toLocation, setToLocation] = useState('HITEC City, Hyderabad');
  const [transportMode, setTransportMode] = useState<TransportMode>('car');
  const [activeTab, setActiveTab] = useState<'details' | 'compare' | 'algorithm'>('details');

  const [isLoading, setIsLoading] = useState(false);
  const [routeResponse, setRouteResponse] = useState<OptimizeApiResponse | undefined>();
  const [activeRoute, setActiveRoute] = useState<RouteResult | undefined>();
  const [comparisonList, setComparisonList] = useState<ModeComparisonItem[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // Map Toggles
  const [showTrafficColors, setShowTrafficColors] = useState(false);
  const [showTrafficTiles, setShowTrafficTiles] = useState(false);

  // Live Refresh Toggle (2 minutes timer)
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Cost function weights state
  const [weights, setWeights] = useState({
    alpha: 0.4,
    beta: 0.8,
    gamma: 0.5,
    delta: 0.1
  });

  const [routePreference, setRoutePreference] = useState<'shortest' | 'fastest'>('shortest');

  const handleSearch = useCallback(async (customWeights?: typeof weights) => {
    setIsLoading(true);
    try {
      const res = await fetchRoute({
        from: fromLocation,
        to: toLocation,
        transport_mode: transportMode,
        weights: customWeights || weights
      });
      setRouteResponse(res);

      // Select route according to active preference (Default = Shortest distance)
      if (routePreference === 'shortest') {
        setActiveRoute(res.shortest_route || res.best_route || (res.alternatives && res.alternatives[0]));
      } else {
        setActiveRoute(res.fastest_route || res.best_route || (res.alternatives && res.alternatives[0]));
      }

      if (res.warning) {
        setToastMessage(res.warning);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Route calculation failed.');
    } finally {
      setIsLoading(false);
    }
  }, [fromLocation, toLocation, transportMode, weights, routePreference, setToastMessage]);

  // Initial load search
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks-exhaustive-deps
  }, []);

  // Handle Mode Comparison fetch when tab activated
  const handleCompareClick = async () => {
    setActiveTab('compare');
    if (comparisonList.length === 0 || fromLocation || toLocation) {
      setIsComparing(true);
      try {
        const list = await compareModes(fromLocation, toLocation);
        setComparisonList(list);
      } catch (e) {
        // Ignored
      } finally {
        setIsComparing(false);
      }
    }
  };

  // Live 2-minute Traffic Refresh Timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      if (!isLoading && fromLocation && toLocation) {
        try {
          const res = await fetchRoute({
            from: fromLocation,
            to: toLocation,
            transport_mode: transportMode,
            weights
          });
          if (activeRoute && res.best_route) {
            const timeDiffMin = Math.round((activeRoute.travel_time_s - res.best_route.travel_time_s) / 60);
            if (timeDiffMin > 2) {
              setToastMessage(`⚡ Faster route updated! Saves ${timeDiffMin} minutes in traffic.`);
            }
          }
          setRouteResponse(res);
          const shortestOrBest = res.shortest_route || res.best_route;
          setActiveRoute(shortestOrBest);
        } catch (e) {
          // Ignored background error
        }
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, isLoading, fromLocation, toLocation, transportMode, weights, activeRoute, setToastMessage]);

  return (
    <div className="relative w-full h-[calc(100vh-65px)] overflow-hidden flex flex-col md:flex-row">
      {/* LEFT / FLOATING SIDEBAR (Desktop floating, Mobile stacked) */}
      <div className="w-full md:w-[400px] lg:w-[440px] h-full z-20 flex flex-col p-4 gap-4 overflow-y-auto shrink-0 bg-slate-950/80 backdrop-blur-md md:bg-transparent md:backdrop-blur-none border-b md:border-b-0 md:border-r border-slate-800">
        {/* Search Card */}
        <SearchCard
          fromLocation={fromLocation}
          setFromLocation={setFromLocation}
          toLocation={toLocation}
          setToLocation={setToLocation}
          transportMode={transportMode}
          setTransportMode={setTransportMode}
          onSearch={() => handleSearch()}
          isLoading={isLoading}
        />

        {/* View Navigation Tabs */}
        <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'details'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Route Details</span>
          </button>

          <button
            type="button"
            onClick={handleCompareClick}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'compare'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Compare Modes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('algorithm')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'algorithm'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Algorithm</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <RouteDetailsPanel
              activeRoute={activeRoute}
              shortestRoute={routeResponse?.shortest_route}
              fastestRoute={routeResponse?.fastest_route}
              alternatives={routeResponse?.alternatives}
              reason={routeResponse?.reason}
              warning={routeResponse?.warning}
              dbPersisted={routeResponse?.db_persisted}
              routePreference={routePreference}
              setRoutePreference={(pref) => {
                setRoutePreference(pref);
                if (pref === 'shortest' && routeResponse?.shortest_route) {
                  setActiveRoute(routeResponse.shortest_route);
                } else if (pref === 'fastest') {
                  const fast = routeResponse?.fastest_route || routeResponse?.alternatives?.find(a => a.is_fastest) || routeResponse?.best_route;
                  if (fast) setActiveRoute(fast);
                }
              }}
              onSelectRoute={(r) => setActiveRoute(r)}
            />
          )}

          {activeTab === 'compare' && (
            <CompareModesView
              comparisonList={comparisonList}
              activeMode={transportMode}
              onSelectMode={(mode) => {
                setTransportMode(mode);
                handleSearch();
              }}
              isLoading={isComparing}
            />
          )}

          {activeTab === 'algorithm' && (
            <AlgorithmView
              bestRoute={routeResponse?.best_route}
              shortestRoute={routeResponse?.shortest_route}
              weights={weights}
              setWeights={setWeights}
              onApplyWeights={() => handleSearch(weights)}
            />
          )}
        </div>

        {/* Auto Refresh Toggle Bar */}
        <div className="glass-panel p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>Live Traffic Refresh (2m)</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
              autoRefresh ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* RIGHT / FULL MAP VIEW AREA */}
      <div className="flex-1 h-full relative">
        <MapView
          startLocation={routeResponse?.start_location}
          destLocation={routeResponse?.destination_location}
          activeRoute={activeRoute}
          shortestRoute={routeResponse?.shortest_route}
          alternatives={routeResponse?.alternatives}
          onSelectRoute={(r) => setActiveRoute(r)}
          showTrafficColors={showTrafficColors}
          setShowTrafficColors={setShowTrafficColors}
          showTrafficTiles={showTrafficTiles}
          setShowTrafficTiles={setShowTrafficTiles}
        />

        {/* Traffic Legend (Bottom Right Overlay) */}
        <div className="absolute bottom-6 right-6 z-[400]">
          <TrafficLegend />
        </div>
      </div>
    </div>
  );
};
