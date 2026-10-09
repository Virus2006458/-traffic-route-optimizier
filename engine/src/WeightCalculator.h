#ifndef ENGINE_WEIGHT_CALCULATOR_H
#define ENGINE_WEIGHT_CALCULATOR_H

#include "Edge.h"
#include <string>
#include <unordered_map>
#include <limits>
#include <nlohmann/json.hpp>

namespace traffic {

constexpr double INF_COST = std::numeric_limits<double>::infinity();

struct WeightParams {
    double alpha{0.4}; // distance weight
    double beta{0.8};  // time weight
    double gamma{0.5}; // traffic weight
    double delta{0.1}; // road suitability weight
};

class WeightCalculator {
public:
    WeightCalculator();
    explicit WeightCalculator(const std::string& config_file_path);

    bool loadConfig(const std::string& config_file_path);

    // Calculate dynamic cost of an edge based on mode and optional override parameters
    double calculateCost(const Edge& edge, const std::string& mode,
                        const WeightParams* custom_params = nullptr) const;

    // Get traffic penalty multiplier
    double getTrafficPenalty(const std::string& traffic_level) const;

    // Get road penalty for a given mode and road class
    double getRoadPenalty(const std::string& mode, const std::string& road_class) const;

    // Get default parameters for a mode
    WeightParams getParamsForMode(const std::string& mode) const;

    // Update traffic penalty mapping dynamically
    void setTrafficPenalty(const std::string& level, double penalty);

private:
    std::unordered_map<std::string, double> traffic_penalties_;
    std::unordered_map<std::string, WeightParams> mode_params_;
    std::unordered_map<std::string, std::unordered_map<std::string, double>> road_penalties_;

    void setDefaultFallbackConfig();
};

} // namespace traffic

#endif // ENGINE_WEIGHT_CALCULATOR_H
