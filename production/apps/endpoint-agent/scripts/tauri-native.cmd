@echo off
setlocal

set "VSWHERE=C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" set "VSWHERE=C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
  echo Visual Studio Installer vswhere.exe was not found.
  exit /b 1
)

set "VSROOT="
for /f "usebackq tokens=*" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSROOT=%%I"

if not defined VSROOT (
  echo Visual Studio Build Tools with Desktop development with C++ is required.
  exit /b 1
)

if not exist "%VSROOT%\Common7\Tools\VsDevCmd.bat" (
  echo VsDevCmd.bat was not found under "%VSROOT%".
  exit /b 1
)

call "%VSROOT%\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 >nul
if errorlevel 1 exit /b %errorlevel%

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
corepack pnpm exec tauri %*
exit /b %errorlevel%
