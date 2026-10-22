代码助手模块 0.1.0

宿主提供 workspace、projects、addProject、authorize、resolveModel、stream 和可选 guidance 接口；
CodeAssistantService 管理独立任务、OpenCode 进程、工具审批、模型桥接及路由。
前端 CodeAssistant 为 React 嵌入面板，宿主负责同源认证及 /api/capabilities/code-assistant/* 路由。
Toggle 属性注入宿主共享启停控件，面板源码不引用宿主目录；接入应用须支持 TSX 与 CSS Modules。
本工作台适配器位于 dsh-capabilities/src/host/code-assistant.ts；不依赖旧 DeveloperService 状态。

业务数据：DSH_HOME/code-assistant。卸载或停用不删除用户项目和任务记录。
引擎：external-tools/opencode；版本 1.19.3，MIT，官方 ZIP SHA256 见工具清单。
编辑器：Monaco 0.55.1，MIT，本地 lib/assets/editor，无 CDN。
引擎启动依赖：@opencode-ai/plugin 1.19.3 与 npm 锁定传递依赖，本地 lib/assets/engine-runtime。
更新依赖前核对 assets-lock/ 下的 package-lock.json；构建准备脚本使用 npm ci。

运行时关闭上游更新、模型目录获取、默认插件、外部技能、LSP 下载、分享和联网工具。
实测上游 1.19.3 的 v2 插件发现未完全遵循项目配置禁用开关，因此每次运行前检查项目及可发现的祖先目录。
含 .opencode、opencode.json 或 opencode.jsonc 的项目暂拒绝启动，请使用不含原生配置的代码副本；不自动修改这些文件。
模型仅通过带随机令牌的本机桥接调用宿主 llm 服务。没有额外模型 Key 或账户配置。
基础文件和 Git 工具通过宿主通用工作区接口；任务执行使用 OpenCode 工具链。
只读任务禁止模型编辑和运行。允许修改的任务逐项审批，命令和编辑不自动永久放行。
普通子进程不是操作系统沙箱；批准的项目命令本身可能使用网络。
首版同时运行一个编码任务，保证模型选择与停止进程归属明确。
Monaco 提供内置 JS/TS 编辑体验；首版关闭 OpenCode 自动 LSP/格式化下载。

开发：node scripts/prepare-code-assistant.mjs WORKBENCH_ROOT SOURCE_ROOT，准备锁定构建资产。
构建：沿用工作台 build-workbench.mjs / install-workbench.mjs 与离线制作脚本。
普通启动不安装依赖。外部工具安装、复用、检查使用工作台 deploy.ps1 -Mode Tools/Check。
