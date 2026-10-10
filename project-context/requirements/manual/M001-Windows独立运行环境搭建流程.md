# M001 Windows 独立运行环境搭建流程

> 协作迁移说明（2026-10-10）：本文件保留历次方案与执行记录；当前状态以[事项台账](../../PEFR_PLAN.MD)及本文件最新记录为准。旧版本界面、发布流程和本机路径不自动成为现行要求。`<WORKBENCH_ROOT>` 表示克隆后的工作台根目录，`<SECONDARY_WORKSPACE>` 表示作者本机隔离验证目录，后者不是协作开发前提。


- 编号：M001
- 来源：用户明确要求，助手整理。
- 创建日期：2026-09-16；更新日期：2026-09-17
- 版本：第二版；公共环境和网页版流程，桌面部分见 M002。
- 验证范围：已核对本地命令帮助、CLI 实现及配置；未在空目录重新完成整套安装与启动测试。
- 返回：[项目台账](../../PEFR_PLAN.MD)

桌面完整流程见 [M002 Electron 桌面开发环境搭建与启动流程](M002-Electron桌面开发环境搭建与启动流程.md)。首次搭建桌面端，先完成本文第 2～5 节及第 6 节的插件安装，再进入 M002；已有环境日常使用无需重装。

## 1. 目标与准备

使用 Windows PowerShell 和电脑已有的 Node.js，将 DSH 工作台的工具、插件和数据放在独立目录中。

本流程安装已发布的 dsh-web 0.3.23，适用于当前“搭建环境并启动工作台”的目标，不涉及源码编译或 Electron 打包。

| 目录 | 用途 |
| --- | --- |
| <WORKBENCH_ROOT>\runtime | DSH 和 pnpm |
| <WORKBENCH_ROOT>\dsh-data | 插件、配置、凭据和会话 |
| <WORKBENCH_ROOT>\dsh-web-0.3.23 | 已有源码，保持独立 |

前提：电脑已安装 Node.js 22.12.0 或更高版本（兼顾后续 Electron 环境要求），并能联网下载依赖；此前本机检查结果为 24.13.1。

以下步骤在同一个 PowerShell 窗口中依次执行，每一步成功后再继续。已经完成搭建的电脑直接使用第 7 节。

## 2. 检查 Node.js 和 npm

```powershell
node --version
npm.cmd --version
```

**写法与原因：**命令和参数之间用空格分隔；--version 只显示版本。Windows 下明确使用 npm.cmd，避免同名 PowerShell 脚本受到执行策略限制。两条命令都应输出版本号。

## 3. 创建独立运行目录

```powershell
$base = '<WORKBENCH_ROOT>'
$runtime = Join-Path $base 'runtime'

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Set-Location -LiteralPath $base
```

**写法与原因：**PowerShell 变量以 $ 开头；固定路径用单引号包住，确保空格属于路径。Join-Path 拼接子目录。-Force 允许目录已经存在，Out-Null 隐藏普通创建输出，-LiteralPath 按原样解释路径。

**结果：**runtime 位于工作台根目录，与源码目录并列。

## 4. 安装 DSH 和 pnpm

```powershell
npm.cmd install --prefix "$runtime" --save-exact @deepseek-ai/dsh@0.1.5-rc.1 pnpm@11.24.0
```

**写法与原因：**--prefix 指定安装目录；双引号会展开 $runtime，并保留路径中的空格。包名后的 @版本号指定直接依赖版本，--save-exact 按精确版本保存。不使用 -g，因此 DSH 和 pnpm 安装在 runtime 内。

这组版本采用本地项目的宿主与工具链基线。npm 下载缓存仍使用其自身默认位置。

## 5. 指定工具路径和数据目录

```powershell
$env:PATH = "$runtime\node_modules\.bin;$env:PATH"
$env:DSH_HOME = Join-Path $base 'dsh-data'

dsh.cmd --version
pnpm.cmd --version
```

**写法与原因：**$env: 设置当前终端的环境变量。将本地工具目录放到 PATH 最前面，优先使用刚安装的版本；Windows 用分号分隔目录，并保留原 PATH。DSH_HOME 指定配置和插件进入 dsh-data。末尾两条命令检查版本。

**结果：**应分别看到 0.1.5-rc.1 和 11.24.0。环境变量只影响当前终端及其启动的进程。

## 6. 安装插件并首次启动

### 安装工作台插件

下面是一条完整命令，窗口自动换行不影响复制：

```powershell
dsh.cmd plugin --profile web add @linxin666/dsh-web-all@0.3.23 --save-exact --allow-build=cloudflared --allow-build=cpu-features --allow-build=node-pty --allow-build=ssh2
```

**写法与原因：**--profile web 指定浏览器工作台的插件配置。DSH 将 add 及参数交给 pnpm，安装成功后注册插件。每个 --allow-build=包名 允许一个指定依赖执行安装构建脚本，重复该参数可列出四个包。

四项依赖分别涉及隧道客户端、CPU 特性辅助、伪终端和 SSH 支持。安装时就明确许可，无需额外进行交互式勾选。参数已核对本地 pnpm 11.24.0 的帮助与实现，含义见 [pnpm 官方说明](https://pnpm.io/cli/add#--allow-build)。

### 启动工作台

插件安装成功后执行：

```powershell
Set-Location -LiteralPath $base
dsh.cmd web
```

**写法与原因：**先回到工作台根目录，避免在插件配置目录中启动。web 是浏览器工作台的运行入口。

打开终端显示的完整访问链接；如果带有认证参数，保留完整链接。然后：

1. 在“设置 → 模型”配置供应商与 API Key。
2. 选择需要操作的项目文件夹作为工作区。
3. 选择模型，发送一条简单请求，确认可以收到回复。

页面能打开说明 Web 服务已启动；收到模型回复才能说明模型配置也可用。运行期间保持终端开启，需要停止时在该终端按 Ctrl+C。

## 7. 以后如何启动

新开 PowerShell 后，只执行下面这一段，不必重复安装：

```powershell
$base = '<WORKBENCH_ROOT>'
$env:PATH = "$base\runtime\node_modules\.bin;$env:PATH"
$env:DSH_HOME = Join-Path $base 'dsh-data'

Set-Location -LiteralPath $base
dsh.cmd web
```

**写法与原因：**新终端不会继承上一次临时设置的环境变量，需要重新指定 PATH 和 DSH_HOME。固定路径用单引号，包含变量的路径用双引号；其他步骤与首次启动相同。

## 8. 完成标准与依据

- 工具版本检查通过。
- 插件安装命令成功结束。
- 启动后能打开工作台页面。
- 配置模型、选择工作区后能够收到回复。

依据：本地 DSH 0.1.5-rc.1 的插件命令转发实现、pnpm 11.24.0 的 add 帮助和参数类型，以及项目版本配置。当前四项构建许可和全家桶注册已从配置中核实；用户已反馈网页版可用，桌面启动也已另行验证，模型调用仍待验证。本轮仅整理文档，没有重新安装或启动服务。

更新记录：2026-09-16 创建第一版，采用正常安装顺序，为每段命令附简短写法说明。

2026-09-17：更新为公共环境与网页版流程第二版，统一 Node.js 最低版本，补充 M002 桌面流程入口及实际验证边界。
