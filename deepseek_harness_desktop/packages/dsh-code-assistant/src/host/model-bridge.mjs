import { createServer } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'

function plainContent(content) {
  if (typeof content === 'string') return content
  if (content == null) return ''
  if (!Array.isArray(content) || content.some(part => part.type !== 'text')) throw new Error('代码助手首版只接受文本和工具结果')
  return content.map(part => part.text).join('\n')
}

/** Convert every message and tool call, retaining call ids and raw argument JSON. */
export function toHostRequest(body, route, signal) {
  const slash = route.indexOf('/')
  if (slash < 1 || slash === route.length - 1) throw new Error('请在工作台选择或配置模型')
  if (!Array.isArray(body.messages)) throw new Error('模型消息格式无效')
  const messages = body.messages.map(message => {
    const id = randomUUID()
    if (message.role === 'tool') return { id, role: 'user', source: { kind: 'tool', callId: message.tool_call_id },
      content: [{ type: 'tool-result', toolCallId: message.tool_call_id, content: [{ type: 'text', text: plainContent(message.content) }] }] }
    const content = []
    if (message.reasoning_content) content.push({ type: 'reasoning', text: message.reasoning_content })
    const text = plainContent(message.content)
    if (text) content.push({ type: 'text', text })
    for (const call of message.tool_calls ?? []) content.push({ type: 'tool-call', id: call.id, name: call.function.name, arguments: call.function.arguments })
    if (!['system', 'developer', 'user', 'assistant'].includes(message.role)) throw new Error('模型消息角色无效')
    return { id, role: message.role === 'developer' ? 'system' : message.role, content,
      source: message.role === 'assistant' ? { kind: 'model', provider: route.slice(0, slash), model: route.slice(slash + 1) } : { kind: 'user' } }
  })
  return { provider: route.slice(0, slash), model: route.slice(slash + 1), messages,
    ...(body.tools?.length ? { tools: body.tools.map(tool => ({ name: tool.function.name, description: tool.function.description ?? '', parameters: tool.function.parameters })) } : {}),
    ...(typeof body.temperature === 'number' ? { temperature: body.temperature } : {}),
    ...(typeof (body.max_tokens ?? body.max_completion_tokens) === 'number' ? { maxTokens: body.max_tokens ?? body.max_completion_tokens } : {}),
    ...(body.stop ? { stop: Array.isArray(body.stop) ? body.stop : [body.stop] } : {}), signal }
}

export class ModelBridge {
  constructor({ token, stream, route }) { Object.assign(this, { token, stream, route }); this.controllers = new Set() }
  async start() {
    this.server = createServer((req, res) => { void this.handle(req, res) })
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve) })
    return `http://127.0.0.1:${this.server.address().port}`
  }
  async handle(req, res) {
    const controller = new AbortController(); this.controllers.add(controller)
    res.on('close', () => { if (!res.writableEnded) controller.abort() })
    const sendError = error => {
      if (res.writableEnded || res.destroyed) return
      if (res.headersSent) res.end('data: ' + JSON.stringify({ error: { message: error.message } }) + '\n\n')
      else { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: error.message } })) }
    }
    try {
      const received = Buffer.from(req.headers.authorization ?? ''), expected = Buffer.from('Bearer ' + this.token)
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions' || received.length !== expected.length || !timingSafeEqual(received, expected)) {
        res.writeHead(403); res.end(); return
      }
      const chunks = []; let size = 0
      for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error('模型上下文过大'); chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      const request = toHostRequest(body, this.route(), controller.signal)
      const id = 'chatcmpl-' + randomUUID(), created = Math.floor(Date.now() / 1000)
      const indices = new Map(), seen = new Set(), calls = []; let text = '', reasoning = '', usage, finish = 'stop'
      const emit = (delta, finish_reason = null) => {
        if (!body.stream) return
        if (!res.headersSent) res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
        res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created, model: body.model, choices: [{ index: 0, delta, finish_reason }], ...(finish_reason && usage ? { usage } : {}) }) + '\n\n')
      }
      for await (const chunk of this.stream(request)) {
        if (controller.signal.aborted) throw new Error('模型请求已停止')
        if (chunk.type === 'text-delta') { seen.add(chunk.index); text += chunk.text; emit({ content: chunk.text }) }
        if (chunk.type === 'reasoning-delta') { seen.add(chunk.index); reasoning += chunk.text; emit({ reasoning_content: chunk.text }) }
        if (chunk.type === 'tool-call-delta') {
          const first = !indices.has(chunk.index)
          if (first) { indices.set(chunk.index, indices.size); calls.push({ id: chunk.id, type: 'function', function: { name: chunk.name ?? '', arguments: '' } }) }
          const index = indices.get(chunk.index), call = calls[index]
          if (chunk.name) call.function.name = chunk.name
          call.function.arguments += chunk.argumentsDelta ?? ''
          seen.add(chunk.index)
          emit({ tool_calls: [{ index, ...(first ? { id: chunk.id, type: 'function' } : {}), function: { ...(chunk.name ? { name: chunk.name } : {}), arguments: chunk.argumentsDelta ?? '' } }] })
        }
        if (chunk.type === 'block-end' && !seen.has(chunk.index)) {
          const block = chunk.block
          if (block.type === 'text') { text += block.text; emit({ content: block.text }) }
          if (block.type === 'tool-call') { const index = calls.length; const call = { id: block.id, type: 'function', function: { name: block.name, arguments: block.arguments } }; calls.push(call); emit({ tool_calls: [{ index, ...call }] }) }
        }
        if (chunk.type === 'usage') { const u = chunk.usage, input = u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0); usage = { prompt_tokens: input, completion_tokens: u.outputTokens, total_tokens: u.totalTokens ?? input + u.outputTokens } }
        if (chunk.type === 'finish') {
          if (['error', 'aborted'].includes(chunk.reason.kind)) throw new Error(chunk.reason.failure?.message ?? '工作台模型调用失败')
          finish = chunk.reason.kind === 'tool-calls' ? 'tool_calls' : chunk.reason.kind === 'max-tokens' ? 'length' : 'stop'
        }
      }
      if (calls.length && finish === 'stop') finish = 'tool_calls'
      if (body.stream) { emit({}, finish); res.end('data: [DONE]\n\n') }
      else { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id, object: 'chat.completion', created, model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: text || null, ...(reasoning ? { reasoning_content: reasoning } : {}), ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: finish }], usage })) }
    } catch (error) { sendError(error) } finally { this.controllers.delete(controller) }
  }
  abort() { for (const controller of this.controllers) controller.abort() }
  async close() { this.abort(); if (this.server) { this.server.closeAllConnections(); await new Promise(resolve => this.server.close(resolve)) } }
}
