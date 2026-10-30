代码助手模块 0.1.0

宿主提供 workspace、projects、addProject、authorize、resolveModel、stream 和可选 guidance 接口；
CodeAssistantService 管理独立任务、OpenCode 进程、工具审批、模型桥接及路由。
前端 CodeAssistant 为 React 嵌入面板，宿主负责同源认证及 /api/capabilities/code-assistant/* 路由。
Toggle、Modal 属性注入宿主共享启停控件和居中弹窗，removeIcon 注入共享移除图标；
面板源码不引用宿主目录，接入应用须支持 TSX 与 CSS Modules。
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

任务记录按项目路径分组，支持搜索、移除与撤销；Windows 路径忽略大小写，项目同名不合并。
移除仅持久隐藏记录（historyRemovedAt），保留对话、引擎会话、项目文件和Git提交。
当前页面内可撤销最近一次移除；关闭再打开任务记录仍可撤销。继续发送或分叉产生的新记录会显示。
运行中的任务不可移除，切换任务保留既有未保存编辑确认。

任务记录回收站（2026-10-28）：
- 左侧项目垃圾桶将整个项目分组移入回收站，底部“回收站”可恢复项目或单条记录；移除状态跨重启保留。
- 项目移除仅影响当前岗位的记录列表，用独立 history-projects.json 原子保存；不修改磁盘项目、Git、任务对话、当前工作区或地址栏项目登记。
- 项目恢复会显示随项目隐藏的任务，之前单独移除的记录仍在回收站。项目隐藏期间继续已有对话或新增任务，需恢复项目后才在记录列表显示。
- 单条记录沿用 historyRemovedAt；旧版已移除记录自动进入回收站。不提供永久清除。
- GET history 返回 tasks / removedProjects / removedTasks 的一致快照，history/project/remove、history/project/restore 管理项目；history/remove、history/restore 同步返回完整快照。


对话查看（2026-10-28）
- 同一任务内连续提问保持一段对话；问题目录按用户消息编号，可搜索、上一问/下一问及回到最新。
- 历史同时支持按对话和按问题查看；GET history/tasks 的 tasks 项增加 questions 摘要（消息ID、标题、顺序、原始时间及状态），不返回工具输出，不迁移旧文件。按问题定位不会调用模型。
- 回答优先按 OpenCode parentID 归属；没有父ID的旧消息按原顺序处理，无法关联的旧消息保留在独立折叠区。
- Markdown代码围栏、工具命令及输出显示为深色代码块，可复制；非零退出码显示失败，未知退出码不推定成功。历史失败不被之后的修复覆盖。
- 左右侧栏可拖动或用方向键调整宽度，Esc取消拖动；栏内箭头收起后保留32px竖排入口。宽度和开关保存在本机浏览器，隐藏不卸载输入、审批或编辑器。
- 窄屏改为纵向布局，原项目选择、回收站、审批、文件与Git操作保持。

紧凑阅读布局
- 问题目录按需浮层展开，搜索或选择后定位到连续对话里的原提问；Esc和点击外部关闭目录。
- 上下问导航与目录同排，输入框默认两行并随输入增长至上限；模型、审批开关与发送同排。
- 专注阅读临时收起文件与代码区，返回后保留侧栏宽度、编辑内容和对话草稿。
- 命令与输出合并为一个黑色终端框；历史失败结果保留，实际审批与执行接口不变。

提问移除：问题目录右侧垃圾桶经确认后隐藏整轮提问、回答和工具输出，历史按问题视图同步；可连续撤销最近移除，重开后保留。
POST question/remove、question/restore 接收 id、roleId、questionId。removedQuestionIds 只保存展示偏好，原消息、时间、引擎上下文及已执行代码保持；运行中禁止移除/恢复。
