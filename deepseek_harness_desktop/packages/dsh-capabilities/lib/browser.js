//#region src/browser.ts
const name = "workbench-browser-provider";
const inject = ["capabilities"];
/** Separately manageable provider; unloading it leaves capability definitions intact. */
async function apply(ctx) {
	const runtime = ctx.capabilities;
	await runtime.loadProvider();
	ctx.effect(() => () => runtime.unloadProvider(), "capabilities: BrowserSkill provider");
}
//#endregion
export { apply, inject, name };
