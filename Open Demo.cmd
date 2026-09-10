@echo off
setlocal
set "PMO_PS=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if exist "%PMO_PS%" goto launch
set "PMO_PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if exist "%PMO_PS%" goto launch
set "PMO_PS=pwsh.exe"
where pwsh.exe >nul 2>&1
if not errorlevel 1 goto launch
echo PowerShell 7.5 or later is required. Use an installed version or the Codex bundled runtime.
pause
exit /b 1
:launch
"%PMO_PS%" -NoLogo -NoProfile -File "%~dp0scripts\open-hub.ps1" -Showcase
if "%ERRORLEVEL%"=="2" goto starting
if not errorlevel 1 exit /b 0
echo.
echo The demonstration could not be opened. Read the message above; no project data was reset.
pause
exit /b 1
:starting
echo.
echo The server is still starting. Double-click Open Demo.cmd again to continue waiting.
pause
exit /b 0
