import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute$1, join as join$1 } from "node:path/posix";
//#region ../../shared/host/dsh-home.ts
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
//#region src/index.ts
const name = "workbench-plain-chat";
const inject = ["webServer"];
function escapeAttribute(value) {
	return value.replace(/[&<>"']/g, (char) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[char]);
}
/** Owns only this plugin's preset and its neutral data directory. */
function apply(ctx) {
	const home = dshHome();
	const chatRoot = join(dirname(home), "chat-data");
	mkdirSync(chatRoot, { recursive: true });
	const preset = join(home, ".agent-presets", "workbench-chat");
	mkdirSync(preset, { recursive: true });
	const source = fileURLToPath(new URL("../presets/workbench-chat/", import.meta.url));
	for (const filename of [
		"agent.cordis.yml",
		"preset.yml",
		"no-tools.mjs"
	]) copyFileSync(join(source, filename), join(preset, filename));
	ctx.effect(() => ctx.webServer.tapIndex((html) => html.replace("</head>", `<meta name="dsh-plain-chat-root" content="${escapeAttribute(chatRoot)}"></head>`)), "plain-chat: boot metadata");
}
//#endregion
export { apply, escapeAttribute, inject, name };
