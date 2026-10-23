# DeepSeek Harness 工作台

Windows x64 桌面工作台。**首次安装需要本仓库源码和配套离线安装包，两者缺一不可。** Git 不保存运行环境、安装 ZIP、个人密钥、聊天记录或本机协作资料。

当前配套版本：`2026.10.23-r14-win-x64`。

## 1. 获取源码和离线包

从 [仓库首页](https://github.com/yexisui/deepseek-harness-Workbench) 获取源码；可以使用 Git 克隆，也可以选择 Code → Download ZIP 后解压。升级已有安装时使用 Git 更新，并先关闭工作台。

```powershell
git clone https://github.com/yexisui/deepseek-harness-Workbench.git
cd deepseek-harness-Workbench
```

这两行分别下载源码并进入项目根目录；只有使用 Git 的方式才需要预先安装 Git。代码助手处理 Git 项目也需要系统 Git。

打开 [r14 离线版本下载页](https://github.com/yexisui/deepseek-harness-Workbench/releases/tag/offline-2026.10.23-r14)，下载以下两个附件，原样放入项目根目录的 `offline-delivery`：

- `DeepSeek-Workbench-Offline-2026.10.23-r14-win-x64.zip`
- `DeepSeek-Workbench-Offline-2026.10.23-r14-win-x64.zip.sha256`

不要下载发布页自动生成的 Source code 代替离线安装包，也不要手动解压安装 ZIP。仓库为私有时，获取源码与附件均需仓库访问权限。离线电脑可由其他电脑下载后通过移动存储复制源码及这两个文件。

建议 `offline-delivery` 中只放本次所需版本；多个包存在时，安装器按文件修改时间选择最新者。安装器自动核对同名 SHA256 文件，不要自行修改校验值。

## 2. 安装与启动

系统要求：Windows x64、Windows PowerShell 5.1 和系统 .NET Framework。将项目放在本机可写目录，避免网络共享盘。支持中文及空格路径。

1. 确认根目录有 `一键部署.cmd`、`启动桌面端.cmd`、`deploy.ps1` 和 `offline-delivery`。
2. 关闭正在运行的工作台，双击 **一键部署.cmd**，等待出现 `Deployment completed.`。
3. 双击 **启动桌面端.cmd**。
4. 在工作台设置中的模型/服务配置入口填写自己的服务地址、模型和 API Key，再进行一次简单对话确认服务可用。共享配置不包含原电脑的密钥。

离线包内置便携 Node.js、Electron、宿主与插件依赖、FFmpeg/ffprobe、Everything/ES、OpenCode、Monaco，以及共享能力记录需要的程序文件。无需预装 Node.js、npm、Python 或设置这些工具的系统 PATH。

首次部署文件搜索所需的 Everything 索引服务时，Windows 可能请求管理员授权；已有运行中的服务直接复用。安装包不代替操作系统组件；遇到缺少系统 DLL 的明确错误时，按错误修复对应系统组件。

**离线安装不代表在线模型可以断网使用。** 模型、网页访问或其他外部服务仍需可访问的网络和相应配置。普通启动不会下载依赖。

## 3. 升级、检查与修复

已有安装先关闭工作台，更新 Git 源码，放入与版本说明匹配的新离线包，再运行同一个 `一键部署.cmd`。安装器校验受管理的程序文件，复用一致文件，修复缺失或不同的文件。

```powershell
.\一键部署.cmd -Mode Check
.\一键部署.cmd -Repair
```

在项目根目录的 PowerShell 中运行。第一行只检查已部署环境，不安装或解压；第二行修复程序文件。新包尚未部署时应先正常运行一键部署，再使用 Check。

保留 `dsh-data`、`chat-data`、`desktop-state` 和 `settings-local`；它们包含个人配置、会话、任务或本地备份。不要通过删除这些目录解决程序缺项。共享设置由安装器按快照合并，个人凭据和历史任务保留；安装器必要的注册配置备份位于 `offline-state/backups`。不要执行 `git clean -fdx`，它会删除被 Git 忽略的数据及安装环境。

离线交付是预构建程序，`-Mode Build` 不适用于此安装流程。修改源码后需由维护者重新构建并交付离线包，单独拉取源码不能保证运行程序已经更新。

## 4. 可选浏览器插件

部署后，可选包位于 `offline/capability-packages/BrowserSkill-0.3.0-offline.zip`。需要浏览器能力时，关闭工作台，将这个**可选包**解压到项目根目录；在 Chrome/Edge 扩展管理中启用开发者模式，加载 `runtime/browserskill/0.3.0/extension`，然后重启工作台。它不是能力管理中导入的能力 ZIP。

代码助手使用工作台已配置的模型。当前版本暂不支持带 `.opencode`、`opencode.json` 或 `opencode.jsonc` 原生配置的项目，请使用不含这些配置的工程副本。

## 5. 常见问题

| 现象 | 处理 |
| --- | --- |
| 提示缺少离线包 | 将完整安装 ZIP 放在 `offline-delivery` 的直接下级，检查是否误下载了 Source code。不会自动联网补装。 |
| ZIP 校验失败 | 重新获取同一版本的 ZIP 和 SHA256 文件，确认复制完成后再部署。 |
| 缺少 `runtime-node/node.exe` 或插件程序 | 关闭客户端，运行一键部署或 `-Repair`，然后执行 Check；不需要借用系统 Node。 |
| Check 提示新包尚未准备 | 先正常运行一键部署，Check 本身不解压。 |
| Everything 服务未运行 | 重新部署并完成 Windows 授权，按提示检查服务状态。 |
| 程序启动失败 | 查看安装窗口错误及 `desktop-state/logs`；反馈时提供版本、报错和脱敏日志，不发送 Key 或完整业务数据。 |
| 界面能打开但模型不回复 | 检查模型、服务地址、密钥及网络；安装成功不等于模型服务已配置。 |

## 6. 维护与分发

源码、锁文件、工具清单、部署脚本和脱敏共享设置通过 Git 分发；安装 ZIP 与校验文件通过对应 Release 分发。本机 `project-context`、`AGENTS.MD`、`CLAUDE.md` 和测试录音不再跟踪；这些文件不是运行依赖。旧 Git 历史仍可能包含此前提交的协作资料。已有协作者拉取本次删除提交前，请先保存自己的协作资料修改。

维护者的离线包制作与验证步骤见 [离线制作说明](deepseek_harness_desktop/scripts/offline/README.txt)。外部工具来源、版本与校验见 [工具清单](external-tools/tools.json)。修改外部依赖后需同步工具清单、安装脚本与离线包，并验证新装、重复部署、修复和实际启动。
