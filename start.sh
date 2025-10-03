#!/bin/bash

echo "========================================"
echo "Starting SCEUDL Calendar Application"
echo "========================================"
echo ""

echo "Starting Backend Server (Port 3001)..."
cd mcp-server && node server.js &
BACKEND_PID=$!

sleep 3

echo ""
echo "Starting Frontend Server (Port 3000)..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "Both servers are running!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
