' 우가우가 그림 작업: Codex 3개를 창 없이 백그라운드로 실행
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\run-3codex.cmd""", 0, False
