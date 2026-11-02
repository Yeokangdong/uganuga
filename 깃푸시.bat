@echo off
chcp 65001 >nul
cd /d D:\99.Work\ugauga
set LOG=codex\reports\git_push.txt
(
git config --global --add safe.directory D:/99.Work/ugauga
git config user.name "Yeokangdong"
git config user.email "durkdehd@gmail.com"
git add -A
git commit -q -m "우가누가 첫 커밋 (15판 구성)"
git branch -M main
git log --oneline -1
git count-objects -vH
git remote remove origin
git remote add origin https://github.com/Yeokangdong/uganuga.git
git push -u origin main
echo DONE
) > %LOG% 2>&1
type %LOG%
pause
