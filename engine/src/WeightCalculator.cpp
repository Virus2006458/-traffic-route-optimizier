#include "WeightCalculator.h"
#include <fstream>
#include <iostream>
#include <cmath>

namespace traffic {

using json = nlohmann::json;

WeightCalculator::WeightCalculator() {
    setDefaultFallbackConfig();
}

WeightCalculator::WeightCalculator(const std::string& config_file_path) {
    if (!loadConfig(config_file_path)) {
        setDefaultFallbackConfig();
    }
}

void WeightCalculator::setDefaultFallbackConfig() {
    traffic_penalties_ = {
        {"Low", 1.0},
        {"Moderate", 2.0},
        {"High", 4.0},
        {"Severe", 7.0}
    };

    mode_params_["walking"] = {1.0, 1.0, 0.05, 0.5};
    mode_params_["car"]     = {0.4, 0.8, 0.5, 0.1};
    mode_params_["heavy"]   = {0.3, 0.6, 0.8, 0.6};

    road_penalties_["walking"] = {
        {"motorway", 1000.0}, {"trunk", 500.0}, {"primary", 5.0},
        {"secondary", 1.0}, {"residential", 0.0}, {"pedestrian", 0.0}
    };
    road_penalties_["car"] = {
        {"motorway", 0.0}, {"trunk", 0.0}, {"primary", 0.1},
        {"secondary", 0.2}, {"residential", 1.0}, {"pedestrian", 1000.0}
    };
    road_penalties_["heavy"] = {
        {"motorway", 0.0}, {"trunk", 0.0}, {"primary", 0.2},
        {"secondary", 1.0}, {"residential", 10.0}, {"pedestrian", 1000.0}
    };
}

bool WeightCalculator::loadConfig(const std::string& config_file_path) {
    try {
        std::ifstream file(config_file_path);
        if (!file.is_open()) {
            return false;
        }
        json j;
        file >> j;

        if (j.contains("traffic_penalties")) {
            for (auto it = j["traffic_penalties"].begin(); it != j["traffic_penalties"].end(); ++it) {
                traffic_penalties_[it.key()] = it.value().get<double>();
            }
        }

        if (j.contains("modes")) {
            for (auto it = j["modes"].begin(); it != j["modes"].end(); ++it) {
                std::string mode = it.key();
                const auto& mode_data = it.value();
                WeightParams p;
                if (mode_data.contains("alpha")) p.alpha = mode_data["alpha"].get<double>();
                if (mode_data.contains("beta"))  p.beta  = mode_data["beta"].get<double>();
                if (mode_data.contains("gamma")) p.gamma = mode_data["gamma"].get<double>();
                if (mode_data.contains("delta")) p.delta = mode_data["delta"].get<double>();
                mode_params_[mode] = p;

                if (mode_data.contains("road_penalties")) {
                    for (auto rit = mode_data["road_penalties"].begin(); rit != mode_data["road_penalties"].end(); ++rit) {
                        road_penalties_[mode][rit.key()] = rit.value().get<double>();
                    }
                }
            }
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "WeightCalculator config load warning: " << e.what() << std::endl;
        return false;
    }
}

double WeightCalculator::getTrafficPenalty(const std::string& traffic_level) const {
    auto it = traffic_penalties_.find(traffic_level);
    if (it != traffic_penalties_.end()) {
        return it->second;
    }
    return 1.0;
}

double WeightCalculator::getRoadPenalty(const std::string& mode, const std::string& road_class) const {
    auto mit = road_penalties_.find(mode);
    if (mit != road_penalties_.end()) {
        auto rit = mit->second.find(road_class);
        if (rit != mit->second.end()) {
            return rit->second;
        }
    }
    return 0.0;
}

WeightParams WeightCalculator::getParamsForMode(const std::string& mode) const {
    auto it = mode_params_.find(mode);
    if (it != mode_params_.end()) {
        return it->second;
    }
    return {0.4, 0.8, 0.5, 0.1}; // fallback car
}

void WeightCalculator::setTrafficPenalty(const std::string& level, double penalty) {
    traffic_penalties_[level] = penalty;
}

double WeightCalculator::calculateCost(const Edge& edge, const std::string& mode,
                                       const WeightParams* custom_params) const {
    if (mode == "heavy" && !edge.truck_allowed) {
        return INF_COST;
    }

    if (mode == "walking" && (edge.road_class == "motorway" || edge.road_class == "trunk")) {
        return INF_COST;
    }

    WeightParams p = custom_params ? *custom_params : getParamsForMode(mode);

    double norm_dist = edge.length_m / 1000.0;
    double norm_time = edge.travel_time_s / 60.0;

    double traf_pen = getTrafficPenalty(edge.traffic_level);
    double road_pen = getRoadPenalty(mode, edge.road_class);

    double cost = (p.alpha * norm_dist) +
                  (p.beta * norm_time) +
                  (p.gamma * traf_pen * norm_dist) +
                  (p.delta * road_pen);

    return cost;
}

} // namespace traffic
