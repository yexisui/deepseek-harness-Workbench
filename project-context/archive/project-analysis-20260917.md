# dsh-web 0.3.23 项目分析与二次开发指南

分析日期：2026-09-16。

分析对象：`<WORKBENCH_ROOT>\dsh-web-0.3.23`。

本报告依据本地源码、构建脚本和配置，辅以 DeepSeek 官方在线文档。在线 master 文档可能高于本地锁定的宿主版本，具体字段以安装版本为准。本次只做静态分析和环境查询，没有安装依赖、启动服务、调用模型、修改原项目或部署网站；下列命令是操作指南，不代表已实测成功。

## 1. 项目是什么

这是 DeepSeek Harness 的 Web 插件 monorepo，附带 Electron 桌面客户端和独立的创意工坊网站。它依赖官方 DSH 宿主运行 Agent，不包含完整官方宿主源码，也不包含模型权重。

运行关系：浏览器或 Electron → DSH Web 宿主 → 官方模型适配器 → 模型 API。工作台插件挂载到宿主，补充任务看板、Git、SSH、使用统计、主题、远程访问等功能。

| 目录 | 职责 | 二次开发入口 |
| --- | --- | --- |
| `packages/` | 独立功能插件 | 业务功能、界面、工具 |
| `packages/dsh-web-all/` | 聚合包、兼容层、插件故障隔离 | 控制哪些插件出厂启用 |
| `packages/dsh-model-capabilities/` | 模型图片输入、推理档位与供应商启停 | 模型能力设置界面 |
| `packages/dsh-task-board/` | 任务看板与后端定时任务 | 自动化业务流程 |
| `packages/skins/skin-center/` | 皮肤引擎与资产 | 品牌、主题、壁纸 |
| `shared/` | 共享运行时与构建约定 | 跨插件公共逻辑 |
| `desktop/` | Electron 壳及内置运行时打包 | 桌面品牌、安装包、启动体验 |
| `market/` | 静态商城、浏览器试穿壳、Cloudflare Worker | 自营插件与资产商城 |
| `scripts/`、`docs/` | 构建、挂载、校验与开发说明 | 工程化流程 |

插件主要使用 TypeScript、React、Cordis；客户端使用 tsdown 打包，CSS Modules 由共享构建处理。Electron 主进程为 CommonJS。创意工坊使用静态资产加 Cloudflare Workers/D1。

根目录没有 `start` 脚本；`pnpm build` 只构建插件，`pnpm dev:watch` 只监听并重建浏览器 bundle。真正启动入口是 `dsh web`。桌面开发入口才是 `desktop/` 下的 `npm start`。

## 2. 本机与源码现状

| 项目 | 查询结果 |
| --- | --- |
| Node.js | v24.13.1，满足本地 README 的 Node >=22 要求 |
| pnpm | 当前会话 PATH 可用版本 11.19.0；仓库声明 11.24.0 |
| dsh | 当前会话 PATH 未找到，不代表电脑其他位置一定没有桌面内置版本 |
| Git | 当前会话 PATH 可找到 |
| 源码目录 | 未看到 `.git` 与根 `node_modules`，属于尚未安装依赖的解压源码 |
| 桌面运行时 | `desktop/resources` 仅看到图标，没有已暂存的 runtime |
| 宿主版本基线 | `desktop/runtime/host/package.json` 固定 `@deepseek-ai/dsh@0.1.5-rc.1` |
| 工作台版本 | `packages/dsh-web-all/package.json` 为 0.3.23 |

建议先用这份源码声明的版本组合跑通，再单独验证升级。官方宿主处于快速迭代阶段，不建议把所有依赖一次改成 latest。

## 3. Windows 如何启动

### 3.1 先体验已发布版本

PowerShell 示例；全局安装会改变本机工具链，请在你决定安装时执行：

```powershell
npm install -g pnpm@11.24.0 @deepseek-ai/dsh@0.1.5-rc.1
dsh plugin --profile web add @linxin666/dsh-web-all@0.3.23
dsh web
```

打开终端打印的完整访问地址，默认端口通常是 3080；若带认证 token，使用完整链接。随后在设置中配置模型，再选择需要 Agent 操作的工作区。首次初始化与插件安装需要联网。

这条路线运行 npm 上的发布包，不会载入你对本地源码的修改。

不准备开发时，也可从项目 Releases 下载 Windows `dsh-desktop-*` 安装包。源码 zip 与桌面安装包不是同一种交付物。

### 3.2 挂载这份源码进行开发

先具备上面的 Node、pnpm、dsh 环境。以下流程使用默认用户目录的 web profile，不是隔离方案；如果该 profile 已装有发布包，先查看插件管理器，避免不清楚地混用多个安装来源。

