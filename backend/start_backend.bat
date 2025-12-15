@echo off
cd /d D:\ChatBot\backend
powershell -NoExit -Command ".\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload"



