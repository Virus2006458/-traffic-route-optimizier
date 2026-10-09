#include "Router.h"
#include <queue>
#include <unordered_set>
#include <algorithm>
#include <cmath>
#include <sstream>
#include <iomanip>
#include <iostream>

namespace traffic {

Router::Router(WeightCalculator weight_calc) : weight_calc_(std::move(weight_calc)) {}

double Router::getEdgeWeight(const Edge& edge, const std::string& mode,
                            CostMetric metric, const WeightParams* custom_params) const {
    switch (metric) {
        case CostMetric::Distance:
            return edge.length_m;
        case CostMetric::Time:
            return edge.travel_time_s;
        case CostMetric::TrafficCost:
        default:
            return weight_calc_.calculateCost(edge, mode, custom_params);
    }
}

RouteResult Router::buildRouteResultFromEdges(const Graph& graph,
                                              const std::vector<Edge>& path_edges,
                                              const std::string& start_id,
                                              const std::string& target_id,
                                              const std::string& mode,
                                              const std::string& algo_name,
                                              uint64_t nodes_expanded,
                                              int64_t runtime_us,
                                              CostMetric metric,
                                              const WeightParams* custom_params) const {
    RouteResult res;
    res.found = true;
    res.algorithm_name = algo_name;
    res.nodes_expanded = nodes_expanded;
    res.runtime_us = runtime_us;
    res.edge_segments = path_edges;

    if (path_edges.empty()) {
        if (start_id == target_id && graph.hasNode(start_id)) {
            res.path = {start_id};
            const Node* n = graph.getNode(start_id);
            if (n) {
                res.polyline.push_back({n->lat, n->lon});
                res.waypoints.push_back(*n);
            }
            return res;
        }
        res.found = false;
        return res;
    }

    res.path.push_back(path_edges.front().from);
    for (const auto& edge : path_edges) {
        res.path.push_back(edge.to);
        res.edge_ids.push_back(edge.id);
        res.distance_m += edge.length_m;
        res.travel_time_s += edge.travel_time_s;
        res.free_flow_time_s += edge.free_flow_time_s;
        res.total_cost += weight_calc_.calculateCost(edge, mode, custom_params);

        if (!edge.geometry.empty()) {
            for (const auto& pt : edge.geometry) {
                if (res.polyline.empty() ||
                    std::abs(res.polyline.back().first - pt.first) > 1e-6 ||
                    std::abs(res.polyline.back().second - pt.second) > 1e-6) {
                    res.polyline.push_back(pt);
                }
            }
        }
    }

    // Fallback if edges had no geometry: fill from nodes
    if (res.polyline.empty()) {
        for (const auto& nid : res.path) {
            const Node* n = graph.getNode(nid);
            if (n) {
                res.polyline.push_back({n->lat, n->lon});
            }
        }
    }

    // Waypoints: Major turns only (max 10), not every point
    if (path_edges.size() <= 10) {
        for (const auto& nid : res.path) {
            const Node* n = graph.getNode(nid);
            if (n) res.waypoints.push_back(*n);
        }
    } else {
        size_t step = std::max<size_t>(1, path_edges.size() / 10);
        for (size_t i = 0; i < path_edges.size(); i += step) {
            const Node* n = graph.getNode(path_edges[i].from);
            if (n && res.waypoints.size() < 10) {
                res.waypoints.push_back(*n);
            }
        }
        const Node* lastNode = graph.getNode(path_edges.back().to);
        if (lastNode && res.waypoints.size() < 10) {
            res.waypoints.push_back(*lastNode);
        }
    }

    int severe_count = 0, high_count = 0, mod_count = 0;
    for (const auto& edge : path_edges) {
        if (edge.traffic_level == "Severe") severe_count++;
        else if (edge.traffic_level == "High") high_count++;
        else if (edge.traffic_level == "Moderate") mod_count++;
    }

    if (severe_count > 0) res.traffic_level = "Severe";
    else if (high_count > 0) res.traffic_level = "High";
    else if (mod_count > 0) res.traffic_level = "Moderate";
    else res.traffic_level = "Low";

    return res;
}

RouteResult Router::runDijkstra(const Graph& graph, const std::string& start_id,
                                const std::string& target_id, const std::string& mode,
                                CostMetric metric, const WeightParams* custom_params) const {
    auto start_time = std::chrono::high_resolution_clock::now();

    RouteResult res;
    res.algorithm_name = (metric == CostMetric::Distance) ? "Dijkstra (Distance)" :
                         (metric == CostMetric::Time) ? "Dijkstra (Time)" : "Dijkstra (Cost)";

    if (!graph.hasNode(start_id) || !graph.hasNode(target_id)) {
        res.found = false;
        return res;
    }

    if (start_id == target_id) {
        auto end_time = std::chrono::high_resolution_clock::now();
        int64_t dur = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time).count();
        return buildRouteResultFromEdges(graph, {}, start_id, target_id, mode, res.algorithm_name, 1, dur, metric, custom_params);
    }

