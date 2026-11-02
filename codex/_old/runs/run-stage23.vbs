' ugauga art: stage 2/3 Codex jobs hidden (no window)
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\run-stage23.cmd""", 0, False
