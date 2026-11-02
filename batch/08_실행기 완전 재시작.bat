@echo off
chcp 65001 >nul
echo [우가누가] 작업 관리자 완전 재시작
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dispatcher.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
timeout /t 2 >nul
powershell -NoProfile -Command "Start-Process wscript.exe -ArgumentList '\"D:\99.Work\Uganuga\codex\dispatcher.vbs\"' -WindowStyle Hidden"
timeout /t 12 >nul
type D:\99.Work\Uganuga\codex\dispatcher-alive.txt
pause
