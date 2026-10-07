import { afterEach, expect, it, vi } from 'vitest'
import { ModelAccess } from '../src/host/model-access.ts'
function setup() {
  const state = { active: true, models: [{ id: 'speech', name: 'Speech' }], profile: { baseURL: 'https://example.test/v1', apiKeyEnv: 'TEST_KEY', api: 'openai-completions' }, credential: { value: 'private-test-key', source: 'file' } }
  const services = { llm: { listProviders: () => state.active ? [{ id: 'gateway' }] : [], listConfigurableProviders: () => [{ provider: 'gateway', settingsNs: 'llm-pi-ai', settingsPath: ['providers','gateway'], displayName: 'Gateway' }], listModels: async () => state.models }, settings: { get: () => ({ providers: { gateway: state.profile } }) }, credentials: { resolve: async () => state.credential } }
  const access = new ModelAccess({ get: (name: keyof typeof services) => services[name] } as never)
  return { access, state }
}
afterEach(() => vi.unstubAllGlobals())
it('uses managed endpoint and latest credentials; never returns secrets in catalog', async () => {
  const { access, state } = setup()
  expect(await access.choices()).toEqual([{ id: 'gateway/speech', name: 'Speech', provider: 'Gateway', selectable: true, reason: undefined }])
  expect((await access.resolve('gateway/speech','json',25)).endpoint).toBe('https://example.test/v1/audio/transcriptions')
  state.credential.value = 'rotated'
  expect((await access.resolve('gateway/speech','json',25)).apiKey).toBe('rotated')
  state.models = []
  await expect(access.resolve('gateway/speech','json',25)).rejects.toThrow('移除')
  state.active = false
  expect(() => access.metadata('gateway/speech','json',25)).toThrow('停用')
})
it('reveals only an explicitly addressed saved credential', async () => {
  const { access, state } = setup()
  expect(await access.reveal('gateway')).toEqual({ apiKey: 'private-test-key' })
  state.credential.source = 'env'
  await expect(access.reveal('gateway')).rejects.toThrow('环境')
  await expect(access.reveal('arbitrary')).rejects.toThrow('移除')
})
it('actually posts audio; separates timestamp support and invalidates tests after credential changes', async () => {
  const { access, state } = setup()
  const fetcher = vi.fn(async (_url, init) => {
    expect(init.body.get('file').size).toBeGreaterThan(1000)
    expect(init.body.get('model')).toBe('speech')
    expect(init.redirect).toBe('error')
    return new Response(JSON.stringify({ text: 'Hello. This is a speech recognition test.' }))
  })
  vi.stubGlobal('fetch', fetcher)
  const result = await access.check('gateway/speech','json',25)
  expect(result.timestamps).toBe(false)
  expect(result.speakers).toBe(false)
  expect(JSON.stringify(result)).not.toContain('private-test-key')
  expect(await access.checked('gateway/speech','json',25)).not.toBeNull()
  state.credential.value = 'rotated'
  expect(await access.checked('gateway/speech','json',25)).toBeNull()
})
it('does not accept arbitrary text or echo upstream credential errors', async () => {
  const { access } = setup()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'unknown' }))))
  await expect(access.check('gateway/speech','json',25)).rejects.toThrow('不符')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('private-test-key', { status: 401 })))
  await expect(access.check('gateway/speech','json',25)).rejects.toThrow('认证')
  expect(await access.checked('gateway/speech','json',25)).toBeNull()
})

it('resolves native DeepSeek defaults, launch environment and explicit overrides in adapter order', async () => {
  let profile: Record<string,string> = {}
  let inherited: string | undefined
  let requestedRef = ''
  const services = {
    llm: { listProviders: () => [{id:'deepseek-official'}], listConfigurableProviders: () => [{provider:'deepseek-official',settingsNs:'llm-deepseek',settingsPath:[],displayName:'DeepSeek'}], listModels:async()=>[{id:'deepseek-flash',name:'Flash'}] },
    settings: { get: () => profile },
    launchEnvironment: { get: () => inherited === undefined ? undefined : {value:inherited} },
    credentials: { resolve: async (ref: string) => { requestedRef=ref; return {value:'test-only',source:'file'} } },
  }
  const access = new ModelAccess({get:(name:keyof typeof services)=>services[name]} as never)
  expect((await access.choices())[0]?.selectable).toBe(true)
  expect((await access.resolve('deepseek-official/deepseek-flash','json',25)).endpoint).toBe('https://api.deepseek.com/audio/transcriptions')
  expect(requestedRef).toBe('DEEPSEEK_API_KEY')
  inherited='https://gateway.example/v1'
  expect(access.metadata('deepseek-official/deepseek-flash','json',25).endpoint).toBe('https://gateway.example/v1/audio/transcriptions')
  profile={baseURL:'https://override.example/v1',apiKeyEnv:'CUSTOM_KEY'}
  expect((await access.resolve('deepseek-official/deepseek-flash','json',25)).endpoint).toBe('https://override.example/v1/audio/transcriptions')
  expect(requestedRef).toBe('CUSTOM_KEY')
})
