export type TransportMode = 'walking' | 'car' | 'heavy';

export interface LocationPoint {
  lat: number;
  lon: number;
  name?: string;
}

export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  length_m: number;
  travel_time_s: number;
  free_flow_time_s: number;
  traffic_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  road_class: string;
  truck_allowed: boolean;
  geometry?: [number, number][];
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RouteResult {
  route_id: string;
  name: string;
  found: boolean;
  path: string[];
  edge_ids?: string[];
  polyline: [number, number][];
  waypoints: GraphNode[];
  total_cost: number;
  distance_m: number;
  travel_time_s: number;
  free_flow_time_s: number;
  delay_s: number;
  traffic_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  nodes_expanded: number;
  runtime_us: number;
  algorithm_name: string;
  is_best: boolean;
  is_shortest: boolean;
  is_fastest: boolean;
  edge_segments: GraphEdge[];
  explanation?: string;
  comparison_text?: string;
}

export interface OptimizeResponse {
  status: string;
  mode: TransportMode;
  start_location: LocationPoint;
  target_location: LocationPoint;
  reason: string;
  best_route: RouteResult;
  shortest_route: RouteResult;
  fastest_route: RouteResult;
  alternatives: RouteResult[];
  traffic_data_available: boolean;
}

export interface SavedRouteItem {
  id: string;
  user_id?: string;
  session_id: string;
  start_location: string;
  start_lat: number;
  start_lon: number;
  destination: string;
  dest_lat: number;
  dest_lon: number;
  transport_mode: TransportMode;
  distance_m: number;
  travel_time_s: number;
  traffic_level: string;
  route_cost: number;
  algorithm: string;
  is_saved: boolean;
  created_at: string;
  explanation?: string;
}
