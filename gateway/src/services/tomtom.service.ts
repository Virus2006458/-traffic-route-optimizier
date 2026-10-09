import axios from 'axios';
import { config } from '../config';
import { LocationPoint, TransportMode } from '../types';

export interface TomTomRouteSection {
  startPointIndex: number;
  endPointIndex: number;
  sectionType: string;
  simpleCategory?: string;
  delayInSeconds?: number;
}

export interface TomTomRouteData {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    noTrafficTravelTimeInSeconds: number;
  };
  points: [number, number][]; // [lat, lon]
  sections: TomTomRouteSection[];
}

export const isInsideIndia = (lat: number, lon: number): boolean => {
  return lat >= 6.0 && lat <= 38.5 && lon >= 68.0 && lon <= 98.5;
};

const KNOWN_LANDMARKS: Record<string, LocationPoint> = {
  // Telangana / Hyderabad
  'charminar': { lat: 17.3616, lon: 78.4747, name: 'Charminar, Hyderabad, Telangana (500002)' },
  'hitec city': { lat: 17.4435, lon: 78.3772, name: 'HITEC City, Hyderabad, Telangana (500081)' },
  'gachibowli': { lat: 17.4401, lon: 78.3489, name: 'Gachibowli, Hyderabad, Telangana (500032)' },
  'kondapur': { lat: 17.4646, lon: 78.3666, name: 'Kondapur, Hyderabad, Telangana (500084)' },
  'madhapur': { lat: 17.4483, lon: 78.3915, name: 'Madhapur, Hyderabad, Telangana (500081)' },
  'jubilee hills': { lat: 17.4319, lon: 78.4071, name: 'Jubilee Hills, Hyderabad, Telangana (500033)' },
  'banjara hills': { lat: 17.4156, lon: 78.4347, name: 'Banjara Hills, Hyderabad, Telangana (500034)' },
  'tank bund': { lat: 17.4239, lon: 78.4738, name: 'Tank Bund, Hyderabad, Telangana (500029)' },
  'secunderabad': { lat: 17.4399, lon: 78.4983, name: 'Secunderabad Railway Station (500003)' },
  'hyderabad airport': { lat: 17.2403, lon: 78.4294, name: 'RGIA Airport, Shamshabad, Hyderabad (501218)' },
  'kukatpally': { lat: 17.4849, lon: 78.4138, name: 'Kukatpally, Hyderabad, Telangana (500072)' },
  'miyapur': { lat: 17.4968, lon: 78.3582, name: 'Miyapur, Hyderabad, Telangana (500049)' },

  // Delhi NCR
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi, Delhi (110001)' },
  'connaught place': { lat: 28.6315, lon: 77.2167, name: 'Connaught Place, New Delhi (110001)' },
  'india gate': { lat: 28.6129, lon: 77.2295, name: 'India Gate, New Delhi (110001)' },
  'red fort': { lat: 28.6562, lon: 77.2410, name: 'Red Fort, Chandni Chowk, Delhi (110006)' },
  'delhi airport': { lat: 28.5562, lon: 77.1000, name: 'Indira Gandhi International Airport, New Delhi (110037)' },
  'cyber city': { lat: 28.4950, lon: 77.0895, name: 'Cyber City, DLF Phase 2, Gurugram, Haryana (122002)' },
  'noida sector 18': { lat: 28.5708, lon: 77.3260, name: 'Sector 18, Noida, Uttar Pradesh (201301)' },
  'noida sector 62': { lat: 28.6280, lon: 77.3649, name: 'Sector 62, Noida, Uttar Pradesh (201309)' },

  // Maharashtra / Mumbai / Pune
  'mumbai': { lat: 18.9220, lon: 72.8347, name: 'Mumbai, Maharashtra' },
  'gateway of india': { lat: 18.9220, lon: 72.8347, name: 'Gateway of India, Colaba, Mumbai (400001)' },
  'marine drive': { lat: 18.9432, lon: 72.8230, name: 'Marine Drive, Nariman Point, Mumbai (400021)' },
  'bandra': { lat: 19.0596, lon: 72.8295, name: 'Bandra West, Mumbai, Maharashtra (400050)' },
  'bkc': { lat: 19.0657, lon: 72.8687, name: 'Bandra Kurla Complex (BKC), Mumbai (400051)' },
  'andheri': { lat: 19.1136, lon: 72.8697, name: 'Andheri East, Mumbai, Maharashtra (400069)' },
  'mumbai airport': { lat: 19.0896, lon: 72.8656, name: 'CSM International Airport (T2), Mumbai (400099)' },
  'csmt': { lat: 18.9401, lon: 72.8354, name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Mumbai (400001)' },
  'pune': { lat: 18.5204, lon: 73.8567, name: 'Pune, Maharashtra (411001)' },
  'hinjewadi': { lat: 18.5913, lon: 73.7389, name: 'Hinjewadi IT Park, Pune, Maharashtra (411057)' },
  'koregaon park': { lat: 18.5362, lon: 73.8940, name: 'Koregaon Park, Pune, Maharashtra (411001)' },

  // Karnataka / Bengaluru
  'bengaluru': { lat: 12.9716, lon: 77.5946, name: 'Bengaluru, Karnataka (560001)' },
  'bangalore': { lat: 12.9716, lon: 77.5946, name: 'Bengaluru, Karnataka (560001)' },
  'mg road': { lat: 12.9756, lon: 77.6066, name: 'MG Road, Bengaluru, Karnataka (560001)' },
  'koramangala': { lat: 12.9352, lon: 77.6245, name: 'Koramangala, Bengaluru, Karnataka (560034)' },
  'indiranagar': { lat: 12.9784, lon: 77.6408, name: 'Indiranagar, Bengaluru, Karnataka (560038)' },
  'whitefield': { lat: 12.9698, lon: 77.7500, name: 'Whitefield, Bengaluru, Karnataka (560066)' },
  'electronic city': { lat: 12.8399, lon: 77.6770, name: 'Electronic City Phase 1, Bengaluru (560100)' },
  'bengaluru airport': { lat: 13.1986, lon: 77.7066, name: 'Kempegowda International Airport (BLR), Bengaluru (560300)' },

  // Tamil Nadu / Chennai
  'chennai': { lat: 13.0827, lon: 80.2707, name: 'Chennai, Tamil Nadu (600001)' },
  'marina beach': { lat: 13.0500, lon: 80.2824, name: 'Marina Beach, Chennai, Tamil Nadu (600005)' },
  't nagar': { lat: 13.0418, lon: 80.2341, name: 'T. Nagar, Chennai, Tamil Nadu (600017)' },
  'omr': { lat: 12.9171, lon: 80.2280, name: 'OMR (IT Corridor), Chennai, Tamil Nadu (600096)' },
  'chennai airport': { lat: 12.9941, lon: 80.1709, name: 'Chennai International Airport (MAA) (600027)' },

  // West Bengal / Kolkata
  'kolkata': { lat: 22.5726, lon: 88.3639, name: 'Kolkata, West Bengal (700001)' },
  'howrah bridge': { lat: 22.5851, lon: 88.3468, name: 'Howrah Bridge, Kolkata, West Bengal (700001)' },
  'park street': { lat: 22.5517, lon: 88.3524, name: 'Park Street, Kolkata, West Bengal (700016)' },
  'salt lake': { lat: 22.5744, lon: 88.4338, name: 'Salt Lake Sector V, Kolkata, West Bengal (700091)' },

  // Gujarat / Ahmedabad
  'ahmedabad': { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad, Gujarat (380001)' },
  'sabarmati ashram': { lat: 23.0605, lon: 72.5800, name: 'Sabarmati Ashram, Ahmedabad, Gujarat (380027)' },
  'sg highway': { lat: 23.0537, lon: 72.5152, name: 'SG Highway, Ahmedabad, Gujarat (380054)' },

  // Rajasthan / Jaipur
  'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Jaipur (Pink City), Rajasthan (302001)' },
  'hawa mahal': { lat: 26.9239, lon: 75.8267, name: 'Hawa Mahal, Badi Choupad, Jaipur (302002)' },

  // Uttar Pradesh
  'lucknow': { lat: 26.8467, lon: 80.9462, name: 'Lucknow, Uttar Pradesh (226001)' },
  'taj mahal': { lat: 27.1751, lon: 78.0421, name: 'Taj Mahal, Agra, Uttar Pradesh (282001)' },
  'varanasi': { lat: 25.3176, lon: 82.9739, name: 'Varanasi (Kashi), Uttar Pradesh (221001)' },

  // Kerala / Kochi
  'kochi': { lat: 9.9312, lon: 76.2673, name: 'Kochi (Cochin), Kerala (682001)' },
  'fort kochi': { lat: 9.9658, lon: 76.2421, name: 'Fort Kochi, Kochi, Kerala (682001)' },

  // Goa
  'goa': { lat: 15.2993, lon: 74.1240, name: 'Panaji, Goa (403001)' },
  'panaji': { lat: 15.4909, lon: 73.8278, name: 'Panaji, Goa (403001)' },

  // Punjab / Chandigarh
  'chandigarh': { lat: 30.7333, lon: 76.7794, name: 'Sector 17, Chandigarh (160017)' },

  // Popular Indian PIN codes
  '110001': { lat: 28.6315, lon: 77.2167, name: 'Connaught Place / New Delhi 110001, Delhi' },
  '400001': { lat: 18.9388, lon: 72.8354, name: 'Fort / South Mumbai 400001, Maharashtra' },
  '500001': { lat: 17.3850, lon: 78.4867, name: 'Koti / Hyderabad GPO 500001, Telangana' },
  '500081': { lat: 17.4435, lon: 78.3772, name: 'HITEC City / Madhapur 500081, Telangana' },
  '500084': { lat: 17.4646, lon: 78.3666, name: 'Kondapur / Hyderabad 500084, Telangana' },
  '500032': { lat: 17.4401, lon: 78.3489, name: 'Gachibowli / Hyderabad 500032, Telangana' },
  '500002': { lat: 17.3616, lon: 78.4747, name: 'Charminar / Hyderabad 500002, Telangana' },
  '560001': { lat: 12.9756, lon: 77.6066, name: 'MG Road / Bengaluru GPO 560001, Karnataka' },
  '560066': { lat: 12.9698, lon: 77.7500, name: 'Whitefield / Bengaluru 560066, Karnataka' },
  '560100': { lat: 12.8399, lon: 77.6770, name: 'Electronic City / Bengaluru 560100, Karnataka' },
  '600001': { lat: 13.0827, lon: 80.2707, name: 'George Town / Chennai GPO 600001, Tamil Nadu' },
  '700001': { lat: 22.5726, lon: 88.3639, name: 'BBD Bagh / Kolkata GPO 700001, West Bengal' }
};

export class TomTomService {
  private static apiKey = config.tomtomApiKey;

  public static async geocode(query: string): Promise<LocationPoint> {
    if (!query || query.trim() === '') {
      throw new Error('Location query cannot be empty.');
    }

    const coordMatch = query.match(/^([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lon: parseFloat(coordMatch[2]),
        name: `Location (${coordMatch[1]}, ${coordMatch[2]})`
      };
    }

    const normalized = query.toLowerCase().trim();
    for (const [key, loc] of Object.entries(KNOWN_LANDMARKS)) {
      if (normalized === key || normalized.includes(key)) {
        return loc;
      }
    }

    if (this.apiKey) {
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${this.apiKey}&countrySet=IN&limit=5`;
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data?.results?.length > 0) {
          for (const item of res.data.results) {
            if (item.position && isInsideIndia(item.position.lat, item.position.lon)) {
              const freeform = item.address?.freeformAddress || query;
              const displayName = freeform.toLowerCase().includes('india') ? freeform : `${freeform}, India`;
              return {
                lat: item.position.lat,
                lon: item.position.lon,
                name: displayName
              };
            }
          }
        }
      } catch (err: any) {
        console.warn(`[TomTom Geocode Warning] API call failed (${err.message}). Using fallback.`);
      }
    }

    return this.fallbackGeocode(query);
  }

  public static async autocomplete(query: string): Promise<LocationPoint[]> {
    if (!query || query.trim().length < 2) return [];

    const results: LocationPoint[] = [];
    const norm = query.toLowerCase().trim();
    const isPincode = /^\d{5,6}$/.test(norm);

    // 1. Match local landmark or pincode presets across India
    for (const [key, loc] of Object.entries(KNOWN_LANDMARKS)) {
      if (key.includes(norm) || loc.name?.toLowerCase().includes(norm)) {
        results.push(loc);
      }
    }

    // 2. Fetch live suggestions from TomTom Search V2 API RESTRICTED TO INDIA
    if (this.apiKey) {
      try {
        const extraParams = isPincode
          ? '&idxSet=Geo,PAD,Postal'
          : '&idxSet=Geo,PAD,Addr,POI,Str,Postal';
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${this.apiKey}&countrySet=IN&limit=10&typeahead=true${extraParams}`;
        const res = await axios.get(url, { timeout: 5000 });
        if (res.data?.results) {
          for (const item of res.data.results) {
            if (item.position && item.address?.freeformAddress && isInsideIndia(item.position.lat, item.position.lon)) {
              const freeform = item.address.freeformAddress;
              const postal = item.address.postalCode;
              const baseName = postal && !freeform.includes(postal)
                ? `${freeform} (${postal})`
                : freeform;
              const displayName = baseName.toLowerCase().includes('india') ? baseName : `${baseName}, India`;

              if (!results.some(r => r.name?.toLowerCase() === displayName.toLowerCase() || (Math.abs(r.lat - item.position.lat) < 0.001 && Math.abs(r.lon - item.position.lon) < 0.001))) {
                results.push({
                  lat: item.position.lat,
                  lon: item.position.lon,
                  name: displayName
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[TomTom Autocomplete Error] ${err.message}`);
      }
    }

    // Ensure all returned results are strictly inside India
    return results.filter(r => isInsideIndia(r.lat, r.lon)).slice(0, 10);
  }

  public static areRoutesDuplicate(r1: TomTomRouteData, r2: TomTomRouteData): boolean {
    const d1 = r1.summary.lengthInMeters;
    const d2 = r2.summary.lengthInMeters;
    const diffRatio = Math.abs(d1 - d2) / Math.max(d1, d2);
    // If length differs by more than 1%, they are not duplicates
    if (diffRatio > 0.01) return false;

    // Check overlap: sample points from r1 and see if >= 90% are within 35m of r2
    const pts1 = r1.points;
    const pts2 = r2.points;
    if (pts1.length === 0 || pts2.length === 0) return false;

    const sampleCount = Math.min(50, pts1.length);
    const step = Math.max(1, Math.floor(pts1.length / sampleCount));
    let matchingPoints = 0;
    let totalSampled = 0;

    for (let i = 0; i < pts1.length; i += step) {
      const p1 = pts1[i];
      totalSampled++;
      let minDistance = Infinity;
      const searchStep = Math.max(1, Math.floor(pts2.length / 100));
      for (let j = 0; j < pts2.length; j += searchStep) {
        const p2 = pts2[j];
        const dist = this.haversineMeters(p1[0], p1[1], p2[0], p2[1]);
        if (dist < minDistance) minDistance = dist;
        if (minDistance < 25) break;
      }
      if (minDistance <= 35) {
        matchingPoints++;
      }
    }

    const overlap = totalSampled > 0 ? (matchingPoints / totalSampled) : 0;
    return overlap >= 0.90;
  }

  public static async fetchRoutes(
    start: LocationPoint,
    end: LocationPoint,
    mode: TransportMode,
    vehicleSpecs?: Record<string, any>
  ): Promise<{ routes: TomTomRouteData[]; liveTrafficUsed: boolean }> {
    if (!this.apiKey) {
      return {
        routes: this.generateSyntheticRoutes(start, end, mode),
        liveTrafficUsed: false
      };
    }

    try {
      const travelModeMap: Record<TransportMode, string> = {
        walking: 'pedestrian',
        car: 'car',
        heavy: 'truck'
      };

      const baseParams: Record<string, any> = {
        key: this.apiKey,
        travelMode: travelModeMap[mode],
        traffic: 'true',
        sectionType: 'traffic',
        computeTravelTimeFor: 'all'
      };

      if (mode === 'heavy') {
        baseParams.vehicleWeight = vehicleSpecs?.vehicleWeight || 12000;
        baseParams.vehicleAxleWeight = vehicleSpecs?.vehicleAxleWeight || 8000;
        baseParams.vehicleLength = vehicleSpecs?.vehicleLength || 10;
        baseParams.vehicleWidth = vehicleSpecs?.vehicleWidth || 2.5;
        baseParams.vehicleHeight = vehicleSpecs?.vehicleHeight || 3.8;
        baseParams.vehicleCommercial = 'true';
      }

      const shortestParams = {
        ...baseParams,
        routeType: 'shortest',
        maxAlternatives: 0
      };

      const fastestParams = {
        ...baseParams,
        routeType: 'fastest',
        maxAlternatives: 2
      };

      const url = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json`;

      // Fetch shortest route and fastest + alternatives in parallel
      const [shortestRes, fastestRes] = await Promise.allSettled([
        axios.get(url, { params: shortestParams, timeout: 12000 }),
        axios.get(url, { params: fastestParams, timeout: 12000 })
      ]);

      const candidateRoutes: TomTomRouteData[] = [];

      // 1. Process shortest distance candidate
      if (shortestRes.status === 'fulfilled' && shortestRes.value.data?.routes?.length > 0) {
        const sr = shortestRes.value.data.routes[0];
        const sPoints: [number, number][] = sr.legs.flatMap((leg: any) =>
          leg.points.map((pt: any) => [pt.latitude, pt.longitude] as [number, number])
        );
        candidateRoutes.push({
          summary: {
            lengthInMeters: sr.summary.lengthInMeters,
            travelTimeInSeconds: sr.summary.travelTimeInSeconds,
            trafficDelayInSeconds: sr.summary.trafficDelayInSeconds || 0,
            noTrafficTravelTimeInSeconds: sr.summary.noTrafficTravelTimeInSeconds || sr.summary.travelTimeInSeconds
          },
          points: sPoints,
          sections: sr.sections || []
        });
      }

      // 2. Process fastest candidates + alternatives (max 2)
      if (fastestRes.status === 'fulfilled' && fastestRes.value.data?.routes?.length > 0) {
        for (const fr of fastestRes.value.data.routes) {
          const fPoints: [number, number][] = fr.legs.flatMap((leg: any) =>
            leg.points.map((pt: any) => [pt.latitude, pt.longitude] as [number, number])
          );
          const fRoute: TomTomRouteData = {
            summary: {
              lengthInMeters: fr.summary.lengthInMeters,
              travelTimeInSeconds: fr.summary.travelTimeInSeconds,
              trafficDelayInSeconds: fr.summary.trafficDelayInSeconds || 0,
              noTrafficTravelTimeInSeconds: fr.summary.noTrafficTravelTimeInSeconds || fr.summary.travelTimeInSeconds
            },
            points: fPoints,
            sections: fr.sections || []
          };

          // Filter duplicates (within 1% distance and >= 90% geometric overlap)
          const isDup = candidateRoutes.some(existing => this.areRoutesDuplicate(existing, fRoute));
          if (!isDup) {
            candidateRoutes.push(fRoute);
          }
          if (candidateRoutes.length >= 3) break;
        }
      }

      // Ensure the shortest distance candidate is at index 0
      if (candidateRoutes.length > 1) {
        let minLenIdx = 0;
        for (let i = 1; i < candidateRoutes.length; i++) {
          if (candidateRoutes[i].summary.lengthInMeters < candidateRoutes[minLenIdx].summary.lengthInMeters) {
            minLenIdx = i;
          }
        }
        if (minLenIdx !== 0) {
          const temp = candidateRoutes[0];
          candidateRoutes[0] = candidateRoutes[minLenIdx];
          candidateRoutes[minLenIdx] = temp;
        }
      }

      if (candidateRoutes.length > 0) {
        return { routes: candidateRoutes.slice(0, 3), liveTrafficUsed: true };
      }
    } catch (err: any) {
      console.warn(`[TomTom Route Warning] Route API call failed (${err.message}). Using synthetic routing.`);
    }

    return {
      routes: this.generateSyntheticRoutes(start, end, mode),
      liveTrafficUsed: false
    };
  }

  private static fallbackGeocode(query: string): LocationPoint {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = (hash << 5) - hash + query.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 100) / 1000) - 0.05;
    const lonOffset = (((Math.abs(hash) >> 2) % 100) / 1000) - 0.05;
    return {
      lat: 17.3850 + latOffset,
      lon: 78.4867 + lonOffset,
      name: query
    };
  }

  public static generateSyntheticRoutes(start: LocationPoint, end: LocationPoint, mode: TransportMode): TomTomRouteData[] {
    const directDist = this.haversineMeters(start.lat, start.lon, end.lat, end.lon);
    const speedMs = (mode === 'walking') ? 1.4 : (mode === 'car') ? 12.5 : 9.0;
    const numPoints = Math.max(40, Math.ceil(directDist / 75));

    const routes: TomTomRouteData[] = [];

    // Route 1: Shortest distance, direct road corridor, moderate traffic delay
    const points1 = this.interpolatePath(start, end, numPoints, 0.0);
    const dist1 = directDist * 1.03;
    const freeTime1 = Math.round(dist1 / speedMs);
    const delay1 = (mode === 'car' || mode === 'heavy') ? Math.round(freeTime1 * 0.40) : 0;
    routes.push({
      summary: {
        lengthInMeters: Math.round(dist1),
        travelTimeInSeconds: freeTime1 + delay1,
        trafficDelayInSeconds: delay1,
        noTrafficTravelTimeInSeconds: freeTime1
      },
      points: points1,
      sections: (mode !== 'walking') ? [{
        startPointIndex: Math.floor(numPoints * 0.3),
        endPointIndex: Math.floor(numPoints * 0.6),
        sectionType: 'TRAFFIC',
        simpleCategory: 'SLOW',
        delayInSeconds: delay1
      }] : []
    });

    // Route 2: Faster bypass/expressway, slightly longer (+1.5 km), minimal delay
    const points2 = this.interpolatePath(start, end, numPoints, 0.008);
    const dist2 = directDist * 1.12;
    const freeTime2 = Math.round(dist2 / (speedMs * 1.3));
    const delay2 = Math.round(freeTime2 * 0.05);
    routes.push({
      summary: {
        lengthInMeters: Math.round(dist2),
        travelTimeInSeconds: freeTime2 + delay2,
        trafficDelayInSeconds: delay2,
        noTrafficTravelTimeInSeconds: freeTime2
      },
      points: points2,
      sections: [{
        startPointIndex: Math.floor(numPoints * 0.4),
        endPointIndex: Math.floor(numPoints * 0.5),
        sectionType: 'TRAFFIC',
        simpleCategory: 'SLOW',
        delayInSeconds: delay2
      }]
    });

    // Route 3: Outer ring alternative
    const points3 = this.interpolatePath(start, end, numPoints, -0.012);
    const dist3 = directDist * 1.22;
    const freeTime3 = Math.round(dist3 / (speedMs * 1.35));
    const delay3 = Math.round(freeTime3 * 0.03);
    routes.push({
      summary: {
        lengthInMeters: Math.round(dist3),
        travelTimeInSeconds: freeTime3 + delay3,
        trafficDelayInSeconds: delay3,
        noTrafficTravelTimeInSeconds: freeTime3
      },
      points: points3,
      sections: []
    });

    return routes;
  }

  private static interpolatePath(
    start: LocationPoint,
    end: LocationPoint,
    numPoints: number,
    curveOffset: number
  ): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const lat = start.lat + (end.lat - start.lat) * t;
      const lon = start.lon + (end.lon - start.lon) * t;
      const perpLat = -(end.lon - start.lon);
      const perpLon = (end.lat - start.lat);
      // Smooth sinusoidal offset with gentle harmonic
      const factor = Math.sin(t * Math.PI) * curveOffset + Math.sin(t * 2 * Math.PI) * (curveOffset * 0.35);
      pts.push([lat + perpLat * factor, lon + perpLon * factor]);
    }
    return pts;
  }

  public static haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
