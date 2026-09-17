; NSIS custom script for DeepSeek Harness desktop installer and uninstaller

!include "x64.nsh"

; Check environment prerequisites before installation starts
!macro customInit
  ${If} ${RunningX64}
    SetRegView 64
    ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" "Installed"
    ${If} $0 != 1
      ${IfNot} ${FileExists} "$WINDIR\System32\vcruntime140.dll"
        MessageBox MB_YESNO|MB_ICONEXCLAMATION "检测到当前 Windows 系统缺少微软 Visual C++ 运行库（vcruntime140.dll）。$\r$\n$\r$\n没有该运行库，DeepSeek Harness 将无法启动内置后台服务。$\r$\n$\r$\n是否立即前往微软官网下载并安装？" IDNO skipVcPrompt
        ExecShell "open" "https://aka.ms/vs/17/release/vc_redist.x64.exe"
        skipVcPrompt:
      ${EndIf}
    ${EndIf}
    SetRegView 32
  ${EndIf}
!macroend

; Prompt user to clean up ~/.dsh and AppData during uninstallation
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时清除 DeepSeek Harness 的所有用户数据与历史会话？$\r$\n$\r$\n包括：$\r$\n- 历史会话记录、模型配置与密钥（$PROFILE\.dsh）$\r$\n- 应用运行日志与缓存（$APPDATA\dsh-desktop）$\r$\n$\r$\n点击【是】彻底清除数据$\r$\n点击【否】仅卸载应用程序，保留个人数据" IDNO skipCleanUserData
    RMDir /r "$PROFILE\.dsh"
    RMDir /r "$APPDATA\dsh-desktop"
  skipCleanUserData:
!macroend
