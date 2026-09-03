@echo off
setlocal DisableDelayedExpansion
set "CS6_SETUP_ROOT=%~dp0"
if not exist "%CS6_SETUP_ROOT%index.html" (
    echo Put this file next to the project's index.html and run it again.
    pause
    exit /b 1
)
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $root=$env:CS6_SETUP_ROOT; $file=Join-Path $root '.vscode\settings.json'; $launcher=Join-Path $root '.vscode\open-two-views.cmd'; if (!(Test-Path -LiteralPath $launcher)) { throw 'Extract all ZIP files into the existing project folder first.' }; $settings=[pscustomobject]@{}; if (Test-Path -LiteralPath $file) { $settings=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json; $backup=$file+'.two-windows-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'); Copy-Item -LiteralPath $file -Destination $backup; }; $updates=@{'liveServer.settings.AdvanceCustomBrowserCmdLine'=([string][char]34+$launcher+[char]34); 'liveServer.settings.CustomBrowser'=$null; 'liveServer.settings.NoBrowser'=$false}; $defaults=@{'liveServer.settings.host'='127.0.0.1'; 'liveServer.settings.port'=5500; 'liveServer.settings.root'='/'}; foreach ($key in $defaults.Keys) { if ($null -eq $settings.PSObject.Properties[$key]) { $updates[$key]=$defaults[$key] } }; foreach ($key in $updates.Keys) { $settings | Add-Member -MemberType NoteProperty -Name $key -Value $updates[$key] -Force }; [IO.File]::WriteAllText($file,($settings | ConvertTo-Json -Depth 50)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false))); Write-Host 'Two-window Go Live setup complete.'"
if errorlevel 1 (
    echo Setup failed. See the error above. No administrator permission is needed.
    pause
    exit /b 1
)
echo Stop Live Server, then click Go Live again.
echo Your existing host and port were preserved to keep saved logins.
echo Or double-click open-two-windows.cmd after starting Live Server.
echo Teacher: Chrome Profile 5. Student: Separate student browser.
pause
endlocal
exit /b 0
