@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dispatcher.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo 작업 관리자를 껐습니다.
pause
