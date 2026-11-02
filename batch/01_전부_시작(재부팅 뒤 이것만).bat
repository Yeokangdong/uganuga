@echo off
chcp 65001 >nul
echo [우가누가] 전부 시작 - 작업 관리자 + 게임 서버
powershell -NoProfile -Command "Start-Process wscript.exe -ArgumentList '\"D:\99.Work\Uganuga\codex\dispatcher.vbs\"' -WindowStyle Hidden"
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)) { Start-Process cmd.exe -ArgumentList '/c cd /d D:\99.Work\Uganuga && npx vite preview --port 4173 --strictPort' -WindowStyle Hidden }"
timeout /t 5 >nul
type D:\99.Work\Uganuga\codex\dispatcher-alive.txt
echo 시작 완료. (시작프로그램 등록 안 함 - 재부팅 뒤 이 파일만 실행)
pause
