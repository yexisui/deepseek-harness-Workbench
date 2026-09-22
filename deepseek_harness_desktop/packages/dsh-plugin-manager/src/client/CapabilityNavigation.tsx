import React, { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'

/** rc.2 slot seam: select the inventory using its own tab callback, retaining SDK state. */
export function withCapabilityNavigation(Original: React.ComponentType<any>) {
  return function CapabilityPluginSection(props: any) {
    const [request, setRequest] = useState(0), handled = useRef(-1)
    const tree = (Original as (props: any) => ReactNode)(props)
    let select: (() => void) | undefined
    const find = (node: ReactNode): void => {
      if (!isValidElement<any>(node)) return
      if (node.props.role === 'tab' && String(node.props.id).endsWith('-tab-all')) select = node.props.onClick
      Children.forEach(node.props.children, find)
    }
    find(tree)
    useEffect(() => {
      const listener = (event: Event) => { if ((event as CustomEvent).detail?.section === 'plugins') setRequest(value => value + 1) }
      window.addEventListener('workbench-capability-link', listener)
      return () => window.removeEventListener('workbench-capability-link', listener)
    }, [])
    useEffect(() => {
      let link: any
      try { link = JSON.parse(sessionStorage.getItem('workbench-capability-link') ?? 'null') } catch { return }
      if (handled.current === request || !select || link?.section !== 'plugins' || !link.moduleName) return
      handled.current = request; select()
    }, [request, select])
    return tree
  }
}
