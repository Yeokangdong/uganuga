@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 진행 중인 그림 작업(낱장)을 멈추고 스프라이트 시트 방식으로 다시 시작합니다.
taskkill /fi "WINDOWTITLE eq ugauga-art*" /t /f >nul 2>nul
timeout /t 2 >nul
if not exist "%cd%\art-src\sheets" mkdir "%cd%\art-src\sheets"
start "ugauga-art2" /min cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\codex-prompt2.txt" > "%cd%\art-src\codex-log2.txt" 2>&1"
timeout /t 3 >nul
