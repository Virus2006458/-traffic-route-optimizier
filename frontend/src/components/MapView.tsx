import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RouteResult, LocationPoint } from '../types';
import { Eye, Layers, MapPin } from 'lucide-react';

interface MapViewProps {
  startLocation?: LocationPoint;
  destLocation?: LocationPoint;
  activeRoute?: RouteResult;
  shortestRoute?: RouteResult;
  alternatives?: RouteResult[];
  onSelectRoute?: (route: RouteResult) => void;
  showTrafficColors: boolean;
  setShowTrafficColors: (val: boolean) => void;
  showTrafficTiles: boolean;
  setShowTrafficTiles: (val: boolean) => void;
}

// Auto fit map to route bounds while preventing the floating side panel from covering it
const MapAutoFit: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) {
      const bounds = L.latLngBounds(points);
      const isDesktop = window.innerWidth >= 768;
      map.fitBounds(bounds, {
        paddingTopLeft: isDesktop ? [40, 470] : [30, 30],
        paddingBottomRight: isDesktop ? [40, 50] : [30, 30],
        maxZoom: 15
      });
    }
  }, [map, points]);
  return null;
};

// Google Maps Style Start Marker: White circle with dark border
const startIcon = L.divIcon({
  className: 'gmaps-start-pin',
  html: `<div style="width: 18px; height: 18px; background: #ffffff; border: 4px solid #202124; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

// Google Maps Style Destination Pin: Red teardrop pin with white center dot
const endIcon = L.divIcon({
  className: 'gmaps-dest-pin',
  html: `
    <div style="width: 27px; height: 38px; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.45));">
      <svg viewBox="0 0 27 41" width="27" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 0C6.044 0 0 6.044 0 13.5C0 23.625 13.5 41 13.5 41C13.5 41 27 23.625 27 13.5C27 6.044 20.956 0 13.5 0Z" fill="#EA4335" stroke="#B31412" stroke-width="0.8"/>
        <circle cx="13.5" cy="13.5" r="5.5" fill="#FFFFFF"/>
      </svg>
    </div>
  `,
  iconSize: [27, 38],
  iconAnchor: [13.5, 38]
});

// Waypoint dot: Small white dot with blue border for major turns (max 10)
const waypointIcon = L.divIcon({
  className: 'gmaps-waypoint-dot',
  html: `<div class="gmaps-dot-inner"></div>`,
  iconSize: [9, 9],
  iconAnchor: [4.5, 4.5]
});

// Google Maps Style Route Label Box: "🚗 19 min" bold line 1, "12.4 km" grey line 2
const createRouteLabelIcon = (travelTimeMin: number, distKm: string, isSelected: boolean) => {
  const formattedTime = travelTimeMin >= 60
    ? `${Math.floor(travelTimeMin / 60)} hr ${travelTimeMin % 60} min`
    : `${travelTimeMin} min`;

  const borderClass = isSelected ? 'gmaps-label-selected' : 'gmaps-label-alt';

  return L.divIcon({
    className: 'gmaps-route-label',
    html: `
      <div class="gmaps-label-box ${borderClass}">
        <div class="gmaps-label-time">
          <span class="gmaps-label-icon">🚗</span>
          <span class="gmaps-label-text">${formattedTime}</span>
        </div>
        <div class="gmaps-label-dist">${distKm} km</div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Calculate approximate distance between two lat/lon points (in km)
const getDistanceBetween = (p1: [number, number], p2: [number, number]): number => {
  const latDiff = (p1[0] - p2[0]) * 111.32;
  const avgLatRad = ((p1[0] + p2[0]) / 2) * (Math.PI / 180);
  const lonDiff = (p1[1] - p2[1]) * 111.32 * Math.cos(avgLatRad);
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
};

// Distance from a point to a polyline (in km)
const getDistanceToPolyline = (pt: [number, number], polyline: [number, number][]): number => {
  if (!polyline || polyline.length === 0) return 999;
  let minDist = 999;
  const step = Math.max(1, Math.floor(polyline.length / 50));
  for (let i = 0; i < polyline.length; i += step) {
    const d = getDistanceBetween(pt, polyline[i]);
    if (d < minDist) minDist = d;
  }
  return minDist;
};

// Get a point along polyline at a target fraction of its total cumulative distance
const getPointAtFraction = (pts: [number, number][], fraction: number = 0.5): [number, number] | null => {
  if (!pts || pts.length === 0) return null;
  if (pts.length === 1) return pts[0];

  let totalDist = 0;
  const dists: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    totalDist += getDistanceBetween(pts[i - 1], pts[i]);
    dists.push(totalDist);
  }

  if (totalDist === 0) return pts[Math.floor(pts.length / 2)];

  const targetDist = totalDist * Math.max(0.1, Math.min(0.9, fraction));
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= targetDist) {
      return pts[i];
    }
  }
  return pts[Math.floor(pts.length / 2)];
};

