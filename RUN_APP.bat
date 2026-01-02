@echo off
cd /d %~dp0
echo Starting ML Blood Smear Detection App... 
echo.
rem Start the server in a new terminal window so this script can continue
start "ML Blood App" cmd /k "cd /d D:\p1 && uvicorn app:app --reload --host 0.0.0.0 --port 8000"
rem Give the server a moment to start, then open the browser to localhost
timeout /t 2 >nul
start "" "http://localhost:8000"
echo The app should open in your default browser. Close this window to stop following logs.
pause

