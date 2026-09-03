@echo off
setlocal DisableDelayedExpansion
rem Start Live Server first. An optional URL overrides the default address.
set "CS6_DIRECT_URL=%~1"
if not defined CS6_DIRECT_URL set "CS6_DIRECT_URL=http://127.0.0.1:5500/index.html"
call "%~dp0.vscode\open-two-views.cmd" "%CS6_DIRECT_URL%"
if errorlevel 1 pause
endlocal
