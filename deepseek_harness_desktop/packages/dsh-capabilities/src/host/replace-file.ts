import { rename } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

/** Atomic replacement can briefly fail while Windows readers or scanners hold a handle. */
export async function replaceFile(source: string, target: string) {
  for (let attempt = 0; ; attempt++) {
    try { await rename(source, target); return }
    catch (error) {
      if (attempt === 5 || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
      await delay(20 * 2 ** attempt)
    }
  }
}
