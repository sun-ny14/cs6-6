@echo off
setlocal DisableDelayedExpansion
rem Run Go Live first. This opens the student window without reconfiguring VS Code.
call "%~dp0.vscode\open-two-views.cmd" "http://127.0.0.1:5500/index.html" student
if errorlevel 1 pause
endlocal
