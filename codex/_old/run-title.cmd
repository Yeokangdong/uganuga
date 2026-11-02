@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 진행 중인 그림 작업이 끝나면(DONE.txt) 타이틀 원화 작업을 이어서 시작합니다. 이 창은 최소화해 두세요.
:wait
if exist "%cd%\art-src\DONE.txt" goto go
timeout /t 20 /nobreak >nul
goto wait
:go
start "ugauga-title" /min cmd /c "codex exec -s workspace-write --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\codex-prompt-title.txt" > "%cd%\art-src\codex-log-title.txt" 2>&1"
