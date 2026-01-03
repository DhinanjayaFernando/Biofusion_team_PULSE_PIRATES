@echo off
cd /d %~dp0
echo Starting ML Blood Smear Detection App (Production Mode)...
echo.
rem Set environment variables for production optimization
set PRODUCTION=true
set LOG_LEVEL=WARNING
set ALLOWED_ORIGINS=http://127.0.0.1:3000
echo Production optimizations enabled:
echo   - Debug mode disabled
echo   - Source maps disabled
echo   - API docs disabled
echo   - IPv4-only binding (faster than localhost DNS resolution)
echo.
rem Start the server in a new terminal window on IPv4 (127.0.0.1) for better performance
start "ML Blood App" cmd /k "cd /d D:\p1 && uvicorn app:app --host 127.0.0.1 --port 8000"
rem Give the server a moment to start, then open the browser
timeout /t 2 >nul
start "" "http://127.0.0.1:8000"
echo.
echo The app should open in your default browser. Close this window to stop the server.
pause

