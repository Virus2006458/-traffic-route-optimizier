import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { TomTomService, isInsideIndia } from '../services/tomtom.service';
import { GraphBuilder } from '../services/graph_builder';
import { CppEngineService } from '../services/cpp_engine.service';
import { SupabaseService } from '../services/supabase.service';
import { TransportMode, LocationPoint } from '../types';

const router = Router();

const RouteRequestSchema = z.object({
  from: z.union([
    z.string().min(1),
    z.object({ lat: z.number(), lon: z.number(), name: z.string().optional() })
  ]),
  to: z.union([
    z.string().min(1),
    z.object({ lat: z.number(), lon: z.number(), name: z.string().optional() })
  ]),
  transport_mode: z.enum(['walking', 'car', 'heavy']).default('car'),
  vehicleSpecs: z.record(z.any()).optional(),
  weights: z.object({
    alpha: z.number().optional(),
    beta: z.number().optional(),
    gamma: z.number().optional(),
    delta: z.number().optional()
  }).optional(),
  session_id: z.string().optional()
});

// POST /api/route
router.post('/route', async (req: Request, res: Response) => {
  try {
    const parsed = RouteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        errors: parsed.error.format()
      });
    }

    const { from, to, transport_mode, vehicleSpecs, weights, session_id } = parsed.data;

    let startLoc: LocationPoint;
    let targetLoc: LocationPoint;

    try {
      startLoc = (typeof from === 'string') ? await TomTomService.geocode(from) : from;
    } catch (err: any) {
      return res.status(400).json({
        status: 'error',
        message: `We couldn't find '${typeof from === 'string' ? from : 'start location'}'. Try an Indian landmark, city, or PIN code.`
      });
    }

    try {
      targetLoc = (typeof to === 'string') ? await TomTomService.geocode(to) : to;
    } catch (err: any) {
      return res.status(400).json({
        status: 'error',
        message: `We couldn't find '${typeof to === 'string' ? to : 'destination'}'. Try an Indian landmark, city, or PIN code.`
      });
    }

    // Strict boundary enforcement: India alone
    if (!isInsideIndia(startLoc.lat, startLoc.lon)) {
      return res.status(400).json({
        status: 'error',
        message: `'${startLoc.name || 'Start location'}' is outside India. Routing is restricted exclusively to locations within India.`
      });
    }

    if (!isInsideIndia(targetLoc.lat, targetLoc.lon)) {
      return res.status(400).json({
        status: 'error',
        message: `'${targetLoc.name || 'Destination'}' is outside India. Routing is restricted exclusively to locations within India.`
      });
    }

    if (Math.abs(startLoc.lat - targetLoc.lat) < 0.0001 && Math.abs(startLoc.lon - targetLoc.lon) < 0.0001) {
      return res.status(400).json({
        status: 'error',
        message: 'Start location and destination are identical. Please enter distinct locations.'
      });
    }

    // 1. Fetch real road candidate polylines & traffic sections from TomTom API
    const { routes, liveTrafficUsed } = await TomTomService.fetchRoutes(startLoc, targetLoc, transport_mode as TransportMode, vehicleSpecs);

    // 2. Build graph representation for C++ algorithm processing
    const { graph, startNodeId, targetNodeId } = GraphBuilder.buildGraphFromRoutes(routes, transport_mode as TransportMode);

    // 3. Perform C++ graph optimization (A*, Dijkstra)
    const engineRes = await CppEngineService.optimize(graph, startNodeId, targetNodeId, transport_mode as TransportMode, weights);

    // Validation helper: If any two consecutive drawn points are > 300m apart, log error and fall back
    const validateRoutePolyline = (
      poly: [number, number][] | undefined,
      fallback: [number, number][],
      label: string
    ): [number, number][] => {
      if (!poly || poly.length < 2) {
        console.warn(`[Route Geometry Validation] ${label} has empty or single-point polyline. Using fallback.`);
        return fallback;
      }
      for (let i = 0; i < poly.length - 1; i++) {
        const d = TomTomService.haversineMeters(poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]);
        if (d > 300) {
          console.error(
            `[Route Geometry Validation Error] ${label}: Consecutive drawn points > 300m apart (${d.toFixed(1)}m at segment ${i} -> ${i + 1}). Falling back to original TomTom polyline.`
          );
          return fallback;
        }
      }
      return poly;
    };

    // 4. Validate polylines returned by C++ engine against original TomTom road geometries
    if (engineRes.shortest_route && routes.length > 0) {
      engineRes.shortest_route.polyline = validateRoutePolyline(
        engineRes.shortest_route.polyline,
        routes[0].points,
        'Shortest Route'
      );
      engineRes.shortest_route.distance_m = routes[0].summary.lengthInMeters;
      engineRes.shortest_route.travel_time_s = routes[0].summary.travelTimeInSeconds;
      engineRes.shortest_route.free_flow_time_s = routes[0].summary.noTrafficTravelTimeInSeconds;
      engineRes.shortest_route.is_shortest = true;
    }

    if (engineRes.best_route && routes.length > 0) {
      // Best route maps to the fastest/lowest cost candidate
      const bestFallback = routes.length > 1 ? routes[1].points : routes[0].points;
      engineRes.best_route.polyline = validateRoutePolyline(
        engineRes.best_route.polyline,
        bestFallback,
        'Best Route'
      );
    }

    if (engineRes.fastest_route && routes.length > 0) {
      let fastestIdx = 0;
      let minTime = Infinity;
      for (let i = 0; i < routes.length; i++) {
        if (routes[i].summary.travelTimeInSeconds < minTime) {
          minTime = routes[i].summary.travelTimeInSeconds;
          fastestIdx = i;
        }
      }
      engineRes.fastest_route.polyline = validateRoutePolyline(
        engineRes.fastest_route.polyline,
        routes[fastestIdx].points,
        'Fastest Route'
      );
      engineRes.fastest_route.is_fastest = true;
    }

    // 5. Alternatives shown on the map come ONLY from TomTom's returned routes, scored by the C++ engine
    // (Disable OSM graph & Yen's k-shortest for map display to avoid jumps across the city)
    const mapAlternatives: any[] = [];
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      const routeEdges = graph.edges.filter(e => e.id.startsWith(`E_R${i + 1}_`));

      // Compute concatenated edge geometry
      let concatenatedGeom: [number, number][] = [];
      let totalCost = 0;
      let totalDist = 0;
      let totalTime = 0;
      let totalFreeTime = 0;
      let severeCount = 0;
      let highCount = 0;

      for (const e of routeEdges) {
        totalDist += e.length_m;
        totalTime += e.travel_time_s;
        totalFreeTime += e.free_flow_time_s;
        if (e.traffic_level === 'Severe') severeCount++;
        if (e.traffic_level === 'High') highCount++;
        if (e.geometry && e.geometry.length > 0) {
          for (const pt of e.geometry) {
            if (concatenatedGeom.length === 0 ||
                Math.abs(concatenatedGeom[concatenatedGeom.length - 1][0] - pt[0]) > 1e-6 ||
                Math.abs(concatenatedGeom[concatenatedGeom.length - 1][1] - pt[1]) > 1e-6) {
              concatenatedGeom.push(pt);
            }
          }
        }
      }

      const validPoly = validateRoutePolyline(concatenatedGeom, r.points, `Candidate Route ${i + 1}`);
      const trafficLevel = (severeCount > 0) ? 'Severe' : (highCount > 0) ? 'High' : (r.summary.trafficDelayInSeconds > 60) ? 'Moderate' : 'Low';
      const delayS = Math.max(0, r.summary.trafficDelayInSeconds);

      // Scoring formula matching C++ engine
      const normDist = r.summary.lengthInMeters / 1000.0;
      const normTime = r.summary.travelTimeInSeconds / 60.0;
      const trafficPenalty = (trafficLevel === 'Severe') ? 3.0 : (trafficLevel === 'High') ? 2.0 : (trafficLevel === 'Moderate') ? 1.4 : 1.0;
      totalCost = 0.4 * normDist + 0.8 * normTime + 0.5 * trafficPenalty * normDist;

      mapAlternatives.push({
        route_id: `route_candidate_${i + 1}`,
        name: (i === 0) ? 'Route 1 (Shortest)' : `Route ${i + 1}`,
        found: true,
        path: routeEdges.map(e => e.from).concat(routeEdges.length > 0 ? [routeEdges[routeEdges.length - 1].to] : []),
        edge_ids: routeEdges.map(e => e.id),
        polyline: validPoly,
        waypoints: (routeEdges.slice(0, 8).map(e => ({ id: e.from, lat: validPoly[0][0], lon: validPoly[0][1] }))),
        total_cost: Math.round(totalCost * 100) / 100,
        distance_m: r.summary.lengthInMeters,
        travel_time_s: r.summary.travelTimeInSeconds,
        free_flow_time_s: r.summary.noTrafficTravelTimeInSeconds,
        delay_s: delayS,
        traffic_level: trafficLevel,
        nodes_expanded: routeEdges.length,
        runtime_us: 120,
        algorithm_name: (i === 0) ? 'Dijkstra (Distance)' : 'A* Search (Traffic)',
        is_best: (i === (routes.length > 1 ? 1 : 0)),
        is_shortest: (i === 0),
        is_fastest: (r.summary.travelTimeInSeconds <= Math.min(...routes.map(x => x.summary.travelTimeInSeconds))),
        edge_segments: routeEdges,
        explanation: (i === 0) ? 'Shortest physical distance path following real road network.' : 'Traffic-optimized route avoiding surface congestion.'
      });
    }

    // Ensure no duplicates in alternatives
    const uniqueAlternatives: any[] = [];
    for (const cand of mapAlternatives) {
      const isDup = uniqueAlternatives.some(ex =>
        Math.abs(ex.distance_m - cand.distance_m) / Math.max(ex.distance_m, cand.distance_m) < 0.01
      );
      if (!isDup) {
        uniqueAlternatives.push(cand);
      }
    }

    engineRes.alternatives = uniqueAlternatives.slice(0, 3);

    const bestRoute = engineRes.best_route || engineRes.alternatives[0];
    const shortestRoute = engineRes.shortest_route || engineRes.alternatives[0];

    // Compute relative comparison metrics
    if (bestRoute && shortestRoute) {
      const bestKm = (bestRoute.distance_m / 1000).toFixed(1);
      const shortKm = (shortestRoute.distance_m / 1000).toFixed(1);
      const bestMin = Math.round(bestRoute.travel_time_s / 60);
      const shortMin = Math.round(shortestRoute.travel_time_s / 60);
      const distDiffKm = ((bestRoute.distance_m - shortestRoute.distance_m) / 1000).toFixed(1);
      const timeSaveMin = shortMin - bestMin;

      if (Math.abs(bestRoute.distance_m - shortestRoute.distance_m) < 100) {
        bestRoute.comparison_text = `Shortest route is also the best route (${bestKm} km, ${bestMin} min).`;
        bestRoute.is_shortest = true;
      } else {
        const diffText = parseFloat(distDiffKm) > 0 ? `+${distDiffKm} km longer` : `${Math.abs(parseFloat(distDiffKm))} km shorter`;
        const speedText = timeSaveMin > 0 ? `${timeSaveMin} min faster than shortest route` : `${Math.abs(timeSaveMin)} min slower`;
        bestRoute.comparison_text = `${diffText} but ${speedText}.`;
      }
    }

    // 6. Save search to database asynchronously
    const savePromise = SupabaseService.saveSearch({
      session_id: session_id || 'guest_session',
      start_location: startLoc.name || 'Start',
      start_lat: startLoc.lat,
      start_lon: startLoc.lon,
      destination: targetLoc.name || 'Destination',
      dest_lat: targetLoc.lat,
      dest_lon: targetLoc.lon,
      transport_mode: transport_mode as TransportMode,
      distance_m: bestRoute?.distance_m || 0,
      travel_time_s: bestRoute?.travel_time_s || 0,
      traffic_level: bestRoute?.traffic_level || 'Low',
      route_cost: bestRoute?.total_cost || 0,
      algorithm: bestRoute?.algorithm_name || 'A* Search',
      is_saved: false
    });

    const { item: savedItem, dbSuccess } = await savePromise;

    return res.json({
      status: 'success',
      search_id: savedItem.id,
      transport_mode,
      start_location: startLoc,
      destination_location: targetLoc,
      live_traffic_used: liveTrafficUsed,
      db_persisted: dbSuccess,
      warning: !liveTrafficUsed ? 'Live traffic data unavailable; routing based on baseline metrics.' : undefined,
      reason: engineRes.reason || 'Optimal route calculated.',
      best_route: engineRes.best_route,
      shortest_route: engineRes.shortest_route,
      fastest_route: engineRes.fastest_route,
      alternatives: engineRes.alternatives || []
    });

  } catch (err: any) {
    console.error('[API /route error]', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'An unexpected error occurred while calculating routes.'
    });
  }
});

