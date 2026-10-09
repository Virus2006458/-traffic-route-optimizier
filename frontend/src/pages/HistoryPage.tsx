import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHistory, toggleSaveRoute, deleteHistoryItem } from '../api';
import { SavedRouteItem } from '../types';
import { Search, Bookmark, Trash2, RotateCcw, Footprints, Car, Truck } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [items, setItems] = useState<SavedRouteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSavedOnly, setFilterSavedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHistory(50);
      setItems(data);
    } catch (e) {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleToggleSave = async (item: SavedRouteItem) => {
    const newState = !item.is_saved;
    setItems(items.map(i => i.id === item.id ? { ...i, is_saved: newState } : i));
    await toggleSaveRoute(item.id, newState);
  };

  const handleDelete = async (id: string) => {
    setItems(items.filter(i => i.id !== id));
    await deleteHistoryItem(id);
  };

  const handleRerun = (item: SavedRouteItem) => {
    navigate('/', {
      state: {
        from: item.start_location,
        to: item.destination,
        mode: item.transport_mode
      }
    });
  };

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.start_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.transport_mode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSaved = filterSavedOnly ? item.is_saved : true;
    return matchesSearch && matchesSaved;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white">Route Optimization History</h2>
          <p className="text-xs text-slate-400">Review past calculated graph routes, favorite saved routes, and re-run optimizations.</p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..."
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-blue-500 w-48"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterSavedOnly(!filterSavedOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              filterSavedOnly
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Favorites</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading history items...</div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 text-sm">
          No route history items found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col justify-between gap-3 hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold capitalize flex items-center gap-1 text-slate-300">
                    {item.transport_mode === 'walking' && <Footprints className="w-3.5 h-3.5 text-emerald-400" />}
                    {item.transport_mode === 'car' && <Car className="w-3.5 h-3.5 text-blue-400" />}
                    {item.transport_mode === 'heavy' && <Truck className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{item.transport_mode}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSave(item)}
                      title={item.is_saved ? 'Unsave Route' : 'Save Favorite Route'}
                      className={`p-1.5 rounded-lg transition-all ${
                        item.is_saved ? 'text-amber-400 bg-amber-500/20' : 'text-slate-500 hover:text-amber-400'
                      }`}
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      title="Delete History Item"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-sm font-bold text-white leading-snug">{item.start_location}</div>
                <div className="text-xs text-slate-500 my-0.5">↓ to</div>
                <div className="text-sm font-bold text-white leading-snug">{item.destination}</div>
              </div>

              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs text-slate-400">
                <div>
                  <span className="font-bold text-white">{Math.round(item.travel_time_s / 60)} min</span>
                  <span className="mx-1">•</span>
                  <span>{(item.distance_m / 1000).toFixed(1)} km</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRerun(item)}
                  className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3 h-3" /> Re-run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
