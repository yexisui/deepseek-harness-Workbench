> 历史参考：来自原项目归档，非现行指令。原文链接以当时的上游目录为背景，不保证在当前仓库可用；现行入口为 project-context/AGENTS.MD。

# @linxin666/dsh-remote-web-ui

English | [中文](README.zh.md)

Local and LAN device pairing for the DeepSeek Harness Web GUI, with expiring tokens, revocable sessions, and mobile interface adaptation.

## What it does

- Provides a pairing button and remote-access settings card for phones and PCs on the intranet.
- Manages device presence, expiry, revocation, LAN binding, and interface selection.
- Runs without plugin update checks, public tunnels, relay registration, or install telemetry. Official DeepSeek Harness base upgrades remain owned by the base installation.

## Install

Use the deployment's prepared plugin directory or local package, including built `lib/` files and runtime dependencies. Register the directory in the intended Harness profile:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-remote-web-ui
```

Host changes take effect after a Harness service restart during a maintenance window.

## Config

The `remote-web-ui` namespace supports `enabled` (true), `tokenTtlMs` (600000), `offlineAfterMs` (25000), `maxDevices` (4), `idleExpireMs` (2592000000), `cookieName` (dsh_pair), and `requirePairingForLan` (true). Durations are milliseconds. `lanBind` remains unset until explicitly changed. `profile` defaults to `DSH_PROFILE` or `web`; `devicesFile` defaults to `$DSH_HOME/remote-web-ui-devices.json`.

`trustedHosts` and the comma-separated `DSH_REMOTE_TRUSTED_HOSTS` support internal reverse proxies. Only add authorities controlled by intranet administrators. Historical `autoTunnel`, `tunnelToken`, `relay`, `publicBaseUrl`, and `DSH_REMOTE_PUBLIC_BASE_URL` values are ignored; loading old settings cannot start public connections.

## Use

1. Open the main computer's loopback GUI, such as `http://127.0.0.1:3080`.
2. Enable LAN access in the remote-access settings card if needed. A bind change may require a service restart.
3. Open the pairing panel, select a reachable internal address, and scan or copy the link to another device.
4. Manage devices from the main computer. Stop or revoke a device to end access through the paired channel.

## Security model

- Pairing grants full host API access through `/remote`. Only authorize devices you control. Requests need a live device credential; stop/revoke denies subsequent requests immediately.
- Pair issuance, device management, and LAN status stay loopback-only. The remote proxy retains the legacy update-path deny rule, although this package mounts no update endpoints.
- The inner proxy uses the process's Harness browser credential only after pairing succeeds. Direct `/api` remains governed by Harness browser authentication and its host fence; revoking pairing does not revoke a separately redeemed Harness browser credential.
- Sessions persist in the local device store. Idle expiry and revocation invalidate them. Treat this store as credential data.
- A local posture probe checks the direct API fence using loopback requests. LAN binding and host firewall configuration determine reachability.
- Internal reverse proxies require explicit trusted-host configuration. The plugin creates no public tunnel and contacts no relay registry.

## Known limitations

- Other devices need a route to the selected intranet address. Internet traversal is unavailable.
- LAN bind changes take effect when the Harness profile next applies; the card reports a pending restart.
- Plain HTTP LAN origins cannot use the secure-context reopen service worker. A bookmark reopen may require a fresh pairing link.
- Mobile adaptation follows official UI selectors. Base GUI upgrades require visual verification.

## Checks

```sh
pnpm run typecheck
pnpm test
pnpm run build
```