    using QueueElement = std::pair<double, std::string>;
    std::priority_queue<QueueElement, std::vector<QueueElement>, std::greater<QueueElement>> pq;

    std::unordered_map<std::string, double> dist;
    std::unordered_map<std::string, Edge> parent_edge;
    std::unordered_set<std::string> visited;

    dist[start_id] = 0.0;
    pq.push({0.0, start_id});

    uint64_t nodes_expanded = 0;

    while (!pq.empty()) {
        QueueElement top_elem = pq.top();
        pq.pop();
        double current_dist = top_elem.first;
        std::string u = top_elem.second;

        if (visited.find(u) != visited.end()) continue;
        visited.insert(u);
        nodes_expanded++;

        if (u == target_id) break;

        for (const auto& edge : graph.neighbors(u)) {
            double weight = getEdgeWeight(edge, mode, metric, custom_params);
            if (std::isinf(weight)) continue;

            std::string v = edge.to;
            double new_dist = current_dist + weight;

            if (dist.find(v) == dist.end() || new_dist < dist[v]) {
                dist[v] = new_dist;
                parent_edge[v] = edge;
                pq.push({new_dist, v});
            }
        }
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    int64_t dur = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time).count();

    if (dist.find(target_id) == dist.end()) {
        res.found = false;
        res.nodes_expanded = nodes_expanded;
        res.runtime_us = dur;
        return res;
    }

    std::vector<Edge> path_edges;
    std::string curr = target_id;
    while (curr != start_id) {
        auto pit = parent_edge.find(curr);
        if (pit == parent_edge.end()) break;
        path_edges.push_back(pit->second);
        curr = pit->second.from;
    }
    std::reverse(path_edges.begin(), path_edges.end());

    return buildRouteResultFromEdges(graph, path_edges, start_id, target_id, mode, res.algorithm_name, nodes_expanded, dur, metric, custom_params);
}

