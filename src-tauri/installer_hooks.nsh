!include "LogicLib.nsh"

!macro NSIS_HOOK_PREINSTALL
  ; Check if legacy METH VTC Hub is installed in HKCU
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\METH VTC Hub" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\METH VTC Hub" "InstallLocation"
    ${If} $1 != ""
      ExecWait '$0 /S _?=$1'
    ${Else}
      ExecWait '$0 /S'
    ${EndIf}
  ${EndIf}

  ; Check if legacy METH VTC Hub is installed in HKLM
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\METH VTC Hub" "UninstallString"
  ${If} $2 != ""
    ReadRegStr $3 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\METH VTC Hub" "InstallLocation"
    ${If} $3 != ""
      ExecWait '$2 /S _?=$3'
    ${Else}
      ExecWait '$2 /S'
    ${EndIf}
  ${EndIf}

  ; Check if old Aura VTC Hub exists and clean up
  ReadRegStr $4 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aura VTC Hub" "UninstallString"
  ${If} $4 != ""
    ExecWait '$4 /S'
  ${EndIf}

  ; Remove legacy desktop and start menu shortcuts
  Delete "$DESKTOP\METH VTC Hub.lnk"
  Delete "$DESKTOP\Aura VTC Hub.lnk"
  Delete "$SMPROGRAMS\METH VTC Hub.lnk"
  Delete "$SMPROGRAMS\METH VTC Hub\METH VTC Hub.lnk"
  RMDir "$SMPROGRAMS\METH VTC Hub"
  Delete "$SMPROGRAMS\Aura VTC Hub.lnk"
  Delete "$SMPROGRAMS\Aura VTC Hub\Aura VTC Hub.lnk"
  RMDir "$SMPROGRAMS\Aura VTC Hub"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Ensure new desktop shortcut is created
  CreateShortcut "$DESKTOP\MY HUB.lnk" "$INSTDIR\app.exe"

  ; Ensure Start Menu shortcut exists with AppUserModelId (Required for Windows Action Center Toast Notifications)
  CreateDirectory "$SMPROGRAMS\MY HUB"
  CreateShortcut "$SMPROGRAMS\MY HUB\MY HUB.lnk" "$INSTDIR\app.exe" "" "$INSTDIR\app.exe" 0 "" "" "MY HUB Fleet Management"

  ; Register AUMID into registry so Windows Notification Center always routes toasts
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.methvtc.hub" "DisplayName" "MY HUB"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.methvtc.hub" "IconUri" "$INSTDIR\app.exe,0"
!macroend
