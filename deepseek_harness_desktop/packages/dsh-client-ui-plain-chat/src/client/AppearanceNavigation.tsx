import React, { Children, cloneElement, isValidElement, useEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import type { SettingsNavigation } from './role-ui-state.ts'
import styles from './AppearanceNavigation.module.css'

const appearanceIds = new Set(['skin-center', 'pet', 'dsh-workshop'])
type NodeProps = { children?: ReactNode; [key: string]: any }
type View = (props: any) => ReactNode

function AppearanceGroup({ items, label }: { items: ReactElement<NodeProps>[]; label: string }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const active = items.find(item => item.props['aria-current'] === 'true')?.key
  useEffect(() => { if (active && ref.current) ref.current.open = true }, [active])
  const baseClass = (items.find(item => !item.props['aria-current']) ?? items[0])?.props.className ?? ''
  return <details ref={ref} className={styles.group}>
    <summary className={`${baseClass} ${styles.heading}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.4a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z" /><circle cx="7.5" cy="11" r=".8" /><circle cx="10" cy="7.5" r=".8" /><circle cx="15" cy="7.5" r=".8" /></svg>
      <span>{label}</span><svg className={styles.chevron} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
    </summary>
    <div className={styles.children}>{items}</div>
  </details>
}

/** Only transform navigation elements. Keep original buttons, callbacks and page slots. */
function groupNavigation(node: ReactNode, label: string): ReactNode {
  if (!isValidElement<NodeProps>(node)) return node
  const children = Children.toArray(node.props.children)
  const items = children.filter((child): child is ReactElement<NodeProps> => isValidElement<NodeProps>(child)
    && child.type === 'button' && appearanceIds.has(String(child.key).replace(/^\.\$/, '')))
  if (items.length) {
    let inserted = false
    return cloneElement(node, {}, children.flatMap(child => {
      if (!items.includes(child as ReactElement<NodeProps>)) return [child]
      if (inserted) return []
      inserted = true
      return [<AppearanceGroup key="workbench-appearance" items={items} label={label} />]
    }))
  }
  return node.props.children === undefined ? node : cloneElement(node, {}, children.map(child => groupNavigation(child, label)))
}

/** SDK rc.2 compatibility seam: decorate the private panel's rendered navigation only. */
export function withAppearanceNavigation(Original: View, label: () => string, navigation?: SettingsNavigation): View {
  const panels = new Map<View, View>()
  const transform = (node: ReactNode): ReactNode => {
    if (!isValidElement<NodeProps>(node)) return node
    if (typeof node.type === 'function' && node.type.name === 'SettingsPanel') {
      const Panel = node.type as View
      if (!panels.has(Panel)) {
        // Calling the known function component here preserves its hooks in this wrapper.
        panels.set(Panel, function AppearanceSettingsPanel(props: any) { return groupNavigation(Panel(props), label()) })
      }
      return React.createElement(panels.get(Panel)!, { ...node.props, key: node.key })
    }
    return node.props.children === undefined ? node : cloneElement(node, {}, Children.map(node.props.children, transform))
  }
  const subscribe = navigation?.subscribe ?? (() => () => {})
  const snapshot = navigation?.getSnapshot ?? (() => 0)
  return function AppearanceSettingsRoot(props: any) {
    const request = useSyncExternalStore(subscribe, snapshot)
    const handled = useRef(0)
    const tree = Original(props)
    let panel: ReactElement<NodeProps> | undefined
    let trigger: ReactElement<NodeProps> | undefined
    const find = (node: ReactNode): void => {
      if (!isValidElement<NodeProps>(node)) return
      if (typeof node.type === 'function' && node.type.name === 'SettingsPanel') panel = node
      if (node.type === 'button' && node.props['aria-haspopup'] === 'dialog') trigger = node
      Children.forEach(node.props.children, find)
    }
    find(tree)
    useEffect(() => {
      if (request === 0 || request === handled.current) return
      if (panel) { panel.props.onSelect('agent-presets'); handled.current = request }
      else trigger?.props.onClick()
    }, [request, panel, trigger])
    return transform(tree)
  }
}