export const MapView: React.FC<MapViewProps> = ({
  startLocation,
  destLocation,
  activeRoute,
  shortestRoute,
  alternatives = [],
  onSelectRoute,
  showTrafficColors,
  setShowTrafficColors,
  showTrafficTiles,
  setShowTrafficTiles
}) => {
  const defaultCenter: [number, number] = [17.3850, 78.4867];

  // Candidates list (at most 3 routes)
  const candidateRoutes = useMemo(() => {
    if (alternatives && alternatives.length > 0) {
      return alternatives.slice(0, 3);
    }
    const list: RouteResult[] = [];
    if (shortestRoute) list.push(shortestRoute);
    if (activeRoute && !list.some(r => r.route_id === activeRoute.route_id)) {
      list.push(activeRoute);
    }
    return list.slice(0, 3);
  }, [alternatives, shortestRoute, activeRoute]);

  // Selected route: defaults to shortestRoute, or activeRoute, or candidates[0]
  const selectedRoute = useMemo(() => {
    if (activeRoute) return activeRoute;
    if (shortestRoute) return shortestRoute;
    return candidateRoutes[0];
  }, [activeRoute, shortestRoute, candidateRoutes]);

  // Non-selected alternative routes (max 2)
  const altRoutes = useMemo(() => {
    if (!selectedRoute) return [];
    return candidateRoutes.filter(
      r => r.route_id !== selectedRoute.route_id &&
           Math.abs(r.distance_m - selectedRoute.distance_m) > 10
    ).slice(0, 2);
  }, [candidateRoutes, selectedRoute]);

  const selectedPoints = selectedRoute?.polyline || [];

  const startPt: [number, number] = startLocation
    ? [startLocation.lat, startLocation.lon]
    : (selectedPoints[0] || defaultCenter);

  const endPt: [number, number] = destLocation
    ? [destLocation.lat, destLocation.lon]
    : (selectedPoints[selectedPoints.length - 1] || defaultCenter);

  // Google Maps Style: Smart Route Label Positioning with anti-collision
  const { selectedLabelPos, altLabelPositions } = useMemo(() => {
    if (!selectedRoute || selectedPoints.length < 2) {
      return { selectedLabelPos: null, altLabelPositions: [] };
    }

    // 1. Position selected route label near 48% distance along its route
    const selPos = getPointAtFraction(selectedPoints, 0.48) || selectedPoints[Math.floor(selectedPoints.length / 2)];
    const placed: [number, number][] = selPos ? [selPos] : [];

    // 2. Candidate fractions along alternative routes to test
    const candidateFractions = [0.28, 0.72, 0.20, 0.80, 0.38, 0.62, 0.15, 0.85, 0.50];

    const altPositions: ([number, number] | null)[] = altRoutes.map((alt) => {
      if (!alt.polyline || alt.polyline.length === 0) return null;

      let bestPt: [number, number] | null = null;
      let bestScore = -Infinity;

      for (const frac of candidateFractions) {
        const pt = getPointAtFraction(alt.polyline, frac);
        if (!pt) continue;

        // Check distance to all already placed labels (in km)
        let minDistToPlaced = 999;
        for (const p of placed) {
          const d = getDistanceBetween(pt, p);
          if (d < minDistToPlaced) minDistToPlaced = d;
        }

        // Distance from this point to the selected route polyline
        const distToSelected = getDistanceToPolyline(pt, selectedPoints);

        // Scoring: prefer points that are well-separated from other labels (>= 1.5 km safe margin)
        // and located along sections where the alternative diverges from the selected route
        let score = distToSelected * 3;
        if (minDistToPlaced < 1.5) {
          score -= (1.5 - minDistToPlaced) * 60;
        } else {
          score += minDistToPlaced * 2;
        }

        if (score > bestScore) {
          bestScore = score;
          bestPt = pt;
        }
      }

      if (!bestPt) {
        bestPt = getPointAtFraction(alt.polyline, 0.25) || alt.polyline[0];
      }

      // If still within 1.0 km of any placed label, shift perpendicular to prevent visual overlap
      let closestDist = 999;
      let closestPt: [number, number] | null = null;
      for (const p of placed) {
        const d = getDistanceBetween(bestPt, p);
        if (d < closestDist) {
          closestDist = d;
          closestPt = p;
        }
      }

      if (closestDist < 1.0 && closestPt) {
        const offsetLat = bestPt[0] >= closestPt[0] ? 0.006 : -0.006;
        const offsetLon = bestPt[1] >= closestPt[1] ? 0.006 : -0.006;
        bestPt = [bestPt[0] + offsetLat, bestPt[1] + offsetLon];
      }

      placed.push(bestPt);
      return bestPt;
    });

    return {
      selectedLabelPos: selPos,
      altLabelPositions: altPositions
    };
  }, [selectedRoute, selectedPoints, altRoutes]);

  const metaEnv = (import.meta as any).env || {};
  const tomtomKey = metaEnv.VITE_TOMTOM_MAP_KEY || 'ExmCsetZ8gLYwdCOtm1h1XyPQupLrYLs';

  const baseTileUrl = tomtomKey && tomtomKey !== 'dummy_key'
    ? `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey}`
    : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;

  const tomtomTrafficFlowUrl = tomtomKey && tomtomKey !== 'dummy_key'
    ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${tomtomKey}`
    : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;

  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'Severe': return '#EA4335';   // Google Red
      case 'High': return '#FF6D00';     // Google Orange
      case 'Moderate': return '#FBBC04'; // Google Yellow
      case 'Low':
      default: return '#34A853';        // Google Green
    }
  };

  const selectedTimeMin = selectedRoute ? Math.round(selectedRoute.travel_time_s / 60) : 0;
  const selectedDistKm = selectedRoute ? (selectedRoute.distance_m / 1000).toFixed(1) : '0';

  // Major turn waypoints (max 10)
  const waypoints = useMemo(() => {
    if (!selectedRoute?.waypoints || selectedRoute.waypoints.length === 0) return [];
    return selectedRoute.waypoints.slice(0, 10);
  }, [selectedRoute]);

  const INDIA_BOUNDS: [[number, number], [number, number]] = [
    [6.0, 68.0],
    [38.0, 98.0]
  ];

  return (
    <div className="relative w-full h-full min-h-[450px]">
      <MapContainer
        center={startPt}
        zoom={12}
        minZoom={4}
        maxBounds={INDIA_BOUNDS}
        maxBoundsViscosity={0.75}
        zoomControl={false}
        className="w-full h-full"
      >
        {/* TomTom Map Base Layer */}
        <TileLayer
          url={baseTileUrl}
          attribution='&copy; <a href="https://www.tomtom.com/">TomTom Maps</a>'
        />

        {/* Optional Traffic Flow Overlay */}
        {showTrafficTiles && (
          <TileLayer
            url={tomtomTrafficFlowUrl}
            opacity={0.65}
          />
        )}

        {/* Auto fit map to selected route bounds with side panel padding */}
        {selectedPoints.length > 1 && <MapAutoFit points={selectedPoints} />}

        {/* 1. ALTERNATIVE ROUTES (Max 2, drawn UNDERNEATH the selected route) */}
        {altRoutes.map((alt, idx) => {
          const altLabelPt = altLabelPositions[idx];
          const altTimeMin = Math.round(alt.travel_time_s / 60);
          const altDistKm = (alt.distance_m / 1000).toFixed(1);

          return (
            <React.Fragment key={`alt_group_${alt.route_id || idx}`}>
              {/* Outer Outline: #5F8FD9 (weight 9) */}
              <Polyline
                positions={alt.polyline}
                pathOptions={{
                  color: '#5F8FD9',
                  weight: 9,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
                eventHandlers={{
                  click: () => onSelectRoute?.(alt)
                }}
              />

              {/* Main Line: #8AB4F8 (weight 6) */}
              <Polyline
                positions={alt.polyline}
                pathOptions={{
                  color: '#8AB4F8',
                  weight: 6,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
                eventHandlers={{
                  click: () => onSelectRoute?.(alt)
                }}
              />

              {/* Google Maps Alternative Route Label Box (Anti-collision positioned) */}
              {altLabelPt && (
                <Marker
                  position={altLabelPt}
                  icon={createRouteLabelIcon(altTimeMin, altDistKm, false)}
                  zIndexOffset={500}
                  eventHandlers={{
                    click: () => onSelectRoute?.(alt)
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* 2. SELECTED ROUTE (Drawn ON TOP of everything) */}
        {selectedRoute && selectedPoints.length > 1 && (
          <>
            {showTrafficColors && selectedRoute.edge_segments && selectedRoute.edge_segments.length > 0 ? (
              // Traffic Colours ON: Outline in #0B57D0, segments colored by traffic level
              <>
                <Polyline
                  positions={selectedPoints}
                  pathOptions={{
                    color: '#0B57D0',
                    weight: 10,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }}
                />
                {selectedRoute.edge_segments.map((seg, sIdx) => {
                  const segPts = seg.geometry && seg.geometry.length > 1
                    ? seg.geometry
                    : [
                        [selectedPoints[sIdx]?.[0] || startPt[0], selectedPoints[sIdx]?.[1] || startPt[1]],
                        [selectedPoints[sIdx + 1]?.[0] || endPt[0], selectedPoints[sIdx + 1]?.[1] || endPt[1]]
                      ] as [number, number][];

                  return (
                    <Polyline
                      key={`traffic_seg_${seg.id || sIdx}`}
                      positions={segPts}
                      pathOptions={{
                        color: getTrafficColor(seg.traffic_level),
                        weight: 7,
                        opacity: 1.0,
                        lineCap: 'round',
                        lineJoin: 'round'
                      }}
                    />
                  );
                })}
              </>
            ) : (
              // Default Google Maps Style: Dark blue outline #0B57D0 (weight 10), solid dark blue #1A73E8 (weight 7)
              <>
                {/* Darker Outline Underneath */}
                <Polyline
                  positions={selectedPoints}
                  pathOptions={{
                    color: '#0B57D0',
                    weight: 10,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }}
                />
                {/* Solid Dark Blue Main Line */}
                <Polyline
                  positions={selectedPoints}
                  pathOptions={{
                    color: '#1A73E8',
                    weight: 7,
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }}
                />
              </>
            )}

            {/* Waypoint dots at major turns only (max 10) */}
            {waypoints.map((wp, wIdx) => (
              <Marker
                key={`wp_${wp.id || wIdx}`}
                position={[wp.lat, wp.lon]}
                icon={waypointIcon}
                zIndexOffset={100}
                interactive={false}
              />
            ))}

            {/* Google Maps Selected Route Label Box (Blue border, top z-index) */}
            {selectedLabelPos && (
              <Marker
                position={selectedLabelPos}
                icon={createRouteLabelIcon(selectedTimeMin, selectedDistKm, true)}
                zIndexOffset={1000}
                interactive={false}
              />
            )}
          </>
        )}

        {/* 3. Start Marker (From): White circle with dark border */}
        {startLocation && (
          <Marker position={[startLocation.lat, startLocation.lon]} icon={startIcon}>
            <Popup>
              <div className="text-xs font-semibold text-slate-900">
                <div className="text-blue-600 font-bold">Start (From)</div>
                <div>{startLocation.name || `${startLocation.lat}, ${startLocation.lon}`}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 4. Destination Marker (To): Classic Google Maps Red Pin */}
        {destLocation && (
          <Marker position={[destLocation.lat, destLocation.lon]} icon={endIcon}>
            <Popup>
              <div className="text-xs font-semibold text-slate-900">
                <div className="text-rose-600 font-bold">Destination (To)</div>
                <div>{destLocation.name || `${destLocation.lat}, ${destLocation.lon}`}</div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Map Control Toggles Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        <div className="glass-panel px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-300 border border-slate-700 flex items-center justify-between gap-1.5 shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">🇮🇳</span>
            <span>India Nationwide</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>

        <div className="glass-panel px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-md">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>TomTom Road Geometry</span>
        </div>

        <button
          type="button"
          onClick={() => setShowTrafficColors(!showTrafficColors)}
          className={`px-3 py-2 rounded-xl text-xs font-bold glass-panel border flex items-center gap-2 shadow-lg transition-all ${
            showTrafficColors
              ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30'
              : 'text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showTrafficColors ? 'Traffic Colours: ON' : 'Traffic Colours (OFF)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowTrafficTiles(!showTrafficTiles)}
          className={`px-3 py-2 rounded-xl text-xs font-bold glass-panel border flex items-center gap-2 shadow-lg transition-all ${
            showTrafficTiles
              ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30'
              : 'text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showTrafficTiles ? 'Traffic Flow: ON' : 'Traffic Flow'}</span>
        </button>
      </div>
    </div>
  );
};
