@echo off
setlocal
rem ----------------------------------------------------------------------
rem chiikawa.cmd  —  command-line launcher for the INSTALLED OhMyChiikawa pet.
rem
rem The installer drops this file next to OhMyChiikawa.exe and (optionally)
rem puts that folder on your PATH, so you can start the desktop pet from any
rem Command Prompt or PowerShell window:
rem
rem   chiikawa
rem   chiikawa --size small
rem   chiikawa --pet usagi -s large
rem
rem This is a thin wrapper around OhMyChiikawa.exe — it needs NO Node.js.
rem The friendly --size / -s flag (small|medium|large) is mapped onto the
rem app's --scale flag; --pet / -p and any other arguments pass straight
rem through to the executable.
rem
rem (Not to be confused with the repository-root chiikawa.cmd, which runs the
rem source tree via `node chiikawa.js` for development.)
rem ----------------------------------------------------------------------

set "EXE=%~dp0OhMyChiikawa.exe"

if not exist "%EXE%" (
    echo ERROR: Cannot find OhMyChiikawa.exe next to this launcher.
    echo Expected: %EXE%
    exit /b 1
)

if /i "%~1"=="-h"     goto :help
if /i "%~1"=="help"   goto :help
if /i "%~1"=="--help" goto :help

set "ARGS="

:parse
if "%~1"=="" goto :launch
if /i "%~1"=="-s"     ( set "ARGS=%ARGS% --scale=%~2" & shift & shift & goto :parse )
if /i "%~1"=="--size" ( set "ARGS=%ARGS% --scale=%~2" & shift & shift & goto :parse )
if /i "%~1"=="-p"     ( set "ARGS=%ARGS% --pet=%~2"   & shift & shift & goto :parse )
if /i "%~1"=="--pet"  ( set "ARGS=%ARGS% --pet=%~2"   & shift & shift & goto :parse )
rem cmd.exe splits "key=value" on the '=', so --scale=large arrives here as
rem "--scale" + "large"; re-join it into the form the exe expects.
if /i "%~1"=="--scale" ( set "ARGS=%ARGS% --scale=%~2" & shift & shift & goto :parse )
set "A=%~1"
if /i "%A:~0,7%"=="--size=" ( set "ARGS=%ARGS% --scale=%A:~7%" & shift & goto :parse )
set "ARGS=%ARGS% %A%"
shift
goto :parse

:launch
start "" "%EXE%" %ARGS%
exit /b 0

:help
echo OhMyChiikawa - desktop pet launcher
echo.
echo Usage:
echo   chiikawa [--pet ^<usagi^|chiikawa^>] [--size ^<small^|medium^|large^>]
echo.
echo Examples:
echo   chiikawa
echo   chiikawa --size small
echo   chiikawa --pet usagi -s large
exit /b 0