```powershell
Set-Location -LiteralPath '<WORKBENCH_ROOT>\dsh-web-0.3.23'
pnpm install
pnpm build

# 先看链接目标，再执行实际挂载
node scripts/link-profile.mjs --dry-run
node scripts/link-profile.mjs

$bundlePath = (Join-Path (Get-Location).Path 'packages\dsh-web-all').Replace('\', '/')
dsh plugin --profile web add "link:$bundlePath"
dsh --profile web --dump-config
dsh web
```

每条命令成功后再执行下一条。若已有 DSH 服务在运行，插件挂载完成后需由使用者安排重启；不要在有任务执行时直接结束进程。

开发时另开 PowerShell，在仓库根运行 `pnpm dev:watch`。它服务于客户端构建，不能代替 `dsh web`；修改宿主代码需重建并安排宿主重启。Windows 下若 watcher 报找不到 `pnpm`，检查 `scripts/dev-watch.mjs` 对 `.cmd` 子进程的处理；该脚本直接调用 `spawn('pnpm', ...)`，本次未实跑验证此路径。

**隔离环境的已知缺口：**宿主支持 `DSH_HOME`，但当前 `scripts/link-profile.mjs` 第 126–131 行从 `HOME` 或 `homedir()` 拼出 `.dsh/profiles/node_modules`，没有读取 `DSH_HOME`。仅设置 `DSH_HOME` 后继续执行原脚本，不构成可靠隔离。二次开发第一步应修复该脚本，或使用独立 OS 用户/独立开发环境；随后让宿主、链接脚本、测试统一使用开发数据目录。

### 3.3 从源码运行桌面壳

```powershell
Set-Location -LiteralPath '<WORKBENCH_ROOT>\dsh-web-0.3.23\desktop'
npm ci
npm run prepare-runtime
npm start
```

`prepare-runtime` 会下载 Node/pnpm 并安装宿主与 profile 载荷，下载量和耗时高于普通插件构建。当前脚本准备 macOS 两种架构及 Windows x64 的 Node 载荷，即便只打 Windows 包也可能下载其他平台资源。

**关键区别：桌面构建不会自动使用仓库中修改后的插件。** `desktop/runtime/profile-web/package.json` 固定下载 `@linxin666/dsh-web-all@0.3.19`；`desktop/scripts/build-runtime.mjs` 在 runtime 子目录执行 pnpm install 后暂存结果。仅在根目录 `pnpm build`，再打桌面包，不会把本地 0.3.23 修改带进去。

开发期先通过 Web profile 验证插件。准备交付桌面版时，再把自有包及子包发布到自有 registry，或建立本地 tarball 的完整依赖打包流程，并更新桌面 profile 清单和锁文件；单纯把 0.3.19 改为 0.3.23，也只是更换下载版本，仍不等于使用未发布的修改。

## 4. 如何部署

### 4.1 个人电脑或内网工作站

最适合本项目原有架构。使用 `dsh web` 或打好的 Electron 安装包，Agent 在宿主所在机器上读写文件和运行命令。定时任务要求宿主持续运行且机器不休眠；关闭浏览器不影响，关闭桌面应用则会停止它启动的宿主。

### 4.2 云服务器上的个人远程工作台

服务器安装同样版本的 Node、pnpm、dsh 与插件，准备工作目录和持久化数据目录，用普通专用用户运行，并用 systemd 等进程管理工具保持在线。

服务命令示意：

```sh
dsh web --no-open --host 127.0.0.1 --port 3080
```

个人使用优先通过 SSH 转发：

```sh
ssh -N -L 3080:127.0.0.1:3080 user@your-server
```

在本机访问转发地址，按宿主要求完成认证。若本机 3080 已占用，换本地端口，并遵循宿主对访问 authority 的认证要求。

需要手机访问时，可研究自带远程插件的配对与隧道流程；需要域名时，代理必须支持流式 SSE/WebSocket，并配置 HTTPS 和访问认证。不要把“配对成功”当作多用户权限隔离。该插件文档明确区分 `/remote` 配对门和宿主原生 `/api`，还保留对旧宿主版本的撤销限制说明；上线应针对实际宿主版本测试认证、撤销、文件访问和流式响应。

Agent 操作的是服务器上的工作区，不会因为在自己的浏览器里访问就改成操作本机文件。持久化并备份 DSH 数据目录、工作区与必要 SSH 配置；凭据备份须按敏感数据处理。

仓库没有现成 Dockerfile/Compose 部署链路。可以后续补充容器化，但要明确容器内工具链、工作区挂载、运行用户和权限，不宜直接把全宿主文件系统和 Docker socket 交给容器。

### 4.3 分发 Windows 桌面安装包

在完成 3.3 的 runtime 准备与自有插件装配后：

