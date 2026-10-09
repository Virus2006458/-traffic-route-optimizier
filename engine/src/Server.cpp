#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
typedef int socklen_t;
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
typedef int SOCKET;
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif

#include "Graph.h"
#include "WeightCalculator.h"
#include "Router.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <string>
#include <sstream>
#include <algorithm>
#include <thread>
#include <vector>

using json = nlohmann::json;
using namespace traffic;

json routeResultToJson(const RouteResult& res) {
    json polyline_json = json::array();
    for (const auto& pt : res.polyline) {
        polyline_json.push_back({pt.first, pt.second});
    }

    json waypoints_json = json::array();
    for (const auto& wp : res.waypoints) {
        waypoints_json.push_back({
            {"id", wp.id},
            {"lat", wp.lat},
            {"lon", wp.lon}
        });
    }

    json edge_ids_json = json::array();
    for (const auto& eid : res.edge_ids) {
        edge_ids_json.push_back(eid);
    }

    json segments_json = json::array();
    for (const auto& edge : res.edge_segments) {
        json geom_json = json::array();
        for (const auto& g : edge.geometry) {
            geom_json.push_back({g.first, g.second});
        }
        segments_json.push_back({
            {"id", edge.id},
            {"from", edge.from},
            {"to", edge.to},
            {"length_m", edge.length_m},
            {"travel_time_s", edge.travel_time_s},
            {"free_flow_time_s", edge.free_flow_time_s},
            {"traffic_level", edge.traffic_level},
            {"road_class", edge.road_class},
            {"truck_allowed", edge.truck_allowed},
            {"geometry", geom_json}
        });
    }

    return json{
        {"route_id", res.route_id},
        {"name", res.name},
        {"found", res.found},
        {"path", res.path},
        {"edge_ids", edge_ids_json},
        {"polyline", polyline_json},
        {"waypoints", waypoints_json},
        {"total_cost", res.total_cost},
        {"distance_m", res.distance_m},
        {"travel_time_s", res.travel_time_s},
        {"free_flow_time_s", res.free_flow_time_s},
        {"delay_s", std::max(0.0, res.travel_time_s - res.free_flow_time_s)},
        {"traffic_level", res.traffic_level},
        {"nodes_expanded", res.nodes_expanded},
        {"runtime_us", res.runtime_us},
        {"algorithm_name", res.algorithm_name},
        {"is_best", res.is_best},
        {"is_shortest", res.is_shortest},
        {"is_fastest", res.is_fastest},
        {"edge_segments", segments_json},
        {"explanation", res.explanation}
    };
}

Graph parseGraphFromJson(const json& j) {
    Graph graph;
    if (j.contains("nodes") && j["nodes"].is_array()) {
        for (const auto& n : j["nodes"]) {
            std::string id = n.value("id", "");
            double lat = n.value("lat", 0.0);
            double lon = n.value("lon", 0.0);
            if (!id.empty()) {
                graph.addNode(Node(id, lat, lon));
            }
        }
    }

    if (j.contains("edges") && j["edges"].is_array()) {
        for (const auto& e : j["edges"]) {
            std::string id = e.value("id", "");
            std::string from = e.value("from", "");
            std::string to = e.value("to", "");
            double length_m = e.value("length_m", 0.0);
            double travel_time_s = e.value("travel_time_s", 0.0);
            double free_flow_time_s = e.value("free_flow_time_s", travel_time_s);
            std::string traffic_level = e.value("traffic_level", "Low");
            std::string road_class = e.value("road_class", "secondary");
            bool truck_allowed = e.value("truck_allowed", true);

            std::vector<std::pair<double, double>> geometry;
            if (e.contains("geometry") && e["geometry"].is_array()) {
                for (const auto& pt : e["geometry"]) {
                    if (pt.is_array() && pt.size() >= 2) {
                        geometry.emplace_back(pt[0].get<double>(), pt[1].get<double>());
                    }
                }
            }

            if (!id.empty() && !from.empty() && !to.empty()) {
                graph.addEdge(Edge(id, from, to, length_m, travel_time_s, free_flow_time_s, traffic_level, road_class, truck_allowed, geometry));
            }
        }
    }
    return graph;
}

std::string makeHttpResponse(int status_code, const std::string& body) {
    std::ostringstream ss;
    std::string status_text = (status_code == 200) ? "OK" : (status_code == 400) ? "Bad Request" : "Not Found";
    ss << "HTTP/1.1 " << status_code << " " << status_text << "\r\n";
    ss << "Content-Type: application/json\r\n";
    ss << "Content-Length: " << body.size() << "\r\n";
    ss << "Access-Control-Allow-Origin: *\r\n";
    ss << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
    ss << "Access-Control-Allow-Headers: Content-Type\r\n";
    ss << "Connection: close\r\n\r\n";
    ss << body;
    return ss.str();
}

