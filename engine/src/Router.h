#ifndef ENGINE_ROUTER_H
#define ENGINE_ROUTER_H

#include "Graph.h"
#include "WeightCalculator.h"
#include <vector>
#include <string>
#include <utility>
#include <chrono>

namespace traffic {

enum class CostMetric {
    TrafficCost, // Custom dynamic cost formula
    Distance,    // Shortest distance in meters
    Time         // Fastest time in seconds
};

struct RouteResult {
    std::string route_id;
    std::string name;
    std::vector<std::string> path; // Node IDs
    std::vector<std::string> edge_ids; // Ordered list of Edge IDs
    std::vector<std::pair<double, double>> polyline; // [lat, lon]
    std::vector<Node> waypoints;
    double total_cost{0.0};
    double distance_m{0.0};
    double travel_time_s{0.0};
    double free_flow_time_s{0.0};
    std::string traffic_level{"Low"};
    uint64_t nodes_expanded{0};
    int64_t runtime_us{0};
    bool found{false};
    std::string algorithm_name{"Dijkstra"};
    bool is_best{false};
    bool is_shortest{false};
    bool is_fastest{false};
    std::vector<Edge> edge_segments;
    std::string explanation;
};

class Router {
public:
    explicit Router(WeightCalculator weight_calc);

    // Run Dijkstra's algorithm for specified metric (TrafficCost, Distance, Time)
    RouteResult runDijkstra(const Graph& graph, const std::string& start_id,
                            const std::string& target_id, const std::string& mode,
                            CostMetric metric = CostMetric::TrafficCost,
                            const WeightParams* custom_params = nullptr) const;

    // Run A* algorithm (heuristically guided, traffic-aware cost)
    RouteResult runAStar(const Graph& graph, const std::string& start_id,
                         const std::string& target_id, const std::string& mode,
                         const WeightParams* custom_params = nullptr) const;

    // Run Yen's K-Shortest Paths algorithm to find k alternative routes
    std::vector<RouteResult> runYenKShortestPaths(const Graph& graph,
                                                  const std::string& start_id,
                                                  const std::string& target_id,
                                                  const std::string& mode,
                                                  int k = 3,
                                                  const WeightParams* custom_params = nullptr) const;

    // Full optimization endpoint helper
    struct OptimizationOutput {
        RouteResult best_route;
        RouteResult shortest_route;
        RouteResult fastest_route;
        std::vector<RouteResult> alternatives;
        std::string decision_reason;
    };

    OptimizationOutput optimize(const Graph& graph, const std::string& start_id,
                               const std::string& target_id, const std::string& mode,
                               const WeightParams* custom_params = nullptr) const;

private:
    WeightCalculator weight_calc_;

    double getEdgeWeight(const Edge& edge, const std::string& mode,
                        CostMetric metric, const WeightParams* custom_params) const;

    RouteResult buildRouteResultFromEdges(const Graph& graph,
                                          const std::vector<Edge>& path_edges,
                                          const std::string& start_id,
                                          const std::string& target_id,
                                          const std::string& mode,
                                          const std::string& algo_name,
                                          uint64_t nodes_expanded,
                                          int64_t runtime_us,
                                          CostMetric metric,
                                          const WeightParams* custom_params) const;
};

} // namespace traffic

#endif // ENGINE_ROUTER_H
