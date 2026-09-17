# dsh-liangshen — 梁神模式（极简 persona + PTC 工具面）

[English](README.md) | 中文

把梁神模式做成 DSH 全家桶里的一键安装插件：Host 启动时把内置 preset 同步到 `~/.dsh/.agent-presets`，新建会话即可在预设选择器中选择「梁神模式」，浏览器半区还在新建会话页的模型选择器旁提供一台老虎机拨杆来开关该模式。该 preset 让系统提示词保持极简 persona——外加本模式的固定工作纪律、会话工作区目录与 AGENTS.md 类工作区指令——并从第一条用户消息起就把工具面作为持久 user 消息注入在用户消息之后——形状与 harness 注入 skill 目录一致，且只宣告该次请求实际开放的工具——而 wire 按回合分层：首轮整个 user turn 原生呈现基础锚定工具集（默认 `[bash, str_replace_editor, exit_plan_mode, skill]`，并保留 bash-only 配置实验），从第二个回合起在 PTC 成功激活后以 PTC 模式呈现工具，wire 上只有 `run_code` 这一条传输工具，其余工具都在程序里经生成的 SDK 调用。PTC 实际激活时发生确定性的回合边界跃迁，保留完整输入输出关键参数语义，没有推理内容门控、没有输出预算上限。全部通过官方 NPM SDK 实现，不修改 DSH 源码。

## 原理

DeepSeek V4 模型在选择执行轨迹时，会受到初始提示词与首轮可见工具面的显著影响。过多过早暴露未受约束的工具可能分散执行轨迹，而完全缺乏编辑或规划手段又限制了复杂任务的完成。

梁神模式采用分层工具与紧凑提示词架构：负责锚定的部分（系统提示词）保持极简 persona 与明确的工作纪律，并注入工作区指令；负责能力的部分（工具面）从第一条用户消息起以 skill-catalog 式的上下文注入宣告，并在首轮整个 user turn 原生呈现基础锚定工具集（`[bash, str_replace_editor, exit_plan_mode, skill]`），提供探索、编辑、退出规划与技能查询的基础能力；从第二个回合起在满足 code runtime 条件并成功声明后，平滑过渡至 PTC（程序即代码）模式。在 PTC 呈现下，注入消息承载生成 SDK 的绑定清单、完整输入输出关键参数语义、「一段程序编排多步调用」的程序契约、以及「只有 `run_code` 可直接调用」的规则。本模式不做出「与官方 Minimal 完全一致」、「社区评测分数证明本版必定更优」或「提示词缓存命中等同于行为一致」的过度承诺，而是以清晰的分层契约保障执行稳定性。

## 工作机制

1. `minimal-prompt` 把每次组装出的提示词收窄到 persona 一段——一行 persona、本模式的固定工作纪律（思维循环即断、先理解需求与方案再实现验证、YAGNI/PDCA、代码不加冗余注释）、以及一行从会话头读取的方位信息 `Your working directory is <cwd>.`——因此 harness identity、web surface、工具用法、文件引用与结构化输出等 section 默认不会到达模型；plan mode 的 `plan:policy` 保留，因为该 section 是 plan mode 唯一的执行依据（它的退出工具在任何模式下都保持注册）；
2. AGENTS.md 类工作区指令直接进入系统提示词本身：组装时 `minimal-prompt` 读取 harness 的基线链（`$DSH_HOME/AGENTS.md`，再从项目根到会话 cwd 沿途的 `AGENTS.md` / `CLAUDE.md` 及其 `.local` 覆盖层），把内容作为一段 `workspace-instructions` 追加在稳定前缀之后，受字节预算约束——放不下时先省略最宽的文件、最后才截断最具体的文件；读取在每次组装时都发生，文件改动无需持久消息即可在下次请求生效，harness 自己的 agent-instructions 注入则被丢弃以免与提示词重复。工作区子目录动态规则后续将支持注册文件工具（含 `str_replace_editor`）及 PTC 内子调用触达的目录；不解析任意 bash/program 代码，不保证 shell 自行文件访问的自动发现；
3. 锚定回合（会话的首轮整个 user turn，而非仅第一步单次请求）把 wire 保持在基础锚定工具集上：默认 `[bash, str_replace_editor, exit_plan_mode, skill]`，原生呈现（`anchorTools`）；同时保留 `[bash]` 的单 shell 实验配置（无需额外注册预设，无需更改注册表）。从第二个回合起，在 code runtime 存在且声明成功时，`tool-catalog` 为该会话激活 PTC 呈现（`agent.ctx.tools.presentAs('ptc')`，在锚定回合结束时声明），wire 收拢为 `run_code` 这一条传输工具，其余工具都在程序里经生成的 SDK 调用；若缺少 code runtime 或激活失败，则优雅回退至原生工具面并发出一次性告警；
4. `tool-catalog` 把工具清单从第一条用户消息起作为持久 user 消息追加在用户消息之后，保留完整输入输出关键参数语义而非 200 字唯一契约（`descriptionMaxLength: 200` 仅作为一行摘要长度上限，不裁剪关键参数结构）。目录只宣告该次请求实际开放的工具：原生锚定回合是锚定工具集，PTC 下则是经 SDK 可达的完整工具面，并附带程序契约：一段程序完成一个意图而不是一步一次调用、`run_code` 的 `code`/`description` 形状、独立只读调用用 `Promise.all` 并发、`ToolCallError` 的处理、程序输出需要自己挑选，以及 `run_code` 一旦在 wire 上就是唯一可直接调用的工具。只在工具面变化、或已发布副本离开可见面（压缩、恢复）时重发，因此晋升边界会进行一次契约更新，不再坚持上下文绝对不变；
5. 运行时上下文（sandbox 与 approval 快照）与 skill 目录按 Standard 模式正常注入。

