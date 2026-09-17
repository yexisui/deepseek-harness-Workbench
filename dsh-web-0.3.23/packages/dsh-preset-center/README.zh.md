# @linxin666/dsh-client-ui-preset-center

[English](README.md) | 中文

DSH Web GUI 的社区 agent 预设管理器：创意工坊的**预设**面板，以及负责安装、启用、禁用、卸载从 [dsh-market.com](https://dsh-market.com) 下载的预设的 host 侧库。预设只有**安装并启用**后才会出现在**设置 → Agent 预设**；其余都留在创意工坊。

## 能力

- 在创意工坊商店卡新增**预设**标签页（通过卡片声明的 `dsh-workshop.panel` 子槽位注入），列出社区目录，带安装状态、版本更新提示与安装计数。
- 把预设安装到惰性库 `$DSH_HOME/agent-presets/<id>/`。没有任何发现根扫描该目录，因此已安装的预设永远不会被加载。
- 启用时把目录移入发现根 `$DSH_HOME/.agent-presets/<id>/`（`@deepseek-ai/dsh-agent-presets` 已在扫描的 harness-home 用户根），禁用时移回。discovery 每次调用都重读根目录，因此新会话无需重启 `dsh web` 即可使用该预设。
- 显示由**已安装字节**算出的**组合画像**——组合挂载的插件名、是否携带本地代码文件或 `!!js` 表达式——并在启用任何可执行内容前要求显式确认；启用前可用只读查看器阅读 `agent.cordis.yml`。
- 拒绝启用 id 已被内置或配置根提供的预设（那些根在发现顺序上优先，启用会静默无效），也拒绝禁用或卸载 `agent-presets` 默认值指向的预设（默认值指向不存在的预设会让每个新会话创建失败）。
- 每次读取状态都校验市场 provenance：逐文件 sha256 锚定 `https://dsh-market.com`，因此本地改动过的预设会被标为「本地已修改」，更新也绝不静默覆盖它。

## 安装

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-preset-center
```

创意工坊卡片（`@linxin666/dsh-client-ui-market`）声明面板槽位并负责下载；没有它时 host 路由仍可用，但没有面板驱动。两者都在 `@linxin666/dsh-web-all` 聚合包内。

## 配置

无。面板是唯一界面，所有行为都由目录清单与两个目录推导。插件不注册设置命名空间，也不向 agent 系统提示注入任何内容。

## 安全模型

预设是代码，不是资源：它的组合可以引用 npm 插件、加载随预设目录分发的文件，并在 DSH 主进程内求值 `!!js` 表达式——全部发生在会话由该预设组合时。官方包对此的表述很直白：预设拥有与 shell 访问同等的信任。因此本插件从不把「安装」当作「运行」：

- **安装是惰性的。** 市场安装器写入 `$DSH_HOME/agent-presets/<id>/`，没有任何发现根扫描它。
- **启用才是授权边界。** 启用把目录移入发现根；只要组合携带本地代码、相对路径行或内联表达式，面板就要求显式确认，并展示这些内容是什么。
- **启用前校验、失败回滚。** id 会与实时 roster 比对；roster 报告为 broken 的预设会被移回库并显示原因，而不是留在半启用状态。
- **provenance 是完整性锚。** 每次读取都重新校验市场记录的逐文件 sha256；不匹配会被报告，绝不静默修复。
- **路由仅限 loopback。** `/api/preset-center/*` 只应答 loopback 请求，与市场网关同一道栅栏，远程浏览器无法驱动该库。
- **未托管目录不可触碰。** 没有市场 provenance 的预设（自建或由其它工具安装）会被标注，并被禁用与卸载拒绝。

## 已知限制

- **启用不是沙箱。** 确认与组合画像降低的是误操作风险，并不能让不可信预设变安全。发布环节的人工审查才是真正的控制点。
- **官方设置分区可能滞后。** 它只在自身动作、`settings/document-updated` 与 `connection/reset` 时重读，因此在创意工坊启用的预设可能需要刷新页面才出现在**设置 → Agent 预设**；新建会话会立即看到它。
- **运行中的会话保留原预设。** 会话的组合在创建时固定，禁用或卸载不会改变正在使用它的会话。
- **Windows 目录移动。** host 进程仍持有句柄时移动目录可能瞬时失败；移动路径会短暂重试并报告写入错误，而不是留下半成品状态。
- **目录为空直到有预设发布。** `packages/dsh-preset-center/presets/catalog.json` 是发布源，贡献格式见该目录的 README。

## 架构

- `src/index.ts` —— host 半区：每进程挂载一次 loopback 网关。
- `src/routes.ts` —— `GET /api/preset-center/state`、`GET /api/preset-center/composition?id=`、`POST /api/preset-center/{enable,disable,uninstall}`；唯一读取 roster 的层，因此保留 id 与默认预设两条策略在这里。
- `src/core/paths.ts` —— 双目录契约与官方预设 id 规则。
- `src/core/library.ts` —— 状态机：扫描、启用、禁用、卸载，原子移动与跨卷降级。
- `src/core/provenance.ts` —— 市场 provenance 读取与逐文件校验。
- `src/core/profile.ts` —— 组合画像。
- `src/client/PresetPanel.tsx` —— 创意工坊卡片渲染的面板。
- `presets/` —— `scripts/market-build` 读取的发布源（catalog 加每个预设一个目录）。

库与发现根目录是跨包契约：市场安装器把 `preset` 资产写进 `$DSH_HOME/agent-presets/<id>/`，官方 roster 扫描 `$DSH_HOME/.agent-presets`。两个包互不 import；路径名与 `dsh-market.provenance.json` 格式是镜像常量，与皮肤中心镜像市场 provenance 的方式一致。
