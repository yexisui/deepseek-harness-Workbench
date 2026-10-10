> 历史参考：来自原项目归档，非现行指令。原文链接以当时的上游目录为背景，不保证在当前仓库可用；现行入口为 project-context/AGENTS.MD。

# @linxin666/dsh-client-ui-plugin-manager

English | [中文](README.zh.md)

Plugin manager for the DSH Plugins settings section: install, enable, disable and uninstall plugins, inspect installation conflicts and open repair conversations. Plugin update checks and update actions are disabled.

## What it does

- Registers the Plugin manager tab and provides the shared pluginManager service.
- Preserves npm, Git and local package installation. Uses the official installer RPC when available, otherwise the loopback HTTP gateway and official DSH CLI.
- Lists installed plugins and aggregate children with next-start switches; essential manager rows remain enabled.
- Shows installation progress, conflict notices, boot failures and repair conversations. Changes requiring a restart take effect after the user restarts the host.
- Makes no registry version checks or telemetry requests. The legacy update and check-updates HTTP endpoints return 410, and matching service methods reject without calling official RPC or the CLI.

## Install

Use the workbench deployment or its existing plugin installation flow. npm, Git and local installation retain their original behavior, including dependency downloads and package scripts. Preparing dependencies for an offline deployment remains the deployer's responsibility.

## Config

This tab has no configuration namespace. Plugin enablement is persisted for the next host start. On runtimes with official installer channels, local management uses those channels; otherwise the gateway manages the profile through the official CLI and atomic patch writes.

## Cordis service

The browser provides pluginManager with isLoopback, list, install, uninstall, status, failures, setEnabled and onChange. The tab and sibling consumers share the same face; successful mutations notify listeners. Compatibility update and checkUpdates methods reject immediately.

## Known limitations

- Plugin management is loopback-only. Remote browsers receive a local-only notice; remote HTTP requests are rejected.
- Installs can require network access. Local package import does not imply that all dependencies are available offline.
- The npm web runtime has no boot-failure ring or safe mode. Installation errors still support repair handoff.
- CLI preflight verifies composition and unresolved entry references; runtime import or apply errors can still appear on the next actual start.
- This package does not control base Harness updates or independently exposed official installer features.

## Security model

Every gateway route checks the socket address, Host, Origin and cross-site request metadata. Installation remains local code execution; package scripts retain their original behavior. Untrusted shell characters and invalid profile names are rejected.

Mutations are serialized. Installations must actually add a dependency before succeeding; duplicate entry claims or unresolved entries roll back the new package. The duplicate-mount safeguard removes only newly introduced conflicting bundle entries. Enablement rechecks ownership and writes backups with atomic replacement.

## License

BSD-3-Clause.
