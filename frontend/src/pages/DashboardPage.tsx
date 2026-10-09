import React, { useEffect, useState } from 'react';
import { fetchStats, fetchHistory } from '../api';
import { DashboardStats, SavedRouteItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Navigation, Clock, Bookmark, Search, Activity, Footprints, Car, Truck } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [historyItems, setHistoryItems] = useState<SavedRouteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const s = await fetchStats();
        setStats(s);
        const h = await fetchHistory(10);
        setHistoryItems(h);
      } catch (e) {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center min-h-[400px]">
        <Activity className="w-8 h-8 text-blue-500 mb-2 animate-spin" />
        <span>Loading Analytics & Traffic Distribution Stats...</span>
      </div>
    );
  }

  const trafficData = [
    { name: 'Low 🟢', count: stats?.traffic_distribution.Low || 0, fill: '#22c55e' },
    { name: 'Moderate 🟡', count: stats?.traffic_distribution.Moderate || 0, fill: '#eab308' },
    { name: 'High 🟠', count: stats?.traffic_distribution.High || 0, fill: '#f97316' },
    { name: 'Severe 🔴', count: stats?.traffic_distribution.Severe || 0, fill: '#ef4444' }
  ];

  const modeData = [
    { name: 'Walking 🚶', value: stats?.mode_usage.walking || 0, color: '#10b981' },
    { name: 'Car 🚗', value: stats?.mode_usage.car || 0, color: '#3b82f6' },
    { name: 'Heavy Truck 🚚', value: stats?.mode_usage.heavy || 0, color: '#f59e0b' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white">System Analytics & Traffic Dashboard</h2>
        <p className="text-xs text-slate-400">Real-time aggregate telemetry of graph optimizations, traffic congestion distribution, and mode usage.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Searches */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Total Route Searches</div>
            <div className="text-2xl font-black text-white mt-1">{stats?.total_searches || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400">
            <Search className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Distance */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Avg Route Distance</div>
            <div className="text-2xl font-black text-white mt-1">{stats?.avg_distance_km || 0} <span className="text-xs font-normal text-slate-400">km</span></div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-600/20 text-cyan-400">
            <Navigation className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Time */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Avg Travel Time</div>
            <div className="text-2xl font-black text-white mt-1">{stats?.avg_travel_time_min || 0} <span className="text-xs font-normal text-slate-400">min</span></div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Saved Routes */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Saved Favorites</div>
            <div className="text-2xl font-black text-white mt-1">{stats?.saved_routes_count || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-600/20 text-amber-400">
            <Bookmark className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Distribution Bar Chart */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Traffic Congestion Distribution</h3>
            <p className="text-xs text-slate-400">Breakdown of route congestion levels evaluated across searches.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {trafficData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mode Usage Pie Chart */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Transport Mode Usage</h3>
            <p className="text-xs text-slate-400">Share of route optimizations per vehicle type.</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {modeData.map((entry, index) => (
                    <Cell key={`cell-pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Searches Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-200">Recent Route Optimizations</h3>
        {historyItems.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">No recent searches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
                  <th className="p-2.5">Start Location</th>
                  <th className="p-2.5">Destination</th>
                  <th className="p-2.5">Mode</th>
                  <th className="p-2.5">Distance</th>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Traffic</th>
                  <th className="p-2.5">Cost</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-900/40 text-slate-300">
                    <td className="p-2.5 font-medium text-white">{item.start_location}</td>
                    <td className="p-2.5 font-medium text-white">{item.destination}</td>
                    <td className="p-2.5 capitalize flex items-center gap-1">
                      {item.transport_mode === 'walking' && <Footprints className="w-3.5 h-3.5 text-emerald-400" />}
                      {item.transport_mode === 'car' && <Car className="w-3.5 h-3.5 text-blue-400" />}
                      {item.transport_mode === 'heavy' && <Truck className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{item.transport_mode}</span>
                    </td>
                    <td className="p-2.5">{(item.distance_m / 1000).toFixed(1)} km</td>
                    <td className="p-2.5 font-semibold text-white">{Math.round(item.travel_time_s / 60)} min</td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {item.traffic_level}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-blue-400 font-bold">{item.route_cost?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
