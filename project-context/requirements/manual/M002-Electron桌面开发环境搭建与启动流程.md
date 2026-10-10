# M002 Electron 桌面开发环境搭建与启动流程

> 协作迁移说明（2026-10-10）：本文件保留历次方案与执行记录；当前状态以[事项台账](../../PEFR_PLAN.MD)及本文件最新记录为准。旧版本界面、发布流程和本机路径不自动成为现行要求。`<WORKBENCH_ROOT>` 表示克隆后的工作台根目录，`<SECONDARY_WORKSPACE>` 表示作者本机隔离验证目录，后者不是协作开发前提。


- 编号：M002
- 来源：用户明确要求记录全部环境布置流程，助手整理。
- 创建/更新日期：2026-09-17
- 状态：流程已整理；当前电脑桌面启动已验证，模型调用待验证。
- 验证范围：现有环境的桌面测试 32 项通过，启动入口和界面加载成功；没有在空目录重新安装整套环境。
- 返回：[项目台账](../../PEFR_PLAN.MD)
- 前置流程：[M001 Windows 独立运行环境搭建流程](M001-Windows独立运行环境搭建流程.md)

## 1. 适用范围与顺序

本流程使用系统 Node.js、工作台外置的 DSH 和 Electron，直接启动本地桌面源码。环境目录均与源码目录并列。这是**桌面开发模式**，尚未生成可以分发给其他电脑的 exe 安装包。

首次搭建顺序：完成 M001 第 2～5 节及第 6 节的“安装工作台插件”，再执行本文第 2～5 节。只使用桌面端时，可以跳过 M001 的网页版启动步骤；Electron 会自行启动后台宿主。

**当前电脑已经完成这些安装和适配，日常直接使用第 6 节，不需要重新安装或覆盖源码。**

| 位置（相对工作台根目录） | 作用 |
| --- | --- |
| runtime | DSH 0.1.5-rc.1、pnpm 11.24.0 |
| runtime-desktop | Electron 44.1.1 及其 npm 依赖 |
| runtime-desktop/cache | Electron 下载缓存 |
| dsh-data | 已安装的 web 插件 0.3.23、模型配置与会话 |
| desktop-state | Electron 状态、会话缓存与日志，首次启动自动生成 |
| dsh-web-0.3.23/desktop | 桌面源码 |
| start-desktop.ps1、启动桌面端.cmd | 桌面启动入口 |

系统 Node.js 不复制进上述目录。本机此前核实版本为 24.13.1；本流程要求至少 22.12.0。npm 自身的缓存仍使用系统原有设置。

## 2. 创建独立 Electron 环境

在 PowerShell 中执行；本节及后续安装命令使用同一个终端窗口：

```powershell
$base = '<WORKBENCH_ROOT>'
$desktopRuntime = Join-Path $base 'runtime-desktop'
New-Item -ItemType Directory -Force -Path $desktopRuntime | Out-Null
$env:electron_config_cache = Join-Path $desktopRuntime 'cache'
npm.cmd install --prefix "$desktopRuntime" --save-dev --save-exact electron@44.1.1
```

**写法与原因：**固定路径用单引号，含变量的路径用双引号；Join-Path 拼接子目录。-Force 允许目录已存在。--prefix 把依赖安装在独立目录，--save-dev 将 Electron 记为开发依赖，--save-exact 固定版本。缓存变量让 Electron 下载文件放在该环境内；npm.cmd 避免同名 PowerShell 脚本的执行策略影响。

```powershell
& "$desktopRuntime\node_modules\.bin\electron.cmd" --version
```

**写法与原因：**带引号的程序路径前使用 & 才会执行；--version 用于检查 Electron 是否可运行。首次调用如触发二进制下载，等待完成，应输出 v44.1.1。

成功后，Electron 本体应位于 runtime-desktop/node_modules/electron/dist/electron.exe。仅看到 node_modules 文件夹，不能独立证明程序本体已可运行。

## 3. 接入外部运行环境

原版桌面代码按内置运行载荷启动，仅安装 Electron 还不足以直接复用 runtime 和 dsh-data。当前源码已完成以下适配：

| 文件 | 必要改动及原因 |
| --- | --- |
| [runtime.cjs](../../../deepseek_harness_desktop/desktop/src/runtime.cjs) | 从 DSH_DESKTOP_DEV_ROOT 和 DSH_DESKTOP_NODE 解析外部运行路径；验证路径及已有 web profile。显式开启开发模式后才使用这些路径。 |
| [main.cjs](../../../deepseek_harness_desktop/desktop/src/main.cjs) | 使用外部 Node/DSH，把 Electron 状态放入 desktop-state；开发模式复用既有 profile，不用桌面内置种子覆盖已有配置。 |
| [runtime.test.mjs](../../../deepseek_harness_desktop/desktop/tests/runtime.test.mjs) | 检查开发模式隔离、路径约束和 profile 保留行为。 |

原有打包模式仍使用其内置运行载荷。实现依据及先前验证记录见 [A003](../auto/A003-桌面开发启动实施与验证.md)。

### 仅在从原版 0.3.23 重新搭建时执行

为使流程可重建，本文保存了上述三个文件的[适配快照](附件/M002/适配快照/desktop/)，内容来自 2026-09-17 已验证的本地源码。重新准备原版 dsh-web-0.3.23 源码后，可以复制快照完成同一适配，无需手工逐行修改。

**当前已适配的项目跳过这一步。以下复制只适用于没有自己修改过的同版本源码；如果后续做了二次开发，应合并对应改动，不能用旧快照覆盖新代码。**

