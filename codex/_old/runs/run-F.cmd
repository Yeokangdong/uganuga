@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set ROOT=%cd%
set CX=%ROOT%\codex
if not exist "%CX%\logs" mkdir "%CX%\logs"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-F-logo.txt" > "%CX%\logs\codex-F-logo.txt" 2>&1"
echo started > "%CX%\logs\started-F.txt"
