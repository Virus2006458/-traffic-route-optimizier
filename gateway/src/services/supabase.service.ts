import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { SavedRouteItem } from '../types';

export class SupabaseService {
  private static client: SupabaseClient | null = null;
  private static memoryStore: SavedRouteItem[] = [];
  private static loggedInitError = false;

  private static getClient(): SupabaseClient | null {
    if (this.client) return this.client;

    const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;
    if (!config.supabaseUrl || !key) {
      if (!this.loggedInitError) {
        console.warn('[Supabase Warning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env. Operating in memory session fallback.');
        this.loggedInitError = true;
      }
      return null;
    }

    try {
      this.client = createClient(config.supabaseUrl, key, {
        auth: { persistSession: false }
      });
      return this.client;
    } catch (e: any) {
      console.error('[Supabase Error] Failed to initialize Supabase client:', e?.message || e);
      this.client = null;
      return null;
    }
  }

  public static async saveSearch(item: Omit<SavedRouteItem, 'id' | 'created_at'>): Promise<{ item: SavedRouteItem; dbSuccess: boolean }> {
    const fullItem: SavedRouteItem = {
      ...item,
      id: `sr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      created_at: new Date().toISOString()
    };

    this.memoryStore.unshift(fullItem);
    if (this.memoryStore.length > 50) this.memoryStore.pop();

    const supabase = this.getClient();
    if (!supabase) {
      return { item: fullItem, dbSuccess: false };
    }

    try {
      const { data, error } = await supabase.from('route_searches').insert([{
        session_id: item.session_id,
        start_location: item.start_location,
        start_lat: item.start_lat,
        start_lon: item.start_lon,
        destination: item.destination,
        dest_lat: item.dest_lat,
        dest_lon: item.dest_lon,
        transport_mode: item.transport_mode,
        distance_m: item.distance_m,
        travel_time_s: item.travel_time_s,
        traffic_level: item.traffic_level,
        route_cost: item.route_cost,
        algorithm: item.algorithm,
        is_saved: item.is_saved
      }]).select();

      if (error) {
        console.error('[Supabase DB Error] route_searches insert error:', error.message || error);
        return { item: fullItem, dbSuccess: false };
      }
      if (data && data.length > 0) {
        fullItem.id = data[0].id;
      }
      return { item: fullItem, dbSuccess: true };
    } catch (err: any) {
      console.error('[Supabase Error] Exception in saveSearch:', err.message || err);
      return { item: fullItem, dbSuccess: false };
    }
  }

  public static async getHistory(limit: number = 20): Promise<{ items: SavedRouteItem[]; dbSuccess: boolean }> {
    const supabase = this.getClient();
    if (!supabase) {
      return { items: this.memoryStore.slice(0, limit), dbSuccess: false };
    }

    try {
      const { data, error } = await supabase
        .from('route_searches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return { items: this.memoryStore.slice(0, limit), dbSuccess: false };
      }
      return { items: data as SavedRouteItem[], dbSuccess: true };
    } catch (err) {
      return { items: this.memoryStore.slice(0, limit), dbSuccess: false };
    }
  }

  public static async toggleSaveRoute(id: string, isSaved: boolean): Promise<{ success: boolean }> {
    const memItem = this.memoryStore.find(i => i.id === id);
    if (memItem) memItem.is_saved = isSaved;

    const supabase = this.getClient();
    if (!supabase) return { success: true };

    try {
      const { error } = await supabase
        .from('route_searches')
        .update({ is_saved: isSaved })
        .eq('id', id);
      return { success: !error };
    } catch (err) {
      return { success: true };
    }
  }

  public static async deleteHistory(id: string): Promise<{ success: boolean }> {
    this.memoryStore = this.memoryStore.filter(i => i.id !== id);

    const supabase = this.getClient();
    if (!supabase) return { success: true };

    try {
      const { error } = await supabase
        .from('route_searches')
        .delete()
        .eq('id', id);
      return { success: !error };
    } catch (err) {
      return { success: true };
    }
  }

  public static async getStats(): Promise<{
    total_searches: number;
    avg_distance_km: number;
    avg_travel_time_min: number;
    mode_usage: Record<string, number>;
    traffic_distribution: Record<string, number>;
    saved_routes_count: number;
  }> {
    const { items } = await this.getHistory(100);

    let total_searches = items.length;
    let total_dist_m = 0;
    let total_time_s = 0;
    const mode_usage: Record<string, number> = { walking: 0, car: 0, heavy: 0 };
    const traffic_distribution: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Severe: 0 };
    let saved_routes_count = 0;

    for (const item of items) {
      total_dist_m += item.distance_m || 0;
      total_time_s += item.travel_time_s || 0;
      if (item.transport_mode) {
        mode_usage[item.transport_mode] = (mode_usage[item.transport_mode] || 0) + 1;
      }
      if (item.traffic_level) {
        traffic_distribution[item.traffic_level] = (traffic_distribution[item.traffic_level] || 0) + 1;
      }
      if (item.is_saved) {
        saved_routes_count++;
      }
    }

    const avg_distance_km = total_searches > 0 ? Math.round((total_dist_m / total_searches / 1000) * 10) / 10 : 0;
    const avg_travel_time_min = total_searches > 0 ? Math.round((total_time_s / total_searches / 60) * 10) / 10 : 0;

    return {
      total_searches,
      avg_distance_km,
      avg_travel_time_min,
      mode_usage,
      traffic_distribution,
      saved_routes_count
    };
  }
}
