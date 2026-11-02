@echo off
chcp 65001 >nul
echo [우가누가] 조직 멈춤 - 작업 관리자 정지 (돌던 작업은 끝까지 감, 새 작업은 안 나감)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dispatcher.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo 멈춤 완료. 다시 하려면 23_팀_재개.
pause
