import { GraphPayload, GraphNode, GraphEdge, TransportMode } from '../types';
import { TomTomRouteData, TomTomService } from './tomtom.service';

interface NodeWithBearing extends GraphNode {
  bearing?: number; // Heading in degrees 0-360
}

export class GraphBuilder {
  /**
   * Computes compass bearing in degrees (0-360) from pt1 to pt2.
   */
  private static computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /**
   * Computes angular difference between two compass bearings.
   */
  private static bearingDifference(b1: number, b2: number): number {
    const diff = Math.abs(b1 - b2) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  /**
   * Builds a unified node-edge graph from candidate polylines and traffic sections.
   * Every Edge stores its FULL original road geometry (no Douglas-Peucker point deletion).
   * Only merges nodes that are the exact same point or within 5 m AND on the same road direction.
   */
  public static buildGraphFromRoutes(
    routes: TomTomRouteData[],
    mode: TransportMode
  ): { graph: GraphPayload; startNodeId: string; targetNodeId: string } {
    const rawNodes: NodeWithBearing[] = [];
    const edges: GraphEdge[] = [];
    let globalNodeCounter = 0;
    let edgeCounter = 0;

    const findOrCreateNode = (lat: number, lon: number, bearing?: number): NodeWithBearing => {
      for (const node of rawNodes) {
        const dist = TomTomService.haversineMeters(node.lat, node.lon, lat, lon);
        // Exact same point (< 0.5m)
        if (dist <= 0.5) {
          return node;
        }
        // Within 5 meters AND same road direction (<= 35 degrees)
        if (dist <= 5.0) {
          if (bearing === undefined || node.bearing === undefined) {
            return node;
          }
          if (this.bearingDifference(node.bearing, bearing) <= 35) {
            return node;
          }
        }
      }

      globalNodeCounter++;
      const newNode: NodeWithBearing = {
        id: `N_${globalNodeCounter}`,
        lat,
        lon,
        bearing
      };
      rawNodes.push(newNode);
      return newNode;
    };

    if (routes.length === 0 || routes[0].points.length === 0) {
      return {
        graph: { nodes: [], edges: [] },
        startNodeId: '',
        targetNodeId: ''
      };
    }

    const startPt = routes[0].points[0];
    const endPt = routes[0].points[routes[0].points.length - 1];

    const startNode = findOrCreateNode(startPt[0], startPt[1]);
    const targetNode = findOrCreateNode(endPt[0], endPt[1]);

    const startNodeId = startNode.id;
    const targetNodeId = targetNode.id;

    const freeFlowSpeedMs = (mode === 'walking') ? 1.4 : (mode === 'car') ? 13.5 : 9.5;

    for (let rIdx = 0; rIdx < routes.length; rIdx++) {
      const route = routes[rIdx];
      const pts = route.points;
      if (pts.length < 2) continue;

      // Make sure start and end nodes of route connect to trip start and destination
      const routeStartNode = (rIdx === 0)
        ? startNode
        : (TomTomService.haversineMeters(pts[0][0], pts[0][1], startPt[0], startPt[1]) <= 15)
          ? startNode
          : findOrCreateNode(pts[0][0], pts[0][1]);

      const lastPtIdx = pts.length - 1;
      const routeEndNode = (rIdx === 0)
        ? targetNode
        : (TomTomService.haversineMeters(pts[lastPtIdx][0], pts[lastPtIdx][1], endPt[0], endPt[1]) <= 15)
          ? targetNode
          : findOrCreateNode(pts[lastPtIdx][0], pts[lastPtIdx][1]);

      // Divide route into chunks of 15 to 25 points, preserving ALL geometry points
      const pointsPerEdge = 20;
      let prevNode = routeStartNode;

      for (let i = 0; i < pts.length - 1; i += pointsPerEdge) {
        const segStartIdx = i;
        const segEndIdx = Math.min(pts.length - 1, i + pointsPerEdge);
        if (segEndIdx <= segStartIdx) break;

        // Extract FULL original road geometry for this edge
        const edgeGeometry: [number, number][] = pts.slice(segStartIdx, segEndIdx + 1);

        const isLastSegment = (segEndIdx === pts.length - 1);
        const currPt = pts[segEndIdx];

        let currNode: NodeWithBearing;
        if (isLastSegment) {
          currNode = routeEndNode;
        } else {
          const bearing = this.computeBearing(
            pts[segEndIdx - 1][0], pts[segEndIdx - 1][1],
            currPt[0], currPt[1]
          );
          currNode = findOrCreateNode(currPt[0], currPt[1], bearing);
        }

        if (prevNode.id === currNode.id) continue;

        // Calculate accurate length along the geometry
        let length_m = 0;
        for (let g = 0; g < edgeGeometry.length - 1; g++) {
          length_m += TomTomService.haversineMeters(
            edgeGeometry[g][0], edgeGeometry[g][1],
            edgeGeometry[g + 1][0], edgeGeometry[g + 1][1]
          );
        }
        length_m = Math.max(10.0, Math.round(length_m * 10) / 10);

        const free_flow_time_s = Math.round((length_m / freeFlowSpeedMs) * 10) / 10;

        // Evaluate traffic level along this segment from TomTom sections
        let trafficLevel: 'Low' | 'Moderate' | 'High' | 'Severe' = 'Low';
        let delayFactor = 1.0;

        if (route.sections && route.sections.length > 0 && mode !== 'walking') {
          for (const sec of route.sections) {
            // Check index overlap
            if (sec.startPointIndex <= segEndIdx && sec.endPointIndex >= segStartIdx) {
              const secDelay = sec.delayInSeconds || 0;
              if (secDelay > 180 || sec.simpleCategory === 'JAM') {
                trafficLevel = 'Severe';
                delayFactor = Math.max(delayFactor, 2.8);
              } else if (secDelay > 60 || sec.simpleCategory === 'SLOW') {
                trafficLevel = 'High';
                delayFactor = Math.max(delayFactor, 1.8);
              } else if (secDelay > 15) {
                trafficLevel = 'Moderate';
                delayFactor = Math.max(delayFactor, 1.3);
              }
            }
          }
        }

        // If route summary indicates overall traffic delay and no specific section tagged
        if (trafficLevel === 'Low' && route.summary.trafficDelayInSeconds > 60 && mode !== 'walking') {
          const ratio = route.summary.trafficDelayInSeconds / Math.max(1, route.summary.noTrafficTravelTimeInSeconds);
          if (ratio > 0.5) {
            // Congested corridor in the central half of the route
            if (segStartIdx > pts.length * 0.2 && segEndIdx < pts.length * 0.8) {
              trafficLevel = (rIdx === 0) ? 'Severe' : 'Moderate';
              delayFactor = (rIdx === 0) ? 2.5 : 1.4;
            }
          } else if (ratio > 0.15) {
            trafficLevel = 'Moderate';
            delayFactor = 1.25;
          }
        }

        const travel_time_s = Math.round(free_flow_time_s * delayFactor * 10) / 10;
        const road_class = (length_m > 1200) ? 'primary' : (length_m > 400) ? 'secondary' : 'residential';
        const truck_allowed = !(mode === 'heavy' && road_class === 'residential');

        edgeCounter++;
        edges.push({
          id: `E_R${rIdx + 1}_${edgeCounter}`,
          from: prevNode.id,
          to: currNode.id,
          length_m,
          travel_time_s,
          free_flow_time_s,
          traffic_level: trafficLevel,
          road_class,
          truck_allowed,
          geometry: edgeGeometry
        });

        prevNode = currNode;
      }
    }

    return {
      graph: {
        nodes: rawNodes.map(({ id, lat, lon }) => ({ id, lat, lon })),
        edges
      },
      startNodeId,
      targetNodeId
    };
  }
}