## 安全模型

本模式坚持在官方宿主安全架构内运行，严格遵守沙箱策略：

- **宿主沙箱约束**：所有文件工具（无论是首轮原生呈现的 `str_replace_editor`、Standard 文件工具，还是后续在 PTC `run_code` 中调用的文件操作）均受宿主文件沙箱策略约束，继承当前会话的沙箱级别（如 `danger-full-access` 或只读/工作区受限）。不存在裸本地文件系统访问（不挂载 `dsh-fs-local`），所有跨越工作区的读写均受宿主策略拦截。
- **Windows 平台现有限制与 Git Bash**：DSH 的 PTY 后端仅支持 Linux/Darwin。在 Windows (win32) 下，持久 shell 组被禁用，`bash` 由 `presets/liangshen/custom-bash.mjs` 调用系统 Git Bash 子进程提供：
  - Windows Git Bash 运行于普通子进程通道，受 Windows 平台限制，不具备 Linux 下基于 namespace/cgroups 的 OS 沙箱隔离；
  - shell 进程不跨调用常驻，命令状态（环境变量、当前目录等）不跨调用保留；
  - 非零退出码以结果返回而非抛错；
  - 用户与开发者切勿修改 `custom-bash.mjs` 去尝试规避安全策略；高权限操作需遵从宿主提示和环境安全规范。
- **PTC 代码沙箱**：PTC 模式下执行的 `run_code` 代码运行于独立的 worker thread 隔离上下文，其对系统资源的访问完全受限于 SDK 暴露的 tools 边界。

## 拨杆

浏览器半区在新建会话页的输入框工具行里、模型选择器紧左侧装了一台老虎机拨杆：

- 把拨杆拨下——拖动、点击或用键盘激活都算——即将开始的会话就组合为梁神模式；命中后播放中奖特效（闪光、冲击环、火花，以及「梁神模式」横幅叠文言文、二进制、摩斯三行）；
- 把拨杆上拨，就回到你此前的模式——还没有记住任何模式时，回到部署默认预设；
- 拨杆始终反映会话真实的预设，刷新页面后状态依然正确；且只在会话仍为空时渲染——会话一旦开始，宿主拒绝重新组合，整行控件直接从输入框中消失；
- 被拒绝的切换会在拨杆下方显示宿主给出的原因，且不播放特效；`prefers-reduced-motion` 下保留状态变化、去掉动画。

拨杆通过浏览器会话已经完成鉴权的 agent-preset Remote 命名空间驱动会话预设，不额外申请权限。它只在会话为空时改动预设，而那正是它渲染所在的新建会话页。

## Preset 配置

两个 preset 内置插件都在 `agent.cordis.yml` 中配置：

