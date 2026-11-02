@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set ROOT=%cd%
set CX=%ROOT%\codex
if not exist "%CX%\logs" mkdir "%CX%\logs"
if not exist "%ROOT%\art-src\ui" mkdir "%ROOT%\art-src\ui"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-E.txt" > "%CX%\logs\codex-E-cave-ui.txt" 2>&1"
echo started > "%CX%\logs\started-E.txt"
