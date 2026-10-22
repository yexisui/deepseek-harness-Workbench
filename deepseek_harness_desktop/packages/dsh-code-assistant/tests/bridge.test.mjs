import test from 'node:test'
import assert from 'node:assert/strict'
import { ModelBridge, toHostRequest } from '../src/host/model-bridge.mjs'
import { engineConfig, engineEnvironment } from '../src/host/engine.mjs'

test('model bridge preserves messages, raw tool arguments and result correlation', () => {
  const request = toHostRequest({ messages: [
    { role: 'system', content: 'rules' }, { role: 'user', content: 'fix it' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call1', function: { name: 'read', arguments: '{"filePath":"a.js"}' } }] },
    { role: 'tool', tool_call_id: 'call1', content: 'file bytes' },
  ], tools: [{ function: { name: 'read', description: 'Read', parameters: { type: 'object' } } }], max_tokens: 500 }, 'provider/model/name', new AbortController().signal)
  assert.equal(request.model, 'model/name')
  assert.equal(request.messages[2].content[0].arguments, '{"filePath":"a.js"}')
  assert.equal(request.messages[3].content[0].toolCallId, 'call1')
  assert.equal(request.messages[3].content[0].content[0].text, 'file bytes')
  assert.equal(request.tools[0].name, 'read'); assert.equal(request.maxTokens, 500)
})
test('bridge authenticates, streams split calls once, retains usage and fails explicitly', async t => {
  let received
  const bridge = new ModelBridge({ token: 'test-token', route: () => 'local/fake', stream: async function* (request) {
    received = request
    yield { type: 'tool-call-delta', index: 2, id: 'call1', name: 'edit', argumentsDelta: '{"a":' }
    yield { type: 'tool-call-delta', index: 2, id: 'call1', argumentsDelta: '1}' }
    yield { type: 'block-end', index: 2, block: { type: 'tool-call', id: 'call1', name: 'edit', arguments: '{"a":1}' } }
    yield { type: 'usage', usage: { inputTokens: 3, cacheReadTokens: 2, outputTokens: 4 } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  } })
  const url = await bridge.start(); t.after(() => bridge.close())
  const unauthorized = await fetch(url + '/v1/chat/completions', { method: 'POST', body: '{}' }); assert.equal(unauthorized.status, 403)
  const response = await fetch(url + '/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify({ stream: true, model: 'selected', messages: [{ role: 'user', content: 'edit' }] }) })
  const chunks = (await response.text()).split('\n\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
  assert.equal(chunks.length, 3); assert.equal(chunks[0].choices[0].delta.tool_calls[0].index, 0)
  assert.equal(chunks[1].choices[0].delta.tool_calls[0].function.arguments, '1}')
  assert.equal(chunks[2].choices[0].finish_reason, 'tool_calls'); assert.equal(chunks[2].usage.prompt_tokens, 5)
  assert.equal(received.provider, 'local')
})
test('isolated engine environment excludes inherited model keys and external config', () => {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only'
  try { const env = engineEnvironment('C:/sandbox', {}, 'password'); assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1'); assert.equal(env.npm_config_offline, 'true') }
  finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous }
  const config = engineConfig('http://127.0.0.1:1234', 'random'); assert.deepEqual(config.enabled_providers, ['workbench']); assert.equal(config.share, 'disabled'); assert.equal(config.permission.webfetch, 'deny'); assert.equal(config.lsp, false)
})
