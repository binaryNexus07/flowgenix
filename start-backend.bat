@echo off
echo.
echo  ==========================================
echo   FlowGenix — Starting Backend Server
echo  ==========================================
echo.

set PATH=%USERPROFILE%\AppData\Local\Programs\Python\Python312;%USERPROFILE%\AppData\Local\Programs\Python\Python312\Scripts;%PATH%

cd /d "%~dp0backend"

echo [1/2] Installing Python packages...
pip install -r requirements.txt --quiet

echo [2/2] Starting FastAPI server on http://localhost:8000
echo       API Docs: http://localhost:8000/docs
echo.
python main.py

pause
