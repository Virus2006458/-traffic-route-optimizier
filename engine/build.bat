@echo off
echo Building Traffic Routing Engine with MinGW GCC...

g++ -std=c++17 -O2 -D_WIN32_WINNT=0x0600 -Isrc -Ithird_party ^
    src/Graph.cpp src/WeightCalculator.cpp src/Router.cpp tests/test_engine.cpp ^
    -o test_engine.exe -lws2_32 -lwsock32

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Test compilation failed!
    exit /b 1
)

g++ -std=c++17 -O2 -D_WIN32_WINNT=0x0600 -Isrc -Ithird_party ^
    src/Graph.cpp src/WeightCalculator.cpp src/Router.cpp src/Server.cpp ^
    -o routing_engine.exe -lws2_32 -lwsock32

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Server compilation failed!
    exit /b 1
)

echo [SUCCESS] Build completed successfully!
