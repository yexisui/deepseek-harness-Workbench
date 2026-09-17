# @linxin666/dsh-client-ui-market

English | [中文](README.zh.md)

Workshop store card for the DSH Web GUI settings page: one first-level Workshop
section that browses [dsh-market.com](https://dsh-market.com) from inside the GUI and installs skins,
pets, plugins and community presets locally with one click; installed items are managed by their own
surfaces (Skin Center, Pet, the plugin manager in the official Plugins section, and the Presets panel
this card's preset tab renders).

## What it does

- Four-category catalog (skins / pets / plugins / presets) with the same ranking used by the Workshop site:
  device-backed likes first (tie-broken by the manifest order), a search box, and per-card preview
  links (skins open the live try-on simulator).
- One-click asset install (loopback browsers): skins download into `$DSH_HOME/skins/<id>/` and pets
  into `$DSH_HOME/pets/<id>/` — the DSH home directories that the Skin Center and the pet registry
  already scan, so no restart is needed (reopen the card to pick them up). Presets download into the
  inert library `$DSH_HOME/agent-presets/<id>/`, which no discovery root scans; enabling one moves it
  into the roster's user root through the Presets panel. Reinstalling an existing directory asks for
  confirmation and replaces it atomically.
- One-click plugin install through the optional `pluginManager` service (provided by
  `@linxin666/dsh-client-ui-plugin-manager`); without it the card degrades to the copy-command index.
- Remote browsers see the read-only catalog: install buttons are hidden, the Workshop site link and
  copy-command fallbacks stay available.
- Each card also shows an independent Workshop install count next to likes, plus a plugin npm
  last-30-day download count (npm-backed plugins only); install counts record successful install
  events, npm downloads use the public registry convention, and neither merges with likes.

## Install

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-market
```

Restart `dsh web`; the Workshop section appears in the settings page and opens this store card
directly (skins / pets / plugins / presets tabs). The Skin Center, the Pet section and the plugin
manager in the official Plugins section are separate first-level settings entries; the presets tab is
rendered by `@linxin666/dsh-client-ui-preset-center`, which contributes it into the child slot this
card declares.

## Config

- Enable switch: the card carries its own master switch in the plugin configuration section (persisted
  in the `dsh-web-ui-market` settings namespace). Turning it off hides the catalog and keeps the switch only.
- No other configuration; the catalog data always comes from dsh-market.com.

## Known limitations

- Remote (non-loopback) browsers cannot drive installs at all; they get the read-only catalog with
  copy-command fallbacks.
- Asset installs require the Workshop site to be reachable; a manifest or download failure leaves the
  existing asset directory untouched.
- Likes are per-device (the browser stores one anonymous fingerprint); they are not tied to any login.

## Telemetry

The browser half sends one anonymous install heartbeat per UTC day to dsh-market.com: a random localStorage id plus this package's name, nothing else. The server stores only a salted hash of that id, never IP addresses, and exposes aggregate counts only. See [docs/telemetry.md](../../docs/telemetry.md) for the full contract.

## Architecture

- The host half (`src/index.ts`) registers the `dsh-web-ui-market` settings namespace and mounts the
  loopback-only gateway (`/api/market/installed`, `/api/market/install-skin`, `/api/market/install-pet`,
  `/api/market/install-preset`).
- The installer core (`src/core/installer.ts`) fetches the manifest from `dsh-market.com` itself,
  validates every path against a conservative allowlist, and writes atomically (temp dir then rename),
  so a failed download never leaves a half-written asset directory. The client never supplies URLs or
  file lists.
- Every market asset carries an explicit file list, so a new skin pack ships to installs automatically
  as soon as `scripts/market-build` regenerates `market/dist`.
- The card declares the keyed child slot `dsh-workshop.panel` and renders one cell per contributed
  kind; the Presets panel registers the `preset` cell and receives the catalog records and the download
  gateway as owner props, so the store keeps one catalog fetch and one gateway for every kind.

## Security model

- Install routes answer only loopback requests (the same gate as the plugin manager); remote browsers
  cannot drive them.
- All downloaded content comes from `https://dsh-market.com` (asset URLs are rebuilt from the
  validated manifest); skin CSS is sanitized by the Skin Center runtime before it is applied.
- The manifest (1 MiB), the per-asset file count (2000) and the per-file size (200 MiB) are capped and
  every fetch has a 30 s timeout; a manifest or download exceeding a cap or timing out fails cleanly
  and leaves the existing asset directory untouched.
- Presets install into an inert library, never into a discovery root: a preset is code (its composition
  can load local files and evaluate inline expressions in the host process), so downloading one must
  not be the same act as running it. The preset center owns the enable step and its confirmation.
- Every install writes `dsh-market.provenance.json` into the asset directory: the sha256 of each
  installed file, pinned to `https://dsh-market.com`. The Skin Center uses it to run a market
  skin's hooks only when the on-disk bytes hash-match what the market served (issue #1073);
  hand-dropped or tampered directories keep hooks refused.
- Plugin installs go through the same confirmation and CLI path as the Plugin manager tab.
- The card validates manifest install sources before calling the plugin manager: only npm package
  names (optionally pinned with a version tag) and plain https:// git URLs are accepted; ssh://,
  file://, http:// and relative or bare-repo forms are rejected with an error and no install call.
