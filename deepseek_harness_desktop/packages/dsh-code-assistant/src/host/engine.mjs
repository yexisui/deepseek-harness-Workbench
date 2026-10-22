import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, cp, writeFile, readFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

export const ENGINE_VERSION = '1.19.3'

export async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

/** Only explicit host environment is inherited: no personal provider keys or OpenCode configuration. */
export function engineEnvironment(root, config, password) {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|SYSTEMDRIVE|PROGRAMFILES|PROGRAMFILES\(X86\)|COMMONPROGRAMFILES|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i.test(key)) env[key] = value
  }
  return { ...env, XDG_DATA_HOME: join(root, 'data'), XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'), XDG_STATE_HOME: join(root, 'state'),
    OPENCODE_TEST_HOME: join(root, 'home'), OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_SERVER_PASSWORD: password, OPENCODE_SERVER_USERNAME: 'workbench',
    OPENCODE_DISABLE_PROJECT_CONFIG: '1', OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
    OPENCODE_DISABLE_LSP_DOWNLOAD: '1', OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
    OPENCODE_DISABLE_CLAUDE_CODE: '1', OPENCODE_DISABLE_EMBEDDED_WEB_UI: '1',
    OPENCODE_DISABLE_TERMINAL_TITLE: '1', OPENCODE_PURE: '1', DO_NOT_TRACK: '1',
    npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false',
  }
}

export function engineConfig(bridgeUrl, token) {
  return {
    autoupdate: false, share: 'disabled', snapshot: false, enabled_providers: ['workbench'],
    model: 'workbench/selected', small_model: 'workbench/selected', default_agent: 'build',
    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh', agent: { build: { steps: 60 } },
    plugin: [], mcp: {}, lsp: false, formatter: false,
    provider: { workbench: { npm: '@ai-sdk/openai-compatible', name: '工作台模型',
      options: { baseURL: bridgeUrl + '/v1', apiKey: token },
      models: { selected: { name: '当前工作台模型', tool_call: true, limit: { context: 128000, output: 16384 } } } } },
    permission: { '*': 'deny', read: 'allow', list: 'allow', glob: 'allow', grep: 'allow',
      edit: 'ask', bash: 'ask', shell: 'ask', todowrite: 'allow', todoread: 'allow',
      external_directory: 'deny', webfetch: 'deny', websearch: 'deny', codesearch: 'deny',
      task: 'deny', question: 'deny', skill: 'deny' },
  }
}

export class OpenCodeEngine {
  constructor({ executable, assets, root, bridgeUrl, token }) {
    Object.assign(this, { executable, assets, root, bridgeUrl, token })
    this.password = randomBytes(32).toString('hex')
    this.child = null
    this.starting = null
    this.logs = ''
  }
  async start() {
    if (this.url && this.child?.exitCode === null) return
    if (this.starting) return this.starting
    this.starting = this.launch().finally(() => { this.starting = null })
    return this.starting
  }
  async launch() {
    await access(this.executable).catch(() => { throw new Error('代码引擎尚未安装，请使用工作台一键部署补齐 OpenCode') })
    for (const dir of ['home', 'data', 'cache', 'state', 'workspace', 'config/opencode']) await mkdir(join(this.root, dir), { recursive: true })
    // The upstream config loader prepares @opencode-ai/plugin even in pure mode.
    // Ship the real locked package tree; no fake package markers and no runtime install.
    const configDir = join(this.root, 'config/opencode')
    const marker = join(configDir, 'workbench-runtime-version')
    if (await readFile(marker, 'utf8').catch(() => '') !== ENGINE_VERSION) {
      await cp(join(this.assets, 'engine-runtime'), configDir, { recursive: true })
      await writeFile(marker, ENGINE_VERSION)
    }
    const port = await freePort()
    const child = spawn(this.executable, ['--pure', 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: join(this.root, 'workspace'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: engineEnvironment(this.root, engineConfig(this.bridgeUrl, this.token), this.password),
    })
    this.child = child
    this.url = `http://127.0.0.1:${port}`
    let failure
    child.on('error', error => { failure = error })
    const log = data => { this.logs = (this.logs + data.toString()).slice(-24000) }
    child.stdout.on('data', log); child.stderr.on('data', log)
    child.once('exit', () => { if (this.child === child) { this.child = null; this.url = null } })
    for (let i = 0; i < 240; i++) {
      if (failure || child.exitCode !== null) throw failure ?? new Error('代码引擎启动失败：' + this.logs.slice(-1500))
      try { const health = await this.request('/global/health', undefined, undefined, false, { signal: AbortSignal.timeout(1000) }); if (health.healthy || health.status === 'ok') return } catch {}
      await new Promise(resolve => setTimeout(resolve, 125))
    }
    await this.stop()
    throw new Error('代码引擎启动超时：' + this.logs.slice(-1000))
  }
  async request(path, body, cwd, start = true, options = {}) {
    if (start) await this.start()
    if (!this.url) throw new Error('代码引擎已停止')
    const url = new URL(path, this.url)
    if (cwd) url.searchParams.set('directory', cwd)
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: 'Basic ' + Buffer.from('workbench:' + this.password).toString('base64'), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`代码引擎 ${response.status}: ${text.slice(0, 1800)}`)
    return text ? JSON.parse(text) : null
  }
  async stop() {
    const child = this.child
    this.child = null; this.url = null
    if (!child || child.exitCode !== null) return
    if (process.platform === 'win32') {
      await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        killer.once('error', resolve); killer.once('exit', resolve)
      })
    } else child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve) }), new Promise(resolve => setTimeout(resolve, 3000))])
  }
}
