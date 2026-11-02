@echo off
chcp 65001 >nul
set OLD=D:\99.Work\ugauga
set NEW=D:\99.Work\Uganuga
set LOG=D:\Claude_Batch\Uganuga\폴더이름변경_결과.txt
call :main > "%LOG%" 2>&1
type "%LOG%"
pause
exit /b

:main
if not exist "%OLD%" ( echo 이미 바뀜 또는 원래 폴더 없음 & exit /b )
dir /b "%OLD%\codex\running\*.txt" 2>nul | findstr . >nul && ( echo 실행 중인 작업이 있어 중단합니다. 진행상황.bat 확인 후 다시 실행 & exit /b )
echo [1] 작업 관리자·게임 서버 끄기
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*dispatcher.ps1*') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*ugauga*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
timeout /t 3 >nul
echo [2] 폴더 이름 변경
ren "%OLD%" Uganuga || ( echo 이름 변경 실패 - 폴더를 연 프로그램을 닫고 다시 실행 & exit /b )
echo [3] 경로 고치기
powershell -NoProfile -Command "$fs = @(Get-ChildItem 'D:\Claude_Batch\Uganuga' -File -Include *.bat,*.vbs,*.md -Recurse) + @(Get-Item 'D:\99.Work\Uganuga\AGENTS.md','D:\99.Work\Uganuga\codex\직접지시_안내.md','D:\99.Work\Uganuga\package.json' -ErrorAction SilentlyContinue); foreach($f in $fs){ $t=[IO.File]::ReadAllText($f.FullName); $n=$t.Replace('99.Work\ugauga','99.Work\Uganuga').Replace('99.Work/ugauga','99.Work/Uganuga').Replace('\"name\": \"ugauga\"','\"name\": \"uganuga\"'); if($n -ne $t){ [IO.File]::WriteAllText($f.FullName,$n,(New-Object Text.UTF8Encoding($false))); 'fixed ' + $f.Name } }"
git config --global --add safe.directory D:/99.Work/Uganuga
git config --global --add safe.directory D:/99.Work/Uganuga/_pages
echo [4] 작업 관리자 다시 켜기
start "" wscript.exe "D:\99.Work\Uganuga\codex\dispatcher.vbs"
echo DONE
exit /b
