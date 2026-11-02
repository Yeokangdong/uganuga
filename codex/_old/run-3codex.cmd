@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 기존 그림 작업을 정리하고 Codex 3개로 나눠서 동시에 그립니다.
taskkill /fi "WINDOWTITLE eq ugauga-art*" /t /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq ugauga-title*" /t /f >nul 2>nul
timeout /t 2 >nul
start "ugauga-A-bg" /min cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\prompt-A-bg.txt" > "%cd%\art-src\codex-log-A.txt" 2>&1"
start "ugauga-B-title" /min cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\prompt-B-title.txt" > "%cd%\art-src\codex-log-B.txt" 2>&1"
start "ugauga-C-items" /min cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\prompt-C-items.txt" > "%cd%\art-src\codex-log-C.txt" 2>&1"
echo 시작했습니다. 로그: art-src\codex-log-A.txt / B / C
timeout /t 3 >nul
