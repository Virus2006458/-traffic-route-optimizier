import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ArrowUpDown, Footprints, Car, Truck, Search, Crosshair, Loader2, Hash } from 'lucide-react';
import { TransportMode, LocationPoint } from '../types';
import { fetchAutocomplete } from '../api';

interface SearchCardProps {
  fromLocation: string;
  setFromLocation: (val: string) => void;
  toLocation: string;
  setToLocation: (val: string) => void;
  transportMode: TransportMode;
  setTransportMode: (mode: TransportMode) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export const SearchCard: React.FC<SearchCardProps> = ({
  fromLocation,
  setFromLocation,
  toLocation,
  setToLocation,
  transportMode,
  setTransportMode,
  onSearch,
  isLoading
}) => {
  const [fromSuggestions, setFromSuggestions] = useState<LocationPoint[]>([]);
  const [toSuggestions, setToSuggestions] = useState<LocationPoint[]>([]);
  const [loadingFromDrop, setLoadingFromDrop] = useState(false);
  const [loadingToDrop, setLoadingToDrop] = useState(false);
  const [showFromDrop, setShowFromDrop] = useState(false);
  const [showToDrop, setShowToDrop] = useState(false);
  const [locating, setLocating] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fromLocation.trim().length < 2) {
      setFromSuggestions([]);
      setLoadingFromDrop(false);
      return;
    }
    setLoadingFromDrop(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchAutocomplete(fromLocation);
        setFromSuggestions(res);
      } catch (e) {
        setFromSuggestions([]);
      } finally {
        setLoadingFromDrop(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [fromLocation]);

  useEffect(() => {
    if (toLocation.trim().length < 2) {
      setToSuggestions([]);
      setLoadingToDrop(false);
      return;
    }
    setLoadingToDrop(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchAutocomplete(toLocation);
        setToSuggestions(res);
      } catch (e) {
        setToSuggestions([]);
      } finally {
        setLoadingToDrop(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [toLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
        setShowFromDrop(false);
      }
      if (toRef.current && !toRef.current.contains(event.target as Node)) {
        setShowToDrop(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwap = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (lat < 6.0 || lat > 38.5 || lon < 68.0 || lon > 98.5) {
            alert('Your current location is outside India. Routing is restricted to locations within India.');
            setLocating(false);
            return;
          }
          setFromLocation(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
          setLocating(false);
        },
        () => {
          alert('Could not access current location. Please type an Indian place or PIN code.');
          setLocating(false);
        }
      );
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60 flex flex-col gap-4 relative z-30">
      {/* India Scope Badge */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
        <span className="flex items-center gap-1.5 text-blue-400 font-bold">
          <span className="text-sm">🇮🇳</span> India Only
        </span>
        <span className="text-slate-400 text-[10px]">All States, Cities, Towns & PIN Codes</span>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setTransportMode('walking')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            transportMode === 'walking'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Walk</span>
        </button>

        <button
          type="button"
          onClick={() => setTransportMode('car')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            transportMode === 'car'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Car</span>
        </button>

        <button
          type="button"
          onClick={() => setTransportMode('heavy')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            transportMode === 'heavy'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Truck</span>
        </button>
      </div>

      {/* From Input */}
      <div className="relative" ref={fromRef}>
        <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <MapPin className="w-3.5 h-3.5" /> Start Location in India
          </span>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline"
          >
            {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
            Use my location
          </button>
        </label>
        <div className="relative">
          <input
            type="text"
            value={fromLocation}
            onChange={(e) => {
              setFromLocation(e.target.value);
              setShowFromDrop(true);
            }}
            onFocus={() => setShowFromDrop(true)}
            placeholder="Type any Indian place or PIN code (e.g. Connaught Place or 500084)"
            className="w-full bg-slate-900/90 border border-slate-700 focus:border-blue-500 text-sm text-slate-100 rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-500"
          />
          {loadingFromDrop && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showFromDrop && fromLocation.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-[9999] max-h-56 overflow-y-auto">
            {fromSuggestions.length > 0 ? (
              fromSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFromLocation(item.name || `${item.lat}, ${item.lon}`);
                    setShowFromDrop(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-blue-600/30 hover:text-white flex items-center gap-2 border-b border-slate-800 last:border-0 transition-colors"
                >
                  {/^\d+/.test(item.name || '') ? (
                    <Hash className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate font-medium">{item.name}</span>
                </button>
              ))
            ) : !loadingFromDrop ? (
              <div className="px-3.5 py-2.5 text-xs text-slate-500">No matching place or PIN code found in India.</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Swap Button */}
      <div className="flex justify-center -my-2 z-10">
        <button
          type="button"
          onClick={handleSwap}
          title="Swap Start and Destination"
          className="p-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-blue-600 transition-all hover:scale-110 shadow-md"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* To Input */}
      <div className="relative" ref={toRef}>
        <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5 text-rose-400">
          <Navigation className="w-3.5 h-3.5" /> Destination in India
        </label>
        <div className="relative">
          <input
            type="text"
            value={toLocation}
            onChange={(e) => {
              setToLocation(e.target.value);
              setShowToDrop(true);
            }}
            onFocus={() => setShowToDrop(true)}
            placeholder="Type Indian destination (e.g. Mumbai Airport, Whitefield, or 500032)"
            className="w-full bg-slate-900/90 border border-slate-700 focus:border-blue-500 text-sm text-slate-100 rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-500"
          />
          {loadingToDrop && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showToDrop && toLocation.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-[9999] max-h-56 overflow-y-auto">
            {toSuggestions.length > 0 ? (
              toSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setToLocation(item.name || `${item.lat}, ${item.lon}`);
                    setShowToDrop(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-blue-600/30 hover:text-white flex items-center gap-2 border-b border-slate-800 last:border-0 transition-colors"
                >
                  {/^\d+/.test(item.name || '') ? (
                    <Hash className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="truncate font-medium">{item.name}</span>
                </button>
              ))
            ) : !loadingToDrop ? (
              <div className="px-3.5 py-2.5 text-xs text-slate-500">No matching place or PIN code found.</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Find Best Route Button */}
      <button
        type="button"
        onClick={onSearch}
        disabled={isLoading}
        className="w-full mt-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Calculating Graph Routes...</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>Find Best Route</span>
          </>
        )}
      </button>
    </div>
  );
};
