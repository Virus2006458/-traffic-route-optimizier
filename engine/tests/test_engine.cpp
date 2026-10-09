#include "../src/Graph.h"
#include "../src/WeightCalculator.h"
#include "../src/Router.h"
#include <iostream>
#include <cassert>
#include <cmath>

using namespace traffic;

void testRoadABeatsRoadB() {
    std::cout << "[TEST 1] Testing Road A (5 km, low traffic, 8 min) vs Road B (4 km, heavy traffic, 20 min)..." << std::endl;
    Graph g;
    g.addNode(Node("N0", 17.3850, 78.4867));
    g.addNode(Node("N1_A", 17.3900, 78.4900));
    g.addNode(Node("N1_B", 17.3800, 78.4800));
    g.addNode(Node("N2", 17.4000, 78.5000));

    // Road A: N0 -> N1_A -> N2 (5000m total, 8 min = 480s, Low traffic)
    g.addEdge(Edge("E_A1", "N0", "N1_A", 2500, 240, 240, "Low", "primary"));
    g.addEdge(Edge("E_A2", "N1_A", "N2", 2500, 240, 240, "Low", "primary"));

    // Road B: N0 -> N1_B -> N2 (4000m total, 20 min = 1200s, Severe traffic)
    g.addEdge(Edge("E_B1", "N0", "N1_B", 2000, 600, 240, "Severe", "primary"));
    g.addEdge(Edge("E_B2", "N1_B", "N2", 2000, 600, 240, "Severe", "primary"));

    WeightCalculator wc;
    Router router(wc);

    auto opt = router.optimize(g, "N0", "N2", "car");

    std::cout << "  Best route path: ";
    for (const auto& nid : opt.best_route.path) std::cout << nid << " ";
    std::cout << "\n  Best route cost: " << opt.best_route.total_cost << std::endl;
    std::cout << "  Shortest route cost: " << opt.shortest_route.total_cost << std::endl;

    // Verify Road A path was chosen for Best Route (starts with N1_A)
    assert(opt.best_route.found);
    assert(opt.best_route.path.size() == 3);
    assert(opt.best_route.path[1] == "N1_A"); // Road A path chosen due to lower traffic cost

    // Verify Shortest route picked Road B (starts with N1_B)
    assert(opt.shortest_route.path[1] == "N1_B");

    std::cout << "  ✓ PASSED: Road A (5 km, low traffic) beats Road B (4 km, severe traffic)!" << std::endl;
}

void testDijkstraEqualsAStarCost() {
    std::cout << "[TEST 2] Testing Dijkstra Cost == A* Cost..." << std::endl;
    Graph g;
    g.addNode(Node("A", 17.3850, 78.4867));
    g.addNode(Node("B", 17.3900, 78.4900));
    g.addNode(Node("C", 17.3950, 78.4950));
    g.addNode(Node("D", 17.4000, 78.5000));

    g.addEdge(Edge("E1", "A", "B", 1200, 150, 120, "Moderate", "primary"));
    g.addEdge(Edge("E2", "B", "C", 800, 100, 90, "Low", "secondary"));
    g.addEdge(Edge("E3", "C", "D", 1500, 200, 150, "High", "primary"));
    g.addEdge(Edge("E4", "A", "C", 2200, 350, 300, "Low", "primary"));

    WeightCalculator wc;
    Router router(wc);

    auto dij_res = router.runDijkstra(g, "A", "D", "car", CostMetric::TrafficCost);
    auto astar_res = router.runAStar(g, "A", "D", "car");

    std::cout << "  Dijkstra Cost: " << dij_res.total_cost << " (Nodes: " << dij_res.nodes_expanded << ")" << std::endl;
    std::cout << "  A* Cost:       " << astar_res.total_cost << " (Nodes: " << astar_res.nodes_expanded << ")" << std::endl;

    assert(dij_res.found && astar_res.found);
    assert(std::abs(dij_res.total_cost - astar_res.total_cost) < 1e-5);
    assert(dij_res.path == astar_res.path);

    std::cout << "  ✓ PASSED: Dijkstra cost matches A* cost exactly!" << std::endl;
}

void testUnreachableDestination() {
    std::cout << "[TEST 3] Testing Unreachable Destination..." << std::endl;
    Graph g;
    g.addNode(Node("A", 17.3850, 78.4867));
    g.addNode(Node("B", 17.3900, 78.4900));
    g.addNode(Node("ISLAND", 17.5000, 78.6000));

    g.addEdge(Edge("E1", "A", "B", 1000, 120, 120, "Low", "primary"));

    WeightCalculator wc;
    Router router(wc);

    auto res = router.runAStar(g, "A", "ISLAND", "car");

    assert(!res.found);
    std::cout << "  ✓ PASSED: Correctly reported unreachable destination!" << std::endl;
}

void testSameStartAndEnd() {
    std::cout << "[TEST 4] Testing Same Start and End Node..." << std::endl;
    Graph g;
    g.addNode(Node("A", 17.3850, 78.4867));

    WeightCalculator wc;
    Router router(wc);

    auto res = router.runAStar(g, "A", "A", "car");

    assert(res.found);
    assert(res.path.size() == 1 && res.path[0] == "A");
    assert(res.total_cost == 0.0);
    assert(res.distance_m == 0.0);

    std::cout << "  ✓ PASSED: Correctly handled identical start and destination node!" << std::endl;
}

int main() {
    std::cout << "==================================================" << std::endl;
    std::cout << "     RUNNING ROUTING ENGINE UNIT TESTS            " << std::endl;
    std::cout << "==================================================" << std::endl;

    testRoadABeatsRoadB();
    testDijkstraEqualsAStarCost();
    testUnreachableDestination();
    testSameStartAndEnd();

    std::cout << "==================================================" << std::endl;
    std::cout << " ALL ROUTING ENGINE UNIT TESTS PASSED SUCCESSFULLY! " << std::endl;
    std::cout << "==================================================" << std::endl;

    return 0;
}
