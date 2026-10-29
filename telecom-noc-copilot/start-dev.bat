@echo off
setlocal
set ROOT=%~dp0

echo Stopping anything on ports 8000 and 5173...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /F /PID %%P 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%P 2>nul
timeout /t 1 /nobreak >nul

echo Starting backend http://127.0.0.1:8000 and frontend http://127.0.0.1:5173
start "NOC Backend" cmd /k "cd /d "%ROOT%backend" && set PYTHONUNBUFFERED=1 && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app --reload-dir ..\mock-services"
start "NOC Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Two Command Prompt windows should open. Leave them running.
endlocal
