; install-cli.nsh — NSIS include for the OhMyChiikawa Windows installer.
;
; Adds an optional `chiikawa` command-line launcher to the assisted installer:
;   * always writes chiikawa.cmd next to OhMyChiikawa.exe (a thin wrapper that
;     starts the app and maps --size onto the app's --scale flag; no Node.js);
;   * offers to add the install directory to the per-user PATH so `chiikawa`
;     works from any new terminal.
;
; electron-builder expands these macros inside its installer / uninstaller:
;   customInstall    — after the app files are written   (installer pass)
;   customUnInstall  — before the app files are removed   (uninstaller pass)
;
; IMPORTANT: electron-builder compiles this script twice — once for the
; installer (BUILD_UNINSTALLER undefined) and once for the uninstaller
; (BUILD_UNINSTALLER defined). Uninstaller-mode helpers such as StrFunc's
; ${UnStrRep} emit `un.`-prefixed code. Declaring them unconditionally leaks
; that code into the installer pass, where WriteUninstaller is never called,
; producing NSIS warning 6020 — which electron-builder treats as an error and
; which previously broke `npm run dist:win`. So they are declared ONLY inside
; the uninstaller pass below.

!include "LogicLib.nsh"

!ifdef BUILD_UNINSTALLER
  !include "StrFunc.nsh"
  ${UnStrRep}
!endif

; ----------------------------------------------------------------------
; customInstall  (installer pass — after the app is installed)
; ----------------------------------------------------------------------
!macro customInstall
  ; Always ship the launcher shim alongside the executable.
  SetOutPath "$INSTDIR"
  File "${BUILD_RESOURCES_DIR}\win\chiikawa.cmd"

  ; Offer to expose `chiikawa` on the user's PATH.
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Add the 'chiikawa' command to your PATH?$\n$\n\
    This lets you start OhMyChiikawa from any Command Prompt or PowerShell \
    window:$\n  chiikawa$\n  chiikawa --size small$\n  chiikawa --pet usagi" \
    /SD IDYES IDNO skipCliPath

  ReadRegStr $0 HKCU "Environment" "PATH"

  ; Already on PATH? (case-insensitive substring search)
  StrCpy $1 0
  ${If} $0 != ""
    System::Call 'shlwapi::StrStrIW(w r0, w "$INSTDIR")i.r1'
  ${EndIf}
  ${If} $1 <> 0
    MessageBox MB_OK|MB_ICONINFORMATION \
      "'$INSTDIR' is already on your PATH.$\n$\n\
      Open a NEW Command Prompt or PowerShell window and run:$\n  chiikawa"
    Goto skipCliPath
  ${EndIf}

  ; Compose the new PATH value.
  ${If} $0 == ""
    StrCpy $2 "$INSTDIR"
  ${Else}
    StrCpy $2 "$0;$INSTDIR"
  ${EndIf}

  ; Guard against the NSIS 8192-char string limit: if PATH is near it, the
  ; registry read was likely truncated, so don't risk rewriting a clipped PATH.
  StrLen $3 $2
  ${If} $3 > 8000
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "Could not add to PATH automatically (your PATH is very long).$\n$\n\
      To use 'chiikawa', add this folder to your PATH manually:$\n$INSTDIR"
    Goto skipCliPath
  ${EndIf}

  WriteRegExpandStr HKCU "Environment" "PATH" "$2"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  MessageBox MB_OK|MB_ICONINFORMATION \
    "The 'chiikawa' command is ready.$\n$\n\
    Open a NEW Command Prompt or PowerShell window and run:$\n  chiikawa$\n  chiikawa --help"

  skipCliPath:
!macroend

; ----------------------------------------------------------------------
; customUnInstall  (uninstaller pass — before the app is removed)
; ----------------------------------------------------------------------
!macro customUnInstall
  ; Remove the launcher shim we created.
  Delete "$INSTDIR\chiikawa.cmd"

  ; Remove the install directory from the per-user PATH. Strip the entry with
  ; an adjacent separator first (the common case), then any bare leftover.
  ReadRegStr $0 HKCU "Environment" "PATH"
  ${If} $0 != ""
    ${UnStrRep} $0 "$0" ";$INSTDIR" ""
    ${UnStrRep} $0 "$0" "$INSTDIR;" ""
    ${UnStrRep} $0 "$0" "$INSTDIR"  ""
    WriteRegExpandStr HKCU "Environment" "PATH" "$0"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}
!macroend
