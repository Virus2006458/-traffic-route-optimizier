import axios from 'axios';
import {
  OptimizeApiResponse,
  ModeComparisonItem,
  SavedRouteItem,
  DashboardStats,
  TransportMode,
  LocationPoint
} from './types';

const API_BASE = '/api';

export async function fetchRoute(payload: {
  from: string | LocationPoint;
  to: string | LocationPoint;
  transport_mode: TransportMode;
  weights?: { alpha?: number; beta?: number; gamma?: number; delta?: number };
}): Promise<OptimizeApiResponse> {
  const res = await axios.post(`${API_BASE}/route`, payload, { timeout: 16000 });
  return res.data;
}

export async function compareModes(from: string | LocationPoint, to: string | LocationPoint): Promise<ModeComparisonItem[]> {
  const res = await axios.post(`${API_BASE}/compare-modes`, { from, to }, { timeout: 20000 });
  return res.data.comparison || [];
}

export async function fetchAutocomplete(query: string): Promise<LocationPoint[]> {
  if (!query || query.length < 2) return [];
  const res = await axios.get(`${API_BASE}/autocomplete`, { params: { q: query } });
  return res.data.suggestions || [];
}

export async function fetchHistory(limit: number = 20): Promise<SavedRouteItem[]> {
  const res = await axios.get(`${API_BASE}/history`, { params: { limit } });
  return res.data.items || [];
}

export async function toggleSaveRoute(id: string, isSaved: boolean): Promise<boolean> {
  const res = await axios.post(`${API_BASE}/routes/${id}/save`, { is_saved: isSaved });
  return res.data.status === 'success';
}

export async function deleteHistoryItem(id: string): Promise<boolean> {
  const res = await axios.delete(`${API_BASE}/history/${id}`);
  return res.data.status === 'success';
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await axios.get(`${API_BASE}/stats`);
  return res.data.stats;
}

export async function checkHealth(): Promise<{
  status: string;
  tomtom_api_key_configured: boolean;
  cpp_engine: { isOnline: boolean };
  supabase_configured: boolean;
}> {
  const res = await axios.get(`${API_BASE}/health`);
  return res.data;
}
