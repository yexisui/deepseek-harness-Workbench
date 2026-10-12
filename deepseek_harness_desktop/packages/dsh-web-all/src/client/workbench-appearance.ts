/** Shared presentation policy for the web, desktop and skin surfaces. */
export const BLANK_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/%3E'

export const WORKBENCH_APPEARANCE_CSS = `
[data-slot="sidebar"] button:has([class*="_brandIdentity"]),
[data-slot="sidebar"] [class*="_railMark"],
[data-slot="sidebar.brand.mark"],
[data-slot="sidebar.brand.name"],
[data-slot="conversation.hero.brand.mark"],
[class*="_fishHitbox"]:has([data-slot="conversation.hero.brand.mark"]),
[data-skin-chrome="titlebar-brand"],
[data-skin-chrome="composer-brand"] {
  display: none !important;
}
[data-slot="sidebar"] [class*="_logoRow"] {
  height: 36px !important;
  min-height: 36px !important;
  margin-bottom: 4px !important;
  padding-block: 0 !important;
}
[data-slot="sidebar"] [data-dsh-responsive-part="sidebar-toggle"] [class*="_panelIcon"] {
  display: inline !important;
}
`

/** Remove product chrome while keeping the selected conversation/skin title. */
export function workbenchTitle(title: string): string {
  return title
    .replace(/\s*(?:[—–·|:-]\s*)?DeepSeek[\s-]*Harness(?:\s+Desktop)?\s*$/i, '')
    .replace(/\s*·\s*(?:DeepSeek\s*在线|DSH)\s*$/i, '')
    .trim() || '工作台'
}

/** Keep head updates from the shell and skins free of product chrome. */
export function installWorkbenchAppearance(): () => void {
  const style = document.createElement('style')
  style.dataset.dshCompat = 'appearance'
  style.textContent = WORKBENCH_APPEARANCE_CSS
  document.head.appendChild(style)

  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.dataset.dshCompat = 'appearance'
  icon.href = BLANK_ICON
  document.head.appendChild(icon)
  const originals = new Map<HTMLLinkElement, string | null>()
  const sync = (): void => {
    const title = workbenchTitle(document.title)
    if (document.title !== title) document.title = title
    document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(link => {
      if (link === icon) return
      if (!originals.has(link)) originals.set(link, link.getAttribute('href'))
      if (link.getAttribute('href') !== BLANK_ICON) link.setAttribute('href', BLANK_ICON)
    })
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'rel'] })
  return () => {
    observer.disconnect()
    style.remove()
    icon.remove()
    for (const [link, href] of originals) {
      if (!link.isConnected || link.getAttribute('href') !== BLANK_ICON) continue
      if (href === null) link.removeAttribute('href')
      else link.setAttribute('href', href)
    }
  }
}
