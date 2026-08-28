@echo off
setlocal

set "TARGET_URL=%~1"

if "%TARGET_URL%"=="" (
    set "TARGET_URL=http://127.0.0.1:5500"
)

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
    set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if not exist "%CHROME%" (
    echo Chrome executable not found.
    pause
    exit /b 1
)

rem 교사용 Profile 5를 새 창으로 실행
start "" "%CHROME%" --profile-directory="Profile 5" --new-window "%TARGET_URL%"

rem Chrome이 첫 번째 프로필을 여는 동안 잠깐 대기
timeout /t 2 /nobreak >nul

rem 학생용 Default를 새 창으로 실행
start "" "%CHROME%" --profile-directory="Default" --new-window "%TARGET_URL%"

endlocal
exit /b 0