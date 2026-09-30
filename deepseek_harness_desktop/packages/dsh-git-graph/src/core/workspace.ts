/** Shared wire types for the developer workspace. No host imports. */
export type FileState = { path: string; oldPath?: string; index: string; worktree: string; conflict: boolean }
export type FileImage = { hash: string; size: number; text?: string; reason?: string }
export type WorkspaceImage = { root: string; at: string; fingerprint: string; files: Record<string, FileImage>; excluded: string[] }
export type WorkspaceState = { root: string; git: boolean; branch: string; head: string; index: string; fingerprint: string; files: FileState[]; operation: boolean }
export type FileView = { path: string; version: string; text: string; size: number; reason?: string }
export type WorkspaceDiff = { path: string; before: FileView; after: FileView; patch: string; label: string }
export type CommitPreview = { head: string; index: string; branch: string; files: string[]; patch: string }

export function parseFileStatus(raw: string): FileState[] {
  const records = raw.split('\0'), rows: FileState[] = []
  const conflicts = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])
  for (let i = 0; i < records.length; i++) {
    const row = records[i]!
    if (row.length < 4) continue
    const xy = row.slice(0, 2), path = row.slice(3)
    const oldPath = /[RC]/.test(xy) ? records[++i] : undefined
    rows.push({ path, ...(oldPath ? { oldPath } : {}), index: xy[0]!, worktree: xy[1]!, conflict: conflicts.has(xy) })
  }
  return rows
}

export function changedPaths(before: WorkspaceImage, after: WorkspaceImage): string[] {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
    .filter(name => before.files[name]?.hash !== after.files[name]?.hash).sort()
}

/** Bounded line diff used for private snapshots (they never become Git commits). */
export function lineDiff(before: string, after: string, name: string): string {
  if (before === after) return ''
  const a = before ? before.split('\n') : [], b = after ? after.split('\n') : []
  let start = 0, end = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  const aa = a.slice(start, a.length - end), bb = b.slice(start, b.length - end)
  const body: string[] = []
  if (aa.length * bb.length <= 500_000) {
    const width = bb.length + 1, grid = new Uint32Array((aa.length + 1) * width)
    for (let i = aa.length - 1; i >= 0; i--) for (let j = bb.length - 1; j >= 0; j--)
      grid[i * width + j] = aa[i] === bb[j] ? grid[(i + 1) * width + j + 1]! + 1 : Math.max(grid[(i + 1) * width + j]!, grid[i * width + j + 1]!)
    let i = 0, j = 0
    while (i < aa.length || j < bb.length) {
      if (i < aa.length && j < bb.length && aa[i] === bb[j]) { body.push(' ' + aa[i]); i++; j++ }
      else if (j < bb.length && (i === aa.length || grid[i * width + j + 1]! >= grid[(i + 1) * width + j]!)) body.push('+' + bb[j++])
      else body.push('-' + aa[i++])
    }
  } else body.push(...aa.map(line => '-' + line), ...bb.map(line => '+' + line))
  const lead = Math.min(start, 3), tail = Math.min(end, 3)
  return [`--- a/${name}`, `+++ b/${name}`, `@@ -${start - lead + 1},${aa.length + lead + tail} +${start - lead + 1},${bb.length + lead + tail} @@`,
    ...a.slice(start - lead, start).map(line => ' ' + line), ...body, ...a.slice(a.length - end, a.length - end + tail).map(line => ' ' + line)].join('\n')
}
