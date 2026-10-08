export type TranscriptSegment = { timingKind?: 'chunk'; id: string; start: number | null; end: number | null; speaker: string; text: string }
export function hasTiming(row: { start: number | null; end: number | null }): row is { start: number; end: number } {
  return typeof row.start === 'number' && typeof row.end === 'number' && Number.isFinite(row.start) && Number.isFinite(row.end) && row.start >= 0 && row.end > row.start
}
export const sourceKey = (item: { text: string; sourceIds: string[] }) => JSON.stringify([item.text, item.sourceIds])
const text = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const milliseconds = (v: unknown, scale: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v * scale : null
export function parseSegments(data: any): TranscriptSegment[] {
  const rows = Array.isArray(data?.segments) && data.segments.length ? data.segments : Array.isArray(data?.transcripts) ? data.transcripts.flatMap((p: any) => Array.isArray(p?.sentences) ? p.sentences : []) : Array.isArray(data?.words) ? data.words : []
  const segments: TranscriptSegment[] = rows.map((row: any, index: number) => {
    const start = row.begin_time !== undefined ? milliseconds(row.begin_time, 1) : milliseconds(row.start, 1000)
    const end = row.end_time !== undefined ? milliseconds(row.end_time, 1) : milliseconds(row.end, 1000)
    const valid = hasTiming({ start, end })
    return { id: `s${index + 1}`, start: valid ? start : null, end: valid ? end : null, speaker: text(row.speaker, 100) || (row.speaker_id == null ? '发言人' : `发言人 ${row.speaker_id}`), text: text(row.text ?? row.word, 100_000) }
  }).filter((row: TranscriptSegment) => row.text)
  return segments.length ? segments : text(data?.text, 100_000) ? [{ id: 's1', start: null, end: null, speaker: '发言人', text: text(data.text, 100_000) }] : []
}
