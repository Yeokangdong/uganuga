@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
set CX=D:\99.Work\Uganuga\codex
set MAX=0
for %%D in (queue running done) do for %%F in ("%CX%\%%D\*.txt") do for /f "delims=_" %%N in ("%%~nF") do (
  set /a T=%%N 2>nul
  if !T! gtr !MAX! set MAX=!T!
)
set /a N=MAX+1
set FILE=%CX%\queue\%N%_개발팀장_검수.txt
> "%FILE%" echo [개발팀장] 최근 구현 작업 검수 (%N%) — 코드 수정 금지, 검수만.
>>"%FILE%" echo codex\done 최근 구현 작업들과 git log 최근 커밋을 codex\DECISIONS.md 대비 검수. npm run build, 1~15판 진행 막힘(코드상).
>>"%FILE%" echo 결과: codex\reports\LEAD_%N%.md 표 "문제/근거(파일:줄)/고칠 방법/우선순위" 10줄 이내, 문제 없으면 "통과".
echo 넣었습니다: %FILE%
pause
