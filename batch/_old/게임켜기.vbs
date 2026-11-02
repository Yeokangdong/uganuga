CreateObject("WScript.Shell").Run "cmd /c cd /d D:\99.Work\Uganuga && npx vite preview --port 4173 --strictPort", 0, False
CreateObject("WScript.Shell").Run "http://localhost:4173"