RouteResult Router::runAStar(const Graph& graph, const std::string& start_id,
                             const std::string& target_id, const std::string& mode,
                             const WeightParams* custom_params) const {
    auto start_time = std::chrono::high_resolution_clock::now();

    RouteResult res;
    res.algorithm_name = "A* Search";

    if (!graph.hasNode(start_id) || !graph.hasNode(target_id)) {
        res.found = false;
        return res;
    }

    if (start_id == target_id) {
        auto end_time = std::chrono::high_resolution_clock::now();
        int64_t dur = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time).count();
        return buildRouteResultFromEdges(graph, {}, start_id, target_id, mode, res.algorithm_name, 1, dur, CostMetric::TrafficCost, custom_params);
    }

    double min_cost_per_m = 1e9;
    for (const auto& pair : graph.getEdges()) {
        const Edge& edge = pair.second;
        double cost = weight_calc_.calculateCost(edge, mode, custom_params);
        if (!std::isinf(cost) && edge.length_m > 0) {
            double cost_per_m = cost / edge.length_m;
            if (cost_per_m < min_cost_per_m) {
                min_cost_per_m = cost_per_m;
            }
        }
    }
    if (min_cost_per_m >= 1e9) min_cost_per_m = 0.0001;

    auto heuristic = [&](const std::string& node_id) -> double {
        double d_m = graph.haversineMeters(node_id, target_id);
        return d_m * min_cost_per_m;
    };

    using QueueElement = std::pair<double, std::string>;
    std::priority_queue<QueueElement, std::vector<QueueElement>, std::greater<QueueElement>> pq;

    std::unordered_map<std::string, double> g_score;
    std::unordered_map<std::string, Edge> parent_edge;
    std::unordered_set<std::string> visited;

    g_score[start_id] = 0.0;
    pq.push({heuristic(start_id), start_id});

    uint64_t nodes_expanded = 0;

    while (!pq.empty()) {
        QueueElement top_elem = pq.top();
        pq.pop();
        std::string u = top_elem.second;

        if (visited.find(u) != visited.end()) continue;
        visited.insert(u);
        nodes_expanded++;

        if (u == target_id) break;

        for (const auto& edge : graph.neighbors(u)) {
            double weight = weight_calc_.calculateCost(edge, mode, custom_params);
            if (std::isinf(weight)) continue;

            std::string v = edge.to;
            double tentative_g = g_score[u] + weight;

            if (g_score.find(v) == g_score.end() || tentative_g < g_score[v]) {
                g_score[v] = tentative_g;
                parent_edge[v] = edge;
                double f_score = tentative_g + heuristic(v);
                pq.push({f_score, v});
            }
        }
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    int64_t dur = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time).count();

    if (g_score.find(target_id) == g_score.end()) {
        res.found = false;
        res.nodes_expanded = nodes_expanded;
        res.runtime_us = dur;
        return res;
    }

    std::vector<Edge> path_edges;
    std::string curr = target_id;
    while (curr != start_id) {
        auto pit = parent_edge.find(curr);
        if (pit == parent_edge.end()) break;
        path_edges.push_back(pit->second);
        curr = pit->second.from;
    }
    std::reverse(path_edges.begin(), path_edges.end());

    return buildRouteResultFromEdges(graph, path_edges, start_id, target_id, mode, res.algorithm_name, nodes_expanded, dur, CostMetric::TrafficCost, custom_params);
}

std::vector<RouteResult> Router::runYenKShortestPaths(const Graph& graph,
                                                      const std::string& start_id,
                                                      const std::string& target_id,
                                                      const std::string& mode,
                                                      int k,
                                                      const WeightParams* custom_params) const {
    std::vector<RouteResult> A;

    RouteResult p1 = runDijkstra(graph, start_id, target_id, mode, CostMetric::TrafficCost, custom_params);
    if (!p1.found) return A;

    p1.route_id = "route_1";
    p1.name = "Candidate Route 1";
    A.push_back(p1);

    struct CandidatePath {
        RouteResult result;
        std::vector<Edge> edges;
    };
    std::vector<CandidatePath> B;

    for (int k_idx = 1; k_idx < k; ++k_idx) {
        const auto& prev_edges = A[k_idx - 1].edge_segments;
        const auto& prev_nodes = A[k_idx - 1].path;

        if (prev_nodes.size() < 2) break;

        for (size_t i = 0; i < prev_nodes.size() - 1; ++i) {
            std::string spur_node = prev_nodes[i];

            std::vector<Edge> root_edges(prev_edges.begin(), prev_edges.begin() + i);
            std::unordered_set<std::string> disabled_edge_ids;
            std::unordered_set<std::string> disabled_nodes;

            for (const auto& path_res : A) {
                const auto& pe = path_res.edge_segments;
                if (pe.size() > i) {
                    bool root_matches = true;
                    for (size_t r = 0; r < i; ++r) {
                        if (pe[r].id != root_edges[r].id) {
                            root_matches = false;
                            break;
                        }
                    }
                    if (root_matches) {
                        disabled_edge_ids.insert(pe[i].id);
                    }
                }
            }

            for (size_t r = 0; r < i; ++r) {
                disabled_nodes.insert(prev_nodes[r]);
            }

            Graph temp_graph = graph;
            for (const auto& edge_id : disabled_edge_ids) {
                temp_graph.reweightEdge(edge_id, 1e9, "Severe");
            }

            RouteResult spur_result = runDijkstra(temp_graph, spur_node, target_id, mode, CostMetric::TrafficCost, custom_params);

            if (spur_result.found) {
                std::vector<Edge> candidate_edges = root_edges;
                candidate_edges.insert(candidate_edges.end(), spur_result.edge_segments.begin(), spur_result.edge_segments.end());

                RouteResult candidate_res = buildRouteResultFromEdges(graph, candidate_edges, start_id, target_id, mode, "Yen K-Shortest", spur_result.nodes_expanded, spur_result.runtime_us, CostMetric::TrafficCost, custom_params);

                bool duplicate = false;
                for (const auto& existing : A) {
                    if (existing.path == candidate_res.path) {
                        duplicate = true;
                        break;
                    }
                }
                if (!duplicate) {
                    for (const auto& existing : B) {
                        if (existing.result.path == candidate_res.path) {
                            duplicate = true;
                            break;
                        }
                    }
                }

                if (!duplicate) {
                    B.push_back({candidate_res, candidate_edges});
                }
            }
        }

        if (B.empty()) break;

        std::sort(B.begin(), B.end(), [](const CandidatePath& a, const CandidatePath& b) {
            return a.result.total_cost < b.result.total_cost;
        });

        RouteResult next_best = B.front().result;
        next_best.route_id = "route_" + std::to_string(k_idx + 1);
        next_best.name = "Candidate Route " + std::to_string(k_idx + 1);
        A.push_back(next_best);
        B.erase(B.begin());
    }

    return A;
}

