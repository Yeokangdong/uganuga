@echo off
chcp 65001 >nul
cd /d D:\99.Work\Uganuga
git add -A
git commit -m "대표 수동 저장"
git push origin main
pause
