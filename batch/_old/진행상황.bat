@echo off
chcp 65001 >nul
set CX=D:\99.Work\Uganuga\codex
echo [실행 중]
dir /b "%CX%\running\*.txt" 2>nul
echo.
echo [대기 중]
dir /b "%CX%\queue\*.txt" 2>nul
echo.
echo [최근 끝난 작업 5개]
powershell -NoProfile -Command "Get-ChildItem '%CX%\done\*.txt' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { $_.Name }"
echo.
echo [최근 보고서 3개]
powershell -NoProfile -Command "Get-ChildItem '%CX%\reports\*.md' | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object { $_.Name }"
pause
