'use strict'

// Input/output use seconds. The host performs audio I/O and keeps credentials private.
exports.execute = async ({ action, input }) => {
  if (action !== 'plan-audio-segments') throw new Error('Unknown action')
  const duration = Number(input?.duration)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('需要有效录音时长（秒）')
  const pauses = (Array.isArray(input.silences) ? input.silences : [])
    .filter(p => Number.isFinite(p.start) && Number.isFinite(p.end) && p.end > p.start)
    .map(p => (p.start + p.end) / 2).filter(t => t > 0 && t < duration)
  const segments = []
  let start = 0
  while (start < duration) {
    let end = duration
    if (duration - start > 30) {
      const candidates = pauses.filter(t => t >= start + 15 && t <= start + 30)
      end = candidates.sort((a, b) => Math.abs(a - start - 22) - Math.abs(b - start - 22))[0] ?? start + 25
    }
    segments.push({ start, end })
    start = end
  }
  return { timingKind: 'chunk', segments }
}
