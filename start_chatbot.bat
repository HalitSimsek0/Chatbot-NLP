@echo off
echo ========================================
echo   ISTE ChatBot Baslatiliyor...
echo ========================================
echo.

cd /d D:\ChatBot

echo [1/2] Backend baslatiliyor (Port 8000)...
start "ISTE ChatBot - Backend" powershell -NoExit -Command "cd D:\ChatBot\backend; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload"

echo [2/2] Frontend baslatiliyor (Port 5173)...
timeout /t 3 /nobreak >nul
start "ISTE ChatBot - Frontend" cmd /k "cd /d D:\ChatBot\arayuz && npm run dev"

echo.
echo ========================================
echo   ChatBot baslatildi!
echo   Backend: http://127.0.0.1:8000
echo   Frontend: http://localhost:5173
echo ========================================
echo.
echo Durdurmak icin: stop_chatbot.bat dosyasini calistirin
echo veya her iki pencerede Ctrl+C basin
echo.
pause




