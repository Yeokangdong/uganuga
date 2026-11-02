@echo off
chcp 65001 >nul
cd /d D:\99.Work\ugauga
set LOG=D:\99.Work\ugauga\codex\reports\restore_1101.txt
(
robocopy src codex\_old\src_1102 /E /NFL /NDL /NJH /NP
robocopy public\assets\stage-signs-v1 codex\_old\stage-signs_1102 *.webp *.json /NFL /NDL /NJH /NP
robocopy public\assets\stage-signs-v1\_old public\assets\stage-signs-v1 *.webp *.json /NFL /NDL /NJH /NP
if not exist _pages mkdir _pages
robocopy public _pages /MIR /XD .git /NFL /NDL /NJH /NP
robocopy codex\_restore_1101 _pages /E /NFL /NDL /NJH /NP
robocopy _pages dist /MIR /XD .git /NFL /NDL /NJH /NP
cd _pages
type nul > .nojekyll
git add -A
git commit -q -m "11/1 버전으로 되돌림"
git push -u -f origin gh-pages
echo DONE
) > %LOG% 2>&1
type %LOG%
pause
