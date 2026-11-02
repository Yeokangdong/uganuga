@echo off
chcp 65001 >nul
rem 창 없이 실행하려면 run-stage23.vbs 를 더블클릭. 지금 돌고 있는 다른 Codex 작업은 건드리지 않음
cd /d "%~dp0.."
set ROOT=%cd%
set CX=%ROOT%\codex
if not exist "%CX%\logs" mkdir "%CX%\logs"
if not exist "%ROOT%\art-src\stage2" mkdir "%ROOT%\art-src\stage2"
if not exist "%ROOT%\art-src\stage3" mkdir "%ROOT%\art-src\stage3"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-S2.txt" > "%CX%\logs\codex-S2.txt" 2>&1"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-S3.txt" > "%CX%\logs\codex-S3.txt" 2>&1"
echo started > "%CX%\logs\started-stage23.txt"
