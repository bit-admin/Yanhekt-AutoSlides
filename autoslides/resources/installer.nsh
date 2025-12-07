; Custom NSIS installer script for AutoSlides
; This script:
; 1. Sets the default installation directory to C:\Program Files\AutoSlides
; 2. Detects and removes old Squirrel installation from %LocalAppData%\AutoSlides

!macro preInit
  ; Set default installation directory for 64-bit systems
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES64\AutoSlides"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES64\AutoSlides"

  ; Set default installation directory for 32-bit systems
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES\AutoSlides"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES\AutoSlides"
!macroend

!macro customInit
  ; Check for old Squirrel installation in %LocalAppData%\AutoSlides
  Var /GLOBAL _OldInstallPath
  ExpandEnvStrings $_OldInstallPath "%LOCALAPPDATA%\AutoSlides"

  ; Check for old Squirrel installation
  IfFileExists "$_OldInstallPath\AutoSlides.exe" oldSquirrelFound
  IfFileExists "$_OldInstallPath\Update.exe" oldSquirrelFound
  Goto noOldInstall

  oldSquirrelFound:
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of AutoSlides was found at:$\r$\n$_OldInstallPath$\r$\n$\r$\nThis appears to be an older installation. Would you like to remove it before continuing?" IDYES removeOld IDNO noOldInstall

  removeOld:
    ; Remove the old Squirrel installation directory recursively
    RMDir /r "$_OldInstallPath"

    ; Also remove Squirrel shortcuts from Desktop and Start Menu
    Delete "$DESKTOP\AutoSlides.lnk"
    Delete "$SMPROGRAMS\AutoSlides.lnk"
    RMDir /r "$SMPROGRAMS\AutoSlides"

    ; Remove Squirrel uninstall registry entries if they exist
    SetRegView 64
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoSlides"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoSlides"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.squirrel.AutoSlides.AutoSlides"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.squirrel.AutoSlides.AutoSlides"
    SetRegView 32
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoSlides"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoSlides"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.squirrel.AutoSlides.AutoSlides"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.squirrel.AutoSlides.AutoSlides"

    MessageBox MB_OK|MB_ICONINFORMATION "Old installation removed successfully."

  noOldInstall:
!macroend
