#ifndef ENGINE_GRAPH_H
#define ENGINE_GRAPH_H

#include "Node.h"
#include "Edge.h"
#include <string>
#include <unordered_map>
#include <vector>
#include <memory>

namespace traffic {

class Graph {
public:
    Graph() = default;

    void addNode(const Node& node);
    void addEdge(const Edge& edge);

    const Node* getNode(const std::string& id) const;
    const Edge* getEdge(const std::string& id) const;
    Edge* getEdgeMutable(const std::string& id);

    std::vector<Edge> neighbors(const std::string& node_id) const;

    bool hasNode(const std::string& id) const;
    bool reweightEdge(const std::string& edge_id, double new_travel_time_s,
                      const std::string& new_traffic_level);

    size_t nodeCount() const { return nodes_.size(); }
    size_t edgeCount() const { return edges_.size(); }

    const std::unordered_map<std::string, Node>& getNodes() const { return nodes_; }
    const std::unordered_map<std::string, Edge>& getEdges() const { return edges_; }

    void clear();

    // Haversine distance in meters between two lat/lon pairs or two node IDs
    static double haversineMeters(double lat1, double lon1, double lat2, double lon2);
    double haversineMeters(const std::string& node_a_id, const std::string& node_b_id) const;

private:
    std::unordered_map<std::string, Node> nodes_;
    std::unordered_map<std::string, Edge> edges_;
    std::unordered_map<std::string, std::vector<std::string>> adjacency_; // node_id -> list of edge_ids
};

} // namespace traffic

#endif // ENGINE_GRAPH_H
