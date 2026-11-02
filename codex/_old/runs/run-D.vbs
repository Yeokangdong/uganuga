' ugauga art: attack + cave Codex job hidden (no window)
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\run-D.cmd""", 0, False
