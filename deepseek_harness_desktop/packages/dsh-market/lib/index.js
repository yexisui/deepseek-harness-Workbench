import z from "schemastery";
import { homedir } from "node:os";
import path, { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isAbsolute as isAbsolute$1, join as join$1 } from "node:path/posix";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { parseDocument } from "yaml";
import { inflateRawSync } from "node:zlib";
import { Readable } from "node:stream";
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and unmarks when its fiber disposes;
* any later mount of the same package name is a no-op.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/dsh-home.ts
/**
* DSH_HOME resolution shared by the plugin family's Host halves: the
* environment override wins, the platform home fallback follows. Mirrors
* what dsh-pet and dsh-liangshen each used to implement locally.
*/
/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
	const j = home.startsWith("/") ? join$1 : join;
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) return j(home, path.slice(2));
	return path;
}
/**
* Resolve the DSH home directory.
* @param env - process environment to read DSH_HOME from.
* @param home - platform home directory fallback (test seam).
* @returns the absolute DSH home path.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const isPosix = home.startsWith("/");
	const j = isPosix ? join$1 : join;
	const isAbs = isPosix ? isAbsolute$1 : isAbsolute;
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = expandHome(raw.trim(), home);
		return isAbs(expanded) ? expanded : j(process.cwd(), expanded);
	}
	return j(home, ".dsh");
}
/** Resolve the DSH home directory from the live environment. */
function dshHome() {
	return resolveDshHome();
}
//#endregion
//#region src/http.ts
/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Lenient bounded body reader: parse a request body as JSON, or null on an
* empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
* Overflow destroys the request instead of draining the remainder (no drain
* call, matching the current repo-wide behavior); callers must not keep
* reading the request afterwards. With objectOnly, non-JSON-object payloads
* also yield null.
*/
async function readJsonBody(req, opts = {}) {
	const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		const parsed = JSON.parse(text);
		if (opts.objectOnly && !isJsonObject(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
/** Whether a value is a JSON object: typeof object, not null, not an array. */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Narrow a value to a JSON object, or undefined when it is not one. */
function asJsonObject(value) {
	return isJsonObject(value) ? value : void 0;
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
//#endregion
//#region src/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region ../skins/skin-center/src/core/manifest-v2/types.ts
/** v1 fields accepted but ignored with a migration warning (never fail-closed). */
const DEPRECATED_V1_FIELDS = [
	"package",
	"wiring",
	"bodyAttr"
];
//#endregion
//#region ../skins/skin-center/src/core/manifest-v2/validate.ts
/**
* Fail-closed validator for skin.json manifest v2.
*
* Pure, dependency-free, safe in both the host (node) and the browser
* bundle. Rules (issue #506, section 5):
*  - unknown top-level / nested fields are hard errors (fail-closed);
*  - the v1 fields `package` / `wiring` / `bodyAttr` are an explicit
*    deprecated allowlist: ignored with a migration warning, never an
*    error — otherwise the 11 legacy manifests would be rejected by their
*    own validator;
*  - all file references must be relative paths inside the skin directory
*    (no leading slash, no "..", no protocol URLs);
*  - `skinManifestVersion` declares file structure only; hooks runtime
*    compatibility is carried by `facets.client.apiVersion` and checked
*    by the loader, not here.
*/
const REL_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*:\/\/)[A-Za-z0-9._\-/]+$/;
const SKIN_ID = /^[a-z][a-z0-9-]{0,31}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const API_VERSION = /^x-org\.linxin666\.skin-center\/[a-z0-9]+$/;
const TOP_LEVEL_KEYS = /* @__PURE__ */ new Set([
	"$schema",
	"skinManifestVersion",
	"id",
	"name",
	"nameEn",
	"version",
	"author",
	"tagline",
	"description",
	"tags",
	"accent",
	"order",
	"preview",
	"license",
	"licenseUrl",
	"noticeUrl",
	"sourceUrl",
	"attribution",
	"requires",
	"contributes",
	"facets",
	...DEPRECATED_V1_FIELDS
]);
const DEPRECATED_SET = new Set(DEPRECATED_V1_FIELDS);
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkKeys(obj, allowed, path, errors) {
	for (const key of Object.keys(obj)) if (!allowed.has(key)) errors.push(`${path}: unknown field "${key}"`);
}
function checkRelPath(value, path, errors) {
	if (typeof value !== "string" || !REL_PATH.test(value)) errors.push(`${path}: must be a relative path inside the skin directory (got ${JSON.stringify(value)})`);
}
function checkOptionalString(value, path, errors) {
	if (value !== void 0 && typeof value !== "string") errors.push(`${path}: must be a string`);
}
function checkBackgroundLayer(value, path, errors) {
	if (value === void 0) return;
	if (!isRecord$2(value)) {
		errors.push(`${path}: must be an object`);
		return;
	}
	checkKeys(value, /* @__PURE__ */ new Set([
		"type",
		"src",
		"scrim"
	]), path, errors);
	if (value.type !== "image" && value.type !== "video") errors.push(`${path}.type: must be "image" or "video"`);
	checkRelPath(value.src, `${path}.src`, errors);
	checkOptionalString(value.scrim, `${path}.scrim`, errors);
}
function checkContracts(value, path, errors) {
	if (value === void 0) return;
	if (!Array.isArray(value)) {
		errors.push(`${path}: must be an array`);
		return;
	}
	value.forEach((entry, index) => {
		const p = `${path}[${index}]`;
		if (!isRecord$2(entry)) {
			errors.push(`${p}: must be an object`);
			return;
		}
		checkKeys(entry, /* @__PURE__ */ new Set([
			"apiVersion",
			"kind",
			"optional"
		]), p, errors);
		if (typeof entry.apiVersion !== "string" || !API_VERSION.test(entry.apiVersion)) errors.push(`${p}.apiVersion: must match x-org.linxin666.skin-center/<tag>`);
		if (entry.kind !== "SkinRuntime" && entry.kind !== "SkinHooks") errors.push(`${p}.kind: must be "SkinRuntime" or "SkinHooks"`);
		if (entry.optional !== void 0 && typeof entry.optional !== "boolean") errors.push(`${p}.optional: must be a boolean`);
	});
}
/**
* Validate a parsed skin.json payload against the v2 contract.
* Never throws; malformed input yields `ok: false` with human-readable errors.
*/
function validateSkinManifestV2(input) {
	const errors = [];
	const warnings = [];
	if (!isRecord$2(input)) return {
		ok: false,
		errors: ["manifest: must be a JSON object"],
		warnings
	};
	for (const field of Object.keys(input)) if (DEPRECATED_SET.has(field)) warnings.push(`deprecated v1 field "${field}" ignored; run the v1→v2 migration codemod`);
	checkKeys(input, TOP_LEVEL_KEYS, "manifest", errors);
	if (input.skinManifestVersion !== 2) errors.push("manifest.skinManifestVersion: must be 2 (v1 manifests need the migration codemod)");
	if (typeof input.id !== "string" || !SKIN_ID.test(input.id)) errors.push(`manifest.id: must match ${SKIN_ID} (got ${JSON.stringify(input.id)})`);
	for (const field of [
		"name",
		"nameEn",
		"author"
	]) if (typeof input[field] !== "string" || input[field].length === 0) errors.push(`manifest.${field}: required non-empty string`);
	if (typeof input.version !== "string" || !SEMVER.test(input.version)) errors.push(`manifest.version: required SemVer string (got ${JSON.stringify(input.version)})`);
	checkOptionalString(input.tagline, "manifest.tagline", errors);
	checkOptionalString(input.description, "manifest.description", errors);
	for (const field of [
		"license",
		"licenseUrl",
		"noticeUrl",
		"sourceUrl",
		"attribution"
	]) checkOptionalString(input[field], `manifest.${field}`, errors);
	if (input.tags !== void 0) {
		if (!Array.isArray(input.tags) || input.tags.some((t) => typeof t !== "string")) errors.push("manifest.tags: must be a string array");
	}
	if (input.accent !== void 0 && (typeof input.accent !== "string" || !HEX_COLOR.test(input.accent))) errors.push(`manifest.accent: must be a #rrggbb color (got ${JSON.stringify(input.accent)})`);
	if (input.order !== void 0 && !Number.isInteger(input.order)) errors.push("manifest.order: must be an integer");
	if (input.$schema !== void 0 && typeof input.$schema !== "string") errors.push("manifest.$schema: must be a string");
	if (input.preview !== void 0) if (!isRecord$2(input.preview)) errors.push("manifest.preview: must be an object");
	else {
		checkKeys(input.preview, /* @__PURE__ */ new Set(["light", "dark"]), "manifest.preview", errors);
		checkRelPath(input.preview.light, "manifest.preview.light", errors);
		checkRelPath(input.preview.dark, "manifest.preview.dark", errors);
	}
	if (input.requires !== void 0) if (!isRecord$2(input.requires)) errors.push("manifest.requires: must be an object");
	else {
		checkKeys(input.requires, /* @__PURE__ */ new Set(["contracts"]), "manifest.requires", errors);
		checkContracts(input.requires.contracts, "manifest.requires.contracts", errors);
	}
	if (!isRecord$2(input.contributes)) errors.push("manifest.contributes: required object with at least \"stylesheet\"");
	else {
		const contributes = input.contributes;
		checkKeys(contributes, /* @__PURE__ */ new Set([
			"stylesheet",
			"patches",
			"backgroundMedia"
		]), "manifest.contributes", errors);
		checkRelPath(contributes.stylesheet, "manifest.contributes.stylesheet", errors);
		if (contributes.patches !== void 0) checkRelPath(contributes.patches, "manifest.contributes.patches", errors);
		if (contributes.backgroundMedia !== void 0) if (!isRecord$2(contributes.backgroundMedia)) errors.push("manifest.contributes.backgroundMedia: must be an object");
		else {
			checkKeys(contributes.backgroundMedia, /* @__PURE__ */ new Set(["light", "dark"]), "manifest.contributes.backgroundMedia", errors);
			checkBackgroundLayer(contributes.backgroundMedia.light, "manifest.contributes.backgroundMedia.light", errors);
			checkBackgroundLayer(contributes.backgroundMedia.dark, "manifest.contributes.backgroundMedia.dark", errors);
		}
	}
	if (input.facets !== void 0) if (!isRecord$2(input.facets)) errors.push("manifest.facets: must be an object");
	else {
		checkKeys(input.facets, /* @__PURE__ */ new Set(["client"]), "manifest.facets", errors);
		if (input.facets.client !== void 0) {
			const client = input.facets.client;
			if (!isRecord$2(client)) errors.push("manifest.facets.client: must be an object");
			else {
				checkKeys(client, /* @__PURE__ */ new Set(["entry", "apiVersion"]), "manifest.facets.client", errors);
				checkRelPath(client.entry, "manifest.facets.client.entry", errors);
				if (typeof client.apiVersion !== "string" || !API_VERSION.test(client.apiVersion)) errors.push("manifest.facets.client.apiVersion: must match x-org.linxin666.skin-center/<tag>");
			}
		}
	}
	const manifest = errors.length === 0 ? input : void 0;
	return {
		ok: errors.length === 0,
		errors,
		warnings,
		manifest
	};
}
//#endregion
//#region ../dsh-pet/src/gameplay.ts
const KEBAB = /^[a-z0-9][a-z0-9-]*$/;
const MAX_STATS = 16;
const MAX_ZONES = 8;
const MAX_BRANCHES = 8;
const MAX_ACTS = 16;
const MAX_SHOP_ITEMS = 32;
const MAX_LOTTERY_TIERS = 16;
const MAX_PHRASES = 64;
const PHRASE_MAX_LENGTH = 120;
const STAT_VALUE_MAX = 1e6;
const KNOWN_GAMEPLAY = /* @__PURE__ */ new Set([
	"idleDirector",
	"stats",
	"hitBox",
	"touch",
	"work",
	"sleep",
	"passiveIncome",
	"shop",
	"dragState",
	"dragEndState"
]);
const KNOWN_STAT = /* @__PURE__ */ new Set([
	"max",
	"initial",
	"decayPerMinute",
	"workingDecayPerMinute",
	"idleDecayPerMinute"
]);
const KNOWN_ZONE = /* @__PURE__ */ new Set([
	"name",
	"y0",
	"y1",
	"branches"
]);
const KNOWN_TOUCH = /* @__PURE__ */ new Set(["zones", "clickBoost"]);
const KNOWN_BRANCH = /* @__PURE__ */ new Set([
	"probability",
	"effects",
	"state",
	"stateMs",
	"phrases"
]);
const KNOWN_EFFECT = /* @__PURE__ */ new Set([
	"stat",
	"currency",
	"amount"
]);
const KNOWN_WORK = /* @__PURE__ */ new Set([
	"state",
	"successState",
	"failState",
	"tickMs",
	"resultMs",
	"successProbability",
	"success",
	"fail"
]);
const KNOWN_SLEEP = /* @__PURE__ */ new Set([
	"state",
	"wakeState",
	"restore"
]);
const KNOWN_SHOP_ITEM = /* @__PURE__ */ new Set([
	"id",
	"label",
	"image",
	"price",
	"currency",
	"effects",
	"lottery"
]);
const KNOWN_LOTTERY = /* @__PURE__ */ new Set([
	"effects",
	"currency",
	"tiers"
]);
const KNOWN_IDLE_DIRECTOR = /* @__PURE__ */ new Set([
	"intervalMs",
	"maxMiss",
	"idleWeight",
	"acts"
]);
const KNOWN_ACT = /* @__PURE__ */ new Set([
	"track",
	"weight",
	"phrases"
]);
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unknownKeys$1(source, known) {
	return Object.keys(source).filter((key) => !known.has(key));
}
function validName(name, max = 32) {
	return typeof name === "string" && name.length <= max && KEBAB.test(name);
}
function intIn(value, min, max) {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function numIn(value, min, max) {
	return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function parseEffects(raw, field, stats, hooks) {
	if (raw === void 0) return void 0;
	if (!Array.isArray(raw) || raw.length === 0) {
		hooks.error(field + " must be a non-empty array of effects");
		return;
	}
	const effects = [];
	for (const entry of raw) {
		if (!isRecord$1(entry)) {
			hooks.error(field + ": every effect must be an object");
			continue;
		}
		const extra = unknownKeys$1(entry, KNOWN_EFFECT);
		if (extra.length > 0) hooks.error(field + ": unknown effect field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
		const hasStat = typeof entry.stat === "string";
		const hasCurrency = typeof entry.currency === "string";
		if (hasStat === hasCurrency) {
			hooks.error(field + ": an effect needs exactly one of stat or currency");
			continue;
		}
		if (!intIn(entry.amount, -1e6, STAT_VALUE_MAX) || entry.amount === 0) {
			hooks.error(field + ": effect amount must be a non-zero integer within ±1000000");
			continue;
		}
		if (hasStat && stats[entry.stat] === void 0) {
			hooks.error(field + ": effect references undeclared stat " + JSON.stringify(entry.stat));
			continue;
		}
		if (hasCurrency && !validName(entry.currency, 24)) {
			hooks.error(field + ": effect currency must be a kebab id");
			continue;
		}
		effects.push({
			...hasStat ? { stat: entry.stat } : {},
			...hasCurrency ? { currency: entry.currency } : {},
			amount: entry.amount
		});
	}
	return effects.length === 0 ? void 0 : effects;
}
function parsePhrases(raw, field, hooks) {
	if (raw === void 0) return void 0;
	if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PHRASES || raw.some((line) => typeof line !== "string" || line.trim() === "" || line.length > PHRASE_MAX_LENGTH)) {
		hooks.error(field + " must be 1..64 non-empty lines of at most 120 chars");
		return;
	}
	return raw;
}
function parseStateRef(raw, field, hooks) {
	if (raw === void 0) return void 0;
	if (typeof raw !== "string" || !hooks.stateNames.has(raw)) {
		hooks.error(field + " must name a declared frames2d track");
		return;
	}
	return raw;
}
/**
* Validate the manifest 'gameplay' block (fail-closed). Only frames2d pets
* may declare gameplay today: every state reference checks against the
* declared track names.
*/
function parseGameplayManifest(raw, hooks) {
	const error = (message) => hooks.error(message);
	if (!isRecord$1(raw)) {
		error("gameplay must be an object");
		return;
	}
	const extra = unknownKeys$1(raw, KNOWN_GAMEPLAY);
	if (extra.length > 0) error("gameplay: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	let failed = false;
	const fail = (message) => {
		failed = true;
		error(message);
	};
	const stats = {};
	if (raw.stats !== void 0) if (!isRecord$1(raw.stats)) fail("gameplay.stats must be an object keyed by stat id");
	else {
		const entries = Object.entries(raw.stats);
		if (entries.length > MAX_STATS) fail("gameplay.stats declares too many stats (max 16)");
		for (const [name, value] of entries) {
			if (!validName(name, 24)) {
				fail("gameplay.stats: invalid stat id " + JSON.stringify(name));
				continue;
			}
			if (!isRecord$1(value)) {
				fail("gameplay.stats." + name + " must be an object");
				continue;
			}
			const statExtra = unknownKeys$1(value, KNOWN_STAT);
			if (statExtra.length > 0) fail("gameplay.stats." + name + ": unknown field(s) " + statExtra.map((k) => JSON.stringify(k)).join(", "));
			if (!intIn(value.max, 1, STAT_VALUE_MAX)) {
				fail("gameplay.stats." + name + ".max must be an integer in [1, 1000000]");
				continue;
			}
			const def = { max: value.max };
			if (value.initial !== void 0) if (!numIn(value.initial, 0, value.max)) fail("gameplay.stats." + name + ".initial must be within [0, max]");
			else def.initial = value.initial;
			for (const key of [
				"decayPerMinute",
				"workingDecayPerMinute",
				"idleDecayPerMinute"
			]) if (value[key] !== void 0) if (!numIn(value[key], 0, 1e3)) fail("gameplay.stats." + name + "." + key + " must be a number in [0, 1000]");
			else def[key] = value[key];
			stats[name] = def;
		}
	}
	const block = {};
	if (Object.keys(stats).length > 0) block.stats = stats;
	if (raw.idleDirector !== void 0) if (!isRecord$1(raw.idleDirector) || !Array.isArray(raw.idleDirector.acts)) fail("gameplay.idleDirector must be an object with an acts array");
	else {
		const d = raw.idleDirector;
		const dExtra = unknownKeys$1(d, KNOWN_IDLE_DIRECTOR);
		if (dExtra.length > 0) fail("gameplay.idleDirector: unknown field(s) " + dExtra.map((k) => JSON.stringify(k)).join(", "));
		if (d.intervalMs !== void 0 && !intIn(d.intervalMs, 1e3, 6e4)) fail("gameplay.idleDirector.intervalMs must be an integer in [1000, 60000]");
		if (d.maxMiss !== void 0 && !intIn(d.maxMiss, 0, 10)) fail("gameplay.idleDirector.maxMiss must be an integer in [0, 10]");
		if (d.idleWeight !== void 0 && !intIn(d.idleWeight, 0, 1e4)) fail("gameplay.idleDirector.idleWeight must be an integer in [0, 10000]");
		if (d.acts.length === 0 || d.acts.length > MAX_ACTS) fail("gameplay.idleDirector.acts must declare 1..16 acts");
		const acts = [];
		for (const act of d.acts) {
			if (!isRecord$1(act) || !intIn(act.weight, 1, 1e4)) {
				fail("gameplay.idleDirector.acts entries need a weight integer in [1, 10000]");
				continue;
			}
			const aExtra = unknownKeys$1(act, KNOWN_ACT);
			if (aExtra.length > 0) fail("gameplay.idleDirector.acts: unknown field(s) " + aExtra.map((k) => JSON.stringify(k)).join(", "));
			const track = parseStateRef(act.track, "gameplay.idleDirector.acts.track", hooks);
			if (track === void 0) continue;
			const entry = {
				track,
				weight: act.weight
			};
			const phrases = parsePhrases(act.phrases, "gameplay.idleDirector.acts.phrases", hooks);
			if (phrases !== void 0) entry.phrases = phrases;
			acts.push(entry);
		}
		if (acts.length > 0) block.idleDirector = {
			intervalMs: intIn(d.intervalMs, 1e3, 6e4) ? d.intervalMs : 5e3,
			maxMiss: intIn(d.maxMiss, 0, 10) ? d.maxMiss : 2,
			idleWeight: intIn(d.idleWeight, 0, 1e4) ? d.idleWeight : 0,
			acts
		};
	}
	if (raw.hitBox !== void 0) {
		const b = raw.hitBox;
		if (!isRecord$1(b) || !numIn(b.x0, 0, 1) || !numIn(b.x1, 0, 1) || !numIn(b.y0, 0, 1) || !numIn(b.y1, 0, 1) || !(b.x0 < b.x1) || !(b.y0 < b.y1)) fail("gameplay.hitBox must be { x0, y0, x1, y1 } fractions with x0 < x1 and y0 < y1");
		else block.hitBox = {
			x0: b.x0,
			y0: b.y0,
			x1: b.x1,
			y1: b.y1
		};
	}
	if (raw.touch !== void 0) if (!isRecord$1(raw.touch) || !Array.isArray(raw.touch.zones)) fail("gameplay.touch must be an object with a zones array");
	else {
		const tExtra = unknownKeys$1(raw.touch, KNOWN_TOUCH);
		if (tExtra.length > 0) fail("gameplay.touch: unknown field(s) " + tExtra.map((k) => JSON.stringify(k)).join(", "));
		let clickBoost;
		if (raw.touch.clickBoost !== void 0) {
			const cb = raw.touch.clickBoost;
			if (!isRecord$1(cb) || typeof cb.stat !== "string" || stats[cb.stat] === void 0 || !intIn(cb.min, 0, 1e3) || !intIn(cb.max, 0, 1e3) || cb.min > cb.max) fail("gameplay.touch.clickBoost must be { stat (declared), min, max } integers with 0 <= min <= max <= 1000");
			else clickBoost = {
				stat: cb.stat,
				min: cb.min,
				max: cb.max
			};
		}
		const zones = [];
		if (raw.touch.zones.length === 0 || raw.touch.zones.length > MAX_ZONES) fail("gameplay.touch.zones must declare 1..8 zones");
		for (const zoneRaw of raw.touch.zones) {
			if (!isRecord$1(zoneRaw) || !validName(zoneRaw.name) || !numIn(zoneRaw.y0, 0, 1) || !numIn(zoneRaw.y1, 0, 1) || !(zoneRaw.y0 < zoneRaw.y1)) {
				fail("gameplay.touch.zones entries need a kebab name and 0 <= y0 < y1 <= 1");
				continue;
			}
			const zExtra = unknownKeys$1(zoneRaw, KNOWN_ZONE);
			if (zExtra.length > 0) fail("gameplay.touch." + zoneRaw.name + ": unknown field(s) " + zExtra.map((k) => JSON.stringify(k)).join(", "));
			if (!Array.isArray(zoneRaw.branches) || zoneRaw.branches.length === 0 || zoneRaw.branches.length > MAX_BRANCHES) {
				fail("gameplay.touch." + zoneRaw.name + ".branches must declare 1..8 branches");
				continue;
			}
			let probabilitySum = 0;
			const branches = [];
			for (const branchRaw of zoneRaw.branches) {
				if (!isRecord$1(branchRaw) || !numIn(branchRaw.probability, 0, 1) || branchRaw.probability === 0) {
					fail("gameplay.touch." + zoneRaw.name + ".branches entries need a probability in (0, 1]");
					continue;
				}
				const bExtra = unknownKeys$1(branchRaw, KNOWN_BRANCH);
				if (bExtra.length > 0) fail("gameplay.touch." + zoneRaw.name + ": unknown branch field(s) " + bExtra.map((k) => JSON.stringify(k)).join(", "));
				probabilitySum += branchRaw.probability;
				const branch = { probability: branchRaw.probability };
				const effects = parseEffects(branchRaw.effects, "gameplay.touch." + zoneRaw.name + ".effects", stats, hooks);
				if (effects !== void 0) branch.effects = effects;
				const state = parseStateRef(branchRaw.state, "gameplay.touch." + zoneRaw.name + ".state", hooks);
				if (state !== void 0) branch.state = state;
				if (branchRaw.stateMs !== void 0) if (!intIn(branchRaw.stateMs, 200, 1e4)) fail("gameplay.touch." + zoneRaw.name + ".stateMs must be an integer in [200, 10000]");
				else branch.stateMs = branchRaw.stateMs;
				const phrases = parsePhrases(branchRaw.phrases, "gameplay.touch." + zoneRaw.name + ".phrases", hooks);
				if (phrases !== void 0) branch.phrases = phrases;
				branches.push(branch);
			}
			if (probabilitySum > 1.000000001) fail("gameplay.touch." + zoneRaw.name + ": branch probabilities must sum to at most 1");
			if (branches.length > 0) zones.push({
				name: zoneRaw.name,
				y0: zoneRaw.y0,
				y1: zoneRaw.y1,
				branches
			});
		}
		if (zones.length > 0 || clickBoost !== void 0) block.touch = {
			zones,
			...clickBoost === void 0 ? {} : { clickBoost }
		};
	}
	if (raw.work !== void 0) {
		const w = raw.work;
		if (!isRecord$1(w)) fail("gameplay.work must be an object");
		else {
			const wExtra = unknownKeys$1(w, KNOWN_WORK);
			if (wExtra.length > 0) fail("gameplay.work: unknown field(s) " + wExtra.map((k) => JSON.stringify(k)).join(", "));
			const state = parseStateRef(w.state, "gameplay.work.state", hooks);
			const successState = parseStateRef(w.successState, "gameplay.work.successState", hooks);
			const failState = parseStateRef(w.failState, "gameplay.work.failState", hooks);
			if (!intIn(w.tickMs, 1e3, 6e4)) fail("gameplay.work.tickMs must be an integer in [1000, 60000]");
			if (!numIn(w.successProbability, 0, 1)) fail("gameplay.work.successProbability must be a number in [0, 1]");
			if (state !== void 0 && successState !== void 0 && failState !== void 0 && intIn(w.tickMs, 1e3, 6e4) && numIn(w.successProbability, 0, 1)) {
				const work = {
					state,
					successState,
					failState,
					tickMs: w.tickMs,
					successProbability: w.successProbability
				};
				if (w.resultMs !== void 0) if (!isRecord$1(w.resultMs) || !intIn(w.resultMs.success, 200, 1e4) || !intIn(w.resultMs.fail, 200, 1e4)) fail("gameplay.work.resultMs must be { success, fail } integers in [200, 10000]");
				else work.resultMs = {
					success: w.resultMs.success,
					fail: w.resultMs.fail
				};
				for (const key of ["success", "fail"]) if (w[key] !== void 0) if (!isRecord$1(w[key])) fail("gameplay.work." + key + " must be an object { effects }");
				else {
					const effects = parseEffects(w[key].effects, "gameplay.work." + key + ".effects", stats, hooks);
					if (effects !== void 0) work[key] = { effects };
				}
				block.work = work;
			}
		}
	}
	if (raw.sleep !== void 0) {
		const s = raw.sleep;
		if (!isRecord$1(s) || !isRecord$1(s.restore)) fail("gameplay.sleep must be an object with a restore block");
		else {
			const sExtra = unknownKeys$1(s, KNOWN_SLEEP);
			if (sExtra.length > 0) fail("gameplay.sleep: unknown field(s) " + sExtra.map((k) => JSON.stringify(k)).join(", "));
			const state = parseStateRef(s.state, "gameplay.sleep.state", hooks);
			const wakeState = parseStateRef(s.wakeState, "gameplay.sleep.wakeState", hooks);
			const restoreStat = typeof s.restore.stat === "string" && stats[s.restore.stat] !== void 0 ? s.restore.stat : void 0;
			if (restoreStat === void 0) fail("gameplay.sleep.restore.stat must reference a declared stat");
			if (!intIn(s.restore.amount, 1, 1e3)) fail("gameplay.sleep.restore.amount must be an integer in [1, 1000]");
			if (!intIn(s.restore.intervalMs, 1e3, 6e5)) fail("gameplay.sleep.restore.intervalMs must be an integer in [1000, 600000]");
			if (state !== void 0 && restoreStat !== void 0 && intIn(s.restore.amount, 1, 1e3) && intIn(s.restore.intervalMs, 1e3, 6e5)) block.sleep = {
				state,
				...wakeState === void 0 ? {} : { wakeState },
				restore: {
					stat: restoreStat,
					amount: s.restore.amount,
					intervalMs: s.restore.intervalMs
				}
			};
		}
	}
	if (raw.passiveIncome !== void 0) {
		const p = raw.passiveIncome;
		if (!isRecord$1(p) || !validName(p.currency, 24) || !intIn(p.amount, 1, 1e4) || !intIn(p.intervalMs, 1e3, 864e5)) fail("gameplay.passiveIncome must be { currency (kebab), amount 1..10000, intervalMs 1000..86400000 }");
		else block.passiveIncome = {
			currency: p.currency,
			amount: p.amount,
			intervalMs: p.intervalMs
		};
	}
	if (raw.shop !== void 0) {
		const s = raw.shop;
		if (!isRecord$1(s) || !Array.isArray(s.items) || s.items.length === 0 || s.items.length > MAX_SHOP_ITEMS) fail("gameplay.shop must be an object with 1..32 items");
		else {
			const shopState = parseStateRef(s.state, "gameplay.shop.state", hooks);
			const items = [];
			const seen = /* @__PURE__ */ new Set();
			for (const itemRaw of s.items) {
				if (!isRecord$1(itemRaw) || !validName(itemRaw.id, 24)) {
					fail("gameplay.shop.items entries need a kebab id");
					continue;
				}
				if (seen.has(itemRaw.id)) {
					fail("gameplay.shop: duplicate item id " + JSON.stringify(itemRaw.id));
					continue;
				}
				seen.add(itemRaw.id);
				const iExtra = unknownKeys$1(itemRaw, KNOWN_SHOP_ITEM);
				if (iExtra.length > 0) fail("gameplay.shop." + itemRaw.id + ": unknown field(s) " + iExtra.map((k) => JSON.stringify(k)).join(", "));
				if (typeof itemRaw.label !== "string" || itemRaw.label.trim() === "" || itemRaw.label.length > 80) {
					fail("gameplay.shop." + itemRaw.id + ".label must be a non-empty string of at most 80 chars");
					continue;
				}
				if (!intIn(itemRaw.price, 1, 1e6)) {
					fail("gameplay.shop." + itemRaw.id + ".price must be an integer in [1, 1000000]");
					continue;
				}
				if (!validName(itemRaw.currency, 24)) {
					fail("gameplay.shop." + itemRaw.id + ".currency must be a kebab id");
					continue;
				}
				const item = {
					id: itemRaw.id,
					label: itemRaw.label.trim(),
					price: itemRaw.price,
					currency: itemRaw.currency
				};
				if (itemRaw.image !== void 0) if (typeof itemRaw.image !== "string" || itemRaw.image.includes("..") || itemRaw.image.includes("\\") || itemRaw.image.startsWith("/")) fail("gameplay.shop." + itemRaw.id + ".image must be a safe manifest-relative frame path");
				else item.image = itemRaw.image;
				const effects = parseEffects(itemRaw.effects, "gameplay.shop." + itemRaw.id + ".effects", stats, hooks);
				if (effects !== void 0) item.effects = effects;
				if (itemRaw.lottery !== void 0) {
					const l = itemRaw.lottery;
					if (!isRecord$1(l) || !Array.isArray(l.tiers) || l.tiers.length === 0 || l.tiers.length > MAX_LOTTERY_TIERS) fail("gameplay.shop." + itemRaw.id + ".lottery needs 1..16 tiers");
					else {
						const lExtra = unknownKeys$1(l, KNOWN_LOTTERY);
						if (lExtra.length > 0) fail("gameplay.shop." + itemRaw.id + ".lottery: unknown field(s) " + lExtra.map((k) => JSON.stringify(k)).join(", "));
						if (l.currency !== void 0 && !validName(l.currency, 24)) fail("gameplay.shop." + itemRaw.id + ".lottery.currency must be a kebab id");
						let tierSum = 0;
						const tiers = [];
						for (const tierRaw of l.tiers) {
							if (!isRecord$1(tierRaw) || !numIn(tierRaw.probability, 0, 1) || tierRaw.probability === 0 || !intIn(tierRaw.prize, 0, 1e9)) {
								fail("gameplay.shop." + itemRaw.id + ".lottery.tiers entries need probability (0,1] and prize 0..1e9");
								continue;
							}
							tierSum += tierRaw.probability;
							const tier = {
								probability: tierRaw.probability,
								prize: tierRaw.prize
							};
							if (tierRaw.currency !== void 0) if (!validName(tierRaw.currency, 24)) fail("gameplay.shop." + itemRaw.id + ".lottery tier currency must be a kebab id");
							else tier.currency = tierRaw.currency;
							tiers.push(tier);
						}
						if (tierSum > 1.000000001) fail("gameplay.shop." + itemRaw.id + ".lottery tier probabilities must sum to at most 1");
						if (tiers.length > 0) {
							const lotteryEffects = parseEffects(l.effects, "gameplay.shop." + itemRaw.id + ".lottery.effects", stats, hooks);
							item.lottery = {
								tiers,
								...lotteryEffects === void 0 ? {} : { effects: lotteryEffects },
								...validName(l.currency, 24) ? { currency: l.currency } : {}
							};
						}
					}
				}
				if (item.effects === void 0 && item.lottery === void 0) {
					fail("gameplay.shop." + itemRaw.id + " needs effects or a lottery");
					continue;
				}
				items.push(item);
			}
			if (items.length > 0) block.shop = {
				...shopState === void 0 ? {} : { state: shopState },
				items
			};
		}
	}
	if (raw.dragState !== void 0) {
		const state = parseStateRef(raw.dragState, "gameplay.dragState", hooks);
		if (state !== void 0) block.dragState = state;
	}
	if (raw.dragEndState !== void 0) {
		const state = parseStateRef(raw.dragEndState, "gameplay.dragEndState", hooks);
		if (state !== void 0) block.dragEndState = state;
	}
	return failed ? void 0 : block;
}
/** Renderer kinds the pet center knows how to dispatch (M1 §2). */
const PET_RENDERER_KINDS = [
	"sprite2d",
	"live2d",
	"frames2d"
];
/** The seven ActivityPhase semantics (pet-center owned; M1 §1). */
const PET_ACTIVITY_PHASES = [
	"idle",
	"waiting",
	"thinking",
	"tool",
	"review",
	"done",
	"failed"
];
const PET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
/**
* Field allow-lists mirroring contracts/pet-manifest-v2.schema.json. Exported
* so the drift test can lock the schema file and this validator together;
* the CLI reuses parsePetManifest instead of these.
*/
const KNOWN_TOP_LEVEL = /* @__PURE__ */ new Set([
	"$schema",
	"petManifestVersion",
	"id",
	"displayName",
	"description",
	"version",
	"author",
	"license",
	"homepage",
	"renderer",
	"sprite2d",
	"live2d",
	"frames2d",
	"sequences",
	"remarks",
	"gameplay"
]);
/** sprite2d block field allow-list (drift-locked to the schema file). */
const KNOWN_SPRITE2D = /* @__PURE__ */ new Set([
	"spritesheetPath",
	"cell",
	"columns",
	"atlasRows",
	"frames",
	"tracks"
]);
/** live2d block field allow-list (drift-locked to the schema file). */
const KNOWN_LIVE2D = /* @__PURE__ */ new Set([
	"model",
	"scale",
	"translate",
	"motions",
	"expressions",
	"hitAreas",
	"lipSync"
]);
/** frames2d block field allow-list (drift-locked to the schema file). */
const KNOWN_FRAMES2D = /* @__PURE__ */ new Set([
	"dir",
	"defaultFrameMs",
	"tracks",
	"phases",
	"skins"
]);
/** frames2d track field allow-list (drift-locked to the schema file). */
const KNOWN_FRAMES2D_TRACK = /* @__PURE__ */ new Set([
	"frames",
	"frameMs",
	"loop",
	"fallback"
]);
/** frames2d skin entry field allow-list (drift-locked to the schema file). */
const KNOWN_SKIN = /* @__PURE__ */ new Set([
	"id",
	"label",
	"idleTrack",
	"clickActions",
	"gameplayTracks"
]);
/** frames2d skin click-action field allow-list (drift-locked to the schema file). */
const KNOWN_SKIN_CLICK = /* @__PURE__ */ new Set([
	"track",
	"probability",
	"phrases"
]);
/** Max spoken lines one skin click action may declare. */
const SKIN_CLICK_MAX_PHRASES = 5;
/** Max length of one spoken line. */
const SKIN_CLICK_PHRASE_MAX_LENGTH = 120;
/** Validate a skin click action's optional phrase pool (same spirit as gameplay phrases). */
function parseSkinPhrases(raw, field, diag) {
	if (raw === void 0) return void 0;
	if (!Array.isArray(raw) || raw.length === 0 || raw.length > SKIN_CLICK_MAX_PHRASES || raw.some((line) => typeof line !== "string" || line.trim() === "" || line.length > SKIN_CLICK_PHRASE_MAX_LENGTH)) {
		diag.error(field + " must be 1..5 non-empty lines of at most 120 chars");
		return;
	}
	return raw;
}
var Diagnostics = class {
	list = [];
	source;
	constructor(source) {
		this.source = source;
	}
	error(message) {
		this.list.push({
			level: "error",
			message: this.source + ": " + message
		});
	}
	warn(message) {
		this.list.push({
			level: "warning",
			message: this.source + ": " + message
		});
	}
	get hasErrors() {
		return this.list.some((d) => d.level === "error");
	}
};
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unknownKeys(source, known) {
	return Object.keys(source).filter((key) => !known.has(key));
}
/**
* Validate a manifest-relative asset path: no absolute paths, no backslashes,
* no traversal, plain safe segments only. Returns the normalized path.
*/
function safeManifestPath(raw) {
	if (typeof raw !== "string" || raw.trim() === "") return void 0;
	const value = raw.trim();
	if (isAbsolute(value) || value.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return void 0;
	const segments = value.split("/").filter((segment) => segment !== "");
	if (segments.length === 0) return void 0;
	if (segments.some((segment) => segment === "." || segment === ".." || !PATH_SEGMENT_PATTERN.test(segment))) return void 0;
	return segments.join("/");
}
function parseStringBlock(record, key, diag, required) {
	const value = record[key];
	if (value === void 0) {
		if (required) diag.error("missing required field " + JSON.stringify(key));
		return;
	}
	if (typeof value !== "string" || value.trim() === "") {
		diag.error("field " + JSON.stringify(key) + " must be a non-empty string");
		return;
	}
	return value.trim();
}
/** Validate the phase-keyed string map shape shared by motions/expressions. */
function parsePhaseStringMap(raw, field, diag) {
	if (raw === void 0) return void 0;
	if (!isRecord(raw)) {
		diag.error("field " + JSON.stringify(field) + " must be an object keyed by activity phase");
		return;
	}
	const result = {};
	for (const [phase, value] of Object.entries(raw)) {
		if (!PET_ACTIVITY_PHASES.includes(phase)) {
			diag.error(field + ": unknown activity phase " + JSON.stringify(phase));
			continue;
		}
		if (typeof value !== "string" || value.trim() === "") {
			diag.error(field + "." + phase + " must be a non-empty string");
			continue;
		}
		result[phase] = value.trim();
	}
	return result;
}
/** Structural gate for sequences: content stays warn-and-drop (registry's job). */
function parseSequences(raw, diag) {
	if (raw === void 0) return void 0;
	if (!isRecord(raw)) {
		diag.warn("sequences must be an object keyed by activity phase; ignoring");
		return;
	}
	const sequences = {};
	for (const [phase, value] of Object.entries(raw)) {
		if (!PET_ACTIVITY_PHASES.includes(phase)) {
			diag.warn("sequences: unknown activity phase " + JSON.stringify(phase) + "; entry dropped");
			continue;
		}
		if (!Array.isArray(value) || value.length < 5 || value.some((item) => typeof item !== "string")) {
			diag.warn("sequences." + phase + " must be an array of at least 5 animation names; entry dropped");
			continue;
		}
		sequences[phase] = value;
	}
	return Object.keys(sequences).length === 0 ? void 0 : sequences;
}
function parseSprite2dBlock(raw, diag) {
	if (!isRecord(raw)) {
		diag.error("renderer sprite2d requires a \"sprite2d\" block object");
		return;
	}
	const extra = unknownKeys(raw, KNOWN_SPRITE2D);
	if (extra.length > 0) diag.error("sprite2d: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const spritesheetPath = safeManifestPath(raw.spritesheetPath);
	if (spritesheetPath === void 0) diag.error("sprite2d.spritesheetPath must be a safe manifest-relative path");
	const block = { spritesheetPath: spritesheetPath ?? "" };
	if (raw.cell !== void 0) if (!isRecord(raw.cell)) diag.error("sprite2d.cell must be an object { width?, height? }");
	else block.cell = raw.cell;
	if (raw.columns !== void 0) if (typeof raw.columns !== "number" || !Number.isInteger(raw.columns) || raw.columns < 1) diag.error("sprite2d.columns must be a positive integer");
	else block.columns = raw.columns;
	if (raw.atlasRows !== void 0) if (typeof raw.atlasRows !== "number" || !Number.isInteger(raw.atlasRows) || raw.atlasRows < 1) diag.error("sprite2d.atlasRows must be a positive integer");
	else block.atlasRows = raw.atlasRows;
	if (raw.frames !== void 0) if (!Array.isArray(raw.frames) || raw.frames.some((v) => typeof v !== "number" || !Number.isInteger(v) || v < 0)) diag.error("sprite2d.frames must be an array of non-negative integers");
	else block.frames = raw.frames;
	if (raw.tracks !== void 0) if (!isRecord(raw.tracks)) diag.error("sprite2d.tracks must be an object keyed by animation");
	else block.tracks = raw.tracks;
	return diag.hasErrors ? void 0 : block;
}
function parseLive2dBlock(raw, diag) {
	if (!isRecord(raw)) {
		diag.error("renderer live2d requires a \"live2d\" block object");
		return;
	}
	const extra = unknownKeys(raw, KNOWN_LIVE2D);
	if (extra.length > 0) diag.error("live2d: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const model = safeManifestPath(raw.model);
	if (model === void 0) diag.error("live2d.model must be a safe manifest-relative path to a .model3.json");
	else if (!model.endsWith(".model3.json")) diag.error("live2d.model must point at a .model3.json file");
	const motions = parsePhaseStringMap(raw.motions, "live2d.motions", diag);
	if (raw.motions === void 0) diag.error("live2d.motions is required (at least an \"idle\" group)");
	else if (motions !== void 0 && motions.idle === void 0) diag.error("live2d.motions.idle is required (unmapped phases fall back to it)");
	const block = {
		model: model ?? "",
		motions: motions ?? { idle: "" }
	};
	if (raw.scale !== void 0) if (typeof raw.scale !== "number" || !Number.isFinite(raw.scale) || raw.scale <= 0 || raw.scale > 10) diag.error("live2d.scale must be a number in (0, 10]");
	else block.scale = raw.scale;
	if (raw.translate !== void 0) if (!isRecord(raw.translate) || raw.translate.x !== void 0 && typeof raw.translate.x !== "number" || raw.translate.y !== void 0 && typeof raw.translate.y !== "number") diag.error("live2d.translate must be an object { x?: number, y?: number }");
	else block.translate = raw.translate;
	const expressions = parsePhaseStringMap(raw.expressions, "live2d.expressions", diag);
	if (expressions !== void 0) block.expressions = expressions;
	if (raw.hitAreas !== void 0) if (!Array.isArray(raw.hitAreas) || raw.hitAreas.some((v) => typeof v !== "string" || v.trim() === "")) diag.error("live2d.hitAreas must be an array of non-empty strings");
	else block.hitAreas = raw.hitAreas;
	if (raw.lipSync !== void 0) if (typeof raw.lipSync !== "boolean") diag.error("live2d.lipSync must be a boolean");
	else block.lipSync = raw.lipSync;
	return diag.hasErrors ? void 0 : block;
}
const FRAMES2D_TRACK_NAME = /^[a-z0-9][a-z0-9-]*$/;
const FRAMES2D_MAX_TRACKS = 64;
const FRAMES2D_MAX_FRAMES = 64;
const FRAMES2D_MIN_FRAME_MS = 16;
const FRAMES2D_MAX_FRAME_MS = 5e3;
const FRAMES2D_IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
	".webp",
	".png",
	".gif",
	".jpg",
	".jpeg"
]);
/** Validate one frames2d track name (kebab id, at most 32 chars). */
function validTrackName(name) {
	return name.length <= 32 && FRAMES2D_TRACK_NAME.test(name);
}
/** A frames2d frame entry is a single image file name inside the track directory. */
function safeFrameName(raw) {
	if (typeof raw !== "string" || raw.trim() === "") return void 0;
	const value = raw.trim();
	if (value.includes("/") || value.includes("\\") || !PATH_SEGMENT_PATTERN.test(value)) return void 0;
	const dot = value.lastIndexOf(".");
	if (dot <= 0) return void 0;
	if (!FRAMES2D_IMAGE_EXTENSIONS.has(value.slice(dot).toLowerCase())) return void 0;
	return value;
}
function parseFrames2dTrack(raw, field, diag) {
	if (!isRecord(raw)) {
		diag.error(field + " must be an object");
		return;
	}
	const extra = unknownKeys(raw, KNOWN_FRAMES2D_TRACK);
	if (extra.length > 0) diag.error(field + ": unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const track = {};
	if (raw.frames !== void 0) if (!Array.isArray(raw.frames) || raw.frames.length === 0) diag.error(field + ".frames must be a non-empty array of frame file names");
	else if (raw.frames.length > FRAMES2D_MAX_FRAMES) diag.error(field + ".frames declares too many frames (" + raw.frames.length + ", max 64)");
	else {
		const frames = [];
		for (const entry of raw.frames) {
			const safe = safeFrameName(entry);
			if (safe === void 0) diag.error(field + ".frames entry " + JSON.stringify(String(entry)) + " is not a safe image file name");
			else frames.push(safe);
		}
		if (frames.length === raw.frames.length) track.frames = frames;
	}
	if (raw.frameMs !== void 0) if (!Array.isArray(raw.frameMs) || raw.frameMs.length === 0 || raw.frameMs.some((v) => typeof v !== "number" || !Number.isInteger(v) || v < FRAMES2D_MIN_FRAME_MS || v > FRAMES2D_MAX_FRAME_MS)) diag.error(field + ".frameMs must be a non-empty array of integer ms in [16, 5000]");
	else if (track.frames === void 0) diag.error(field + ".frameMs requires a valid explicit frames list (directory tracks use filename-encoded ms or defaultFrameMs)");
	else if (raw.frameMs.length !== track.frames.length) diag.error(field + ".frameMs must have the same length as frames");
	else track.frameMs = raw.frameMs;
	if (raw.loop !== void 0) if (typeof raw.loop !== "boolean") diag.error(field + ".loop must be a boolean");
	else track.loop = raw.loop;
	if (raw.fallback !== void 0) if (typeof raw.fallback !== "string" || !validTrackName(raw.fallback)) diag.error(field + ".fallback must be a track name");
	else track.fallback = raw.fallback;
	return diag.hasErrors ? void 0 : track;
}
function parseFrames2dBlock(raw, diag) {
	if (!isRecord(raw)) {
		diag.error("renderer frames2d requires a \"frames2d\" block object");
		return;
	}
	const extra = unknownKeys(raw, KNOWN_FRAMES2D);
	if (extra.length > 0) diag.error("frames2d: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const block = {
		tracks: {},
		phases: { idle: "" }
	};
	if (raw.dir !== void 0) {
		const dir = safeManifestPath(raw.dir);
		if (dir === void 0) diag.error("frames2d.dir must be a safe manifest-relative directory");
		else block.dir = dir;
	}
	if (raw.defaultFrameMs !== void 0) if (typeof raw.defaultFrameMs !== "number" || !Number.isInteger(raw.defaultFrameMs) || raw.defaultFrameMs < FRAMES2D_MIN_FRAME_MS || raw.defaultFrameMs > FRAMES2D_MAX_FRAME_MS) diag.error("frames2d.defaultFrameMs must be an integer in [16, 5000]");
	else block.defaultFrameMs = raw.defaultFrameMs;
	const tracks = {};
	if (!isRecord(raw.tracks)) diag.error("frames2d.tracks is required and must be an object keyed by track name");
	else {
		const entries = Object.entries(raw.tracks);
		if (entries.length === 0) diag.error("frames2d.tracks must declare at least one track");
		if (entries.length > FRAMES2D_MAX_TRACKS) diag.error("frames2d.tracks declares too many tracks (" + entries.length + ", max 64)");
		for (const [name, value] of entries) {
			if (!validTrackName(name)) {
				diag.error("frames2d.tracks: invalid track name " + JSON.stringify(name) + " (lowercase kebab, at most 32 chars)");
				continue;
			}
			const track = parseFrames2dTrack(value, "frames2d.tracks." + name, diag);
			if (track !== void 0) tracks[name] = track;
		}
	}
	block.tracks = tracks;
	const phases = parsePhaseStringMap(raw.phases, "frames2d.phases", diag);
	if (raw.phases === void 0) diag.error("frames2d.phases is required (at least an \"idle\" mapping)");
	else if (phases !== void 0 && phases.idle === void 0) diag.error("frames2d.phases.idle is required (unmapped phases fall back to it)");
	const phasesValid = phases !== void 0 && phases.idle !== void 0;
	if (phasesValid) block.phases = phases;
	if (phasesValid) {
		for (const [phase, target] of Object.entries(block.phases)) if (target !== void 0 && tracks[target] === void 0) diag.error("frames2d.phases." + phase + " references unknown track " + JSON.stringify(target));
	}
	for (const [name, track] of Object.entries(tracks)) if (track.fallback !== void 0 && tracks[track.fallback] === void 0) diag.error("frames2d.tracks." + name + ".fallback references unknown track " + JSON.stringify(track.fallback));
	if (raw.skins !== void 0) if (!Array.isArray(raw.skins) || raw.skins.length === 0 || raw.skins.length > 16) diag.error("frames2d.skins must be an array of 1..16 skins");
	else {
		const skins = [];
		const seen = /* @__PURE__ */ new Set();
		for (const [index, entry] of raw.skins.entries()) {
			const field = "frames2d.skins[" + index + "]";
			if (!isRecord(entry)) {
				diag.error(field + " must be an object");
				continue;
			}
			const extra = unknownKeys(entry, KNOWN_SKIN);
			if (extra.length > 0) diag.error(field + ": unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
			const id = typeof entry.id === "string" ? entry.id.trim() : "";
			if (id === "" || id.length > 24 || !FRAMES2D_TRACK_NAME.test(id)) {
				diag.error(field + ".id must be a lowercase kebab id of at most 24 chars");
				continue;
			}
			if (seen.has(id)) {
				diag.error(field + ": duplicate skin id " + JSON.stringify(id));
				continue;
			}
			seen.add(id);
			const label = typeof entry.label === "string" ? entry.label.trim() : "";
			if (label === "" || label.length > 40) {
				diag.error(field + ".label must be a non-empty string of at most 40 chars");
				continue;
			}
			const idleTrack = typeof entry.idleTrack === "string" ? entry.idleTrack : "";
			if (!validTrackName(idleTrack) || tracks[idleTrack] === void 0) {
				diag.error(field + ".idleTrack must name a declared frames2d track");
				continue;
			}
			let clickActions;
			if (entry.clickActions !== void 0) if (!Array.isArray(entry.clickActions) || entry.clickActions.length === 0 || entry.clickActions.length > 8) diag.error(field + ".clickActions must be an array of 1..8 actions");
			else {
				const resolved = [];
				for (const [cIndex, action] of entry.clickActions.entries()) {
					const cField = field + ".clickActions[" + cIndex + "]";
					if (!isRecord(action)) {
						diag.error(cField + " must be an object");
						continue;
					}
					const cExtra = unknownKeys(action, KNOWN_SKIN_CLICK);
					if (cExtra.length > 0) diag.error(cField + ": unknown field(s) " + cExtra.map((k) => JSON.stringify(k)).join(", "));
					const trackName = typeof action.track === "string" ? action.track : "";
					if (!validTrackName(trackName) || tracks[trackName] === void 0) {
						diag.error(cField + ".track must name a declared frames2d track");
						continue;
					}
					if (typeof action.probability !== "number" || !Number.isFinite(action.probability) || action.probability <= 0 || action.probability > 1) {
						diag.error(cField + ".probability must be a number in (0, 1]");
						continue;
					}
					const phrases = parseSkinPhrases(action.phrases, cField + ".phrases", diag);
					resolved.push({
						track: trackName,
						probability: action.probability,
						...phrases === void 0 ? {} : { phrases }
					});
				}
				if (resolved.length > 0) clickActions = resolved;
			}
			let gameplayTracks;
			if (entry.gameplayTracks !== void 0) if (!isRecord(entry.gameplayTracks)) diag.error(field + ".gameplayTracks must be an object mapping gameplay state names to tracks");
			else {
				const states = Object.keys(entry.gameplayTracks);
				if (states.length === 0 || states.length > 8) diag.error(field + ".gameplayTracks must map 1..8 gameplay states");
				else {
					const resolvedTracks = {};
					for (const state of states) {
						if (!/^[a-z0-9][a-z0-9-]*$/.test(state)) {
							diag.error(field + ".gameplayTracks key " + JSON.stringify(state) + " must be a lowercase kebab state name");
							continue;
						}
						const gTrack = entry.gameplayTracks[state];
						if (typeof gTrack !== "string" || !validTrackName(gTrack) || tracks[gTrack] === void 0) {
							diag.error(field + ".gameplayTracks[" + JSON.stringify(state) + "] must name a declared frames2d track");
							continue;
						}
						resolvedTracks[state] = gTrack;
					}
					if (Object.keys(resolvedTracks).length > 0) gameplayTracks = resolvedTracks;
				}
			}
			skins.push({
				id,
				label,
				idleTrack,
				...clickActions === void 0 ? {} : { clickActions },
				...gameplayTracks === void 0 ? {} : { gameplayTracks }
			});
		}
		if (skins.length > 0) block.skins = skins;
	}
	return diag.hasErrors ? void 0 : block;
}
/** v1 compat read: map the legacy flat manifest onto the v2 sprite2d shape. */
function compatV1(source, diag) {
	const id = parseStringBlock(source, "id", diag, true);
	if (id !== void 0 && !PET_ID_PATTERN.test(id)) diag.error("id " + JSON.stringify(id) + " is not a lowercase kebab id");
	const displayName = typeof source.displayName === "string" && source.displayName.trim() !== "" ? source.displayName.trim() : id;
	const spritesheetPath = safeManifestPath(source.spritesheetPath === void 0 ? "spritesheet.webp" : source.spritesheetPath);
	if (spritesheetPath === void 0) diag.error("spritesheetPath " + JSON.stringify(String(source.spritesheetPath)) + " is not a safe relative path");
	if (source.license === void 0) diag.warn("v1 compat read: no license field; run scripts/dsh-pet-migrate-v2 to migrate this pet");
	const sprite2d = { spritesheetPath: spritesheetPath ?? "spritesheet.webp" };
	if (isRecord(source.cell)) sprite2d.cell = source.cell;
	if (typeof source.columns === "number") sprite2d.columns = source.columns;
	if (Array.isArray(source.frames)) sprite2d.frames = source.frames;
	if (isRecord(source.tracks)) sprite2d.tracks = source.tracks;
	if (source.spriteVersionNumber === 2) sprite2d.atlasRows = 11;
	const manifest = {
		petManifestVersion: 2,
		id: id ?? "",
		displayName: displayName ?? "",
		renderer: "sprite2d",
		sprite2d
	};
	if (typeof source.description === "string" && source.description.trim() !== "") manifest.description = source.description.trim();
	if (typeof source.license === "string" && source.license.trim() !== "") manifest.license = source.license.trim();
	const sequences = parseSequences(source.sequences, diag);
	if (sequences !== void 0) manifest.sequences = sequences;
	if (source.remarks !== void 0) manifest.remarks = source.remarks;
	return diag.hasErrors ? void 0 : manifest;
}
/** Strict v2 validation (fail-closed on structure). */
function parseV2(source, diag) {
	const extra = unknownKeys(source, KNOWN_TOP_LEVEL);
	if (extra.length > 0) diag.error("unknown top-level field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	if (source.petManifestVersion !== 2) diag.error("petManifestVersion must be 2 (got " + JSON.stringify(source.petManifestVersion) + ")");
	const id = parseStringBlock(source, "id", diag, true);
	if (id !== void 0 && (!PET_ID_PATTERN.test(id) || id.length > 64)) diag.error("id " + JSON.stringify(id) + " must be a lowercase kebab id of at most 64 chars");
	const displayName = parseStringBlock(source, "displayName", diag, true);
	const license = parseStringBlock(source, "license", diag, true);
	const rendererRaw = source.renderer === void 0 ? "sprite2d" : source.renderer;
	if (!PET_RENDERER_KINDS.includes(rendererRaw)) diag.error("unknown renderer " + JSON.stringify(rendererRaw) + "; expected one of " + PET_RENDERER_KINDS.join(", "));
	const renderer = rendererRaw;
	const manifest = {
		petManifestVersion: 2,
		id: id ?? "",
		displayName: displayName ?? "",
		renderer
	};
	if (license !== void 0) manifest.license = license;
	if (source.description !== void 0) if (typeof source.description !== "string" || source.description.length > 500) diag.error("description must be a string of at most 500 chars");
	else manifest.description = source.description;
	if (source.version !== void 0) if (typeof source.version !== "string" || !SEMVER_PATTERN.test(source.version)) diag.error("version must be a semver string (x.y.z)");
	else manifest.version = source.version;
	if (source.author !== void 0) if (typeof source.author !== "string" || source.author.length > 128) diag.error("author must be a string of at most 128 chars");
	else manifest.author = source.author;
	if (source.homepage !== void 0) if (typeof source.homepage !== "string") diag.error("homepage must be a string URL");
	else manifest.homepage = source.homepage;
	if (renderer === "sprite2d") {
		const block = parseSprite2dBlock(source.sprite2d, diag);
		if (block !== void 0) manifest.sprite2d = block;
		if (source.live2d !== void 0) diag.error("renderer sprite2d must not declare a live2d block");
		if (source.frames2d !== void 0) diag.error("renderer sprite2d must not declare a frames2d block");
	} else if (renderer === "live2d") {
		const block = parseLive2dBlock(source.live2d, diag);
		if (block !== void 0) manifest.live2d = block;
		if (source.sprite2d !== void 0) diag.error("renderer live2d must not declare a sprite2d block");
		if (source.frames2d !== void 0) diag.error("renderer live2d must not declare a frames2d block");
	} else if (renderer === "frames2d") {
		const block = parseFrames2dBlock(source.frames2d, diag);
		if (block !== void 0) manifest.frames2d = block;
		if (source.sprite2d !== void 0) diag.error("renderer frames2d must not declare a sprite2d block");
		if (source.live2d !== void 0) diag.error("renderer frames2d must not declare a live2d block");
	}
	if (source.gameplay !== void 0) if (renderer !== "frames2d") diag.error("gameplay currently requires renderer frames2d (its state references name frames2d tracks)");
	else {
		const gameplay = parseGameplayManifest(source.gameplay, {
			stateNames: new Set(Object.keys(manifest.frames2d?.tracks ?? {})),
			error: (message) => diag.error("gameplay: " + message)
		});
		if (gameplay !== void 0) manifest.gameplay = gameplay;
	}
	const sequences = parseSequences(source.sequences, diag);
	if (sequences !== void 0) manifest.sequences = sequences;
	if (source.remarks !== void 0 && !isRecord(source.remarks)) diag.error("remarks must be an object of remark pools");
	else if (source.remarks !== void 0) manifest.remarks = source.remarks;
	return diag.hasErrors ? void 0 : manifest;
}
/**
* Parse one pet manifest: v1 (no petManifestVersion) is compat-read as a
* sprite2d pet with a migration hint; v2 is validated fail-closed. The parse
* never throws — every failure comes back as structured diagnostics.
* @param raw - the parsed pet.json value.
* @param sourceLabel - human-readable origin for diagnostics (dir or file).
*/
function parsePetManifest(raw, sourceLabel) {
	const diag = new Diagnostics(sourceLabel);
	if (!isRecord(raw)) {
		diag.error("manifest is not an object");
		return {
			ok: false,
			diagnostics: diag.list
		};
	}
	if (raw.petManifestVersion === void 0) {
		const manifest = compatV1(raw, diag);
		if (manifest === void 0) return {
			ok: false,
			diagnostics: diag.list
		};
		diag.warn("v1 compat read: manifest treated as renderer \"sprite2d\"; run scripts/dsh-pet-migrate-v2 to migrate");
		return {
			ok: true,
			manifest,
			migrated: "v1-compat",
			diagnostics: diag.list
		};
	}
	const manifest = parseV2(raw, diag);
	if (manifest === void 0) return {
		ok: false,
		diagnostics: diag.list
	};
	return {
		ok: true,
		manifest,
		migrated: void 0,
		diagnostics: diag.list
	};
}
//#endregion
//#region src/core/local-import-safety.ts
const LOCAL_IMPORT_RECORD$1 = "dsh-workbench.import.json";
const LOCAL_IMPORT_LIMITS = {
	files: 2e3,
	fileBytes: 200 * 1024 * 1024,
	expandedBytes: 500 * 1024 * 1024,
	manifestBytes: 1024 * 1024,
	sessions: 4,
	expiryMs: 1800 * 1e3
};
var LocalImportError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
		this.name = "LocalImportError";
	}
};
function fail(code, message, status = 400) {
	throw new LocalImportError(code, message, status);
}
/** Same conservative path rules on every OS, including Windows ADS/devices. */
function safeLocalPath(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 240 || value !== value.normalize("NFC") || /[\\\x00-\x1f\x7f:*?"<>|]/.test(value)) fail("invalid-path", "Resource paths must be normal relative file names.");
	const parts = value.split("/");
	if (parts.some((p) => !p || p === "." || p === ".." || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(p))) fail("invalid-path", "Absolute, parent, device and ambiguous paths are not supported.");
	if (parts.some((p) => [
		".git",
		".svn",
		"node_modules"
	].includes(p.toLowerCase()))) fail("unsupported-files", "Export the resource package without repository metadata or node_modules.");
	return value;
}
function pathKey(rel) {
	return rel.normalize("NFC").toLowerCase();
}
/** Prevent both normalized duplicate names and file/directory prefix collisions. */
var FilePaths = class {
	files = /* @__PURE__ */ new Set();
	names = /* @__PURE__ */ new Map();
	add(rel, directory = false) {
		const parts = safeLocalPath(rel).split("/");
		for (let i = 1; i <= parts.length; i++) {
			const prefix = parts.slice(0, i).join("/");
			const key = pathKey(prefix);
			const old = this.names.get(key);
			if (old !== void 0 && old !== prefix) fail("duplicate-path", "Resource has case-insensitive duplicate paths.");
			if (i < parts.length && this.files.has(key)) fail("duplicate-path", "A resource file is also used as a directory.");
			this.names.set(key, prefix);
		}
		const key = pathKey(rel);
		if (!directory) {
			if (this.files.has(key) || [...this.names.keys()].some((p) => p.startsWith(key + "/"))) fail("duplicate-path", "Resource has duplicate file paths.");
			this.files.add(key);
		} else if (this.files.has(key)) fail("duplicate-path", "A resource file is also used as a directory.");
	}
};
/** lstat every existing ancestor: never traverse symlinks or Windows junctions. */
function assertPlainPath(target) {
	const resolved = path.resolve(target);
	let current = path.parse(resolved).root;
	for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
		current = path.join(current, part);
		try {
			if (lstatSync(current).isSymbolicLink()) fail("unsafe-destination", "Resource paths cannot contain symbolic links or junctions.");
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
	}
}
function plainMkdir(target) {
	assertPlainPath(target);
	mkdirSync(target, { recursive: true });
	assertPlainPath(target);
}
function listPlainFiles(root, strict = true) {
	assertPlainPath(root);
	const files = [];
	const paths = new FilePaths();
	let bytes = 0;
	const walk = (base, prefix) => {
		for (const entry of readdirSync(base, { withFileTypes: true })) {
			const rel = prefix + entry.name;
			safeLocalPath(rel);
			const full = path.join(base, entry.name);
			const stat = lstatSync(full);
			if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) fail("unsupported-files", "Symbolic links and special files are not supported.");
			paths.add(rel, stat.isDirectory());
			if (stat.isDirectory()) walk(full, rel + "/");
			else {
				if (strict && stat.size > LOCAL_IMPORT_LIMITS.fileBytes) fail("quota", "One resource file exceeds 200 MiB.", 413);
				files.push({
					rel,
					bytes: stat.size
				});
				bytes += stat.size;
				if (files.length > LOCAL_IMPORT_LIMITS.files || bytes > LOCAL_IMPORT_LIMITS.expandedBytes) fail("quota", "Resource exceeds 2,000 files or 500 MiB.", 413);
			}
		}
	};
	walk(root, "");
	return files;
}
/** Imported files may never claim the official-market trust provenance. */
function isImportedRecord(rel) {
	return ["dsh-market.provenance.json", LOCAL_IMPORT_RECORD$1].includes(rel.split("/").at(-1).toLowerCase());
}
//#endregion
//#region src/core/local-import-manifest.ts
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function label(value, maximum = 200) {
	return typeof value === "string" && value.trim() && value.length <= maximum ? value.trim() : void 0;
}
function validateLocalId(kind, value) {
	if (typeof value !== "string" || value.length > 214) fail("invalid-manifest", "Resource manifest needs a valid id.");
	if (kind === "plugin") {
		if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)) fail("invalid-manifest", "Plugin name must be a valid npm package name.");
	} else {
		if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) fail("invalid-manifest", "Resource id must use up to 64 lowercase letters, digits and hyphens.");
		safeLocalPath(value);
	}
	return value;
}
function textFile(root, rel) {
	const full = path.join(root, rel);
	if (statSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) fail("quota", "A resource manifest exceeds 1 MiB.", 413);
	return readFileSync(full, "utf8");
}
function json(root, rel) {
	try {
		const result = JSON.parse(textFile(root, rel));
		if (!result || Array.isArray(result) || typeof result !== "object") fail("invalid-manifest", "Manifest must be a JSON object.");
		return object(result);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "quota") throw error;
		fail("invalid-manifest", `Cannot read ${rel} as a JSON manifest.`);
	}
}
/** YAML tags are retained as inert values; no custom tag constructors run. */
function yaml(root, rel, composition = false) {
	try {
		const doc = parseDocument(textFile(root, rel), {
			uniqueKeys: true,
			schema: "core",
			customTags: composition ? [{
				tag: "tag:yaml.org,2002:js",
				resolve: (value) => value
			}] : []
		});
		if (doc.errors.length || doc.warnings.some((warning) => warning.code === "TAG_RESOLVE_FAILED")) fail("invalid-manifest", `Invalid or unsupported YAML in ${rel}.`);
		return doc.toJS({ maxAliasCount: 30 });
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "quota") throw error;
		fail("invalid-manifest", `Cannot read ${rel} as safe YAML.`);
	}
}
/** Match the official discovery shape check, including nested group rows. */
function validatePresetRows(rows, depth = 0, ancestors = /* @__PURE__ */ new Set()) {
	if (!Array.isArray(rows) || depth > 64 || ancestors.has(rows)) fail("invalid-manifest", "Preset composition must contain a finite list of named plugin rows.");
	const next = new Set(ancestors).add(rows);
	for (const row of rows) {
		const entry = object(row);
		if (!label(entry.name)) fail("invalid-manifest", "Preset composition rows must contain plugin names.");
		if (entry.group === true) validatePresetRows(entry.config, depth + 1, next);
	}
}
function packageExport(value, depth = 0) {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object" || depth > 16) return void 0;
	const record = object(value);
	for (const key of [
		"node",
		"import",
		"default",
		"require"
	]) {
		const entry = packageExport(record[key], depth + 1);
		if (entry) return entry;
	}
}
/** Validate manifest identity and its required on-disk entry references, without loading code. */
function readResourceManifest(root, files, expectedKind, wrapper) {
	const names = new Set(files.map((file) => file.rel));
	const candidates = [];
	if (names.has("skin.json")) candidates.push("skin");
	if (names.has("pet.json")) candidates.push("pet");
	if (names.has("preset.yml")) candidates.push("preset");
	if (!candidates.length && names.has("package.json")) candidates.push("plugin");
	if (candidates.length !== 1 || expectedKind && candidates[0] !== expectedKind) fail("wrong-kind", "Resource manifest is missing, ambiguous or belongs to a different category.");
	const kind = candidates[0];
	const requireFile = (value) => {
		const rel = safeLocalPath(typeof value === "string" ? value.replace(/^\.\//, "") : value);
		if (!names.has(rel)) fail("missing-file", `Resource is missing the referenced file: ${rel}`);
		return rel;
	};
	const optionalFile = (value) => {
		if (value !== void 0) requireFile(value);
	};
	const requireDirectory = (value) => {
		if (value === ".") return "";
		const rel = safeLocalPath(value);
		if (!files.some((file) => file.rel.startsWith(rel + "/"))) fail("missing-file", `Resource has no files in the referenced folder: ${rel}`);
		return rel;
	};
	let raw;
	let id;
	let name;
	let executable = files.some((file) => /\.(?:[cm]?js|[cm]?ts|jsx|tsx|wasm|node|exe|dll|ps1|sh|bat|cmd)$/i.test(file.rel));
	if (kind === "skin") {
		raw = json(root, "skin.json");
		const validation = validateSkinManifestV2(raw);
		if (!validation.ok) fail("invalid-manifest", "Skin Center cannot load this manifest: " + validation.errors.slice(0, 5).join("; "));
		id = validateLocalId(kind, raw.id);
		name = label(raw.name);
		const contributes = object(raw.contributes);
		requireFile(contributes.stylesheet);
		optionalFile(contributes.patches);
		for (const media of Object.values(object(contributes.backgroundMedia))) optionalFile(object(media).src);
		for (const preview of Object.values(object(raw.preview))) optionalFile(preview);
		for (const facet of Object.values(object(raw.facets))) {
			const entry = object(facet).entry;
			if (entry !== void 0) {
				requireFile(entry);
				executable = true;
			}
		}
	} else if (kind === "pet") {
		raw = json(root, "pet.json");
		const validation = parsePetManifest(raw, "pet.json");
		if (!validation.ok) fail("invalid-manifest", "Pet Center cannot load this manifest: " + validation.diagnostics.filter((item) => item.level === "error").slice(0, 5).map((item) => item.message).join("; "));
		raw = validation.manifest;
		id = validateLocalId(kind, raw.id);
		name = label(raw.displayName);
		if (raw.renderer === "sprite2d" || raw.renderer === void 0) requireFile(object(raw.sprite2d).spritesheetPath ?? raw.spritesheetPath ?? "spritesheet.webp");
		else if (raw.renderer === "live2d") {
			const modelPath = requireFile(object(raw.live2d).model);
			const model = json(root, modelPath);
			const modelBase = path.posix.dirname(modelPath);
			const checkModelFile = (value) => {
				if (typeof value !== "string") fail("invalid-manifest", "Live2D model references must be file paths.");
				safeLocalPath(value);
				requireFile(modelBase === "." ? value : modelBase + "/" + value);
			};
			const references = object(model.FileReferences);
			checkModelFile(references.Moc);
			if (!Array.isArray(references.Textures) || !references.Textures.length) fail("invalid-manifest", "Live2D model must declare textures.");
			for (const texture of references.Textures) checkModelFile(texture);
			for (const key of [
				"Physics",
				"Pose",
				"UserData",
				"DisplayInfo"
			]) if (references[key] !== void 0) checkModelFile(references[key]);
			for (const expression of Array.isArray(references.Expressions) ? references.Expressions : []) checkModelFile(object(expression).File);
			for (const motions of Object.values(object(references.Motions))) if (Array.isArray(motions)) for (const motion of motions) {
				checkModelFile(object(motion).File);
				if (object(motion).Sound !== void 0) checkModelFile(object(motion).Sound);
			}
		} else if (raw.renderer === "frames2d") {
			const frames = object(raw.frames2d);
			const dir = requireDirectory(frames.dir ?? ".");
			const tracks = object(frames.tracks);
			const idle = object(frames.phases).idle;
			if (typeof idle !== "string" || !(idle in tracks) || !Object.keys(tracks).length) fail("invalid-manifest", "Frame pets need an idle phase and matching tracks.");
			for (const [track, value] of Object.entries(tracks)) {
				safeLocalPath(track);
				const prefix = [dir, track].filter(Boolean).join("/");
				requireDirectory(prefix);
				const specified = object(value).frames;
				if (specified !== void 0) {
					if (!Array.isArray(specified) || !specified.length) fail("invalid-manifest", "Frame track must contain frame filenames.");
					for (const frame of specified) requireFile(prefix + "/" + safeLocalPath(frame));
				} else if (!files.some((file) => file.rel.startsWith(prefix + "/") && /\.(webp|png|jpe?g|avif)$/i.test(file.rel))) fail("missing-file", `Pet track has no image frames: ${track}`);
			}
		} else fail("invalid-manifest", "Pet renderer is not supported.");
	} else if (kind === "preset") {
		raw = object(yaml(root, "preset.yml"));
		name = label(raw.name);
		requireFile("agent.cordis.yml");
		const fallback = wrapper && /^[a-z0-9][a-z0-9-]{0,63}$/.test(wrapper) ? wrapper : "preset-" + createHash("sha256").update(name ?? textFile(root, "agent.cordis.yml")).digest("hex").slice(0, 12);
		id = validateLocalId(kind, raw.id ?? fallback);
		name ??= id;
		validatePresetRows(yaml(root, "agent.cordis.yml", true));
		executable = true;
	} else {
		raw = json(root, "package.json");
		id = validateLocalId(kind, raw.name);
		name = label(raw.displayName) ?? id;
		const operations = yaml(root, requireFile(object(object(raw.dsh).bundle).patch), true);
		if (!Array.isArray(operations) || !operations.length) fail("invalid-manifest", "Plugin bundle patch must be a nonempty YAML list.");
		const exports = object(raw.exports);
		const entry = requireFile(packageExport(exports["."]) ?? packageExport(raw.exports) ?? raw.main);
		if (!/\.[cm]?js$/.test(entry)) fail("missing-build", "Plugin packages must include a built JavaScript entry.");
		if (object(raw.dsh).client !== void 0) {
			const client = requireFile(packageExport(exports["./client"]));
			if (!/\.[cm]?js$/.test(client)) fail("missing-build", "Plugin packages must include their built browser entry.");
		}
		executable = true;
	}
	if (!name) fail("invalid-manifest", "Resource manifest needs a nonempty display name.");
	return {
		kind,
		id,
		name,
		version: label(raw.version, 100),
		description: label(raw.description, 4e3),
		executable
	};
}
//#endregion
//#region src/core/local-import-zip.ts
/** Minimal bounded ZIP reader. Only stored/deflated regular files are supported. */
const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
	let value = i;
	for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ (value & 1 ? 3988292384 : 0);
	return value >>> 0;
});
function crc32(bytes) {
	let crc = 4294967295;
	for (const byte of bytes) crc = crc >>> 8 ^ CRC_TABLE[(crc ^ byte) & 255];
	return (crc ^ 4294967295) >>> 0;
}
function checkExtra(bytes) {
	for (let pos = 0; pos < bytes.length;) {
		if (pos + 4 > bytes.length) fail("invalid-zip", "Malformed ZIP extra field.");
		const tag = bytes.readUInt16LE(pos);
		const size = bytes.readUInt16LE(pos + 2);
		pos += 4;
		if (pos + size > bytes.length) fail("invalid-zip", "Malformed ZIP extra field.");
		if ([
			1,
			10,
			13,
			22613,
			30062,
			28789
		].includes(tag)) fail("unsupported-zip", "ZIP64, filesystem links and alternate ZIP filenames are not supported. Export a standard ZIP.");
		pos += size;
	}
}
function readDirectory(bytes) {
	if (bytes.length > LOCAL_IMPORT_LIMITS.fileBytes) fail("quota", "ZIP archive exceeds 200 MiB.", 413);
	let end = -1;
	for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) if (bytes.readUInt32LE(p) === 101010256 && p + 22 + bytes.readUInt16LE(p + 20) === bytes.length) {
		end = p;
		break;
	}
	if (end < 0) fail("invalid-zip", "ZIP directory is missing or truncated.");
	const count = bytes.readUInt16LE(end + 10);
	const centralSize = bytes.readUInt32LE(end + 12);
	const centralOffset = bytes.readUInt32LE(end + 16);
	if (count === 65535 || centralSize === 4294967295 || centralOffset === 4294967295) fail("unsupported-zip", "ZIP64 archives are not supported.");
	if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0 || bytes.readUInt16LE(end + 8) !== count) fail("unsupported-zip", "Multi-volume ZIP archives are not supported.");
	if (centralOffset + centralSize !== end) fail("invalid-zip", "ZIP directory size does not match the archive.");
	if (!count || count > LOCAL_IMPORT_LIMITS.files * 2) fail("quota", "ZIP archive has too many entries.", 413);
	const entries = [];
	const seen = new FilePaths();
	const explicitNames = /* @__PURE__ */ new Set();
	let pos = centralOffset;
	let fileCount = 0;
	let total = 0;
	for (let i = 0; i < count; i++) {
		if (pos + 46 > end || bytes.readUInt32LE(pos) !== 33639248) fail("invalid-zip", "Malformed ZIP directory entry.");
		const flags = bytes.readUInt16LE(pos + 8);
		const method = bytes.readUInt16LE(pos + 10);
		const compressed = bytes.readUInt32LE(pos + 20);
		const expanded = bytes.readUInt32LE(pos + 24);
		const nameSize = bytes.readUInt16LE(pos + 28);
		const extraSize = bytes.readUInt16LE(pos + 30);
		const commentSize = bytes.readUInt16LE(pos + 32);
		const offset = bytes.readUInt32LE(pos + 42);
		const next = pos + 46 + nameSize + extraSize + commentSize;
		if (next > end || !nameSize) fail("invalid-zip", "Truncated ZIP directory entry.");
		if (flags & -2063 || flags & 1) fail("unsupported-zip", "Encrypted or unsupported ZIP archives are not supported.");
		if (method !== 0 && method !== 8) fail("unsupported-zip", "Use ZIP stored or deflate compression.");
		if (expanded === 4294967295 || compressed === 4294967295 || offset === 4294967295) fail("unsupported-zip", "ZIP64 archives are not supported.");
		if (bytes.readUInt16LE(pos + 34)) fail("unsupported-zip", "Multi-volume ZIP archives are not supported.");
		const attrs = bytes.readUInt32LE(pos + 38);
		const mode = attrs >>> 16;
		if ((mode & 61440) !== 0 && (mode & 61440) !== 32768 && (mode & 61440) !== 16384) fail("unsupported-files", "ZIP links and special files are not supported.");
		if ((attrs & 1024) !== 0) fail("unsupported-files", "ZIP reparse-point entries are not supported.");
		const rawName = bytes.subarray(pos + 46, pos + 46 + nameSize);
		let decoded;
		try {
			decoded = new TextDecoder("utf-8", { fatal: true }).decode(rawName);
		} catch {
			fail("unsupported-zip", "ZIP filenames must use UTF-8. Export the ZIP with UTF-8 filenames.");
		}
		const directory = decoded.endsWith("/");
		const name = safeLocalPath(directory ? decoded.slice(0, -1) : decoded);
		if (((mode & 61440) === 16384 || (attrs & 16) !== 0) && !directory) fail("invalid-zip", "ZIP directory attributes conflict with the filename.");
		if (explicitNames.has(name.toLowerCase())) fail("duplicate-path", "ZIP contains duplicate entry names.");
		explicitNames.add(name.toLowerCase());
		seen.add(name, directory);
		if (directory && (compressed !== 0 || expanded !== 0)) fail("invalid-zip", "ZIP directory contains file data.");
		if (!directory) {
			total += expanded;
			if (++fileCount > LOCAL_IMPORT_LIMITS.files || expanded > LOCAL_IMPORT_LIMITS.fileBytes || total > LOCAL_IMPORT_LIMITS.expandedBytes) fail("quota", "ZIP exceeds 2,000 files, 200 MiB per file or 500 MiB expanded.", 413);
		}
		checkExtra(bytes.subarray(pos + 46 + nameSize, pos + 46 + nameSize + extraSize));
		entries.push({
			name,
			rawName,
			directory,
			flags,
			method,
			compressed,
			expanded,
			offset,
			crc: bytes.readUInt32LE(pos + 16)
		});
		pos = next;
	}
	if (pos !== end) fail("invalid-zip", "ZIP directory has unaccounted entries.");
	return {
		entries,
		centralOffset
	};
}
function extractLocalZip(archive, destination) {
	const bytes = readFileSync(archive);
	const { entries, centralOffset } = readDirectory(bytes);
	const ranges = [];
	for (const entry of entries) {
		const pos = entry.offset;
		if (pos + 30 > centralOffset || bytes.readUInt32LE(pos) !== 67324752) fail("invalid-zip", "ZIP file header is missing.");
		const nameSize = bytes.readUInt16LE(pos + 26);
		const extraSize = bytes.readUInt16LE(pos + 28);
		const dataStart = pos + 30 + nameSize + extraSize;
		let end = dataStart + entry.compressed;
		if (end > centralOffset || !bytes.subarray(pos + 30, pos + 30 + nameSize).equals(entry.rawName) || bytes.readUInt16LE(pos + 6) !== entry.flags || bytes.readUInt16LE(pos + 8) !== entry.method) fail("invalid-zip", "ZIP file header disagrees with its directory.");
		checkExtra(bytes.subarray(pos + 30 + nameSize, dataStart));
		if (!(entry.flags & 8)) {
			if (bytes.readUInt32LE(pos + 14) !== entry.crc || bytes.readUInt32LE(pos + 18) !== entry.compressed || bytes.readUInt32LE(pos + 22) !== entry.expanded) fail("invalid-zip", "ZIP sizes or checksum disagree.");
		} else {
			if (end + 12 > centralOffset) fail("invalid-zip", "ZIP data descriptor is missing.");
			let descriptor = end;
			if (bytes.readUInt32LE(descriptor) === 134695760) descriptor += 4;
			if (descriptor + 12 > centralOffset || bytes.readUInt32LE(descriptor) !== entry.crc || bytes.readUInt32LE(descriptor + 4) !== entry.compressed || bytes.readUInt32LE(descriptor + 8) !== entry.expanded) fail("invalid-zip", "ZIP data descriptor disagrees with its directory.");
			end = descriptor + 12;
		}
		ranges.push([pos, end]);
	}
	ranges.sort((a, b) => a[0] - b[0]);
	if (ranges[0]?.[0] !== 0) fail("unsupported-zip", "Self-extracting ZIP archives are not supported.");
	for (let i = 1; i < ranges.length; i++) if (ranges[i][0] !== ranges[i - 1][1]) fail("invalid-zip", "ZIP file ranges overlap or contain unlisted data.");
	if (ranges.at(-1)?.[1] !== centralOffset) fail("invalid-zip", "ZIP contains unlisted trailing file data.");
	plainMkdir(destination);
	for (const entry of entries) {
		const full = path.join(destination, ...entry.name.split("/"));
		if (entry.directory) {
			plainMkdir(full);
			continue;
		}
		const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28);
		const compressed = bytes.subarray(start, start + entry.compressed);
		let output;
		try {
			output = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.expanded) });
		} catch {
			fail("invalid-zip", "ZIP deflate data is invalid or exceeds its declared size.");
		}
		if (output.length !== entry.expanded || crc32(output) !== entry.crc) fail("invalid-zip", "ZIP checksum or expanded size is invalid.");
		plainMkdir(path.dirname(full));
		writeFileSync(full, output, { flag: "wx" });
	}
}
//#endregion
//#region src/core/local-import.ts
/** Local resource library: validate and copy bytes, never import/evaluate resource code. */
const KIND_DIRECTORY = {
	skin: "skins",
	pet: "pets",
	preset: "agent-presets",
	plugin: "workshop/plugins"
};
const locks = /* @__PURE__ */ new Map();
function localResourceDir(home, kind, id) {
	validateLocalId(kind, id);
	const directory = kind === "plugin" ? createHash("sha256").update(id).digest("hex") : id;
	return path.join(home, KIND_DIRECTORY[kind], directory);
}
/** Import and activation share the same queue so they cannot mutate one resource concurrently. */
async function localResourceLock(home, kind, id, action) {
	const key = path.resolve(home).toLowerCase() + ":" + kind + ":" + id.toLowerCase();
	const pending = (locks.get(key) ?? Promise.resolve()).catch(() => void 0).then(action);
	locks.set(key, pending);
	try {
		return await pending;
	} finally {
		if (locks.get(key) === pending) locks.delete(key);
	}
}
function hashFiles(root, files) {
	const hashes = Object.create(null);
	for (const file of [...files].sort((a, b) => a.rel.localeCompare(b.rel))) if (!isImportedRecord(file.rel)) hashes[file.rel] = createHash("sha256").update(readFileSync(path.join(root, file.rel))).digest("hex");
	return hashes;
}
/** Metadata is an ownership record, never a code-trust assertion. Actions verify bytes again. */
function readLocalImportRecord(root, options = {}) {
	try {
		assertPlainPath(root);
		const full = path.join(root, LOCAL_IMPORT_RECORD$1);
		assertPlainPath(full);
		if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) return void 0;
		const raw = JSON.parse(readFileSync(full, "utf8"));
		if (raw.version !== 1 || raw.source !== "local-import" || ![
			"skin",
			"pet",
			"plugin",
			"preset"
		].includes(raw.kind) || typeof raw.name !== "string" || typeof raw.importedAt !== "string" || typeof raw.files !== "object" || raw.files === null || Array.isArray(raw.files)) return void 0;
		validateLocalId(raw.kind, raw.id);
		const paths = new FilePaths();
		const entries = Object.entries(raw.files);
		if (!entries.length || entries.length > LOCAL_IMPORT_LIMITS.files) return void 0;
		for (const [rel, hash] of entries) {
			paths.add(rel);
			if (isImportedRecord(rel) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return void 0;
		}
		if (options.verify) {
			const hashes = hashFiles(root, listPlainFiles(root).filter((file) => !isImportedRecord(file.rel)));
			if (Object.keys(hashes).length !== entries.length || entries.some(([rel, hash]) => hashes[rel] !== hash)) return void 0;
		}
		return raw;
	} catch {
		return;
	}
}
function plainExists(full) {
	assertPlainPath(full);
	try {
		return lstatSync(full).isDirectory();
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
function readDirectories(base) {
	try {
		assertPlainPath(base);
		return readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith(".")).map((entry) => entry.name);
	} catch {
		return [];
	}
}
function readSmallJson(full) {
	try {
		assertPlainPath(full);
		if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) return {};
		const value = JSON.parse(readFileSync(full, "utf8"));
		return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
	} catch {
		return {};
	}
}
function protectedId(kind, id) {
	if (/^(default|standard|builtin|core|official)(-|$)/.test(id)) return true;
	if (kind === "skin" && id === "blue-fantasy") return true;
	if (kind === "plugin") return /^@(deepseek-ai|deepseek)\//.test(id) || /^(?:@[^/]+\/)?dsh-(?:core|host|api|agent-presets|settings|web-all)(?:-|$)/.test(id) || [
		"@linxin666/dsh-client-ui-market",
		"@linxin666/dsh-skin-center",
		"@linxin666/dsh-pet",
		"@linxin666/dsh-preset-center"
	].includes(id);
	return false;
}
/** A bounded, in-memory upload registry. Disk staging is purged on expiry or discard. */
var LocalWorkshopService = class {
	home;
	now;
	rename;
	uploads = /* @__PURE__ */ new Map();
	constructor(options) {
		this.home = path.resolve(options.dshHome);
		this.now = options.now ?? Date.now;
		this.rename = options.rename ?? renameSync;
	}
	get uploadsRoot() {
		return path.join(this.home, "workshop", "uploads");
	}
	/** Called on requests, without a background timer keeping the host process alive. */
	cleanup() {
		const cutoff = this.now() - LOCAL_IMPORT_LIMITS.expiryMs;
		for (const [id, upload] of this.uploads) if (!upload.busy && upload.touchedAt < cutoff) {
			this.removeStage(upload.root);
			this.uploads.delete(id);
		}
		for (const name of readDirectories(this.uploadsRoot)) {
			if (!/^upload-[a-f0-9-]{36}$/.test(name) || this.uploads.has(name.slice(7))) continue;
			const full = path.join(this.uploadsRoot, name);
			if (lstatSync(full).mtimeMs < cutoff) this.removeStage(full);
		}
	}
	removeStage(full) {
		const parent = path.resolve(this.uploadsRoot);
		const target = path.resolve(full);
		if (path.dirname(target) !== parent || !path.basename(target).startsWith("upload-")) fail("unsafe-destination", "Invalid upload staging location.");
		assertPlainPath(target);
		rmSync(target, {
			recursive: true,
			force: true,
			maxRetries: 3
		});
	}
	start(kind, format) {
		if (![
			"skin",
			"pet",
			"plugin",
			"preset"
		].includes(kind) || !["zip", "folder"].includes(format)) fail("invalid-body", "Choose a supported resource category and ZIP or folder format.");
		this.cleanup();
		if (this.uploads.size >= LOCAL_IMPORT_LIMITS.sessions) fail("busy", "Too many pending imports. Finish or discard an existing import.", 409);
		const id = randomUUID();
		const root = path.join(this.uploadsRoot, "upload-" + id);
		plainMkdir(path.join(root, "files"));
		this.uploads.set(id, {
			id,
			kind,
			format,
			root,
			createdAt: this.now(),
			touchedAt: this.now(),
			busy: false,
			files: [],
			totalBytes: 0
		});
		return id;
	}
	getUpload(id) {
		this.cleanup();
		if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) fail("invalid-upload", "Upload session is invalid.", 404);
		const upload = this.uploads.get(id);
		if (!upload) fail("expired-upload", "Upload expired. Select the resource again.", 404);
		if (upload.busy) fail("busy", "This upload is already being processed.", 409);
		upload.touchedAt = this.now();
		return upload;
	}
	async uploadFile(id, relativePath, body) {
		const upload = this.getUpload(id);
		if (upload.inspected) fail("inspected-upload", "This resource was already inspected. Start a new import to change its files.", 409);
		const rel = safeLocalPath(relativePath);
		if (upload.format === "zip" && (rel !== "archive.zip" || upload.files.length)) fail("invalid-upload", "A ZIP upload must contain exactly one archive.zip file.");
		if (upload.files.length >= LOCAL_IMPORT_LIMITS.files) fail("quota", "Resource exceeds 2,000 files.", 413);
		const paths = new FilePaths();
		for (const file of upload.files) paths.add(file.rel);
		paths.add(rel);
		upload.busy = true;
		const full = path.join(upload.root, "files", rel);
		let bytes = 0;
		try {
			plainMkdir(path.dirname(full));
			assertPlainPath(full);
			const handle = await open(full, "wx");
			try {
				for await (const chunk of body) {
					const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
					bytes += buffer.byteLength;
					if (bytes > LOCAL_IMPORT_LIMITS.fileBytes || upload.totalBytes + bytes > LOCAL_IMPORT_LIMITS.expandedBytes) fail("quota", "Upload exceeds 200 MiB per file or 500 MiB per resource.", 413);
					let offset = 0;
					while (offset < buffer.length) offset += (await handle.write(buffer, offset, buffer.length - offset)).bytesWritten;
					upload.touchedAt = this.now();
				}
			} finally {
				await handle.close();
			}
			upload.files.push({
				rel,
				bytes
			});
			upload.totalBytes += bytes;
		} catch (error) {
			assertPlainPath(full);
			rmSync(full, { force: true });
			throw error;
		} finally {
			upload.busy = false;
		}
	}
	guardDestination(kind, id) {
		if (protectedId(kind, id)) fail("protected-resource", "Built-in and core resource IDs cannot be imported or replaced. Choose a custom ID.", 409);
		const destination = localResourceDir(this.home, kind, id);
		assertPlainPath(destination);
		if (readDirectories(path.dirname(destination)).some((name) => name.toLowerCase() === path.basename(destination).toLowerCase() && name !== path.basename(destination))) fail("conflict", "A resource with a case-equivalent directory already exists.", 409);
		if (kind === "preset" && plainExists(path.join(this.home, ".agent-presets", id))) fail("active-resource", "Disable this preset before replacing its library resource.", 409);
		if (kind === "skin" && readSmallJson(path.join(this.home, "skin-center-active.json")).active === id) fail("active-resource", "Switch away from this skin before replacing it.", 409);
		if (kind === "pet" && readSmallJson(path.join(this.home, "pet.json")).petId === id) fail("active-resource", "Select another pet before replacing it.", 409);
		if (kind === "plugin") {
			if (readSmallJson(path.join(this.home, "workshop", "plugin-jobs", createHash("sha256").update(id).digest("hex") + ".json")).state === "running") fail("active-resource", "Wait for the plugin installation to finish before replacing it.", 409);
			for (const profile of readDirectories(path.join(this.home, "profiles"))) {
				const dependencies = readSmallJson(path.join(this.home, "profiles", profile, "package.json")).dependencies;
				if (dependencies && typeof dependencies === "object" && Object.hasOwn(dependencies, id)) fail("active-resource", "Uninstall this plugin before replacing its local package.", 409);
			}
		}
		if (existsSync(destination) && !lstatSync(destination).isDirectory()) fail("conflict", "The resource destination is occupied by a file.", 409);
		return plainExists(destination);
	}
	inspect(id) {
		const upload = this.getUpload(id);
		if (!upload.files.length) fail("empty-upload", "Select a resource package containing files.");
		if (!upload.inspected) {
			let root = path.join(upload.root, "files");
			if (upload.format === "zip") {
				root = path.join(upload.root, "extracted");
				assertPlainPath(root);
				rmSync(root, {
					recursive: true,
					force: true
				});
				extractLocalZip(path.join(upload.root, "files", "archive.zip"), root);
			}
			let files = listPlainFiles(root);
			const manifestNames = [
				"skin.json",
				"pet.json",
				"preset.yml",
				"package.json"
			];
			let wrapper;
			if (!files.some((file) => manifestNames.includes(file.rel))) {
				const roots = new Set(files.map((file) => file.rel.split("/")[0]));
				if (roots.size !== 1 || files.some((file) => !file.rel.includes("/"))) fail("invalid-root", "Resource must have its manifest at the root or inside one enclosing folder.");
				wrapper = [...roots][0];
				root = path.join(root, wrapper);
				files = listPlainFiles(root);
			}
			for (const file of files.filter((file) => isImportedRecord(file.rel))) rmSync(path.join(root, file.rel), { force: true });
			files = files.filter((file) => !isImportedRecord(file.rel));
			const manifest = readResourceManifest(root, files, upload.kind, wrapper);
			upload.inspected = {
				root,
				files,
				manifest,
				hashes: hashFiles(root, files)
			};
		}
		const { manifest, files } = upload.inspected;
		const conflict = this.guardDestination(manifest.kind, manifest.id);
		return {
			...manifest,
			fileCount: files.length,
			totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
			conflict
		};
	}
	async commit(id, replace = false) {
		this.inspect(id);
		const upload = this.getUpload(id);
		const inspected = upload.inspected;
		upload.busy = true;
		try {
			return await localResourceLock(this.home, inspected.manifest.kind, inspected.manifest.id, async () => {
				const { root, manifest } = inspected;
				const hashes = hashFiles(root, listPlainFiles(root));
				if (Object.keys(hashes).length !== Object.keys(inspected.hashes).length || Object.entries(inspected.hashes).some(([rel, hash]) => hashes[rel] !== hash)) fail("changed-resource", "Staged resource changed after inspection. Import it again.", 409);
				const exists = this.guardDestination(manifest.kind, manifest.id);
				if (exists && !replace) fail("conflict", "Resource already exists. Confirm replacement first.", 409);
				const destination = localResourceDir(this.home, manifest.kind, manifest.id);
				plainMkdir(path.dirname(destination));
				const metadata = {
					version: 1,
					source: "local-import",
					kind: manifest.kind,
					id: manifest.id,
					name: manifest.name,
					...manifest.version ? { versionLabel: manifest.version } : {},
					importedAt: new Date(this.now()).toISOString(),
					files: hashes
				};
				writeFileSync(path.join(root, LOCAL_IMPORT_RECORD$1), JSON.stringify(metadata, null, 2) + "\n", { flag: "wx" });
				const backup = path.join(this.home, "workshop", "backups", manifest.kind + "-" + encodeURIComponent(manifest.id) + "-" + this.now() + "-" + randomUUID());
				let backedUp = false;
				try {
					if (exists) {
						plainMkdir(path.dirname(backup));
						assertPlainPath(destination);
						this.rename(destination, backup);
						backedUp = true;
					}
					assertPlainPath(root);
					assertPlainPath(destination);
					this.rename(root, destination);
				} catch (error) {
					if (backedUp && !existsSync(destination)) this.rename(backup, destination);
					if (existsSync(root)) rmSync(path.join(root, LOCAL_IMPORT_RECORD$1), { force: true });
					throw error;
				}
				this.uploads.delete(upload.id);
				try {
					this.removeStage(upload.root);
				} catch {}
				return {
					...manifest,
					source: "local",
					status: "available",
					managed: true
				};
			});
		} finally {
			upload.busy = false;
		}
	}
	discard(id) {
		const upload = this.getUpload(id);
		this.removeStage(upload.root);
		this.uploads.delete(upload.id);
	}
	resources() {
		this.cleanup();
		const resources = /* @__PURE__ */ new Map();
		const activeSkin = readSmallJson(path.join(this.home, "skin-center-active.json")).active;
		const activePet = readSmallJson(path.join(this.home, "pet.json")).petId;
		const pluginDependencies = /* @__PURE__ */ new Set();
		for (const profile of readDirectories(path.join(this.home, "profiles"))) try {
			const full = path.join(this.home, "profiles", profile, "package.json");
			assertPlainPath(full);
			if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) continue;
			const pkg = JSON.parse(readFileSync(full, "utf8"));
			for (const id of Object.keys(pkg.dependencies ?? {})) pluginDependencies.add(id);
		} catch {}
		for (const kind of [
			"skin",
			"pet",
			"plugin",
			"preset"
		]) {
			const bases = [path.join(this.home, KIND_DIRECTORY[kind])];
			if (kind === "preset") bases.push(path.join(this.home, ".agent-presets"));
			for (const base of bases) for (const dir of readDirectories(base)) {
				const full = path.join(base, dir);
				try {
					const manifest = readResourceManifest(full, listPlainFiles(full), kind, dir);
					const record = readLocalImportRecord(full);
					const managed = record?.id === manifest.id && record.kind === kind;
					const active = kind === "preset" && base === bases[1] || kind === "skin" && activeSkin === manifest.id || kind === "pet" && activePet === manifest.id;
					resources.set(kind + ":" + manifest.id, {
						...manifest,
						source: managed ? "local" : "existing",
						managed,
						status: active ? "active" : "available",
						...kind === "plugin" ? { installed: pluginDependencies.has(manifest.id) } : {}
					});
				} catch {
					const record = readLocalImportRecord(full);
					if (record?.kind === kind) resources.set(kind + ":" + record.id, {
						kind,
						id: record.id,
						name: record.name,
						version: record.versionLabel,
						source: "local",
						managed: true,
						status: "invalid",
						executable: kind === "plugin" || kind === "preset"
					});
				}
			}
		}
		return [...resources.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
	}
};
//#endregion
//#region src/local-routes.ts
function makeLocalWorkshopRoutes(deps = {}) {
	const options = {
		dshHome: deps.dshHome ?? dshHome(),
		now: deps.now
	};
	const service = deps.service ?? new LocalWorkshopService(options);
	const respond = (res, status, body) => {
		writeJson(res, status, body, {
			"cache-control": "no-store",
			"x-content-type-options": "nosniff"
		});
	};
	const jsonBody = async (req) => {
		const body = asJsonObject(await readJsonBody(req, {
			maxBytes: 16 * 1024,
			objectOnly: true
		}));
		if (!body) throw new LocalImportError("invalid-body", "A JSON object is required.");
		return body;
	};
	const route = (suffix, method, action) => ({
		kind: "exact",
		path: "/api/workshop/" + suffix,
		handler: async (req, res) => {
			let trusted = false;
			try {
				trusted = isLoopbackRequest(req);
			} catch {}
			if (!trusted) {
				respond(res, 403, {
					ok: false,
					error: "loopback-only"
				});
				return;
			}
			if (req.method !== method) {
				respond(res, 405, {
					ok: false,
					error: "method-not-allowed"
				});
				return;
			}
			try {
				respond(res, 200, await action(req));
			} catch (error) {
				const known = error instanceof LocalImportError;
				respond(res, known ? error.status : 500, {
					ok: false,
					error: known ? error.code : "write-failed",
					message: known ? error.message : "The local resource operation failed. Check file permissions and try again."
				});
			}
		}
	});
	return [
		route("resources", "GET", async (req) => {
			const merged = new Map(service.resources().map((resource) => [resource.kind + ":" + resource.id, resource]));
			for (const resource of await deps.additionalResources?.(req) ?? []) {
				const key = resource.kind + ":" + resource.id;
				const local = merged.get(key);
				merged.set(key, local?.source === "local" ? {
					...resource,
					...local,
					status: local.status === "invalid" ? "invalid" : resource.status,
					installed: resource.installed,
					enabled: resource.enabled
				} : resource);
			}
			return {
				ok: true,
				resources: [...merged.values()]
			};
		}),
		route("upload/start", "POST", async (req) => {
			const body = await jsonBody(req);
			return {
				ok: true,
				uploadId: service.start(body.kind, body.format)
			};
		}),
		route("upload/file", "PUT", async (req) => {
			const url = new URL(req.url ?? "", "http://localhost");
			const contentLength = Number(req.headers["content-length"]);
			if (Number.isFinite(contentLength) && contentLength > 200 * 1024 * 1024) throw new LocalImportError("quota", "One resource file exceeds 200 MiB.", 413);
			req.setTimeout(12e4, () => req.destroy());
			try {
				await service.uploadFile(url.searchParams.get("uploadId"), url.searchParams.get("path"), req);
			} finally {
				req.setTimeout(0);
			}
			return { ok: true };
		}),
		route("upload/inspect", "POST", async (req) => {
			const body = await jsonBody(req);
			return {
				ok: true,
				preview: service.inspect(body.uploadId)
			};
		}),
		route("upload/commit", "POST", async (req) => {
			const body = await jsonBody(req);
			return {
				ok: true,
				resource: await service.commit(body.uploadId, body.replace === true)
			};
		}),
		route("upload/discard", "POST", async (req) => {
			const body = await jsonBody(req);
			service.discard(body.uploadId);
			return { ok: true };
		})
	];
}
//#endregion
//#region ../../shared/host/local-resource-trust.ts
/** Host-only, content-bound consent for resources imported by the local Workshop. */
const LOCAL_IMPORT_RECORD = "dsh-workbench.import.json";
function safeResourceRelativePath(rel) {
	return rel.length > 0 && rel.length <= 1024 && !/[\\:\x00-\x1f]/.test(rel) && rel.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
/** Read metadata only. Metadata conveys ownership, never permission to execute. */
function readLocalTrustRecord(dir, kind, id) {
	try {
		const file = join(dir, LOCAL_IMPORT_RECORD);
		if (lstatSync(dir).isSymbolicLink() || lstatSync(file).isSymbolicLink()) return null;
		const value = JSON.parse(readFileSync(file, "utf8"));
		if (value.version !== 1 || value.source !== "local-import" || value.kind !== kind || value.id !== id || typeof value.importedAt !== "string" || !value.files || typeof value.files !== "object" || Array.isArray(value.files)) return null;
		const entries = Object.entries(value.files);
		if (!entries.length || entries.length > 2e3) return null;
		if (entries.some(([rel, hash]) => !safeResourceRelativePath(rel) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) return null;
		if (new Set(entries.map(([rel]) => rel.toLowerCase())).size !== entries.length) return null;
		return value;
	} catch {
		return null;
	}
}
/** Refuse links, missing/changed files, and unrecorded additions (including dot files). */
function localResourceUnchanged(dir, record) {
	try {
		let count = 0;
		const visit = (base) => {
			for (const entry of readdirSync(join(dir, base), { withFileTypes: true })) {
				const rel = base ? `${base}/${entry.name}` : entry.name;
				const abs = join(dir, rel);
				const stat = lstatSync(abs);
				if (stat.isSymbolicLink()) return false;
				if (stat.isDirectory()) {
					if (!visit(rel)) return false;
					continue;
				}
				if (!stat.isFile()) return false;
				if (rel === "dsh-workbench.import.json" || rel === "dsh-market.provenance.json") continue;
				if (++count > 2e3 || record.files[rel] === void 0) return false;
				if (createHash("sha256").update(readFileSync(abs)).digest("hex") !== record.files[rel]) return false;
			}
			return true;
		};
		return visit("") && count === Object.keys(record.files).length;
	} catch {
		return false;
	}
}
function localContentDigest(record) {
	return createHash("sha256").update(JSON.stringify(Object.entries(record.files).sort(([a], [b]) => a.localeCompare(b, "en")))).digest("hex");
}
function localTrustPath(home, kind, id) {
	return join(home, "workshop", "trust", `${kind}-${createHash("sha256").update(id).digest("hex")}.json`);
}
/** Consent lives outside the imported archive so bundled JSON cannot grant trust. */
function trustLocalResource(home, dir, record) {
	if (!localResourceUnchanged(dir, record)) throw new Error("resource-modified");
	const dest = localTrustPath(home, record.kind, record.id);
	mkdirSync(dirname(dest), { recursive: true });
	const temp = `${dest}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temp, JSON.stringify({
			version: 1,
			kind: record.kind,
			id: record.id,
			importedAt: record.importedAt,
			digest: localContentDigest(record),
			confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
		}), { flag: "wx" });
		renameSync(temp, dest);
	} finally {
		if (existsSync(temp)) rmSync(temp);
	}
}
function isLocalResourceTrusted(home, dir, kind, id) {
	try {
		const record = readLocalTrustRecord(dir, kind, id);
		if (!record || !localResourceUnchanged(dir, record)) return false;
		const trust = JSON.parse(readFileSync(localTrustPath(home, kind, id), "utf8"));
		return trust.version === 1 && trust.kind === kind && trust.id === id && trust.importedAt === record.importedAt && trust.digest === localContentDigest(record);
	} catch {
		return false;
	}
}
//#endregion
//#region ../../shared/host/workshop-services.ts
const key = Symbol.for("dsh-workbench.lifecycle-routes.v1");
function registry() {
	const host = globalThis;
	return host[key] ??= /* @__PURE__ */ new Map();
}
/** Keep the caller's real peer and origin when invoking the owning route's guard. */
const callWorkshopService = (original, path, body, home) => new Promise((resolveResult, reject) => {
	const route = registry().get(`${resolve(home)}:${path.split("?")[0]}`);
	if (!route) {
		resolveResult({
			status: 503,
			body: {
				error: "service-unavailable",
				message: "The resource manager is unavailable. Restart the workbench after updating."
			}
		});
		return;
	}
	const req = Readable.from(body === void 0 ? [] : [Buffer.from(JSON.stringify(body))]);
	req.url = path;
	req.method = body === void 0 ? "GET" : "POST";
	req.headers = { ...original.headers };
	Object.defineProperty(req, "socket", { value: original.socket });
	let status = 200;
	const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("resource-manager-timeout")), 3e4);
	const res = {
		writeHead(code) {
			status = code;
			return this;
		},
		end(value) {
			clearTimeout(timer);
			try {
				resolveResult({
					status,
					body: JSON.parse(value)
				});
			} catch (error) {
				reject(error);
			}
		}
	};
	try {
		Promise.resolve(route.handler(req, res)).catch((error) => {
			clearTimeout(timer);
			reject(error);
		});
	} catch (error) {
		clearTimeout(timer);
		reject(error);
	}
});
//#endregion
//#region src/local-actions.ts
/** Local Workshop lifecycle: ownership checks before the existing managers do the work. */
const KINDS = /* @__PURE__ */ new Set([
	"skin",
	"pet",
	"plugin",
	"preset"
]);
const ACTIONS = /* @__PURE__ */ new Set([
	"install",
	"enable",
	"disable",
	"remove",
	"trust"
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
var ActionError = class extends Error {
	code;
	status;
	constructor(code, message, status = 409) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
function assertTreeLocation(home, dir) {
	const rel = relative(resolve(home), resolve(dir));
	if (!rel || rel.startsWith("..") || rel.startsWith(sep)) throw new ActionError("invalid-path", "Resource path is outside the workbench", 400);
	let current = resolve(home);
	for (const segment of rel.split(sep)) {
		current = join(current, segment);
		if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new ActionError("invalid-path", "Resource directories cannot be symbolic links", 400);
	}
}
function jsonFile(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}
function pluginJobPath(home, id) {
	return join(home, "workshop", "plugin-jobs", `${createHash("sha256").update(id).digest("hex")}.json`);
}
/** Keep queued installs protected from replacement until the owning queue settles. */
function monitorPluginJob(home, id, jobId, original, service) {
	const file = pluginJobPath(home, id);
	const request = {
		headers: { ...original.headers },
		socket: { remoteAddress: original.socket.remoteAddress }
	};
	const tick = async () => {
		const marker = jsonFile(file);
		if (marker?.jobId !== jobId || marker.state !== "running") return;
		try {
			const result = await service(request, `/api/plugin-manager/status?job=${encodeURIComponent(jobId)}`, void 0, home);
			const job = result.body.job;
			if (job?.phase === "done" || job?.phase === "error" || result.status === 404) {
				if (jsonFile(file)?.jobId === jobId) writeFileSync(file, JSON.stringify({
					...marker,
					state: job?.phase ?? "error"
				}));
				return;
			}
		} catch {}
		setTimeout(() => {
			tick();
		}, 1e3).unref();
	};
	setTimeout(() => {
		tick();
	}, 500).unref();
}
async function successful(service, req, home, path, body) {
	const result = await service(req, path, body, home);
	if (result.status >= 400 || result.body.ok === false || result.body.error) throw new ActionError(String(result.body.error ?? "manager-error"), String(result.body.message ?? result.body.error ?? "Resource manager rejected the action"), result.status >= 400 ? result.status : 409);
	return result.body;
}
async function installedPlugins(service, req, home) {
	const result = await successful(service, req, home, "/api/plugin-manager/list");
	return Array.isArray(result.plugins) ? result.plugins : [];
}
/** Existing profile plugins are visible but are never adopted or removed by this importer. */
async function listExistingWorkshopPlugins(req, home, service = callWorkshopService) {
	try {
		return (await installedPlugins(service, req, home)).map((row) => ({
			kind: "plugin",
			id: row.id,
			name: row.id,
			...row.version ? { version: row.version } : {},
			source: "existing",
			status: "active",
			executable: true,
			managed: false,
			installed: true,
			enabled: row.enabled !== false
		}));
	} catch {
		return [];
	}
}
/** All actions require a local, unchanged owned record; every delete is a recoverable move. */
function makeLocalActionRoutes(deps = {}) {
	const home = deps.dshHome ?? dshHome();
	const service = deps.service ?? callWorkshopService;
	const execute = async (req, body) => {
		const kind = body.kind;
		const id = body.id;
		const action = body.action;
		if (!KINDS.has(kind) || typeof id !== "string" || !(kind === "plugin" ? PACKAGE : ID).test(id) || !ACTIONS.has(action)) throw new ActionError("invalid-action", "Invalid resource identity or action", 400);
		if (kind === "plugin" && id.startsWith("@deepseek-ai/")) throw new ActionError("protected-resource", "Official runtime packages cannot be managed here");
		return localResourceLock(home, kind, id, async () => {
			const libraryDir = localResourceDir(home, kind, id);
			const enabledDir = kind === "preset" ? join(home, ".agent-presets", id) : libraryDir;
			const dir = kind === "preset" && existsSync(enabledDir) ? enabledDir : libraryDir;
			assertTreeLocation(home, dir);
			const record = readLocalTrustRecord(dir, kind, id);
			if (!record) throw new ActionError("not-managed", "Only resources imported by this workbench can be changed here");
			if (!localResourceUnchanged(dir, record)) throw new ActionError("resource-modified", "Resource files changed. Import the updated resource again before using it.");
			if (kind === "plugin") {
				const marker = jsonFile(pluginJobPath(home, id));
				if (marker?.state === "running" && typeof marker.jobId === "string") {
					const current = await service(req, `/api/plugin-manager/status?job=${encodeURIComponent(marker.jobId)}`, void 0, home);
					const job = current.body.job;
					if (job?.phase === "running" || current.status !== 404 && job?.phase !== "done" && job?.phase !== "error") throw new ActionError("resource-busy", "Wait for this plugin installation to finish before changing its imported resource");
					writeFileSync(pluginJobPath(home, id), JSON.stringify({
						...marker,
						state: job?.phase ?? "error"
					}));
				}
			}
			if (action === "trust") {
				if (kind !== "skin") throw new ActionError("unsupported-action", "Script trust is available for skin hooks; install or enable other resources explicitly");
				if (body.confirmCode !== true) throw new ActionError("confirmation-required", "This skin can execute scripts. Confirm before allowing them.");
				trustLocalResource(home, dir, record);
				return {
					ok: true,
					message: "Skin scripts approved for this exact imported version. Reapply the skin to load its hooks."
				};
			}
			if (action === "remove") {
				if (kind === "preset" && existsSync(enabledDir)) throw new ActionError("resource-active", "Disable this preset before removing it");
				if (kind === "skin" && jsonFile(join(home, "skin-center-active.json"))?.active === id) throw new ActionError("resource-active", "Apply another skin before removing this one");
				if (kind === "pet" && jsonFile(join(home, "pet.json"))?.petId === id) throw new ActionError("resource-active", "Select another pet before removing this one");
				if (kind === "plugin" && (await installedPlugins(service, req, home)).some((row) => row.id === id)) throw new ActionError("resource-installed", "Uninstall this plugin in Settings / Plugins before removing its imported copy");
				if (kind === "preset") {
					const state = await successful(service, req, home, "/api/preset-center/state");
					if (state.rosterAvailable !== true) throw new ActionError("roster-unavailable", "Preset roster is unavailable", 503);
					if (state.defaultId === id) throw new ActionError("default-preset", "Change the default preset before removing this one");
					if (Array.isArray(state.occupied) && state.occupied.includes(id)) throw new ActionError("protected-resource", "This preset id is supplied by another discovery root");
				}
				const backupRoot = join(home, "workshop", "backups");
				assertTreeLocation(home, backupRoot);
				mkdirSync(backupRoot, { recursive: true });
				renameSync(dir, join(backupRoot, `${kind}-${createHash("sha256").update(id).digest("hex").slice(0, 16)}-${Date.now()}-${randomUUID()}`));
				return {
					ok: true,
					message: "Resource removed from the library. A backup was kept in the workbench data directory."
				};
			}
			if (kind === "preset" && (action === "enable" || action === "disable")) {
				if (action === "enable" && body.confirmCode !== true && !isLocalResourceTrusted(home, dir, "preset", id)) throw new ActionError("confirmation-required", "A preset controls executable agent composition. Confirm this imported version before enabling it.");
				await successful(service, req, home, `/api/preset-center/${action}`, {
					id,
					confirm: body.confirmCode === true
				});
				return { ok: true };
			}
			if (kind === "plugin") {
				const installed = (await installedPlugins(service, req, home)).find((row) => row.id === id);
				if (action === "install") {
					if (installed) throw new ActionError("already-installed", "This plugin is already installed. Manage it in Settings / Plugins.");
					if (body.confirmCode !== true) throw new ActionError("confirmation-required", "Installing this plugin executes package scripts and may download dependencies. Confirm before installing.");
					trustLocalResource(home, dir, record);
					const snapshots = join(home, "workshop", "install-snapshots");
					assertTreeLocation(home, snapshots);
					mkdirSync(snapshots, { recursive: true });
					const snapshot = join(snapshots, randomUUID());
					cpSync(dir, snapshot, {
						recursive: true,
						errorOnExist: true,
						force: false
					});
					const result = await successful(service, req, home, "/api/plugin-manager/install", { spec: `file:${snapshot}` });
					if (typeof result.jobId !== "string") throw new ActionError("manager-error", "Plugin manager did not return an installation job", 500);
					const marker = pluginJobPath(home, id);
					assertTreeLocation(home, marker);
					mkdirSync(dirname(marker), { recursive: true });
					writeFileSync(marker, JSON.stringify({
						id,
						jobId: result.jobId,
						state: "running",
						createdAt: (/* @__PURE__ */ new Date()).toISOString()
					}));
					monitorPluginJob(home, id, result.jobId, req, service);
					return {
						ok: true,
						jobId: result.jobId,
						requiresRestart: true,
						message: "Installation queued. Dependencies may require network access; restart the workbench after the job succeeds."
					};
				}
				if (action === "enable" || action === "disable") {
					if (!installed) throw new ActionError("not-installed", "Install the plugin before changing its state");
					if (!isLocalResourceTrusted(home, dir, "plugin", id)) throw new ActionError("confirmation-required", "This plugin version has not been approved for installation");
					await successful(service, req, home, "/api/plugin-manager/set-enabled", {
						id,
						enabled: action === "enable"
					});
					return {
						ok: true,
						requiresRestart: true
					};
				}
			}
			throw new ActionError("unsupported-action", "Apply skins and select pets from their existing Settings sections");
		});
	};
	const handler = async (req, res) => {
		const send = (status, payload) => writeJson(res, status, payload, { "cache-control": "no-store" });
		if (!isLoopbackRequest(req)) {
			send(403, {
				ok: false,
				error: "loopback-only"
			});
			return;
		}
		if (req.method !== "POST") {
			send(405, {
				ok: false,
				error: "method-not-allowed"
			});
			return;
		}
		const body = await readJsonBody(req, {
			maxBytes: 16 * 1024,
			objectOnly: true
		});
		if (!body) {
			send(400, {
				ok: false,
				error: "invalid-body"
			});
			return;
		}
		try {
			send(200, await execute(req, body));
		} catch (error) {
			const known = error instanceof ActionError;
			send(known ? error.status : 500, {
				ok: false,
				error: known ? error.code : "action-failed",
				message: error instanceof Error ? error.message : String(error)
			});
		}
	};
	return [{
		kind: "exact",
		path: "/api/workshop/action",
		handler
	}];
}
//#endregion
//#region src/core/installer.ts
/** Passive compatibility contracts for existing locally installed assets. No network installer. */
const MARKET_ORIGIN = "https://dsh-market.com";
const PROVENANCE_FILENAME = "dsh-market.provenance.json";
const SAFE_REL_RE = /^[A-Za-z0-9._][A-Za-z0-9._\-/]{0,199}$/;
/** Whether one manifest-relative path passes the conservative allowlist. */
function isSafeRel(rel) {
	if (typeof rel !== "string" || !SAFE_REL_RE.test(rel)) return false;
	if (rel.includes("..") || rel.includes("//") || rel.startsWith("/") || rel.endsWith("/")) return false;
	return true;
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "ui-market";
/** Services the routes need; the gateway requires the host webserver. */
const inject = ["webServer"];
/** Settings namespace of the card's enable switch. */
const MARKET_SETTINGS_NAMESPACE = "dsh-web-ui-market";
const Config = z.object({ enabled: z.boolean().default(true) });
/** Register the namespace and mount the install gateway (once). */
const apply = mountOnce("@linxin666/dsh-client-ui-market", applyImpl);
function applyImpl(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		try {
			if (typeof settingsCtx.settings?.installSection === "function") settingsCtx.settings.installSection(ctx, MARKET_SETTINGS_NAMESPACE, Config, {}, {
				setSource: () => {},
				onChange: () => {}
			});
			else if (typeof settingsCtx.settings?.register === "function") settingsCtx.settings.register(MARKET_SETTINGS_NAMESPACE, Config, { base: {} });
		} catch {}
	});
	const home = dshHome();
	const routes = [...makeLocalWorkshopRoutes({
		dshHome: home,
		additionalResources: (req) => listExistingWorkshopPlugins(req, home)
	}), ...makeLocalActionRoutes({ dshHome: home })];
	for (const route of routes) try {
		ctx.effect(() => {
			const dispose = ctx.webServer.register(route);
			return () => {
				dispose();
			};
		}, "dsh-web-ui-market: routes");
	} catch {}
}
//#endregion
export { Config, MARKET_ORIGIN, MARKET_SETTINGS_NAMESPACE, PROVENANCE_FILENAME, apply, inject, isSafeRel, name };