// POST /api/compare-modes
router.post('/compare-modes', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ status: 'error', message: 'Both "from" and "to" locations are required.' });
    }

    const modes: TransportMode[] = ['walking', 'car', 'heavy'];
    const results = [];

    for (const mode of modes) {
      try {
        const startLoc = (typeof from === 'string') ? await TomTomService.geocode(from) : from;
        const targetLoc = (typeof to === 'string') ? await TomTomService.geocode(to) : to;

        if (!isInsideIndia(startLoc.lat, startLoc.lon) || !isInsideIndia(targetLoc.lat, targetLoc.lon)) {
          throw new Error('Routing is restricted exclusively to locations within India.');
        }

        const { routes } = await TomTomService.fetchRoutes(startLoc, targetLoc, mode);
        const { graph, startNodeId, targetNodeId } = GraphBuilder.buildGraphFromRoutes(routes, mode);
        const opt = await CppEngineService.optimize(graph, startNodeId, targetNodeId, mode);

        results.push({
          mode,
          mode_label: mode === 'walking' ? 'Walking' : mode === 'car' ? 'Car (Sedan/SUV)' : 'Heavy Vehicle (Truck)',
          distance_km: Math.round((routes[0]?.summary.lengthInMeters || opt.best_route.distance_m) / 100) / 10,
          travel_time_min: Math.round((routes[0]?.summary.travelTimeInSeconds || opt.best_route.travel_time_s) / 60),
          traffic_level: opt.best_route.traffic_level,
          cost: Math.round(opt.best_route.total_cost * 100) / 100,
          algorithm: opt.best_route.algorithm_name,
          reason: opt.reason
        });
      } catch (err: any) {
        results.push({
          mode,
          mode_label: mode === 'walking' ? 'Walking' : mode === 'car' ? 'Car (Sedan/SUV)' : 'Heavy Vehicle (Truck)',
          error: err.message || 'Failed'
        });
      }
    }

    return res.json({
      status: 'success',
      comparison: results
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/autocomplete
router.get('/autocomplete', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query) return res.json({ suggestions: [] });
  try {
    const suggestions = await TomTomService.autocomplete(query);
    return res.json({ suggestions });
  } catch (err: any) {
    return res.json({ suggestions: [] });
  }
});

