# System Architecture & Component Interaction

## 1. High-Level Architecture

```
+-----------------------------------------------------------------------+
|                             USER INTERFACE                            |
|                  React + Vite + TypeScript (Port 3000)                |
|         - Full-screen Interactive Leaflet Map                         |
|         - Floating Search Panel & Mode Tabs                           |
|         - Route Comparison & Weight Slider Tools                      |
+-----------------------------------------------------------------------+
                                   |
                                   | HTTP / JSON API
                                   v
+-----------------------------------------------------------------------+
|                             GATEWAY API                               |
|                  Node.js + Express + TypeScript (Port 5000)           |
|         - Geocoding & Autocomplete                                    |
|         - TomTom Calculate Route & Traffic Flow                       |
|         - Spatial Point Merging & Douglas-Peucker Graph Builder       |
|         - Supabase Search History Persistence                         |
+-----------------------------------------------------------------------+
                  |                                     |
    HTTP / JSON   |                                     | PostgreSQL / REST
                  v                                     v
+------------------------------------+   +------------------------------+
|         C++ ROUTING ENGINE         |   |       SUPABASE DATABASE      |
|    C++17 Engine (Port 8080)        |   |   PostgreSQL + RLS           |
|  - Graph Adjacency List            |   |   - route_searches           |
|  - Dijkstra (Distance & Time)      |   |   - route_alternatives       |
|  - A* Search (Traffic-Aware)       |   |   - route_waypoints          |
|  - Yen's K-Shortest Paths          |   |   - get_dashboard_stats()    |
+------------------------------------+   +------------------------------+
```

---

## 2. Sequence Diagram

```
User (Browser)               Gateway (Node.js)             C++ Engine               TomTom API / Supabase
     |                              |                           |                             |
     |--- 1. POST /api/route ------>|                           |                             |
     |    (From, To, Mode)          |--- 2. Geocode & Fetch --->|                             |
     |                              |    Polylines + Traffic    |============================>|
     |                              |<-- 3. Return Routes ------|                             |
     |                              |                           |                             |
     |                              |--- 4. Build Graph --------|                             |
     |                              |    (Merge ~15m, DP)       |                             |
     |                              |                           |                             |
     |                              |--- 5. POST /optimize ---->|                             |
     |                              |    (Graph Payload)        |-- 6. Execute A*, Dijkstra --|
     |                              |                           |   & Yen's K-Shortest        |
     |                              |<-- 7. Return Best, -------|                             |
     |                              |    Shortest, Alternatives |                             |
     |                              |                           |                             |
     |                              |--- 8. Save Search Metadata ---------------------------->|
     |                              |                                                         |
     |<-- 9. Return JSON Response --|                                                         |
     |    (Badges, Polylines, Text) |                                                         |
```

---

## 3. Data Flow Specification

1. **Request Phase**: User enters location strings (e.g., "Charminar" to "HITEC City") and selects transport mode.
2. **Geocoding & Polyline Acquisition**: Gateway queries TomTom API (or internal landmark database) for coordinates and fetches candidate route polylines.
3. **Graph Construction**: Gateway merges spatial points into intersection nodes and creates edge objects with speed, free-flow time, and congestion levels.
4. **C++ Optimization**: Graph payload is posted to `http://localhost:8080/optimize`. The C++ engine evaluates:
   - A* Search for traffic-aware Best Route.
   - Dijkstra for Shortest Distance and Fastest Time routes.
   - Yen's K-Shortest Paths for alternatives.
5. **UI Rendering**: Response is rendered on the map with active blue route, clickable alternative grey lines, dashed shortest line, and badges.
