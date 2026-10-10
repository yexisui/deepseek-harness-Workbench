> 历史参考：来自原项目归档，非现行指令。原文链接以当时的上游目录为背景，不保证在当前仓库可用；现行入口为 project-context/AGENTS.MD。

# @linxin666/dsh-client-ui-market

English | [中文](README.zh.md)

Local Workshop for the customized DSH workbench: import and manage your own skins, pets, plugins and agent presets from Settings.

## What it does

- Keeps the Workshop entry and four category tabs, with local counts, search and resource status.
- Imports a ZIP package or selected folder. Inspect its name, type, version, size and replacement conflicts before confirming.
- Copies resource files independently of the source folder, using existing settings cards, controls and theme tokens.
- Shows existing resources without adopting their deletion rights. This card makes no online catalog, preview-image, ranking or Workshop heartbeat requests; the online downloader, routes and challenge frame are absent.

## Install

Use the customized workbench's deployment or rebuild launcher. It builds five affected packages into runtime-dev and selects them through profile workspace overrides. A running host may need a user restart. The public npm package at the same version is the upstream distribution and does not contain this customization.

## Config

The dsh-web-ui-market enable switch hides the library while retaining the switch itself. Import and resource actions are immediate; the card's Save button saves only its enable setting.

| Category | Package requirements | After import |
| --- | --- | --- |
| Skin | Valid v2 skin.json, stylesheets and referenced files | Apply in Settings / Skins; approve executable hooks separately |
| Pet | Valid pet.json and sprite, frame or Live2D assets | Restart the workbench, then select in Settings / Pets |
| Plugin | package.json with dsh.bundle.patch, patch file and built JavaScript entries | Confirm installation, wait for success, restart if requested |
| Preset | preset.yml and agent.cordis.yml | Confirm and enable, then select through the existing preset control |

Import one resource at a time. ZIP files may have one enclosing folder. A preset without an explicit ID uses a suitable enclosing folder name, or a stable ID derived from its name.

## Known limitations

- Only loopback clients can use the local resource API. Plugin dependency installation may require internet access.
- Limits: 2,000 files, 200 MiB per file or ZIP, 500 MiB expanded per resource. Encrypted, ZIP64 and symbolic-link archives are rejected.
- Active resources must be deactivated before replacement; installed plugins must be uninstalled, and running install jobs must finish. Same-ID replacement requires confirmation.
- Imported resources and backups are private runtime data excluded from Git. Git restores source code, not these files.

## Security model

Import checks files without evaluating scripts, loading plugins or enabling presets. Routes verify loopback peers, Host and Origin; paths, manifests, required entries, ZIP integrity and quotas are checked before commit.

Each import generates dsh-workbench.import.json with file digests and ownership metadata. Execution approval is separate and bound to the exact imported content; bundled provenance cannot grant trust. Skin CSS still passes through the Skin Center's safety pipeline.

Plugin installation and preset activation reuse the existing managers and their conflict, roster and default-item checks. Plugin jobs use immutable package snapshots and report their actual outcome.

## Storage and recovery

Resources live below DSH_HOME: skins/, pets/, agent-presets/ (inactive), .agent-presets/ (enabled), and workshop/plugins/. Staging, approvals, installation snapshots and backups live under workshop/.

Replacement and removal retain the old directory in workshop/backups. A failed final move restores the previous directory. To recover a backup, deactivate the current resource and select the backup folder as a new import.
