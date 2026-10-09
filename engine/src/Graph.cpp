#include "Graph.h"
#include <cmath>
#include <algorithm>

namespace traffic {

constexpr double EARTH_RADIUS_M = 6371000.0;
constexpr double PI = 3.14159265358979323846;

static double toRadians(double deg) {
    return deg * (PI / 180.0);
}

void Graph::addNode(const Node& node) {
    nodes_[node.id] = node;
}

void Graph::addEdge(const Edge& edge) {
    edges_[edge.id] = edge;
    adjacency_[edge.from].push_back(edge.id);
    // Ensure nodes exist in map if not explicitly added
    if (nodes_.find(edge.from) == nodes_.end()) {
        nodes_[edge.from] = Node(edge.from, 0.0, 0.0);
    }
    if (nodes_.find(edge.to) == nodes_.end()) {
        nodes_[edge.to] = Node(edge.to, 0.0, 0.0);
    }
}

const Node* Graph::getNode(const std::string& id) const {
    auto it = nodes_.find(id);
    if (it != nodes_.end()) {
        return &(it->second);
    }
    return nullptr;
}

const Edge* Graph::getEdge(const std::string& id) const {
    auto it = edges_.find(id);
    if (it != edges_.end()) {
        return &(it->second);
    }
    return nullptr;
}

Edge* Graph::getEdgeMutable(const std::string& id) {
    auto it = edges_.find(id);
    if (it != edges_.end()) {
        return &(it->second);
    }
    return nullptr;
}

std::vector<Edge> Graph::neighbors(const std::string& node_id) const {
    std::vector<Edge> result;
    auto it = adjacency_.find(node_id);
    if (it != adjacency_.end()) {
        for (const auto& edge_id : it->second) {
            auto eit = edges_.find(edge_id);
            if (eit != edges_.end()) {
                result.push_back(eit->second);
            }
        }
    }
    return result;
}

bool Graph::hasNode(const std::string& id) const {
    return nodes_.find(id) != nodes_.end();
}

bool Graph::reweightEdge(const std::string& edge_id, double new_travel_time_s,
                         const std::string& new_traffic_level) {
    auto it = edges_.find(edge_id);
    if (it != edges_.end()) {
        it->second.travel_time_s = new_travel_time_s;
        it->second.traffic_level = new_traffic_level;
        return true;
    }
    return false;
}

void Graph::clear() {
    nodes_.clear();
    edges_.clear();
    adjacency_.clear();
}

double Graph::haversineMeters(double lat1, double lon1, double lat2, double lon2) {
    double dlat = toRadians(lat2 - lat1);
    double dlon = toRadians(lon2 - lon1);

    double a = std::sin(dlat / 2.0) * std::sin(dlat / 2.0) +
               std::cos(toRadians(lat1)) * std::cos(toRadians(lat2)) *
               std::sin(dlon / 2.0) * std::sin(dlon / 2.0);

    double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
    return EARTH_RADIUS_M * c;
}

double Graph::haversineMeters(const std::string& node_a_id, const std::string& node_b_id) const {
    const Node* na = getNode(node_a_id);
    const Node* nb = getNode(node_b_id);
    if (!na || !nb) return 0.0;
    return haversineMeters(na->lat, na->lon, nb->lat, nb->lon);
}

} // namespace traffic
