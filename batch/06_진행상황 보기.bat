@echo off
chcp 65001 >nul
set CX=D:\99.Work\Uganuga\codex
echo [작업 관리자 마지막 신호]
type "%CX%\dispatcher-alive.txt"
echo.
echo [실행 중]
dir /b "%CX%\running\*.txt" 2>nul
echo.
echo [대기 중]
dir /b "%CX%\queue\*.txt" 2>nul
echo.
echo [최근 끝난 작업 5개]
powershell -NoProfile -Command "Get-ChildItem '%CX%\done\*.txt' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { $_.Name }"
echo.
echo [팀장 체제 자동 기록 최근 5줄]
powershell -NoProfile -Command "if (Test-Path '%CX%\reports\AUTO_팀장체제.md') { Get-Content -Encoding UTF8 '%CX%\reports\AUTO_팀장체제.md' -Tail 5 }"
pause
