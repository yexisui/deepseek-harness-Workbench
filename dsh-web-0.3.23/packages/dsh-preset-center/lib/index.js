import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute$1, join as join$1 } from "node:path/posix";
import { createHash } from "node:crypto";
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
//#region src/host/run-guarded.ts
/**
* Async-boundary guard shared by the plugin family's Host halves: every
* fire-and-forget promise chain and callback the host runtime does not own
* (route handlers, timers, event listeners, spawned work) funnels through
* these helpers. The dsh host installs a process-level fail-loud guard that
* turns ANY unhandled promise rejection into a whole-process exit — one
* plugin's stray rejection would otherwise take every plugin down. These
* helpers exist so that failure mode is structurally impossible in family
* code: the rejection becomes a logged error at the plugin boundary instead.
*
* Complements the aggregate's shell isolation (packages/dsh-web-all): the
* shell contains import/activation failures at boot; runGuarded contains
* run-time failures after activation.
* @module dsh-web-shared/host/run-guarded
*/
/** Format one failure line for logging. */
function formatFailure(label, error) {
	return /* @__PURE__ */ new Error(`[${label}] unhandled async failure: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
}
/**
* Wrap one callback so every invocation is individually guarded: a rejection
* inside one call is logged and swallowed instead of escaping into whatever
* infrastructure invoked the callback (HTTP server, EventEmitter, interval).
* Sync throws are caught identically; a returned promise is replaced by
* `undefined` after guarding (callers that need the original rejection should
* await inside their own try/catch instead).
* @param label - log prefix naming the callback site.
* @param handler - the work to guard.
* @param log - error sink; defaults to console.error.
* @returns a wrapped callback with the same parameter list.
*/
function guardedHandler(label, handler, log = console.error) {
	return (...args) => {
		try {
			const result = handler(...args);
			if (isPromiseLike(result)) {
				Promise.resolve(result).catch((error) => {
					log(formatFailure(label, error));
				});
				return;
			}
			return result;
		} catch (error) {
			log(formatFailure(label, error));
			return;
		}
	};
}
function isPromiseLike(value) {
	return typeof value === "object" && value !== null && typeof value.then === "function";
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
//#region src/core/paths.ts
/**
* The preset-center storage contract: where an installed preset lives while it
* is inert (the library) and where it must live to be discovered (the harness
* home's user preset root).
*
* Both paths are a cross-package contract, not private state:
*  - the library is the destination the market installer writes (`preset`
*    asset kind) and no discovery root scans;
*  - the discovery root is `USER_PRESET_DIR` of
*    `@deepseek-ai/dsh-agent-presets`, appended to the roster unless a
*    deployment sets `includeUserRoot: false`.
* @module @linxin666/dsh-client-ui-preset-center/core/paths
*/
/** Library directory under the DSH home: installed but inert. */
const LIBRARY_DIR = "agent-presets";
/** Official user preset root under the DSH home: present means enabled. */
const ENABLED_DIR = ".agent-presets";
/**
* Provenance filename written by the market installer (mirrors
* `PROVENANCE_FILENAME` in `@linxin666/dsh-client-ui-market`; no
* cross-package runtime import, the same way the skin center mirrors it).
*/
const PROVENANCE_FILENAME = "dsh-market.provenance.json";
/** The composition file that makes a directory a preset. */
const COMPOSITION_FILE = "agent.cordis.yml";
/** Official preset id rule (mirrors `PRESET_ID` in `@deepseek-ai/dsh-agent-presets`). */
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
/** Whether `id` is a usable preset directory name. */
function isPresetId(id) {
	return typeof id === "string" && PRESET_ID_RE.test(id);
}
/** The library directory for one DSH home. */
function libraryRoot(dshHome) {
	return join(dshHome, LIBRARY_DIR);
}
/** The discovery root for one DSH home. */
function enabledRoot(dshHome) {
	return join(dshHome, ENABLED_DIR);
}
//#endregion
//#region src/core/provenance.ts
/**
* Market provenance for one installed preset: the record the market installer
* writes at install time (market origin, asset version, per-file sha256).
*
* It is what lets the panel tell a workshop-managed preset apart from a
* hand-authored directory, and a pristine copy apart from one edited after
* install. Fail-closed: unreadable or wrongly-shaped provenance is `missing`,
* never trusted.
* @module @linxin666/dsh-client-ui-preset-center/core/provenance
*/
/** Market origin the provenance must pin (mirrors MARKET_ORIGIN in the market package). */
const MARKET_ORIGIN = "https://dsh-market.com";
function sha256Hex(abs) {
	try {
		return createHash("sha256").update(readFileSync(abs)).digest("hex");
	} catch {
		return null;
	}
}
/** Every regular file under `dir`, as sorted relative POSIX paths. */
function listFiles(dir, base = "") {
	const out = [];
	let entries;
	try {
		entries = readdirSync(join(dir, base), { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
		if (entry.name.startsWith(".")) continue;
		const rel = base === "" ? entry.name : base + "/" + entry.name;
		if (entry.isDirectory()) out.push(...listFiles(dir, rel));
		else out.push(rel);
	}
	return out;
}
/** Read one preset directory's provenance record; null when absent or malformed. */
function readProvenance(dir, id) {
	let raw;
	try {
		raw = JSON.parse(readFileSync(join(dir, PROVENANCE_FILENAME), "utf8"));
	} catch {
		return null;
	}
	if (typeof raw !== "object" || raw === null) return null;
	const record = raw;
	if (record.version !== 1) return null;
	if (record.source !== "https://dsh-market.com") return null;
	if (record.id !== id) return null;
	const files = record.files;
	if (typeof files !== "object" || files === null) return null;
	const hashes = {};
	for (const [rel, hash] of Object.entries(files)) {
		if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) return null;
		hashes[rel] = hash;
	}
	const installedAt = typeof record.installedAt === "string" ? record.installedAt : "";
	const assetVersion = typeof record.assetVersion === "string" ? record.assetVersion : void 0;
	return {
		version: 1,
		source: MARKET_ORIGIN,
		id,
		installedAt,
		...assetVersion === void 0 ? {} : { assetVersion },
		files: hashes
	};
}
/** Verify one directory's bytes against its own provenance record. */
function verifyProvenance(dir, id) {
	const provenance = readProvenance(dir, id);
	if (provenance === null) return {
		state: "missing",
		provenance: null,
		mismatches: [],
		missing: [],
		extra: []
	};
	const mismatches = [];
	const missing = [];
	for (const [rel, expected] of Object.entries(provenance.files)) {
		const actual = sha256Hex(join(dir, ...rel.split("/")));
		if (actual === null) missing.push(rel);
		else if (actual !== expected) mismatches.push(rel);
	}
	const extra = listFiles(dir).filter((rel) => rel !== "dsh-market.provenance.json" && provenance.files[rel] === void 0);
	return {
		state: mismatches.length === 0 && missing.length === 0 ? "valid" : "modified",
		provenance,
		mismatches,
		missing,
		extra
	};
}
/** Whether `dir` is a directory that exists. */
function isDirectory(dir) {
	try {
		return statSync(dir).isDirectory();
	} catch {
		return false;
	}
}
//#endregion
//#region src/core/profile.ts
/**
* What a preset's composition will actually load, read from the installed
* bytes on the host — never from the market catalog, which a client could
* restate.
*
* The profile answers three questions the enabling confirmation needs: which
* plugins the composition names, which of those are files that travel inside
* the preset directory, and whether the file carries inline `!!js`
* expressions. All three are execution surfaces: a relative row and an inline
* expression both run inside the host process when a session composes the
* preset, exactly like an npm plugin does.
*
* The scan is deliberately shallow (line-oriented) and is a display signal,
* not a sandbox: the authoritative health verdict comes from the official
* roster after the directory is discoverable. A preset that hides a row from
* this scan is still gated by the install/enable split and the operator's
* confirmation.
* @module @linxin666/dsh-client-ui-preset-center/core/profile
*/
const CODE_FILE_RE = /\.(?:mjs|cjs|js)$/;
/** Unquote a YAML scalar the shallow way (the profile is not a parser). */
function unquote(value) {
	const trimmed = value.trim();
	if (trimmed.startsWith("'") && trimmed.endsWith("'") || trimmed.startsWith("\"") && trimmed.endsWith("\"")) return trimmed.slice(1, -1);
	return trimmed;
}
/** Profile one composition document. */
function profileComposition(text, codeFiles) {
	const plugins = [];
	const relativeNames = [];
	let inlineExpressions = 0;
	let rows = 0;
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/\s+#.*$/, "");
		if (line.includes("!!js")) inlineExpressions += 1;
		const match = /^\s*-?\s*name:\s*(.+?)\s*$/.exec(line);
		if (match === null) continue;
		rows += 1;
		const name = unquote(match[1]);
		if (name === "" || name === "cordis:group") continue;
		if (name.startsWith(".")) relativeNames.push(name);
		else plugins.push(name);
	}
	const localCode = codeFiles.filter((rel) => CODE_FILE_RE.test(rel));
	const codeExecution = localCode.length > 0 || relativeNames.length > 0 ? "local" : inlineExpressions > 0 ? "inline" : "none";
	return {
		plugins: [...new Set(plugins)],
		relativeNames: [...new Set(relativeNames)],
		inlineExpressions,
		codeFiles: localCode,
		codeExecution,
		rows
	};
}
/** Profile one installed preset directory; an unreadable composition yields an empty profile. */
function profilePresetDir(dir) {
	let text = "";
	try {
		text = readFileSync(join(dir, COMPOSITION_FILE), "utf8");
	} catch {
		text = "";
	}
	return profileComposition(text, listFiles(dir));
}
/** Whether enabling this profile needs an explicit confirmation from the operator. */
function needsConfirmation(profile) {
	return profile.codeExecution !== "none";
}
//#endregion
//#region src/core/library.ts
/**
* The preset library state machine: install, enable, disable, uninstall, and
* the filesystem-derived state every surface reads.
*
* Two directories, one truth (see `paths.ts`): a preset in the library is
* inert because no discovery root scans it; a preset in the discovery root is
* live because the official roster re-reads its roots on every call. Every
* transition is a directory move, so a crash between steps leaves a state the
* next scan reports instead of a half-written preset.
*
* The module owns no policy: reserved ids and the default-preset guard live in
* the route layer, which is the only place that can read the roster.
* @module @linxin666/dsh-client-ui-preset-center/core/library
*/
/** A refused library operation. */
var PresetOperationError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
/** Subdirectory ids of one root, sorted; absent roots yield none. */
function scanPresetIds(root) {
	let entries;
	try {
		entries = readdirSync(root, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && isPresetId(entry.name)).map((entry) => entry.name).sort();
}
/** The state of one id, derived from the two directories. */
function readPresetState(dshHome, id) {
	const libraryDir = join(libraryRoot(dshHome), id);
	const enabledDir = join(enabledRoot(dshHome), id);
	const installed = isDirectory(libraryDir);
	const enabled = isDirectory(enabledDir);
	const dir = enabled ? enabledDir : libraryDir;
	const report = dir === libraryDir && !installed ? {
		state: "missing",
		provenance: null,
		mismatches: [],
		missing: [],
		extra: []
	} : verifyProvenance(dir, id);
	const provenance = report.provenance;
	return {
		id,
		installed,
		enabled,
		managed: provenance !== null,
		...provenance?.assetVersion === void 0 ? {} : { assetVersion: provenance.assetVersion },
		...provenance?.installedAt === void 0 ? {} : { installedAt: provenance.installedAt },
		integrity: installed || enabled ? report.state : "none",
		conflict: installed && enabled,
		dir
	};
}
/** Every id present in either directory, sorted, with its state. */
function listPresetStates(dshHome) {
	return [.../* @__PURE__ */ new Set([...scanPresetIds(libraryRoot(dshHome)), ...scanPresetIds(enabledRoot(dshHome))])].sort().map((id) => readPresetState(dshHome, id));
}
const RETRYABLE = /* @__PURE__ */ new Set([
	"EPERM",
	"EBUSY",
	"EACCES",
	"ENOTEMPTY"
]);
function errnoOf(err) {
	const code = typeof err === "object" && err !== null ? err.code : void 0;
	return typeof code === "string" ? code : void 0;
}
/** File count and byte total of a tree, for the cross-volume copy check. */
function treeStats(dir) {
	let files = 0;
	let bytes = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = treeStats(abs);
			files += nested.files;
			bytes += nested.bytes;
		} else if (entry.isFile()) {
			files += 1;
			bytes += statSync(abs).size;
		}
	}
	return {
		files,
		bytes
	};
}
/**
* Move one directory into a destination that must not exist yet. A rename is
* atomic within a volume; across volumes the directory is copied, verified by
* file count and byte total, and only then removed from the source. Transient
* Windows handle-release failures are retried briefly before giving up.
*/
function moveDirectory(src, dest) {
	let lastError;
	for (let attempt = 0; attempt < 4; attempt += 1) try {
		renameSync(src, dest);
		return;
	} catch (err) {
		lastError = err;
		const code = errnoOf(err);
		if (code === "EXDEV") try {
			cpSync(src, dest, {
				recursive: true,
				errorOnExist: true,
				force: false
			});
			const from = treeStats(src);
			const to = treeStats(dest);
			if (from.files !== to.files || from.bytes !== to.bytes) {
				rmSync(dest, {
					recursive: true,
					force: true
				});
				throw new PresetOperationError("write", `cross-volume copy of ${src} did not match its source`);
			}
			rmSync(src, {
				recursive: true,
				force: true
			});
			return;
		} catch (copyErr) {
			try {
				rmSync(dest, {
					recursive: true,
					force: true
				});
			} catch {}
			throw copyErr instanceof PresetOperationError ? copyErr : new PresetOperationError("write", copyErr instanceof Error ? copyErr.message : String(copyErr));
		}
		if (code === void 0 || !RETRYABLE.has(code)) break;
		const until = Date.now() + 60 * (attempt + 1);
		while (Date.now() < until);
	}
	throw new PresetOperationError("write", lastError instanceof Error ? lastError.message : String(lastError));
}
/** Absolute library path of one id. */
function libraryDirOf(dshHome, id) {
	return join(libraryRoot(dshHome), id);
}
/** Absolute discovery-root path of one id. */
function enabledDirOf(dshHome, id) {
	return join(enabledRoot(dshHome), id);
}
/**
* Move a preset from the library into the discovery root.
* @throws {PresetOperationError} invalid-id, not-installed, already-enabled, conflict, write.
*/
function enablePreset(dshHome, id) {
	if (!isPresetId(id)) throw new PresetOperationError("invalid-id", `invalid preset id: ${String(id)}`);
	const src = libraryDirOf(dshHome, id);
	const dest = enabledDirOf(dshHome, id);
	if (isDirectory(dest)) throw new PresetOperationError("already-enabled", `preset is already enabled: ${id}`);
	if (!isDirectory(src)) throw new PresetOperationError("not-installed", `preset is not installed: ${id}`);
	mkdirSync(enabledRoot(dshHome), { recursive: true });
	moveDirectory(src, dest);
	return readPresetState(dshHome, id);
}
/**
* Move a preset from the discovery root back into the library.
* @throws {PresetOperationError} invalid-id, not-enabled, not-managed, conflict, write.
*/
function disablePreset(dshHome, id) {
	if (!isPresetId(id)) throw new PresetOperationError("invalid-id", `invalid preset id: ${String(id)}`);
	const src = enabledDirOf(dshHome, id);
	const dest = libraryDirOf(dshHome, id);
	if (!isDirectory(src)) throw new PresetOperationError("not-enabled", `preset is not enabled: ${id}`);
	if (!readPresetState(dshHome, id).managed) throw new PresetOperationError("not-managed", `preset was not installed from the Workshop: ${id}`);
	if (existsSync(dest)) throw new PresetOperationError("conflict", `library already holds ${id}`);
	mkdirSync(libraryRoot(dshHome), { recursive: true });
	moveDirectory(src, dest);
	return readPresetState(dshHome, id);
}
/**
* Remove every copy of a workshop-managed preset.
* @throws {PresetOperationError} invalid-id, not-managed, write.
*/
function uninstallPreset(dshHome, id) {
	if (!isPresetId(id)) throw new PresetOperationError("invalid-id", `invalid preset id: ${String(id)}`);
	const state = readPresetState(dshHome, id);
	if (!state.installed && !state.enabled) return;
	if (!state.managed) throw new PresetOperationError("not-managed", `preset was not installed from the Workshop: ${id}`);
	for (const dir of [libraryDirOf(dshHome, id), enabledDirOf(dshHome, id)]) {
		if (!isDirectory(dir)) continue;
		try {
			rmSync(dir, {
				recursive: true,
				force: true,
				maxRetries: 3,
				retryDelay: 50
			});
		} catch (err) {
			throw new PresetOperationError("write", err instanceof Error ? err.message : String(err));
		}
	}
}
//#endregion
//#region src/routes.ts
const PRESET_CENTER_API_PREFIX = "/api/preset-center";
/** Composition viewer size cap (bytes). */
const COMPOSITION_MAX_BYTES = 256 * 1024;
const ERRORS = {
	"invalid-id": {
		status: 400,
		error: "invalid-id",
		message: "invalid preset id"
	},
	"invalid-body": {
		status: 400,
		error: "invalid-body"
	},
	"loopback-only": {
		status: 403,
		error: "loopback-only"
	},
	"method-not-allowed": {
		status: 405,
		error: "method-not-allowed"
	},
	"not-installed": {
		status: 404,
		error: "not-installed"
	},
	"not-enabled": {
		status: 404,
		error: "not-enabled"
	},
	"not-managed": {
		status: 409,
		error: "not-managed"
	},
	"already-enabled": {
		status: 409,
		error: "already-enabled"
	},
	"conflict": {
		status: 409,
		error: "conflict"
	},
	"shadowed": {
		status: 409,
		error: "shadowed"
	},
	"confirmation-required": {
		status: 409,
		error: "confirmation-required"
	},
	"broken": {
		status: 409,
		error: "broken"
	},
	"default-preset": {
		status: 409,
		error: "default-preset"
	},
	"roster-unavailable": {
		status: 503,
		error: "roster-unavailable"
	},
	"write": {
		status: 500,
		error: "write"
	}
};
function send(res, status, payload) {
	writeJson(res, status, payload, { "cache-control": "no-store" });
}
function sendError(res, err, message) {
	send(res, err.status, {
		ok: false,
		error: err.error,
		...message === void 0 && err.message === void 0 ? {} : { message: message ?? err.message }
	});
}
/** Whether `path` lives inside `root` (a boundary-safe prefix test). */
function isUnder(path, root) {
	return path === root || path.startsWith(root + sep);
}
/** Ids supplied by every root except the discovery root this feature manages. */
async function occupiedIds(roster, root) {
	if (roster === void 0) return null;
	try {
		return (await roster.list()).filter((row) => !isUnder(row.path, root)).map((row) => row.id).sort();
	} catch {
		return null;
	}
}
/** The default preset id, or null when the roster is unavailable. */
function defaultIdOf(roster) {
	if (roster === void 0) return null;
	try {
		return roster.defaultId;
	} catch {
		return null;
	}
}
/** One state row enriched with the composition profile. */
function rowPayload(home, row) {
	return {
		...row,
		profile: profilePresetDir(row.dir)
	};
}
/** Build the preset-center routes. */
function makePresetCenterRoutes(deps = {}) {
	const home = deps.dshHome ?? dshHome();
	const root = enabledRoot(home);
	const rosterOf = deps.roster ?? (() => deps.ctx?.get("agentPresets"));
	const guard = (req, res, method) => {
		if (!isLoopbackRequest(req)) {
			sendError(res, ERRORS["loopback-only"]);
			return false;
		}
		if (req.method !== method) {
			sendError(res, ERRORS["method-not-allowed"]);
			return false;
		}
		return true;
	};
	const readId = async (req, res) => {
		let body;
		try {
			body = await readJsonBody(req, { maxBytes: 16 * 1024 }) ?? {};
		} catch {
			sendError(res, ERRORS["invalid-body"]);
			return null;
		}
		if (!isPresetId(body.id)) {
			sendError(res, ERRORS["invalid-id"]);
			return null;
		}
		return {
			id: body.id,
			confirm: body.confirm === true
		};
	};
	const handleState = guardedHandler("preset-center/state", async (req, res) => {
		if (!guard(req, res, "GET")) return;
		const roster = rosterOf();
		const occupied = await occupiedIds(roster, root);
		const presets = listPresetStates(home).map((row) => rowPayload(home, row));
		send(res, 200, {
			ok: true,
			defaultId: defaultIdOf(roster),
			occupied: occupied ?? [],
			rosterAvailable: occupied !== null,
			presets
		});
	});
	const handleComposition = guardedHandler("preset-center/composition", async (req, res) => {
		if (!guard(req, res, "GET")) return;
		const id = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("id");
		if (!isPresetId(id)) {
			sendError(res, ERRORS["invalid-id"]);
			return;
		}
		const row = readPresetState(home, id);
		if (!row.installed && !row.enabled) {
			sendError(res, ERRORS["not-installed"]);
			return;
		}
		const file = join(row.dir, COMPOSITION_FILE);
		try {
			if (statSync(file).size > 262144) {
				send(res, 200, {
					ok: true,
					id,
					text: "",
					truncated: true,
					profile: profilePresetDir(row.dir)
				});
				return;
			}
			send(res, 200, {
				ok: true,
				id,
				text: readFileSync(file, "utf8"),
				truncated: false,
				profile: profilePresetDir(row.dir)
			});
		} catch {
			sendError(res, ERRORS["not-installed"], "composition file is missing");
		}
	});
	const handleEnable = guardedHandler("preset-center/enable", async (req, res) => {
		if (!guard(req, res, "POST")) return;
		const parsed = await readId(req, res);
		if (parsed === null) return;
		const { id, confirm } = parsed;
		const roster = rosterOf();
		const occupied = await occupiedIds(roster, root);
		if (occupied === null) {
			sendError(res, ERRORS["roster-unavailable"], "the agent-preset roster is unavailable");
			return;
		}
		if (occupied.includes(id)) {
			sendError(res, ERRORS["shadowed"], `preset id is already supplied by another root: ${id}`);
			return;
		}
		const state = readPresetState(home, id);
		if (!state.installed && !state.enabled) {
			sendError(res, ERRORS["not-installed"]);
			return;
		}
		if (!state.managed) {
			sendError(res, ERRORS["not-managed"]);
			return;
		}
		const profile = profilePresetDir(state.dir);
		if (needsConfirmation(profile) && !confirm) {
			send(res, 409, {
				ok: false,
				error: "confirmation-required",
				message: "preset carries executable content",
				profile
			});
			return;
		}
		try {
			enablePreset(home, id);
		} catch (err) {
			if (err instanceof PresetOperationError) {
				sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message);
				return;
			}
			throw err;
		}
		const broken = await brokenReason(roster, id);
		if (broken !== void 0) {
			try {
				disablePreset(home, id);
			} catch {}
			send(res, 409, {
				ok: false,
				error: "broken",
				message: broken
			});
			return;
		}
		send(res, 200, {
			ok: true,
			state: rowPayload(home, readPresetState(home, id))
		});
	});
	const handleDisable = guardedHandler("preset-center/disable", async (req, res) => {
		if (!guard(req, res, "POST")) return;
		const parsed = await readId(req, res);
		if (parsed === null) return;
		const { id } = parsed;
		const refusal = refusalForProtected(rosterOf(), id);
		if (refusal !== null) {
			sendError(res, ERRORS["default-preset"], refusal);
			return;
		}
		try {
			disablePreset(home, id);
		} catch (err) {
			if (err instanceof PresetOperationError) {
				sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message);
				return;
			}
			throw err;
		}
		send(res, 200, {
			ok: true,
			state: rowPayload(home, readPresetState(home, id))
		});
	});
	const handleUninstall = guardedHandler("preset-center/uninstall", async (req, res) => {
		if (!guard(req, res, "POST")) return;
		const parsed = await readId(req, res);
		if (parsed === null) return;
		const { id } = parsed;
		const refusal = refusalForProtected(rosterOf(), id);
		if (refusal !== null) {
			sendError(res, ERRORS["default-preset"], refusal);
			return;
		}
		try {
			uninstallPreset(home, id);
		} catch (err) {
			if (err instanceof PresetOperationError) {
				sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message);
				return;
			}
			throw err;
		}
		send(res, 200, {
			ok: true,
			id
		});
	});
	const route = (path, handler) => ({
		kind: "exact",
		path,
		handler: (req, res) => {
			handler(req, res);
		}
	});
	return [
		route(`${PRESET_CENTER_API_PREFIX}/state`, handleState),
		route(`${PRESET_CENTER_API_PREFIX}/composition`, handleComposition),
		route(`${PRESET_CENTER_API_PREFIX}/enable`, handleEnable),
		route(`${PRESET_CENTER_API_PREFIX}/disable`, handleDisable),
		route(`${PRESET_CENTER_API_PREFIX}/uninstall`, handleUninstall)
	];
}
/** Why a disable/uninstall of `id` is refused, or null when it is allowed. */
function refusalForProtected(roster, id) {
	const current = defaultIdOf(roster);
	if (current !== null && current === id) return `preset is the current default; change the default in Settings - Agent presets first: ${id}`;
	return null;
}
/** The roster's broken reason for `id`, or undefined when healthy or unknown. */
async function brokenReason(roster, id) {
	if (roster === void 0) return void 0;
	try {
		return (await roster.list()).find((entry) => entry.id === id)?.broken;
	} catch {
		return;
	}
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
const name = "ui-preset-center";
/** The gateway requires the host webserver; the roster is read opportunistically. */
const inject = ["webServer"];
/** Mount the preset-center gateway (once per process). */
const apply = mountOnce("@linxin666/dsh-client-ui-preset-center", applyImpl);
function applyImpl(ctx) {
	const routes = makePresetCenterRoutes({ ctx });
	for (const route of routes) try {
		ctx.effect(() => {
			const dispose = ctx.webServer.register(route);
			return () => {
				dispose();
			};
		}, `dsh-preset-center: route ${route.path}`);
	} catch {}
}
//#endregion
export { COMPOSITION_FILE, COMPOSITION_MAX_BYTES, ENABLED_DIR, LIBRARY_DIR, PRESET_CENTER_API_PREFIX, PRESET_ID_RE, PROVENANCE_FILENAME, PresetOperationError, apply, disablePreset, enablePreset, enabledRoot, inject, isPresetId, libraryRoot, listFiles, listPresetStates, makePresetCenterRoutes, moveDirectory, name, needsConfirmation, profileComposition, profilePresetDir, readPresetState, readProvenance, scanPresetIds, uninstallPreset, verifyProvenance };