Router::OptimizationOutput Router::optimize(const Graph& graph, const std::string& start_id,
                                             const std::string& target_id, const std::string& mode,
                                             const WeightParams* custom_params) const {
    OptimizationOutput out;

    out.best_route = runAStar(graph, start_id, target_id, mode, custom_params);
    out.best_route.is_best = true;
    out.best_route.route_id = "route_best";
    out.best_route.name = "Best Route (Traffic Aware)";

    out.shortest_route = runDijkstra(graph, start_id, target_id, mode, CostMetric::Distance, custom_params);
    out.shortest_route.is_shortest = true;
    out.shortest_route.route_id = "route_shortest";
    out.shortest_route.name = "Shortest Distance Route";

    out.fastest_route = runDijkstra(graph, start_id, target_id, mode, CostMetric::Time, custom_params);
    out.fastest_route.is_fastest = true;
    out.fastest_route.route_id = "route_fastest";
    out.fastest_route.name = "Fastest Time Route";

    out.alternatives = runYenKShortestPaths(graph, start_id, target_id, mode, 3, custom_params);

    if (out.best_route.path == out.shortest_route.path) {
        out.best_route.is_shortest = true;
        out.shortest_route.is_best = true;
    }

    std::ostringstream ss;
    ss << std::fixed << std::setprecision(1);

    double best_dist_km = out.best_route.distance_m / 1000.0;
    double best_time_min = out.best_route.travel_time_s / 60.0;
    double short_dist_km = out.shortest_route.distance_m / 1000.0;
    double short_time_min = out.shortest_route.travel_time_s / 60.0;

    double dist_diff = best_dist_km - short_dist_km;
    double time_savings = short_time_min - best_time_min;

    if (out.best_route.path == out.shortest_route.path) {
        ss << "Best route is also the shortest route (" << best_dist_km << " km, "
           << std::round(best_time_min) << " min, cost " << std::setprecision(2) << out.best_route.total_cost << ").";
    } else {
        ss << "Best route selected (cost " << std::setprecision(2) << out.best_route.total_cost
           << " vs " << out.shortest_route.total_cost << "). ";
        if (dist_diff > 0) {
            ss << "+" << dist_diff << " km longer but ";
        } else {
            ss << std::abs(dist_diff) << " km shorter and ";
        }
        if (time_savings > 0) {
            ss << std::round(time_savings) << " min faster than the shortest route. ";
        } else if (time_savings < 0) {
            ss << std::round(std::abs(time_savings)) << " min slower than shortest route. ";
        }
        if (out.shortest_route.traffic_level == "High" || out.shortest_route.traffic_level == "Severe") {
            ss << "Shortest route suffers from " << out.shortest_route.traffic_level << " traffic congestion.";
        }
    }

    out.decision_reason = ss.str();
    out.best_route.explanation = out.decision_reason;

    return out;
}

} // namespace traffic