| 键 | 默认值 | 行为 |
| --- | --- | --- |
| `keepPlanPolicy` | `true` | 在只有一行 persona 的系统提示词中保留 plan mode 的 `plan:policy` 段。置 `false` 得到严格的一行表面，此时 plan mode 背后没有任何策略文本。 |
| `instructionSource` | `system-prompt` | 工作区指令送达模型的方式。`system-prompt` 在组装时读取 AGENTS.md 链并追加进系统提示词（harness 自己的注入被丢弃）；`hint` 恢复指针行为：首次注入替换为一次性的、非命令式的参考文件提示，后续注入丢弃。 |
| `instructionMaxBytes` | `65536` | 渲染后的 workspace-instructions 段的字节预算（system-prompt 模式）：最宽的文件先被省略，最具体的文件最后被截断。 |
| `descriptionMaxLength` | `200` | 注入目录中单个工具一行摘要的长度上限。完整关键参数语义与契约仍由 SDK 自身完整保留。 |
| `anchorTools` | `[bash, str_replace_editor, exit_plan_mode, skill]` | 首轮整个 user turn wire 上原生呈现的工具集；晋升面从第二个回合起生效。出厂默认包含基础四工具，亦可按需配置为 `[bash]` 进行单 shell 实验（无需额外注册预设，无需修改注册表）。留空则关闭分层。 |
| `ptcPresentation` | `true` | 从第二个回合起尝试为该会话声明 PTC 呈现，成功激活后 wire 收拢为 `run_code`，保留完整输入输出关键参数语义。需要挂载 code runtime 与可读取的工具投影；缺失任一项时保持原生呈现并只告警一次。注入目录始终描述该次请求 wire 实际携带的传输方式，声明无法在本回合生效时不会宣告 PTC。置 `false` 则从第二个回合起 wire 上仍是组装出的原生清单。 |

## 安装

```sh
# 方式一：全家桶（推荐）
dsh plugin --profile web add @linxin666/dsh-web-all@latest

# 方式二：单独安装
dsh plugin --profile web add @linxin666/dsh-liangshen@latest

# 两种方式二选一：聚合包与独立 @linxin666/dsh-liangshen 都会挂载本 preset。
# 需要在两者之间切换时，先 dsh plugin remove 移除另一个再安装：
dsh plugin --profile web remove @linxin666/dsh-liangshen
```

装完**完整重启 `dsh web`**，新建空 session，预设选择「梁神模式」。插件会在启动时把 presets 同步进 `~/.dsh/.agent-presets`（升级插件后重启即自动更新）。

## 验证

导出 session JSONL，检查 `request/header`：

- 第一份 header 的 `system` 应恰好是 persona 块（极简 persona、工作纪律清单、工作区目录行 `Your working directory is <cwd>.`），plan mode 开启时另加其策略段，再另加承载 AGENTS.md 链的 `workspace-instructions` 段；
- 首轮整个 user turn 的 header tools 应恰好是锚定面——默认 `[bash, str_replace_editor, exit_plan_mode, skill]`，原生呈现——既不是全量晋升清单，也不会是未激活的 `run_code`；
- 锚定回合放行的消息里应有一条来自 `liangshen-tool-catalog` 的 `plugin` 消息，位于用户消息之后，按参数签名恰好列出锚定工具；从晋升回合起，该消息改为列出经 SDK 可达的完整工具面并写明 `run_code` 程序契约，其中 `run_code` 是唯一可直接调用的工具；
- 从第二个回合起，在 PTC 成功激活的前提下，header 上恰好只有一条工具 `run_code`（PTC 呈现）；若无 code runtime 则优雅回退到原生清单并伴随一次性告警；
- 压缩之后目录会重发一次，形式为替换清单，且会话保持当前呈现模式；
- 文件写入受宿主文件沙箱策略约束，不存在裸本地文件系统绕过。

### 真实会话验证条件与评测说明

在进行模式验证与性能评估时，必须严格区分验证层级：

1. **真实推理探针 ≠ 模式集成通过 ≠ 统计提升**：
   - **真实推理探针**：仅验证链路连通性与模型对特定格式的最小响应能力（例如使用 headless 探针验证模型是否能正常解析输出）；单次探针成功仅代表功能未阻断，绝不证明模式集成已达标。
   - **模式集成通过**：要求在真实完整会话中，验证完整 header、工具分层流转、PTC 真实激活、SDK 参数语义解析与沙箱策略执行无误。
   - **统计显著性提升**：必须在固定 route 与源码 hash 记录的隔离环境中进行多轮对比评测，综合评估任务完成率、工具失败率、规则违反率、人工介入次数与耗时/token 开销。单次或少数 smoke 运行不构成效果提升的证据。
