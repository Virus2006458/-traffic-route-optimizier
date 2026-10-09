@echo off
echo ========================================================
echo  Starting Traffic Route Optimization System
echo ========================================================

echo [1/3] Starting C++ Graph Engine (Port 8080)...
start "Routing Engine (8080)" cmd /k "engine\routing_engine.exe 8080"

echo [2/3] Starting Gateway API (Port 5000)...
start "Gateway API (5000)" cmd /k "cd gateway && npm run dev"

echo [3/3] Starting Frontend React App (Port 3000)...
start "Frontend UI (3000)" cmd /k "cd frontend && npm run dev"

echo ========================================================
echo  All services launched in separate windows!
echo  Frontend URL: http://localhost:3000
echo  Gateway API:  http://localhost:5000
echo  Engine API:   http://localhost:8080
echo ========================================================
pause
