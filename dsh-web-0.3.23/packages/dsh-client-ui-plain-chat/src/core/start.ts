export const PRESET_ID = 'workbench-chat'

export interface StartPort {
  create(request: { sessionId: string; cwd: string; agentPreset: string }): Promise<{ ok: boolean; error?: { message?: string } }>
  adopt(request: { sessionId: string; cwd: string }): Promise<unknown>
  deliver(sessionId: string, text: string): void
}

/** A draft owns one id across uncertain retries; simultaneous sends share one attempt. */
export class ChatStart {
  private pending?: Promise<void>
  private id?: string
  private epoch = 0
  constructor(private readonly port: StartPort, private readonly cwd: string, private readonly mint: () => string) {}
  reset(): void { this.epoch++; this.id = undefined; this.pending = undefined }
  send(text: string): Promise<void> {
    if (this.pending) return this.pending
    if (!text.trim()) return Promise.resolve()
    const epoch = this.epoch
    const id = this.id ??= this.mint()
    const run = async () => {
      const result = await this.port.create({ sessionId: id, cwd: this.cwd, agentPreset: PRESET_ID })
      if (!result.ok) throw new Error(result.error?.message ?? 'Session creation failed')
      if (epoch !== this.epoch) return
      await this.port.adopt({ sessionId: id, cwd: this.cwd })
      if (epoch !== this.epoch) return
      this.port.deliver(id, text)
      this.id = undefined
    }
    const attempt = run().finally(() => { if (this.pending === attempt) this.pending = undefined })
    this.pending = attempt
    return attempt
  }
}
