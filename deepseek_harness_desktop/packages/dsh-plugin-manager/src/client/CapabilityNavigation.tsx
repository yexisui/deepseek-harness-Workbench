import { pendingNavigation, type WorkbenchLink } from './workbench-navigation.ts'
import React, { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'

/** rc.2 slot seam: select the inventory using its own tab callback, retaining SDK state. */
export function withCapabilityNavigation(Original: React.ComponentType<any>) {
  return function CapabilityPluginSection(props: any) {
    const [request, setRequest] = useState<WorkbenchLink|undefined>(()=>pendingNavigation('plugins')), handled = useRef<WorkbenchLink>()
    const tree = (Original as (props: any) => ReactNode)(props)
    let select: (() => void) | undefined
    const find = (node: ReactNode): void => {
      if (!isValidElement<any>(node)) return
      if (node.props.role === 'tab' && String(node.props.id).endsWith('-tab-all')) select = node.props.onClick
      Children.forEach(node.props.children, find)
    }
    find(tree)
    useEffect(() => {
      const listener = (event: Event) => { if ((event as CustomEvent).detail?.section === 'plugins') setRequest((event as CustomEvent).detail) }
      window.addEventListener('workbench-capability-link', listener)
      return () => window.removeEventListener('workbench-capability-link', listener)
    }, [])
    useEffect(() => {
      if (handled.current === request || !select || request?.section !== 'plugins') return
      handled.current = request; select()
    }, [request, select])
    return tree
  }
}
