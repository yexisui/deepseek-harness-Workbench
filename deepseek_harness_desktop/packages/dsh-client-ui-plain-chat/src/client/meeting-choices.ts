export type SelectionStep = 'mode' | 'audience' | 'focus' | 'audio'
export type MeetingMessage = { createdAt?: string; id: number; kind: 'intro' | 'user' | 'assistant' | 'upload' | 'transcript' | 'minutes'; text?: string; file?: string; choiceStep?: SelectionStep }
export const selectionLabels: Record<SelectionStep, string> = { mode: '生成方式', audience: '纪要用途', focus: '整理重点', audio: '录音' }
export const modeLabel = (mode: 'quick' | 'guided') => mode === 'quick' ? '快速生成' : '引导整理'
export const choiceMessage = (messages: MeetingMessage[], step: SelectionStep) => messages.filter(message => message.choiceStep === step).at(-1)

/** Older snapshots recorded choices as plain chat messages. Recover only workflow answers. */
export function recoverChoices(messages: MeetingMessage[], values: { mode: 'quick' | 'guided' | null; audience: string; focus: string }): MeetingMessage[] {
  let awaiting: SelectionStep | undefined
  const result = messages.map((message, index) => {
    if (message.kind === 'intro') awaiting = 'mode'
    if (message.kind === 'assistant') {
      awaiting = message.text?.startsWith('先选择') ? 'audience' : message.text === '这次希望重点突出什么？' ? 'focus' : undefined
    }
    if (message.kind === 'upload') return { ...message, choiceStep: 'audio' as const }
    if (message.kind !== 'user') return message
    const next = messages[index + 1]
    const following = next?.kind === 'assistant' ? next.text : undefined
    const inferred = following === '这次希望重点突出什么？' ? 'audience'
      : following?.startsWith('准备好了') ? 'focus'
      : ['快速生成', '引导整理'].includes(message.text ?? '') && (awaiting === 'mode' || following?.startsWith('先选择') || following?.startsWith('上传录音后')) ? 'mode'
      : awaiting === 'audience' || awaiting === 'focus' ? awaiting : undefined
    awaiting = undefined
    return message.choiceStep || !inferred ? message : { ...message, choiceStep: inferred as SelectionStep }
  })
  const steps = ['mode', 'audience', 'focus', 'audio'] as const
  let nextId = Math.max(0, ...result.map(message => message.id)) + 1
  for (const step of steps.slice(0, 3)) {
    const value = step === 'mode' ? values.mode && modeLabel(values.mode) : values[step as 'audience' | 'focus']
    if (!value) continue
    const existing = choiceMessage(result, step)
    if (existing) {
      // The previous toolbar could change values without updating the old answer bubble.
      if (existing.text !== value) result[result.indexOf(existing)] = { ...existing, text: value, createdAt: undefined }
      continue
    }
    const index = result.findIndex(message => message.choiceStep && steps.indexOf(message.choiceStep) > steps.indexOf(step) || ['upload', 'transcript', 'minutes'].includes(message.kind))
    const insertAt = index >= 0 ? index : result.at(-1)?.kind === 'assistant' ? result.length - 1 : result.length
    result.splice(insertAt, 0, { id: nextId++, kind: 'user', text: value, choiceStep: step })
  }
  return result
}
