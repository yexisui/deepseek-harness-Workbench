/** A read-only projection of OpenCode messages. Never migrate or rewrite the conversation. */
export function toolResult(part) {
  const state = part?.state || {}, raw = state.metadata?.exit ?? state.metadata?.exitCode
  const exit = typeof raw === 'number' && Number.isFinite(raw) ? raw : typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : null
  const command = ['bash', 'shell'].includes(part?.tool)
  const failed = state.status === 'error' || (command && exit !== null && exit !== 0)
  return { command, exit, failed, status: failed ? 'failed' : state.status === 'completed' ? 'done' : 'running', label: failed ? '执行失败' : state.status === 'completed' ? '已完成' : state.status === 'pending' ? '等待执行' : '正在执行' }
}

export function groupConversation(messages = [], taskStatus = 'idle') {
  const list = Array.isArray(messages) ? messages : [], byId = new Map(list.map(m => [m.info?.id, m]))
  const rounds = [], owners = new Map(), users = new Map(), unassigned = []
  list.forEach((message, i) => {
    if (message.info?.role !== 'user' || message.parts?.some(p => p.type === 'compaction')) return
    const id = message.info.id || 'legacy-question-' + i
    const title = (message.parts || []).filter(p => p.type === 'text' && !p.synthetic).map(p => p.text || '').join('\n').trim() || '附件问题'
    const round = { id, title, index: rounds.length + 1, createdAt: message.info.time?.created, messages: [message], status: 'idle', statusLabel: '等待回复' }
    rounds.push(round); owners.set(id, round); users.set(message, round)
  })
  let previous = null
  for (const message of list) {
    if (users.has(message)) { previous = users.get(message); continue }
    let owner = null, parent = message.info?.parentID, seen = new Set()
    // Explicit parent links take precedence, including late tool/assistant messages.
    if (parent) {
      while (parent && !seen.has(parent)) { seen.add(parent); if (owners.has(parent)) { owner = owners.get(parent); break } parent = byId.get(parent)?.info?.parentID }
    } else owner = previous
    if (owner) owner.messages.push(message)
    else unassigned.push(message)
  }
  for (const round of rounds) {
    const replies = round.messages.filter(m => m.info?.role === 'assistant')
    const failed = round.messages.some(m => m.info?.error || (m.parts || []).some(p => p.type === 'tool' && toolResult(p).failed))
    const latest = round === rounds.at(-1)
    if (latest && taskStatus === 'running') { round.status = 'running'; round.statusLabel = '正在处理' }
    else if (latest && ['failed', 'stopped', 'interrupted'].includes(taskStatus)) { round.status = taskStatus; round.statusLabel = { failed: '执行失败', stopped: '已停止', interrupted: '已中断' }[taskStatus] }
    else if (failed) { round.status = 'failed'; round.statusLabel = '含失败记录' }
    else if (replies.some(m => m.info?.time?.completed || m.info?.finish === 'stop')) { round.status = 'done'; round.statusLabel = '已回答' }
    else if (replies.length) { round.status = 'idle'; round.statusLabel = '已有回复' }
  }
  return { rounds, unassigned }
}

export function visibleConversation(task) {
  const grouped = groupConversation(task?.messages, task?.status)
  const removed = new Set(task?.removedQuestionIds || [])
  return { ...grouped, rounds: grouped.rounds.filter(q => !removed.has(q.id)).map((q, i) => ({ ...q, index: i + 1 })) }
}

export function questionSummaries(task) {
  return visibleConversation(task).rounds.map(({ messages, ...question }) => question)
}
