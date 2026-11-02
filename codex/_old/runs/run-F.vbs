' ugauga art: redo title logo hidden (no window)
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\run-F.cmd""", 0, False
