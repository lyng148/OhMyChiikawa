@echo off
setlocal enabledelayedexpansion
rem ----------------------------------------------------------------------
rem install-cli.bat — add the `chiikawa` command to your PATH (manual setup).
rem
rem The OhMyChiikawa installer already offers to do this for you. Run this
rem script only if you skipped that step, or want to set it up again.
rem
rem It adds the OhMyChiikawa install folder — which contains OhMyChiikawa.exe
rem and the chiikawa.cmd launcher — to your user PATH, so that from any new
rem Command Prompt or PowerShell window you can run:
rem   chiikawa
rem   chiikawa --size small
rem   chiikawa --pet usagi
rem
rem No Node.js required: chiikawa.cmd simply launches OhMyChiikawa.exe.
rem ----------------------------------------------------------------------

rem This script ships at <install>\resources\packaging\win\install-cli.bat,
rem so the install root is three levels up.
set "APP_DIR=%~dp0..\..\.."
pushd "%APP_DIR%" 2>nul && set "APP_DIR=%CD%" && popd

if not exist "%APP_DIR%\OhMyChiikawa.exe" (
    echo ERROR: Could not locate OhMyChiikawa.exe.
    echo Looked in: %APP_DIR%
    echo Please run this script from inside the installed OhMyChiikawa folder.
    pause
    exit /b 1
)

rem The installer normally creates chiikawa.cmd; recreate a minimal launcher
rem if it is missing (e.g. a hand-copied install).
if not exist "%APP_DIR%\chiikawa.cmd" (
    echo Creating chiikawa.cmd launcher...
    > "%APP_DIR%\chiikawa.cmd" echo @echo off
    >> "%APP_DIR%\chiikawa.cmd" echo start "" "%%~dp0OhMyChiikawa.exe" %%*
)

rem Read the current user PATH from the registry.
set "CUR_PATH="
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v PATH 2^>nul`) do set "CUR_PATH=%%B"

rem Already present? (boundary-delimited, case-insensitive)
echo ;!CUR_PATH!; | findstr /i /c:";%APP_DIR%;" >nul
if not errorlevel 1 (
    echo '%APP_DIR%' is already on your PATH.
    echo Open a NEW Command Prompt or PowerShell window and run:  chiikawa
    pause
    exit /b 0
)

if defined CUR_PATH (
    set "NEW_PATH=!CUR_PATH!;%APP_DIR%"
) else (
    set "NEW_PATH=%APP_DIR%"
)

reg add "HKCU\Environment" /v PATH /t REG_EXPAND_SZ /d "!NEW_PATH!" /f >nul
if errorlevel 1 (
    echo WARNING: Could not update PATH in the registry.
    echo To use chiikawa, add this folder to your PATH manually:
    echo   %APP_DIR%
    pause
    exit /b 1
)

echo Added to PATH: %APP_DIR%
echo.
echo Done! Open a NEW Command Prompt or PowerShell window and run:
echo   chiikawa
echo   chiikawa --size small
echo   chiikawa --pet usagi
pause
exit /b 0
