/** Print an escaped document without requiring a popup window in desktop shells. */
export function printDocument(html: string): void {
  const frame = document.createElement('iframe')
  frame.title = '打印文档'
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1100px;border:0'
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
  const cleanup = () => { if (cleanupTimer) clearTimeout(cleanupTimer); frame.remove() }
  frame.onload = () => {
    const target = frame.contentWindow
    if (!target) { cleanup(); return }
    target.addEventListener('afterprint', cleanup, { once: true })
    // Retain the document while the native dialog reads it; bound orphaned frames.
    cleanupTimer = setTimeout(cleanup, 10 * 60_000)
    target.focus()
    target.print()
  }
  frame.srcdoc = html
  document.body.append(frame)
}
