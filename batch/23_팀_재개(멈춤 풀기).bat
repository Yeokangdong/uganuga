@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Start-Process wscript.exe -ArgumentList '\"D:\99.Work\Uganuga\codex\dispatcher.vbs\"' -WindowStyle Hidden"
timeout /t 12 >nul
type D:\99.Work\Uganuga\codex\dispatcher-alive.txt
echo 팀 재개.
pause
