# @linxin666/dsh-client-ui-preset-center

English | [中文](README.zh.md)

Community agent-preset manager for the DSH Web GUI: the Workshop's **Presets** panel and the host library that installs, enables, disables and uninstalls presets downloaded from [dsh-market.com](https://dsh-market.com). A preset is only listed in **Settings → Agent presets** once it is installed *and* enabled; everything else stays in the Workshop.

## What it does

- Adds a **Presets** tab to the Workshop store card (contributed through the card's `dsh-workshop.panel` child slot) that lists the community catalog with install state, version updates and install counts.
- Installs a preset into an inert library at `$DSH_HOME/agent-presets/<id>/`. Nothing scans that directory, so an installed preset never loads.
- Enables a preset by moving its directory into the discovery root `$DSH_HOME/.agent-presets/<id>/`, the harness-home root `@deepseek-ai/dsh-agent-presets` already scans; disabling moves it back. Discovery re-reads its roots on every call, so a new session can use the preset without restarting `dsh web`.
- Shows a **composition profile** computed from the installed bytes — the plugin names the composition mounts, whether it ships local code files or `!!js` expressions — and requires an explicit confirmation before enabling anything executable. A read-only viewer renders `agent.cordis.yml` first.
- Refuses to enable a preset whose id a shipped or configured root already supplies (that root wins discovery order, so enabling would silently do nothing), and refuses to disable or uninstall the preset the `agent-presets` default setting names (a default naming a missing preset fails every new session).
- Verifies market provenance on every state read: per-file sha256 pinned to `https://dsh-market.com`, so a locally edited preset is reported as modified and an update never silently overwrites it.

## Install

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-preset-center
```

The Workshop card (`@linxin666/dsh-client-ui-market`) declares the panel slot and owns the download; without it the host routes still work but there is no panel to drive them. Both ship in the `@linxin666/dsh-web-all` aggregate.

## Config

None. The panel is the only surface, and every behavior is derived from the catalog and the two directories. The plugin registers no settings namespace and injects nothing into the agent system prompt.

## Security model

A preset is code, not an asset: its composition may name npm plugins, load files that travel inside the preset directory, and evaluate `!!js` expressions — all inside the DSH host process when a session is composed from it. The official package states the trust plainly: a preset carries the same trust as shell access. This plugin therefore never treats installation as running:

- **Install is inert.** The market installer writes into `$DSH_HOME/agent-presets/<id>/`, which no discovery root scans.
- **Enable is the consent boundary.** Enabling moves the directory into the discovery root; the panel requires an explicit confirmation whenever the composition carries local code, relative rows or inline expressions, and shows what those are.
- **Enable is pre-checked and rolled back.** The id is checked against the live roster, and a preset the roster reports broken is moved back to the library with the reason shown instead of being left half-enabled.
- **Provenance is the integrity anchor.** The market's per-file sha256 record is re-verified on every read; a mismatch is reported, never repaired silently.
- **Routes are loopback-only.** `/api/preset-center/*` answers only loopback requests, the same fence the market gateway uses, so a remote browser cannot drive the library.
- **Unmanaged directories are untouchable.** A preset that has no market provenance (hand-authored, or installed by another tool) is listed as such and refused by disable and uninstall.

## Known limitations

- **Enabling is not sandboxing.** The confirmation and the composition profile reduce accidental risk; they do not make an untrusted preset safe. Review at the publish gate is the real control.
- **The official settings section may lag.** It re-reads on its own actions, `settings/document-updated` and `connection/reset`, so a preset enabled in the Workshop can require a page refresh before it appears under **Settings → Agent presets**. New sessions pick it up immediately.
- **Running sessions keep their preset.** A session's composition is fixed at creation, so disabling or uninstalling a preset never changes a session already using it.
- **Directory moves on Windows.** Moving a directory the host process still has open can fail transiently; the move path retries briefly and reports a write error instead of leaving a partial state.
- **The catalog is empty until presets are published.** `packages/dsh-preset-center/presets/catalog.json` is the publishing source; see its README for the contribution format.

## Architecture

- `src/index.ts` — host half: mounts the loopback gateway once per process.
- `src/routes.ts` — `GET /api/preset-center/state`, `GET /api/preset-center/composition?id=`, `POST /api/preset-center/{enable,disable,uninstall}`; the only layer that reads the roster, so the reserved-id and default-preset policies live here.
- `src/core/paths.ts` — the two-directory contract and the official preset id rule.
- `src/core/library.ts` — the state machine: scan, enable, disable, uninstall, atomic moves with a cross-volume fallback.
- `src/core/provenance.ts` — the market provenance reader and per-file verification.
- `src/core/profile.ts` — the composition profile.
- `src/client/PresetPanel.tsx` — the panel the Workshop card renders.
- `presets/` — the publishing source read by `scripts/market-build` (catalog plus one directory per preset).

The library and discovery directories are a cross-package contract: the market installer writes `preset` assets into `$DSH_HOME/agent-presets/<id>/`, and the official roster scans `$DSH_HOME/.agent-presets`. Neither package imports the other; the path names and the `dsh-market.provenance.json` format are mirrored constants, the same way the Skin Center mirrors the market's provenance.
