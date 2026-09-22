import React, { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useCapabilityPanels, type PanelSide } from './useCapabilityPanels.ts'
import { useCapabilityDrag } from './useCapabilityDrag.ts'
import s from './Capabilities.module.css'

export type WorkbenchItem = { id: string; name: string; subtitle: string; disabled?: boolean }
export function CapabilityGlyph() { return <span className={s.icon} style={{ '--cap-color': '#4F73E8' } as React.CSSProperties} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></span> }

/** Reuses the tested resize/drag hooks and the established compact row design. */
export function ManagedWorkbench({ library, attached, selected, onSelect, onAdd, onRemove, form, inspector, title, libraryTitle, onManage }: {
  library: WorkbenchItem[]; attached: WorkbenchItem[]; selected: string | null; onSelect: (id: string) => void; onAdd: (id: string) => void; onRemove: (id: string) => void;
  form: ReactNode; inspector: ReactNode; title: string; libraryTitle: string; onManage?: () => void;
}) {
  const panels = useCapabilityPanels(attached.length > 0), prefix = useId()
  const [query, setQuery] = useState(''), [feedback, setFeedback] = useState<{ id: string; sequence: number; duplicate: boolean } | null>(null)
  const cards = useRef(new Map<string, HTMLDivElement>())
  const add = (id: string) => { const duplicate = attached.some(a => a.id === id); onAdd(id); setFeedback(old => ({ id, duplicate, sequence: (old?.sequence ?? 0) + 1 })) }
  const drag = useCapabilityDrag<string>(add)
  useLayoutEffect(() => {
    if (!feedback) return
    const row = cards.current.get(feedback.id); if (!row) return
    row.scrollIntoView?.({ block: 'nearest' })
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = row.animate?.(reduced || feedback.duplicate ? [{ opacity: .65 }, { opacity: 1 }] : [{ transform: 'translateY(-4px) scale(.98)' }, { transform: 'translateY(2px) scale(1.015)', offset: .4 }, { transform: 'translateY(-1px) scale(.995)', offset: .7 }, { transform: 'none' }], { duration: reduced ? 150 : 340, easing: 'ease-out' })
    return () => animation?.cancel()
  }, [feedback])
  const configure = (id: string) => { onSelect(id); panels.open('right') }
  const rail = (side: PanelSide) => {
    const open = side === 'left' ? panels.leftOpen : panels.rightOpen
    const label = `${open ? '收起' : '展开'}${side === 'left' ? libraryTitle : '设置'}`
    return <div role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-controls={`${prefix}-${side}`} aria-valuemin={0} aria-valuemax={side === 'left' ? 360 : 420} aria-valuenow={Math.round(open ? side === 'left' ? panels.leftWidth : panels.rightWidth : 0)} title={`${label} · 拖动调整宽度，双击恢复`}
      className={`${s.rail} ${side === 'left' ? s.leftRail : s.rightRail} ${open ? '' : s.railCollapsed} ${panels.resizing === side && panels.willCollapse ? s.collapseReady : ''}`} {...panels.railEvents(side)}><span className={s.railHandle} aria-hidden="true"><span>▥</span><span className={s.railArrow}>{(side === 'left') === open ? '‹' : '›'}</span><span className={s.railGrip}/></span></div>
  }
  return <>
    <div className={s.banner}><span className={s.bannerDot}/>保存草稿可继续编辑；发布版本后可由岗位使用。移除配件不会卸载共享插件。</div>
    <div ref={panels.root} style={panels.style} className={`${s.workbench} ${panels.compact ? s.compact : ''} ${panels.resizing ? s.resizing : ''}`}>
      <section id={`${prefix}-left`} hidden={!panels.leftOpen} className={s.library} aria-label={libraryTitle}>
        <div className={s.columnHeading}><div><h3>{libraryTitle}</h3>{onManage && <button type="button" className={s.manageLink} onClick={onManage}>管理能力 ↗</button>}</div><button type="button" className={s.collapseButton} onClick={() => panels.close('left')} aria-label="收起左栏">‹</button></div>
        <label className={s.search}><input placeholder="搜索名称或组件" aria-label="搜索配件" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <div className={s.catalog}>{library.filter(i => `${i.name} ${i.subtitle}`.toLowerCase().includes(query.toLowerCase())).map(item => <article className={`${s.catalogCard} ${selected === item.id ? s.catalogSelected : ''}`} key={item.id} onPointerDown={e => !item.disabled && drag.start(item.id, e)} onClickCapture={drag.click}>
          <button type="button" className={s.catalogInspect} title={item.name} onClick={() => configure(item.id)}><CapabilityGlyph/><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></button><button data-capability-add type="button" className={s.quickAdd} disabled={item.disabled || attached.some(a => a.id === item.id)} aria-label={`添加 ${item.name}`} onClick={() => add(item.id)}>{attached.some(a => a.id === item.id) ? '✓' : '＋'}</button><span className={s.grip} aria-hidden="true">⠿</span>
        </article>)}</div><p className={s.libraryNote}>仅列出已适配的组件和已发布的能力</p>
      </section>{rail('left')}
      <section className={s.canvas} aria-label={title}><div className={s.columnHeading}><h3>{title}</h3><span className={s.step}>01</span></div>{form}
        <div className={`${s.columnHeading} ${s.attachedHeading}`}><h3>已添加的配件 <span className={s.count}>{attached.length}</span></h3><span className={s.step}>02</span></div>
        <div ref={drag.zone} aria-label="拖入配件" className={`${s.dropZone} ${drag.drag ? s.dragReady : ''} ${drag.over ? s.dragOver : ''}`}>
          {attached.map(item => <div key={item.id} ref={node => { if (node) cards.current.set(item.id, node); else cards.current.delete(item.id) }} className={`${s.attachedCard} ${selected === item.id ? s.attachedSelected : ''}`} data-attached-capability={item.id}>
            <button type="button" className={s.attachedSelect} onClick={() => configure(item.id)}><CapabilityGlyph/><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></button><button type="button" className={s.remove} aria-label={`移除 ${item.name}`} onClick={() => onRemove(item.id)}>×</button>
          </div>)}<div className={`${s.dropHint} ${attached.length ? s.dropCompact : ''}`}><span>＋</span><strong>拖入配件，或点击左侧加号</strong></div>
        </div>
      </section>{rail('right')}
      <aside id={`${prefix}-right`} hidden={!panels.rightOpen} className={s.inspector} aria-label="配件设置"><div className={s.inspectorHeader}><h3>配件设置</h3><button type="button" className={s.collapseButton} onClick={() => panels.close('right')} aria-label="收起右栏">›</button></div>{inspector}</aside>
    </div>
    {drag.drag && <div className={s.dragGhost} aria-hidden="true" style={{ left: drag.drag.x + 12, top: drag.drag.y + 12 }}>{library.find(i => i.id === drag.drag!.id)?.name}</div>}
    <span className={s.srOnly} role="status">{feedback ? `${feedback.duplicate ? '已添加' : '添加成功'}：${library.find(i => i.id === feedback.id)?.name}` : ''}</span>
  </>
}
