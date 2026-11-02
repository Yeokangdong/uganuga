@echo off
chcp 65001 >nul
rem 창 없이 실행하려면 같은 폴더의 run-3codex.vbs 를 더블클릭
cd /d "%~dp0.."
set ROOT=%cd%
set CX=%ROOT%\codex
rem [1] 기존 그림 작업 정리 (창 제목 방식 + 숨김 실행 방식 모두)
taskkill /fi "WINDOWTITLE eq ugauga-*" /t /f >nul 2>nul
powershell -NoProfile -WindowStyle Hidden -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*codex*exec*ugauga*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 >nul
rem [2] art-src 정리: 지시서/배치/스크립트/로그 → codex 폴더
if not exist "%CX%\logs" mkdir "%CX%\logs"
if not exist "%CX%\tools" mkdir "%CX%\tools"
if not exist "%CX%\_old" mkdir "%CX%\_old"
for %%F in ("%ROOT%\art-src\*.md" "%ROOT%\art-src\*.cmd" "%ROOT%\art-src\codex-prompt*.txt" "%ROOT%\art-src\prompt-*.txt" "%ROOT%\art-src\generation-prompts.json") do if exist "%%~F" move /y "%%~F" "%CX%\_old\" >nul
for %%F in ("%ROOT%\art-src\*.ps1") do if exist "%%~F" move /y "%%~F" "%CX%\tools\" >nul
for %%F in ("%ROOT%\art-src\codex-log*.txt") do if exist "%%~F" move /y "%%~F" "%CX%\logs\" >nul
if exist "%ROOT%\art-src\progress.txt" move /y "%ROOT%\art-src\progress.txt" "%CX%\progress.txt" >nul
for %%F in ("%ROOT%\art-src\DONE*.txt") do if exist "%%~F" move /y "%%~F" "%CX%\_old\" >nul
rem [3] Codex 3개 동시 시작 (새 창 없이 백그라운드)
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-A-bg.txt" > "%CX%\logs\codex-A-bg.txt" 2>&1"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-B-title.txt" > "%CX%\logs\codex-B-title.txt" 2>&1"
start "" /b cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%ROOT%" - < "%CX%\prompt-C-items.txt" > "%CX%\logs\codex-C-items.txt" 2>&1"
echo started > "%CX%\logs\started.txt"
