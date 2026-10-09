cmake_minimum_required(VERSION 3.14)
project(traffic_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

set(ENGINE_SOURCES
    src/Graph.cpp
    src/WeightCalculator.cpp
    src/Router.cpp
)

# Routing Engine Executable
add_executable(routing_engine src/Server.cpp ${ENGINE_SOURCES})

if(WIN32)
    target_link_libraries(routing_engine PRIVATE ws2_32 wsock32)
endif()

# Unit Tests Executable
add_executable(test_engine tests/test_engine.cpp ${ENGINE_SOURCES})
if(WIN32)
    target_link_libraries(test_engine PRIVATE ws2_32 wsock32)
endif()
