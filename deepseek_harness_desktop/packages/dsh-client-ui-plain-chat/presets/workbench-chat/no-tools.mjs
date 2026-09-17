/** Conversation-only capability boundary, mounted inside this preset's scope. */
export const name = 'workbench-chat-no-tools'
export const inject = ['tools']

/**
 * Mask inherited capabilities and reject calls even if a later plugin registers
 * a tool in the same scope. The SDK owns both registrations' effect lifetimes.
 * @param {import('@deepseek-ai/cordis').Context & { tools: import('@deepseek-ai/dsh-tools').ToolRuntime }} ctx
 */
export function apply(ctx) {
  ctx.tools.restrict({ allow: [] })
  ctx.tools.guard(() => 'This conversation-only session cannot execute tools. Start a project session by choosing a workspace.')
}