2. **评测工具**：隔离 runner 位于 `packages/dsh-liangshen/tools/benchmark-live-run.mjs`：它把被评测 preset 写入临时目录并通过 roster 自己的 `roots` 配置选中，把会话持久化改写到本次运行目录，并为每次运行记录基线（仓库提交、出厂 preset hash、DSH 版本、固定 route、任务版本）。候选矩阵为 `B`（出厂 persona 与两阶段策略）、`P`（候选 persona）、`T`（候选 persona，首轮即用 PTC）、`N`（候选 persona，全程原生工具）与 `M`（内置包官方 Minimal preset，仅作外部参照而非单因素对照）。单次 smoke 用 `node tools/benchmark-live-run.mjs --variant B`，按种子任务集跑有界矩阵用 `node tools/benchmark-live-run.mjs --tasks tools/tasks/liangshen-v41-flash.json --groups B,P,T,N,M --repeat 3 --max-sessions 60 --budget-usd 5`，再用 `node tools/benchmark-report.mjs .benchmark-results` 汇总结果目录：按组给出成功率与 Wilson 区间、按任务配对差值与置信区间、token 与费用合计、单独列出的基础设施失败以及记录的基线。smoke 只验证协议与费用估算，不构成通用编码能力提升的证据。

## 配置

| 键 | 默认值 | 行为 |
| --- | --- | --- |
| `enabled` | `true` | 总开关：关闭后预设同步与公告都不执行。 |
| `announceToAgent` | `false` | 按需开启：开启后向 agent 系统提示注入本插件公告。默认关闭，保持系统提示词干净。 |

两个字段都可在 Web 设置界面（插件配置，即时生效）或 profile patch（`dsh plugin` / `cordis.patch.yml`）中编辑。

## 行为与限制

- 系统提示词在整个会话中保持稳定：persona 块（persona、工作纪律、工作区目录），plan mode 开启时另加其策略段，另加 workspace-instructions 段。工具调用后不会再追加内容，也不施加任何输出预算上限；
- workspace-instructions 段在每次组装时重新读取，指令文件的改动无需持久消息即可在下一次请求生效；该段渲染在稳定前缀之后的最后位置，锚定的缓存前缀不受影响。工作区子目录动态规则后续将扩展支持注册文件工具（含 `str_replace_editor`）及 PTC 内子调用触达的目录；不解析任意 bash/program 代码，不保证 shell 自行文件访问的自动发现；
- wire 的 schema 集在首轮整个 user turn 保持在基础锚定工具集（默认 `[bash, str_replace_editor, exit_plan_mode, skill]`，且支持 `[bash]` 实验）；在第二个回合起且仅在 PTC 成功激活时收拢为 `run_code`；目录消息每会话写一次，另在工具面变化（含晋升边界）或压缩遮蔽时替换一次；
- 注入的目录是持久消息：每个会话写入一次，另在工具面变化或压缩遮蔽已发布副本时替换一次，并留在历史中供后续请求使用；
- 未观测到 prompt 组装的步不注入任何内容——目录绝不会由过期视图推测；
- 若组合中不存在任何被接受的 persona section 名（`deployment:persona-prefix`、`deployment:persona`、`persona`），过滤器会保留组装结果并只告警一次，而不是发出空系统提示词；
- plan mode 通过其 `plan:policy` 段支持；置 `keepPlanPolicy: false` 后该模式仍有工具，但失去约束它的策略文本；
- PTC 呈现按会话声明，需要挂载的 code runtime（随包发布的 web 与 headless 组合都挂载 `dsh-code-runtime-worker-thread`）；没有 runtime 或激活失败时该模式保持原生呈现并只告警一次；
- 清单就是官方 PTC preset 的模型自著面：不在 `run_code` 之外再发布 `workflow` 工具，而 workflow 引擎仍为 `ralph` 保留挂载；
- 持久 `bash` 会替代 Standard 的一次性 shell 直到会话结束（两个工具都注册 `bash` 名字），因此 shell 状态跨调用保留；win32 上由 `custom-bash` 经 Git Bash 提供同名工具，无 OS 沙箱约束且状态不跨调用保留；
- 文件工具继承宿主文件沙箱（不挂载裸 `dsh-fs-local`）；
- preset 与 shell 访问具有相同信任等级，安装前可自行审阅 `presets/liangshen/`；
- 插件不发起网络请求，也不增加遥测；
- 不要在已经产生内容的会话中途切换 preset；
- 需要 DSH 0.1.5-rc.1+（preset 机制、`system-prompt/assemble` 瀑布、persona 的 `prefix` schema，以及 PTC 呈现 API）。

## 许可

插件本体 Apache-2.0（zhu1090093659）。`presets/liangshen/agent.cordis.yml` 基于 DeepSeek Harness 内置 Minimal、Standard 与 PTC preset 修改（MIT），`custom-bash.mjs` 来自 xiaobright/dsh-anchored-standard（MIT），版权与许可声明见 preset 的 `NOTICE`。