```powershell
$manual = Join-Path $base '需求文档\手动'
$snapshot = Join-Path $manual '附件\M002\适配快照\desktop'
$desktopSource = Join-Path $base 'dsh-web-0.3.23\desktop'
Copy-Item -LiteralPath (Join-Path $snapshot 'src\runtime.cjs') -Destination (Join-Path $desktopSource 'src\runtime.cjs')
Copy-Item -LiteralPath (Join-Path $snapshot 'src\main.cjs') -Destination (Join-Path $desktopSource 'src\main.cjs')
Copy-Item -LiteralPath (Join-Path $snapshot 'tests\runtime.test.mjs') -Destination (Join-Path $desktopSource 'tests\runtime.test.mjs')
```

**写法与原因：**先分别定义附件目录和源码目录，再逐个复制指定文件。-LiteralPath 将路径按原样处理；明确列出三个文件便于核对覆盖范围。此步骤恢复的是已验证适配，不安装依赖，不替换模型配置。

快照只包含运行适配和对应测试；此前源码里的中英文说明与 Agent Note 不属于启动必需文件。保留“需求文档”时请连同附件子目录一起保存。

## 4. 放置启动入口

首次重建时，把随文保存的两个启动文件复制到工作台根目录。当前根目录已存在这两个入口，不需要重复复制。

```powershell
$launcherFiles = Join-Path $base '需求文档\手动\附件\M002\启动入口'
Copy-Item -LiteralPath (Join-Path $launcherFiles 'start-desktop.ps1') -Destination (Join-Path $base 'start-desktop.ps1')
Copy-Item -LiteralPath (Join-Path $launcherFiles '启动桌面端.cmd') -Destination (Join-Path $base '启动桌面端.cmd')
```

**写法与原因：**两个文件必须位于同一个工作台根目录。PowerShell 脚本通过自身位置定位环境，CMD 文件通过自身位置调用该脚本，因此工作台路径中含空格、中文也能正确定位。

启动入口的内容和写法说明：

| 附件 | 关键规则与原因 |
| --- | --- |
| [start-desktop.ps1](附件/M002/启动入口/start-desktop.ps1) | 使用 $PSScriptRoot 定位根目录；Join-Path 组合路径；先检查必要文件。通过 Get-Command 选取 PATH 中第一个 node.exe，设置外部开发环境变量，再用 Start-Process 打开 Electron。源码路径作为带引号的独立参数传入，支持空格。 |
| [启动桌面端.cmd](附件/M002/启动入口/启动桌面端.cmd) | 使用 %~dp0 定位脚本所在目录，并以双引号包住路径。-NoProfile 避免个人 PowerShell 配置干扰；-ExecutionPolicy Bypass 只作用于本次进程，不改变系统长期执行策略；失败时 pause 保留错误信息。 |

PowerShell 启动脚本还会移除当前子进程环境中的 ELECTRON_RUN_AS_NODE，确保 Electron 打开应用窗口。这是启动入口的正常环境设置，用户不需要额外执行命令。

## 5. 首次启动与检查

双击工作台根目录的 [启动桌面端.cmd](../../../启动桌面端.cmd)。也可以在新开的 PowerShell 中执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<WORKBENCH_ROOT>\start-desktop.ps1'
```

**写法与原因：**-File 后跟完整脚本路径，单引号保留空格和中文。脚本会设置本次启动需要的环境变量，因此不必在终端额外准备 PATH 或 DSH_HOME；策略参数仅作用于这个 PowerShell 进程。

成功标准：

1. 出现 DeepSeek Harness 桌面窗口，页面加载完成。
2. desktop-state 中生成状态目录，日志位于 desktop-state/logs/dsh-host.log。
3. 设置页使用既有 dsh-data 中的配置；新环境需要自行填写模型供应商和 API Key。
4. 选择工作区和模型，发一条简单请求并得到回复，才算完成模型验证。

桌面端自动选择本机 3082～3181 范围内的空闲端口；不需要手动填写固定端口，也不需要先启动网页版。日志和访问地址可能含认证信息，不把实际令牌复制到文档中。

当前已验证第 1、2 项及既有数据路径接入；模型请求尚未验证。此次归档没有重新启动服务，也没有发送模型请求。

## 6. 日常启动、退出与改源码

- **日常启动：**双击工作台根目录的“启动桌面端.cmd”，无需重复安装依赖。
- **退出：**确认桌面任务已结束后关闭窗口；应用按原有生命周期停止自己启动的后台宿主。单独运行的网页版由对应终端管理。
- **改桌面代码：**当前加载本地 desktop 源码，修改主进程后退出并重新打开桌面端，不必制作 exe 安装包。
- **改功能插件：**当前 web profile 加载的是已安装的 0.3.23 发布包。修改源码目录中的功能插件，还需另行构建并接入本地插件；这项工作尚未实施，不能把桌面能运行等同于插件源码已联动。
- **制作分发包：**属于后续打包任务，需要准备内置运行载荷和打包工具；不在本次环境流程内。

## 7. 核对依据与版本记录

版本依据：本地 runtime、runtime-desktop 的依赖记录，以及 desktop/package-lock.json。桌面源码、启动入口和附件快照以 2026-09-17 当前文件为准。安装参考：[Electron 官方安装文档](https://www.electronjs.org/docs/latest/tutorial/installation)。

现有环境验证记录：桌面测试 32 项通过、文档检查通过、启动入口实际执行成功、日志出现 GUI loaded。此次文档归档另行检查附件与现有文件一致、Markdown 链接和启动脚本语法，不等同于空目录重装测试。

更新记录：2026-09-17 创建，补齐 Electron 安装、外部环境适配、启动入口、日常使用及可重建附件；只记录正常流程。
