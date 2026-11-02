@echo off
chcp 65001 >nul
cd /d "%~dp0.."
where codex >nul 2>nul
if errorlevel 1 (
  echo [오류] codex 명령을 찾을 수 없습니다. Codex CLI 설치가 필요합니다: npm i -g @openai/codex
  pause
  exit /b 1
)
echo 우가우가 그림 생성을 백그라운드로 시작합니다. 진행 로그: art-src\codex-log.txt
start "ugauga-art" /min cmd /c "codex exec --full-auto --skip-git-repo-check -C "%cd%" - < "%cd%\art-src\codex-prompt.txt" > "%cd%\art-src\codex-log.txt" 2>&1"
timeout /t 3 >nul