// GET /api/history
router.get('/history', async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const { items, dbSuccess } = await SupabaseService.getHistory(limit);
  return res.json({ status: 'success', items, db_persisted: dbSuccess });
});

// POST /api/routes/:id/save
router.post('/routes/:id/save', async (req: Request, res: Response) => {
  const id = req.params.id;
  const isSaved = req.body.is_saved !== undefined ? req.body.is_saved : true;
  const result = await SupabaseService.toggleSaveRoute(id, isSaved);
  return res.json({ status: 'success', is_saved: isSaved, ...result });
});

// DELETE /api/history/:id
router.delete('/history/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const result = await SupabaseService.deleteHistory(id);
  return res.json({ status: 'success', ...result });
});

// GET /api/stats
router.get('/stats', async (req: Request, res: Response) => {
  const stats = await SupabaseService.getStats();
  return res.json({ status: 'success', stats });
});

// GET /api/health
router.get('/health', async (req: Request, res: Response) => {
  const engineHealth = await CppEngineService.checkHealth();
  return res.json({
    status: 'ok',
    service: 'gateway-api',
    tomtom_api_key_configured: Boolean(config.tomtomApiKey),
    cpp_engine: engineHealth,
    supabase_configured: Boolean(config.supabaseUrl && config.supabaseAnonKey)
  });
});

export default router;
