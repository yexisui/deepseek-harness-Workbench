> 历史参考：来自原项目归档，非现行指令。原文链接以当时的上游目录为背景，不保证在当前仓库可用；现行入口为 project-context/AGENTS.MD。

# @linxin666/dsh-remote-web-ui

[English](README.md) | 中文

为 DeepSeek Harness Web 界面提供本机与局域网设备配对，支持限时令牌、可撤销会话和移动端适配。

## 能力

- 为内网手机和电脑提供配对按钮与远程访问设置卡片。
- 管理设备在线状态、过期、撤销、局域网绑定和网卡选择。
- 运行时不检查插件更新、不启动公网隧道、不注册中继、不发送安装遥测。DeepSeek Harness 官方基座升级继续由基座安装负责。

## 安装

使用部署环境准备好的插件目录或本地包，包含已构建的 `lib/` 文件及运行依赖。在目标 Harness 配置中注册目录：

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-remote-web-ui
```

宿主改动在维护窗口重启 Harness 服务后生效。

## 配置

`remote-web-ui` 命名空间支持 `enabled`（true）、`tokenTtlMs`（600000）、`offlineAfterMs`（25000）、`maxDevices`（4）、`idleExpireMs`（2592000000）、`cookieName`（dsh_pair）和 `requirePairingForLan`（true）。时长单位为毫秒。`lanBind` 在明确修改前保持未设置。`profile` 默认为 `DSH_PROFILE` 或 `web`，`devicesFile` 默认为 `$DSH_HOME/remote-web-ui-devices.json`。

`trustedHosts` 与逗号分隔的 `DSH_REMOTE_TRUSTED_HOSTS` 支持内部反向代理，仅添加内网管理员控制的地址。历史 `autoTunnel`、`tunnelToken`、`relay`、`publicBaseUrl` 与 `DSH_REMOTE_PUBLIC_BASE_URL` 值均被忽略，加载旧设置不能发起公网连接。

## 使用

1. 在主电脑打开本机回环 GUI，例如 `http://127.0.0.1:3080`。
2. 按需在远程访问设置卡片中开启局域网访问。绑定变化可能需要重启服务。
3. 打开配对面板，选择可达的内网地址，并在其他设备扫码或打开复制的链接。
4. 在主电脑管理设备。停止或取消设备授权后，配对通道随即拒绝其访问。

## 安全模型

- 配对授予通过 `/remote` 使用完整宿主 API 的权限，只授权自己控制的设备。每次请求需要有效设备凭据，停止或撤销后立即拒绝后续请求。
- 签发令牌、管理设备和查看局域网状态仅限本机回环。远程代理保留旧更新路径的拒绝规则，但本包不挂载更新接口。
- 内部代理仅在配对检查通过后使用进程持有的 Harness 浏览器凭据。直接访问 `/api` 仍由 Harness 浏览器认证和主机栅栏管理，撤销配对不会撤销设备另行兑换的 Harness 浏览器凭据。
- 会话保存在本地设备存储中，空闲过期和撤销授权使其失效。此存储应作为凭据数据保护。
- 本机安全探测通过回环请求检查直接 API 栅栏。局域网绑定和主机防火墙配置决定可达范围。
- 内部反向代理需要明确配置可信主机。插件不创建公网隧道，也不联系中继注册服务。

## 已知限制

- 其他设备需要能够路由到所选内网地址，不提供互联网穿透。
- 局域网绑定在 Harness 配置下次应用后生效，设置卡片会提示待重启状态。
- 普通 HTTP 局域网来源不能使用要求安全上下文的重开 Service Worker，从书签重新打开可能需要新的配对链接。
- 移动端适配依赖官方界面选择器，基座界面升级后需进行视觉验证。

## 检查

```sh
pnpm run typecheck
pnpm test
pnpm run build
```