void handleClient(SOCKET client_fd, WeightCalculator& weight_calc, Graph& global_graph) {
    std::vector<char> buffer(65536);
    int bytes_received = recv(client_fd, buffer.data(), static_cast<int>(buffer.size() - 1), 0);
    if (bytes_received <= 0) {
        closesocket(client_fd);
        return;
    }
    buffer[bytes_received] = '\0';
    std::string raw_req(buffer.data(), bytes_received);

    std::istringstream req_stream(raw_req);
    std::string method, path, version;
    req_stream >> method >> path >> version;

    if (method == "OPTIONS") {
        std::string resp = makeHttpResponse(200, "{\"status\":\"ok\"}");
        send(client_fd, resp.c_str(), static_cast<int>(resp.size()), 0);
        closesocket(client_fd);
        return;
    }

    size_t body_pos = raw_req.find("\r\n\r\n");
    std::string body = (body_pos != std::string::npos) ? raw_req.substr(body_pos + 4) : "";

    std::string response_str;

    if (method == "GET" && path == "/health") {
        json j = {
            {"status", "ok"},
            {"service", "cpp-routing-engine"},
            {"nodes_count", global_graph.nodeCount()},
            {"edges_count", global_graph.edgeCount()}
        };
        response_str = makeHttpResponse(200, j.dump(2));
    } else if (method == "POST" && path == "/optimize") {
        try {
            json req_j = json::parse(body);
            Graph graph;
            if (req_j.contains("graph")) {
                graph = parseGraphFromJson(req_j["graph"]);
                global_graph = graph;
            } else if (req_j.contains("nodes") || req_j.contains("edges")) {
                graph = parseGraphFromJson(req_j);
                global_graph = graph;
            } else {
                graph = global_graph;
            }

            std::string start_id = req_j.value("start_id", "");
            std::string target_id = req_j.value("target_id", "");
            std::string mode = req_j.value("mode", "car");

            WeightParams custom_params = weight_calc.getParamsForMode(mode);
            WeightParams* p_custom = nullptr;

            if (req_j.contains("weights")) {
                auto w = req_j["weights"];
                if (w.contains("alpha")) custom_params.alpha = w["alpha"].get<double>();
                if (w.contains("beta"))  custom_params.beta  = w["beta"].get<double>();
                if (w.contains("gamma")) custom_params.gamma = w["gamma"].get<double>();
                if (w.contains("delta")) custom_params.delta = w["delta"].get<double>();
                p_custom = &custom_params;
            }

            Router router(weight_calc);
            auto opt_out = router.optimize(graph, start_id, target_id, mode, p_custom);

            json alternatives_json = json::array();
            for (const auto& alt : opt_out.alternatives) {
                alternatives_json.push_back(routeResultToJson(alt));
            }

            json resp_j = {
                {"status", "success"},
                {"mode", mode},
                {"start_id", start_id},
                {"target_id", target_id},
                {"reason", opt_out.decision_reason},
                {"best_route", routeResultToJson(opt_out.best_route)},
                {"shortest_route", routeResultToJson(opt_out.shortest_route)},
                {"fastest_route", routeResultToJson(opt_out.fastest_route)},
                {"alternatives", alternatives_json},
                {"graph_summary", {
                    {"nodes_count", graph.nodeCount()},
                    {"edges_count", graph.edgeCount()}
                }}
            };
            response_str = makeHttpResponse(200, resp_j.dump(2));
        } catch (const std::exception& e) {
            json err_j = {{"status", "error"}, {"message", std::string("Optimization failed: ") + e.what()}};
            response_str = makeHttpResponse(400, err_j.dump(2));
        }
    } else if (method == "POST" && path == "/reweight") {
        try {
            json req_j = json::parse(body);
            int updated_count = 0;
            if (req_j.contains("updates") && req_j["updates"].is_array()) {
                for (const auto& u : req_j["updates"]) {
                    std::string edge_id = u.value("edge_id", "");
                    double new_time = u.value("travel_time_s", 0.0);
                    std::string new_level = u.value("traffic_level", "Low");
                    if (global_graph.reweightEdge(edge_id, new_time, new_level)) {
                        updated_count++;
                    }
                }
            }

            json resp_j = {
                {"status", "success"},
                {"message", "Edges reweighted successfully"},
                {"updated_count", updated_count},
                {"nodes_count", global_graph.nodeCount()},
                {"edges_count", global_graph.edgeCount()}
            };

            if (req_j.contains("start_id") && req_j.contains("target_id")) {
                std::string start_id = req_j.value("start_id", "");
                std::string target_id = req_j.value("target_id", "");
                std::string mode = req_j.value("mode", "car");

                Router router(weight_calc);
                auto opt_out = router.optimize(global_graph, start_id, target_id, mode);
                resp_j["best_route"] = routeResultToJson(opt_out.best_route);
                resp_j["reason"] = opt_out.decision_reason;
            }
            response_str = makeHttpResponse(200, resp_j.dump(2));
        } catch (const std::exception& e) {
            json err_j = {{"status", "error"}, {"message", std::string("Reweight failed: ") + e.what()}};
            response_str = makeHttpResponse(400, err_j.dump(2));
        }
    } else {
        response_str = makeHttpResponse(404, "{\"status\":\"error\",\"message\":\"Endpoint not found\"}");
    }

    send(client_fd, response_str.c_str(), static_cast<int>(response_str.size()), 0);
    closesocket(client_fd);
}

int main(int argc, char** argv) {
    int port = 8080;
    if (argc > 1) {
        port = std::stoi(argv[1]);
    }

#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "WSAStartup failed." << std::endl;
        return 1;
    }
#endif

    SOCKET server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCKET) {
        std::cerr << "Failed to create socket." << std::endl;
        return 1;
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    if (bind(server_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
        std::cerr << "Bind failed on port " << port << std::endl;
        closesocket(server_fd);
        return 1;
    }

    if (listen(server_fd, 10) == SOCKET_ERROR) {
        std::cerr << "Listen failed." << std::endl;
        closesocket(server_fd);
        return 1;
    }

    WeightCalculator weight_calc("engine/config/weights.json");
    Graph global_graph;

    std::cout << "==================================================" << std::endl;
    std::cout << " C++ Routing Engine listening on http://0.0.0.0:" << port << std::endl;
    std::cout << "==================================================" << std::endl;

    while (true) {
        sockaddr_in client_addr{};
        socklen_t addrlen = sizeof(client_addr);
        SOCKET client_fd = accept(server_fd, reinterpret_cast<sockaddr*>(&client_addr), &addrlen);
        if (client_fd != INVALID_SOCKET) {
            handleClient(client_fd, weight_calc, global_graph);
        }
    }

#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
