@echo off
chcp 65001 >nul
cd /d D:\99.Work\Uganuga
call npm run build
robocopy dist _pages /MIR /XD .git /NFL /NDL /NJH /NP
cd _pages
type nul > .nojekyll
git add -A
git commit -m "게임 배포"
git push -f origin gh-pages
echo 1~2분 뒤 https://yeokangdong.github.io/uganuga/
pause
