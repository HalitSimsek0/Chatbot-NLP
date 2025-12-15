@echo off
echo ========================================
echo   ISTE ChatBot Durduruluyor...
echo ========================================
echo.

echo Python processleri durduruluyor...
taskkill /IM python.exe /F >nul 2>&1

echo Node.js processleri durduruluyor...
taskkill /IM node.exe /F >nul 2>&1

echo.
echo ========================================
echo   ChatBot durduruldu!
echo ========================================
echo.
timeout /t 2 /nobreak >nul




