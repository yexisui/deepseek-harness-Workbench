import { hasTiming, parseSegments } from '../core/meeting-timing.ts'
import type { Context } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import { InputError } from '../core/validation.ts'
import { config, type MeetingAsrConfig } from './meeting.ts'
import { speechSample } from './speech-sample.ts'

type Profile = { baseURL?: string; apiKeyEnv?: string; api?: string }
type Credentials = { resolve(ref: string): Promise<{ value: string; source: string } | undefined> }
type Choice = { id: string; name: string; provider: string; selectable: boolean; reason?: string }

/** Reads the same directory, settings and credential references as Models. */
export class ModelAccess {
  private checks = new Map<string, { fingerprint: string; at: string; text: string; timestamps: boolean; speakers: boolean }>()
  private checking = false
  constructor(private ctx: Context) {}
  private llm() { const service = this.ctx.get('llm'); if (!service) throw new InputError('模型服务尚未就绪', 503); return service }
  private profile(provider: string) {
    const llm = this.llm()
    const entry = llm.listConfigurableProviders().find(row => row.provider === provider)
    if (!entry || !llm.listProviders().some(row => row.id === provider)) throw new InputError('模型服务已停用或移除，请在模型模块中检查', 409)
    const settings = this.ctx.get('settings')
    if (!settings) throw new InputError('模型设置尚未就绪', 503)
    let value: unknown = settings.get(entry.settingsNs)
    for (const key of entry.settingsPath) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
    if (!value || typeof value !== 'object') throw new InputError('模型配置不可用', 409)
    const profile = value as Profile
    // Native DeepSeek resolves an omitted URL through launch environment, then
    // its built-in default. Match that adapter instead of requiring a UI override.
    if (entry.settingsNs === 'llm-deepseek') {
      const environment = this.ctx.get('launchEnvironment') as { get(name: string): { value: string } | undefined } | undefined
      const inherited = environment ? environment.get('DEEPSEEK_BASE_URL')?.value : process.env.DEEPSEEK_BASE_URL
      return { entry, value: { ...profile, baseURL: profile.baseURL ?? inherited ?? 'https://api.deepseek.com', apiKeyEnv: profile.apiKeyEnv ?? 'DEEPSEEK_API_KEY' } }
    }
    return { entry, value: profile }
  }
  private credentials() { return this.ctx.get('credentials') as unknown as Credentials }
  async reveal(provider: string) {
    const { value } = this.profile(provider)
    const ref = value.apiKeyEnv || provider.toUpperCase().replace(/-/g, '_') + '_API_KEY'
    const credential = await this.credentials().resolve(ref)
    if (!credential) throw new InputError('尚未保存 API Key', 409)
    if (credential.source !== 'file') throw new InputError('此 Key 来自环境配置，界面仅显示来源，不能查看其内容', 409)
    return { apiKey: credential.value }
  }
  metadata(modelRef: string, format: 'json' | 'verbose_json', maxMb: number): MeetingAsrConfig {
    const split = modelRef.indexOf('/')
    if (split < 1 || split === modelRef.length - 1) throw new InputError('请选择模型模块中的模型')
    const provider = modelRef.slice(0, split), model = modelRef.slice(split + 1)
    const { value } = this.profile(provider)
    if (!value.baseURL) throw new InputError('此服务未提供兼容转写地址，请在模型模块设置服务地址', 409)
    if (value.api && !['openai-completions', 'openai-responses'].includes(value.api)) throw new InputError('此模型服务尚未适配兼容音频转写协议', 409)
    const base = value.baseURL.replace(/\/+$/, '')
    const endpoint = base.endsWith('/audio/transcriptions') ? base : base + '/audio/transcriptions'
    config({ endpoint, model, format, maxMb, apiKey: '' })
    return { endpoint, model, apiKey: '', format, maxMb, modelRef }
  }
  async choices(): Promise<Choice[]> {
    const llm = this.llm(), rows: Choice[] = []
    for (const provider of llm.listProviders()) {
      const entry = llm.listConfigurableProviders().find(row => row.provider === provider.id)
      let models
      try { models = await llm.listModels(provider.id) } catch { continue }
      for (const model of models) {
        const id = provider.id + '/' + model.id
        let reason: string | undefined
        try { this.metadata(id, 'json', 25) } catch (error) { reason = error instanceof Error ? error.message : '尚未适配' }
        rows.push({ id, name: model.name || model.id, provider: entry?.displayName || provider.id, selectable: !reason, reason })
      }
    }
    return rows
  }
  async resolve(ref: string, format: 'json' | 'verbose_json', maxMb: number) {
    const settings = this.metadata(ref, format, maxMb)
    const provider = ref.slice(0, ref.indexOf('/')), model = ref.slice(ref.indexOf('/') + 1)
    if (!(await this.llm().listModels(provider)).some(row => row.id === model)) throw new InputError('所选模型已移除，请重新选择', 409)
    const { value } = this.profile(provider)
    const keyRef = value.apiKeyEnv || provider.toUpperCase().replace(/-/g, '_') + '_API_KEY'
    const credential = await this.credentials().resolve(keyRef)
    if (value.apiKeyEnv && !credential) throw new InputError('模型缺少 API Key，请到模型模块配置', 409)
    return { ...settings, apiKey: credential?.value || '' }
  }
  private fingerprint(value: MeetingAsrConfig) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
  async checked(ref: string, format: 'json' | 'verbose_json', maxMb: number) {
    const prior = this.checks.get(ref)
    if (!prior) return null
    try { if (prior.fingerprint !== this.fingerprint(await this.resolve(ref, format, maxMb))) { this.checks.delete(ref); return null } } catch { return null }
    const { fingerprint: _, ...safe } = prior
    return safe
  }
  async check(ref: string, format: 'json' | 'verbose_json', maxMb: number) {
    if (this.checking) throw new InputError('已有检测正在进行，请稍后重试', 409)
    this.checking = true
    this.checks.delete(ref)
    try {
      const value = await this.resolve(ref, format, maxMb)
      const form = new FormData()
      form.set('model', value.model); form.set('response_format', format)
      if (format === 'verbose_json') form.set('timestamp_granularities[]', 'segment')
      form.set('file', new Blob([Buffer.from(speechSample, 'base64')], { type: 'audio/wav' }), 'speech-check.wav')
      const response = await fetch(value.endpoint, { method: 'POST', redirect: 'error', headers: value.apiKey ? { Authorization: `Bearer ${value.apiKey}` } : {}, body: form, signal: AbortSignal.timeout(60_000) })
      if (!response.ok) throw new InputError(response.status === 401 || response.status === 403 ? '认证失败，请在模型模块检查 API Key 与访问权限' : response.status === 404 || response.status === 405 ? '服务未提供兼容的音频转写接口，请选择支持转写的模型' : `转写检测失败（HTTP ${response.status}），请检查模型、配额和响应格式`, 422)
      const data = await response.json() as { text?: string; segments?: { text?: string; start?: number; end?: number; speaker?: unknown; speaker_id?: unknown }[] }
      const text = (data.text || data.segments?.map(s => s.text || '').join(' ') || '').trim()
      if (!text) throw new InputError('接口可访问，但没有返回可用的转写文本', 422)
      // A generic JSON/text endpoint is not proof of speech recognition.
      if (!/hello|speech|recognition|test|语音|识别|测试/i.test(text)) throw new InputError('接口返回了文本，但与检测短句不符，未通过语音识别验证', 422)
      const result = { fingerprint: this.fingerprint(value), at: new Date().toISOString(), text: text.slice(0, 500), timestamps: parseSegments(data).some(hasTiming), speakers: Boolean(data.segments?.some(s => s.speaker !== undefined || s.speaker_id !== undefined)) }
      if (result.fingerprint !== this.fingerprint(await this.resolve(ref, format, maxMb))) throw new InputError('检测期间模型配置已变化，请重新检测', 409)
      this.checks.set(ref, result)
      const { fingerprint: _, ...safe } = result
      return safe
    } catch (error) {
      if (error instanceof InputError) throw error
      throw new InputError('检测未完成：连接失败、超时或响应格式不兼容，请检查模型设置', 422)
    } finally { this.checking = false }
  }
}
