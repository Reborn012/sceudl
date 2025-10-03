@echo off
echo ========================================
echo Starting SCEUDL Calendar Application
echo ========================================
echo.

echo Starting Backend Server (Port 3001)...
start /MIN "Backend Server" cmd /c "cd mcp-server && node server.js"
timeout /t 3 /nobreak >nul

echo Starting Frontend Server (Port 3000)...
start /MIN "Frontend Server" cmd /c "npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo Servers are running in minimized windows.
echo Check taskbar for "Backend Server" and "Frontend Server"
echo.
pause
