' ugauga art: cave hazards + primitive UI Codex job hidden (no window)
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\run-E.cmd""", 0, False
