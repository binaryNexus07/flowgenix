@echo off
title FlowGenix Frontend - localhost:3000
echo.
echo  ==========================================
echo   FlowGenix Frontend
echo   http://localhost:3000
echo  ==========================================
echo.
cd /d "C:\Users\sumit\.gemini\antigravity\scratch\flowgenix\frontend"
echo Starting Next.js... please wait 15-20 seconds...
echo.
node_modules\.bin\next.cmd dev
pause
