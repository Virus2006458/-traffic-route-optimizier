#ifndef ENGINE_EDGE_H
#define ENGINE_EDGE_H

#include <string>
#include <vector>
#include <utility>

namespace traffic {

// Edge represents a directed road segment connecting two nodes.
struct Edge {
    std::string id;
    std::string from;
    std::string to;
    double length_m{0.0};          // Distance in meters
    double travel_time_s{0.0};     // Current travel time including traffic in seconds
    double free_flow_time_s{0.0};  // Ideal travel time without traffic in seconds
    std::string traffic_level{"Low"}; // Low, Moderate, High, Severe
    std::string road_class{"secondary"}; // motorway, trunk, primary, secondary, residential, etc.
    bool truck_allowed{true};      // Heavy vehicle permission flag
    std::vector<std::pair<double, double>> geometry; // Full original road geometry points [lat, lon]

    Edge() = default;
    Edge(std::string id_, std::string from_, std::string to_, double length_m_,
         double travel_time_s_, double free_flow_time_s_, std::string traffic_level_,
         std::string road_class_ = "secondary", bool truck_allowed_ = true,
         std::vector<std::pair<double, double>> geometry_ = {})
        : id(std::move(id_)), from(std::move(from_)), to(std::move(to_)),
          length_m(length_m_), travel_time_s(travel_time_s_),
          free_flow_time_s(free_flow_time_s_), traffic_level(std::move(traffic_level_)),
          road_class(std::move(road_class_)), truck_allowed(truck_allowed_),
          geometry(std::move(geometry_)) {}
};

} // namespace traffic

#endif // ENGINE_EDGE_H
