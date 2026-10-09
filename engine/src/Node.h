#ifndef ENGINE_NODE_H
#define ENGINE_NODE_H

#include <string>

namespace traffic {

// Node represents an intersection or way-point in the road network.
struct Node {
    std::string id;
    double lat{0.0};
    double lon{0.0};

    Node() = default;
    Node(std::string id_, double lat_, double lon_)
        : id(std::move(id_)), lat(lat_), lon(lon_) {}
};

} // namespace traffic

#endif // ENGINE_NODE_H
