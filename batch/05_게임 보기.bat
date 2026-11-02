@echo off
chcp 65001 >nul
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)) { Start-Process cmd.exe -ArgumentList '/c cd /d D:\99.Work\Uganuga && npx vite preview --port 4173 --strictPort' -WindowStyle Hidden; Start-Sleep 4 }"
start "" http://localhost:4173
