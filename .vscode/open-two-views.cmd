@echo off
setlocal DisableDelayedExpansion

rem Keep the existing teacher profile; isolate the student browser session.
set "CS6_TEACHER_PROFILE=Profile 5"
set "CS6_STUDENT_DATA=%LOCALAPPDATA%\CS6-Classroom\StudentBrowser"
set "CS6_WINDOW_MODE=%~2"
set "CS6_LAUNCH_URL=%~1"
if not defined CS6_LAUNCH_URL set "CS6_LAUNCH_URL=http://127.0.0.1:5500/index.html"

rem Preserve Live Server's actual host/port; always open the classroom entry page.
for /f "tokens=1,2 delims=/" %%A in ("%CS6_LAUNCH_URL%") do set "CS6_LAUNCH_URL=%%A//%%B/index.html"

set "CS6_CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CS6_CHROME_EXE%" set "CS6_CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CS6_CHROME_EXE%" set "CS6_CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CS6_CHROME_EXE%" (
    echo Google Chrome was not found. Please install Chrome, then try again.
    pause
    exit /b 1
)

if /i "%CS6_WINDOW_MODE%"=="student" goto student
start "" "%CS6_CHROME_EXE%" --profile-directory="%CS6_TEACHER_PROFILE%" --new-window "%CS6_LAUNCH_URL%"

:student
rem A separate user-data directory keeps the student's login independent.
start "" "%CS6_CHROME_EXE%" --user-data-dir="%CS6_STUDENT_DATA%" --profile-directory="Default" --no-first-run --no-default-browser-check --new-window "%CS6_LAUNCH_URL%"

endlocal
exit /b 0
