//#region src/policy.ts
const name = "workbench-role-policy";
const inject = ["tools"];
/** Presets fail closed if the manager is unavailable, including tools registered later. */
function apply(ctx) {
	ctx.tools.restrict({ allow: [] });
	ctx.tools.presentAs("native");
	ctx.tools.guard((exec) => {
		const runtime = ctx.get("capabilities");
		return runtime ? runtime.authorize(exec) : "能力服务已停用；此岗位暂时不能执行工具。";
	});
}
//#endregion
export { apply, inject, name };