```powershell
npm run dist:win
```

产物在 `desktop/dist/`，包含 Windows x64 NSIS exe 与 zip。当前配置不构建 Linux/Windows ARM64。正式产品化还需调整 appId、名称、图标、版本策略、签名、更新机制和数据迁移。当前 `desktop/package.json` 的版本是 0.1.0，与插件版本独立；直接本地构建时不要误以为安装包文件名一定是 0.3.23。

### 4.4 部署创意工坊网站

`pnpm deploy:market` 部署的是插件、皮肤、宠物、预设的商城，不是 Agent 工作台。它使用 `market/worker/wrangler.jsonc`、Cloudflare Workers、D1 和 Turnstile。

自建时需先替换原项目域名、D1 数据库、服务绑定、Turnstile 站点配置，以及插件中引用的商城地址；当前配置还绑定了遥测看板 Worker。`scripts/deploy-market` 的数据库名称和部分验证信息也写死，不能只换一个 API Token 就当作自己的完整部署。

构建流程是先安装并构建 `market/shell`，然后在根目录运行 `pnpm market:build`、`pnpm market:check`。仓库流程部署已生成的 `market/dist`，发布脚本还会执行数据库迁移。若你只是使用或二开工作台，初期不需要自建商城。

## 5. 如何换模型

通常不改源码，在“设置 → 模型”完成。

1. DeepSeek 官方接口：在 DeepSeek 卡片填写 API Key 并保存。
2. 其他内置供应商：选择“添加提供方”，选择供应商后填写对应凭据。
3. 自建模型服务、企业网关或第三方中转：选择“添加自定义提供方”，填写小写且稳定的 Provider ID、Base URL、API 协议、凭据和模型 ID。
4. 保存后，在对话输入框的模型选择器中选择该供应商及模型；已有会话、预设或定时任务可能有自己的模型选择，应分别核对。
5. 配置图片输入、推理档位时，展开该供应商的“模型能力”。自定义模型需先进入模型目录；该插件不负责修改 DeepSeek 直连适配器的固定目录。

协议名称与端点含义：

| 协议配置 | 端点实际提供的接口 |
| --- | --- |
| `openai-completions` | Chat Completions |
| `openai-responses` | Responses |
| `anthropic-messages` | Anthropic Messages |

示例网关可填 `https://gateway.example/v1`，模型 ID 填服务端实际发布的 ID。这是示例地址；Base URL 是否含 `/v1` 应按供应商说明，不要直接填到 `/chat/completions` 的完整操作路径。若模型列表探测失败，可手动填模型 ID，不等于整个服务不可用。

本地模型服务也是同样接法：先让推理服务运行，再配置它暴露的兼容 API。工作台自身不会下载或运行模型权重。若 DSH 在服务器/容器中，`127.0.0.1` 指的是服务器/容器自身。

图片勾选和推理档位只是能力声明，不会让模型获得本来不具备的能力。接入 Agent 还应实际验证工具调用、流式响应、中断、长上下文和错误重试；普通聊天成功不足以证明编程 Agent 可用。

模型设置一般在下一次请求生效，无需重启。常见问题：401 检查密钥，UNKNOWN_MODEL 检查模型 ID，工具调用失败检查模型与接口，推理请求 400 检查协议参数映射。对于某些网关，需在 `settings.yaml` 调整 `supportsDeveloperRole`、`maxTokensField` 等兼容字段，应依据具体报错处理，而不是给所有供应商统一套配置。

可参考 [官方模型配置指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.zh.md) 与 [官方 pi-ai 适配器文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/README.zh.md)。这些是在线 master 文档，可能描述比 0.1.5-rc.1 更新的能力。

## 6. 二次开发建议

### 优先做：可复现、可隔离、可交付

- 从 Git 检出并建立自己的开发分支，保留这份解压版作为对照；先锁定宿主、SDK、插件、pnpm 版本，不同时做大规模升级和业务改造。
- 修复 `link-profile.mjs` 的 DSH_HOME 路径规则，给开发和日常使用分配不同的数据目录与端口。
- 统一桌面载荷来源，让安装包可追溯到某次构建；解决“源码改了，安装包却装线上旧包”的问题。
- 增加小型启动自检：版本、依赖、端口、profile、关键插件健康状态和模型连通性，失败提示可操作。

### 功能开发：优先新增插件

需要新业务能力时新增 `packages/dsh-<业务名>/`，通过 Cordis 服务与官方 UI 插槽集成，不修改官方 DSH 源码。典型分层为 `src/index.ts` 宿主逻辑、`src/client/` 界面、`src/core/` 纯逻辑、`cordis.patch.yml` 装配。

仓库已有脚手架：

