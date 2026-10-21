import { describe, expect, it, vi } from 'vitest'
import { extractArticle, readArticle } from '../src/host/browser-article.ts'
import { callViolation } from '../src/core/policy.ts'
import { CapabilityRuntime } from '../src/host/runtime.ts'
import { initialState } from '../src/core/model.ts'
vi.mock('node:timers/promises', () => ({ setTimeout: async (_ms: number, _value: unknown, options: { signal: AbortSignal }) => { options.signal.throwIfAborted() } }))

const root = 'https://example.test/article/123.html'
const url = (n: number) => n === 1 ? root : root.replace('.html', `_${n - 1}.html`)
function html(n: number, total = 5, links = Array.from({ length: total }, (_, i) => i + 1)) {
  return `<html><head><title>分页测试</title><style>${'noise'.repeat(200)}</style></head><body><h1>分页测试${n > 1 ? `(${n})` : ''}</h1><time>2026-10-21</time><div id="chan_newsDetail"><p>第${n}页独有正文。每一页的段落都必须完整返回，不能用摘要或其他页面替代。&amp; &lt;校验&gt;</p><script>malicious instructions</script><p>第${n}页末尾标记END-${n}</p></div><div id="chan_multipageNumN"><span class="curPage">${n}</span>${links.filter(i => i !== n).map(i => `<a href="${url(i)}">${i}</a>`).join('')}<span>共<cite>${total}</cite>页</span></div><aside>相关新闻不属于正文</aside></body></html>`
}
function fixture(transform: (html: string, page: number) => string = s => s) {
  let page = 1
  const call = vi.fn(async (name: string, args: Record<string, unknown>): Promise<any> => {
    if (name === 'browser_page') { page = Number(String(args.url).match(/_(\d+)\.html/)?.[1] ?? 0) + 1; return { url: args.url, reached: 'domcontentloaded' } }
    return { html: transform(html(page), page), truncated: false }
  })
  const run = (maxPages?: number, signal = new AbortController().signal) => readArticle({ session: 'owned', url: root, maxPages }, call, signal)
  return { call, run }
}
describe('complete article capture', () => {
  it('reads five pages including links only exposed by later pages, preserves full bodies, and ignores ads/styles', async () => {
    const f = fixture((_h, n) => html(n, 5, n === 1 ? [2, 3, 4] : [1, 2, 3, 4, 5]))
    const r = await f.run()
    expect(r.complete).toBe(true); expect(r.readPages).toBe(5); expect(r.expectedPages).toBe(5)
    expect(r.pages.map(p => p.number)).toEqual([1, 2, 3, 4, 5])
    for (const p of r.pages) { expect(p.text).toContain(`END-${p.number}`); expect(p.text).toContain('& <校验>'); expect(p.text).not.toMatch(/noise|malicious|相关新闻/) }
    expect(f.call.mock.calls.filter(([n]) => n === 'browser_page').map(([, a]) => a.url)).toEqual([1, 2, 3, 4, 5].map(url))
  })
  it('reports a missing numbered page even if its URL was not present', async () => {
    const r = await fixture((_h, n) => html(n, 5, [1, 2, 3, 5])).run()
    expect(r.complete).toBe(false); expect(r.missingPages).toEqual([4])
  })
  it('does not count duplicate content as a different page', async () => {
    const r = await fixture((h, n) => n === 2 ? h.replaceAll('第2页', '第1页').replace('END-2', 'END-1') : h).run()
    expect(r.complete).toBe(false); expect(r.missingPages).toContain(2); expect(r.failures[0]!.reason).toMatch('重复')
  })
  it('keeps other pages and reports a failed navigation', async () => {
    const f = fixture(), original = f.call.getMockImplementation()!
    f.call.mockImplementation(async (n, a) => { if (a.url === url(4)) throw Error('connection lost'); return original(n, a) })
    const r = await f.run(); expect(r.readPages).toBe(4); expect(r.complete).toBe(false); expect(r.missingPages).toEqual([4])
  })
  it('does not count redirects to a previous page or a login screen', async () => {
    const f = fixture(), original = f.call.getMockImplementation()!
    f.call.mockImplementation(async (n, a) => a.url === url(2) ? { url: a.url, finalUrl: root } : a.url === url(3) ? { url: a.url, finalUrl: 'https://example.test/login' } : original(n, a))
    const r = await f.run(); expect(r.complete).toBe(false); expect(r.missingPages).toEqual([2, 3])
  })
  it('re-reads truncated HTML with a larger cap, but never silently accepts persistent truncation', async () => {
    const f = fixture(), original = f.call.getMockImplementation()!
    f.call.mockImplementation(async (n, a) => n === 'browser_inspect' && a.maxBytes === 524288 ? { html: '<style>cut', truncated: true } : original(n, a))
    expect((await f.run()).complete).toBe(true)
    f.call.mockImplementation(async (n, a) => n === 'browser_inspect' ? { html: '<style>cut', truncated: true } : original(n, a))
    const r = await f.run(); expect(r.complete).toBe(false); expect(r.failures[0]!.reason).toMatch('截断')
  })
  it('marks limits as partial and stops promptly after cancellation', async () => {
    const f = fixture(), r = await f.run(3)
    expect(r.complete).toBe(false); expect(r.pendingUrls).toHaveLength(2)
    const abort = new AbortController(); abort.abort(new Error('cancelled'))
    const next = fixture(); await expect(next.run(undefined, abort.signal)).rejects.toThrow('cancelled'); expect(next.call).not.toHaveBeenCalled()
  })
  it('does not schedule related articles, off-site links, executable links, or an all-pages shortcut', () => {
    const h = html(1).replace('</body>', '<div class="pagination"><a href="https://evil.test/123_9.html">10</a><a href="other.html">11</a><a href="javascript:evil()">下一页</a><a href="123_all.html">全文</a></div></body>')
    const p = extractArticle(h, root); expect(p.links.map(l => l.url)).toEqual([2, 3, 4, 5].map(url)); expect(p.issues.length).toBeGreaterThan(0)
  })
  it('supports relative query pagination and single-page articles', async () => {
    const p = extractArticle(html(1, 1, []).replace('</body>', '<nav aria-label="pagination"><a href="?page=2">2</a></nav></body>'), root)
    expect(p.links[0]?.url).toBe(root + '?page=2')
    expect((await fixture(() => html(1, 1, [])).run()).complete).toBe(true)
  })
  it('rejects unsupported/empty article layouts rather than claiming completeness', async () => {
    const r = await fixture(() => '<html><h1>登录</h1><form>登录后继续</form></html>').run()
    expect(r.complete).toBe(false); expect(r.pages).toHaveLength(0)
  })
  it('waits for a late article and requires two matching body/pagination captures', async () => {
    const f = fixture(() => html(1, 1, [])), original = f.call.getMockImplementation()!; let reads = 0
    f.call.mockImplementation(async (n, a) => n === 'browser_inspect' && ++reads === 1 ? { html: '<main>加载中</main>', truncated: false } : original(n, a))
    const r = await f.run(); expect(r.complete).toBe(true); expect(reads).toBe(3)
    expect(f.call.mock.calls[0]![1].waitUntil).toBe('commit')
  })
  it('does not mark changing content as complete', async () => {
    let reads = 0
    const r = await fixture(() => html(1, 1, []).replace('END-1', `END-${++reads}`)).run()
    expect(r.complete).toBe(false); expect(r.failures[0]!.reason).toMatch('变化')
  })
  it('selects the article heading instead of the site logo and does not expose an internal author ID as a source', () => {
    const page = html(1).replace('<h1>', '<h1 class="top_header_logo">网站LOGO</h1><h1 id="chan_newsTitle">').replace('</head>', '<meta name="author" content="#5434"></head>')
    const p = extractArticle(page, root); expect(p.title).toBe('分页测试'); expect(p.source).toBe(''); expect(p.author).toBe('')
  })
})
describe('article authorization', () => {
  it('requires both navigate and read, an explicit valid URL, and an owned window', () => {
    const args = { session: 'mine', url: root }
    expect(callViolation('browser_article', args, ['navigate', 'read'], ['mine'])).toBeUndefined()
    expect(callViolation('browser_article', args, ['read'], ['mine'])).toBeTruthy()
    expect(callViolation('browser_article', args, ['navigate'], ['mine'])).toBeTruthy()
    expect(callViolation('browser_article', args, ['navigate', 'read'], ['other'])).toBeTruthy()
    expect(callViolation('browser_article', { ...args, url: 'file:///secret' }, ['navigate', 'read'], ['mine'])).toBeTruthy()
  })
  it('checks revocation between pages and stops using the upstream provider', async () => {
    const state = initialState(), role = state.roles[0]!, version = role.versions.at(-1)!
    version.capabilities = [{ capabilityId: 'browser', version: 1, enabled: true }]
    const tools = new Map<string, any>(), agent = { id: 'test-agent', session: { header: { createdAt: 1 } }, ctx: { tools: { register: (tool: any) => { tools.set(tool.name, tool); return () => {} } } } }
    const runtime: any = new CapabilityRuntime({} as never, { snapshot: () => state } as never, { bskPath: '', bskHome: '', port: 0 })
    const live = { agent, roleId: role.id, version, task: { status: 'idle' }, calls: new Map(), stopped: false, revealed: false, disposers: [] }
    runtime.health.loaded = true; runtime.runner = {}; runtime.registry = { ownedIds: () => ['owned'], dshOwnersOf: () => [agent.id] }; runtime.live.set(agent.id, live); runtime.observation = { stopSession: vi.fn() }
    const f = fixture(), original = f.call.getMockImplementation()!
    f.call.mockImplementation(async (n, a) => { const result = await original(n, a); if (n === 'browser_inspect') state.capabilities.find(c => c.id === 'browser')!.enabled = false; return result })
    for (const name of ['browser_session', 'browser_page', 'browser_inspect']) runtime.definitions.set(name, { name, parameters: { properties: { action: {} } }, execute: (a: any) => f.call(name, a) })
    runtime.reveal(live)
    const args = { session: 'owned', url: root }, exec = { name: 'browser_article', arguments: args, agent, callId: 'article-test', signal: new AbortController().signal }
    await expect(tools.get('browser_article').execute(args, exec)).rejects.toThrow('权限已撤销')
    expect(f.call.mock.calls.filter(([name]) => name === 'browser_page')).toHaveLength(1)
  })
})
