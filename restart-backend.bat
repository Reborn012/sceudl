@echo off
echo Stopping all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Starting backend server...
cd mcp-server
start "Backend Server" cmd /k "node server.js"
echo Backend server started on port 3001
