@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
set CX=D:\99.Work\Uganuga\codex
echo 담당을 고르세요
echo  1 개발팀장  2 구현  3 테스트  4 정리  5 캐릭터  6 배경  7 UI이펙트
set /p R=번호: 
if "%R%"=="1" set ROLE=개발팀장
if "%R%"=="2" set ROLE=구현
if "%R%"=="3" set ROLE=테스트
if "%R%"=="4" set ROLE=정리
if "%R%"=="5" set ROLE=캐릭터
if "%R%"=="6" set ROLE=배경
if "%R%"=="7" set ROLE=UI이펙트
if not defined ROLE ( echo 잘못된 번호 & pause & exit /b )
set /p MSG=지시 내용: 
set MAX=0
for %%D in (queue running done) do for %%F in ("%CX%\%%D\*.txt") do for /f "delims=_" %%N in ("%%~nF") do (
  set /a T=%%N 2>nul
  if !T! gtr !MAX! set MAX=!T!
)
set /a N=MAX+1
set FILE=%CX%\queue\%N%_%ROLE%_대표지시.txt
> "%FILE%" echo [%ROLE%] %MSG% (%N%) — 파일 삭제 금지(필요시 _old로 이동). 창 띄우지 말 것. .bat 실행 금지.
>>"%FILE%" echo 결과: codex\reports\%ROLE%_%N%.md 5줄 이내.
if "%ROLE%"=="구현" >>"%FILE%" echo 끝나면 npm run build 성공 후 robocopy dist _pages /MIR /XD .git, cd _pages, git add -A, git commit, git push -f origin gh-pages, 루트에서 git add -A, git commit, git push origin main. 개발팀장 검수는 자동으로 붙음.
echo 넣었습니다: %FILE%
pause
