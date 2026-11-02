@echo off
chcp 65001 >nul
cd /d D:\99.Work\ugauga
set LOG=D:\99.Work\ugauga\codex\reports\pages_push.txt
(
call npm run build
if not exist _pages mkdir _pages
robocopy dist _pages /MIR /XD .git /NFL /NDL /NJH /NP
cd _pages
type nul > .nojekyll
git config --global --add safe.directory D:/99.Work/ugauga/_pages
if not exist .git git init
git config user.name "Yeokangdong"
git config user.email "durkdehd@gmail.com"
git add -A
git commit -q -m "게임 배포"
git branch -M gh-pages
git remote remove origin
git remote add origin https://github.com/Yeokangdong/uganuga.git
git push -u -f origin gh-pages
echo DONE
) > %LOG% 2>&1
type %LOG%
pause