```powershell
node scripts/dsh-plugin-new dsh-my-workflow
```

自用插件可以单独挂载。若希望纳入自己的全家桶，再修改 `packages/dsh-web-all/aggregate.yml` 并运行聚合生成器，不要直接手改派生产物。

建议优先方向：

| 目标 | 推荐做法 |
| --- | --- |
| 专属品牌工作台 | 主题资产、默认插件组合、桌面品牌与引导流程 |
| 固定业务流程 | 先做 Agent 预设/Skill，稳定后补插件 UI 和工具 |
| 自动化运维/研发助手 | 复用任务看板与 Git/SSH 能力，增加业务参数和执行结果视图 |
| 多模型工作台 | 增加配置校验、工具调用试测、用量/预算展示、任务级模型选择 |
| 企业多用户平台 | 单独设计认证、租户、密钥、工作区和执行环境隔离；不能仅增加登录页 |

不要一开始重写整个 UI、Agent 执行循环、插件管理器和商城。先交付一个端到端场景，例如“选择项目 → 选择模型 → 运行代码审查 → 展示结果和用量”。

### 工程规则与验证

- `shared/` 是公共逻辑源，修改后执行 `node scripts/sync-shared.mjs`，不要逐个修改生成副本。
- UI 使用官方 slot 和稳定模块接口；避免依赖 CSS Modules 哈希或大量 DOM 猜测。
- 维护模型适配小测试集：纯文本、工具调用、图片、推理、流式中断、超时重试，各供应商单独验证。
- 提交前按仓库规则运行 `pnpm typecheck`、`pnpm test`、`pnpm docs:check`、`pnpm i18n:check`；涉及聚合、商城、皮肤时再运行各自检查。
- 修改需提交的 lib 产物时，构建后执行 `pnpm libs:write`，再 `pnpm libs:check`。
- 商用交付前整理各组件和皮肤素材的许可、归属与 NOTICE；根仓库 Apache-2.0 标识不能替代逐项依赖和素材许可检查。

## 7. 本次识别的文档与实现不一致

| 不一致 | 本地代码证据与处理方式 |
| --- | --- |
| 0.3.23 源码的桌面载荷还是 0.3.19 | 以 `desktop/runtime/profile-web/package.json` 和 `build-runtime.mjs` 为准，二开交付前修复 |
| 聚合包 README 的桌面安装示例使用 `--profile desktop` | 本地 `desktop/src/main.cjs` 实际调用 `web` 并使用 `profiles/web`，本仓库桌面流程以代码为准 |
| DSH_HOME 与本地链接目标不一致 | `scripts/link-profile.mjs` 没有读取 DSH_HOME；必须先修复隔离方案 |
| 根 README 说商城合入 main 自动部署 | `.github/workflows/deploy-market.yml` 实际监听 dev 的相关路径变更 |
| 桌面 README 与远程插件 README 对监听地址描述不同 | 不依靠一句 README 判断远程暴露行为；优先回环加受控隧道，并对实际版本验证 |

## 8. 建议实施顺序

1. 用已发布 0.3.23 插件和匹配宿主完成首次对话及一次工具调用。
2. 建立 Git 开发副本和独立数据目录，修复链接脚本路径规则。
3. 挂载本地源码，验证一次小改动确实进入浏览器工作台。
4. 开发一个有明确输入、输出的业务插件或预设。
5. 跑相关验证，再建立自有插件打包与桌面载荷装配流程。
6. 需要持续定时运行时部署专用服务器；需要多用户时再补租户和执行隔离架构。

## 9. 本地证据入口

- 根 `README.md`：快速启动、功能总览。
- 根 `package.json`、`pnpm-workspace.yaml`：工具链、SDK 依赖与工作区策略。
- `docs/architecture.md`、`docs/plugins.md`：插件结构与装配。
- `desktop/package.json`、`desktop/electron-builder.yml`：桌面命令和安装包目标。
- `desktop/runtime/{host,profile-web}/package.json`：桌面内置版本。
- `desktop/scripts/build-runtime.mjs`：实际载荷来源。
- `desktop/src/main.cjs`：桌面宿主参数和 profile 路径。
- `scripts/link-profile.mjs`：本地插件链接路径。
- `packages/dsh-model-capabilities/README.zh.md` 与源码：模型能力编辑边界。
- `packages/dsh-remote-web-ui/README.zh.md`：远程访问及配对边界。
- `market/worker/wrangler.jsonc`、`scripts/deploy-market`、`.github/workflows/deploy-market.yml`：商城部署。

官方启动方式参见 [DeepSeek Harness README](https://github.com/deepseek-ai/deepseek-harness)。桌面发布包参见 [dsh-web Releases](https://github.com/zhu1090093659/dsh-web/releases)。
