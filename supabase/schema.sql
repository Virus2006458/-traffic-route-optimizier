-- =================================================================
-- TRAFFIC ROUTE OPTIMIZATION SYSTEM - SUPABASE SCHEMA
-- =================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table (Optional authentication support)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Route Searches Table (Primary store for route queries)
CREATE TABLE IF NOT EXISTS public.route_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL DEFAULT 'guest_session',
    start_location TEXT NOT NULL,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lon DOUBLE PRECISION NOT NULL,
    destination TEXT NOT NULL,
    dest_lat DOUBLE PRECISION NOT NULL,
    dest_lon DOUBLE PRECISION NOT NULL,
    transport_mode TEXT NOT NULL CHECK (transport_mode IN ('walking', 'car', 'heavy')),
    distance_m DOUBLE PRECISION NOT NULL,
    travel_time_s DOUBLE PRECISION NOT NULL,
    traffic_level TEXT NOT NULL CHECK (traffic_level IN ('Low', 'Moderate', 'High', 'Severe')),
    route_cost DOUBLE PRECISION NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'A* Search',
    is_saved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Route Alternatives Table
CREATE TABLE IF NOT EXISTS public.route_alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id UUID NOT NULL REFERENCES public.route_searches(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    distance_m DOUBLE PRECISION NOT NULL,
    travel_time_s DOUBLE PRECISION NOT NULL,
    traffic_level TEXT NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    is_best BOOLEAN DEFAULT FALSE,
    is_shortest BOOLEAN DEFAULT FALSE
);

-- 5. Route Waypoints Table
CREATE TABLE IF NOT EXISTS public.route_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.route_searches(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_number INT NOT NULL
);

-- 6. Indexes for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_route_searches_session ON public.route_searches(session_id);
CREATE INDEX IF NOT EXISTS idx_route_searches_created_at ON public.route_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_searches_is_saved ON public.route_searches(is_saved);
CREATE INDEX IF NOT EXISTS idx_route_alternatives_search_id ON public.route_alternatives(search_id);
CREATE INDEX IF NOT EXISTS idx_route_waypoints_route_id ON public.route_waypoints(route_id);

-- 7. Row Level Security (RLS) Setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_waypoints ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated users full select/insert access based on session_id
CREATE POLICY "Public full access on route_searches" ON public.route_searches
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public full access on route_alternatives" ON public.route_alternatives
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public full access on route_waypoints" ON public.route_waypoints
    FOR ALL USING (true) WITH CHECK (true);

-- 8. Dashboard Analytics Stored Procedure (RPC)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_searches', COUNT(*),
        'avg_distance_km', ROUND(COALESCE(AVG(distance_m) / 1000.0, 0)::numeric, 1),
        'avg_travel_time_min', ROUND(COALESCE(AVG(travel_time_s) / 60.0, 0)::numeric, 1),
        'saved_routes_count', COUNT(*) FILTER (WHERE is_saved = true),
        'mode_usage', json_build_object(
            'walking', COUNT(*) FILTER (WHERE transport_mode = 'walking'),
            'car', COUNT(*) FILTER (WHERE transport_mode = 'car'),
            'heavy', COUNT(*) FILTER (WHERE transport_mode = 'heavy')
        ),
        'traffic_distribution', json_build_object(
            'Low', COUNT(*) FILTER (WHERE traffic_level = 'Low'),
            'Moderate', COUNT(*) FILTER (WHERE traffic_level = 'Moderate'),
            'High', COUNT(*) FILTER (WHERE traffic_level = 'High'),
            'Severe', COUNT(*) FILTER (WHERE traffic_level = 'Severe')
        )
    ) INTO result
    FROM public.route_searches;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
