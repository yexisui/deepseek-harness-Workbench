import { access, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** OpenCode 1.19.3's v2 plugin discovery does not honor every v1 disable flag.
 * Reject discoverable native configuration before opening a location; never rename user files.
 */
export async function assertIsolatedProject(directory) {
  let cursor = await realpath(directory)
  for (;;) {
    for (const name of ['.opencode', 'opencode.json', 'opencode.jsonc']) {
      const file = join(cursor, name)
      try { await access(file) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
      throw new Error('为保持离线与插件隔离，首版暂不打开含 OpenCode 原生配置的项目：' + file + '。请使用不含该配置的代码副本；原文件未改动。')
    }
    // Upstream project discovery stops at a Git worktree, including linked worktrees.
    try { await access(join(cursor, '.git')); return } catch (error) { if (error.code !== 'ENOENT') throw error }
    const parent = dirname(cursor)
    if (parent === cursor) return
    cursor = parent
  }
}
