import React, { useEffect, useRef, useState } from 'react'
import type { Classification } from '../core/classification.ts'
import { moveCategory, type CategoryItem, type CategorySlot } from './category-order.ts'
import { InventoryIcon } from './InventoryIcon.tsx'
import css from './inventory-tree.module.css'

interface Props { value: Classification; onChange: (value: Classification) => void; onRemove: (id: string, group: boolean) => void; disabled?: boolean }
type Gesture = { item: CategoryItem; slot?: CategorySlot; name: string; pointer?: number; handle: HTMLElement; x: number; y: number; active: boolean }

export function CategoryEditor({ value, onChange, onRemove, disabled }: Props) {
  const root = useRef<HTMLDivElement>(null), latest = useRef({ value, onChange, disabled })
  latest.current = { value, onChange, disabled }
  const gesture = useRef<Gesture>(), [drag, setDrag] = useState<Gesture>(), [message, setMessage] = useState(''), [moving, setMoving] = useState('')
  const end = (commit: boolean) => {
    const g = gesture.current; gesture.current = undefined; setDrag(undefined)
    if (!g) return
    if (g.pointer !== undefined && g.handle.hasPointerCapture?.(g.pointer)) g.handle.releasePointerCapture(g.pointer)
    if (commit && g.active && g.slot && !latest.current.disabled) {
      latest.current.onChange(moveCategory(latest.current.value, g.item, g.slot)); setMessage(`${g.name}已移动，保存分类后生效`)
    } else setMessage('已取消移动')
    requestAnimationFrame(() => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-handle-id]') ?? []).find(el => el.dataset.handleId === g.item.id)?.focus())
  }
  const endRef = useRef(end); endRef.current = end
  useEffect(() => {
    let frame = 0, last: { x: number; y: number } | undefined
    const hit = (x: number, y: number): CategorySlot | undefined => {
      const g = gesture.current, el = document.elementFromPoint(x, y)
      if (!g || !el || !root.current?.contains(el)) return
      if (g.item.kind === 'group') {
        const group = el.closest<HTMLElement>('[data-category-group]')
        if (!group) return
        const groups = latest.current.value.groups, id = group.dataset.categoryGroup!, i = groups.findIndex(v => v.id === id)
        return { groupId: '', before: y < group.getBoundingClientRect().top + group.getBoundingClientRect().height / 2 ? id : groups[i + 1]?.id }
      }
      const group = el.closest<HTMLElement>('[data-category-group]'); if (!group) return
      const groupId = group.dataset.categoryGroup!, row = el.closest<HTMLElement>('[data-category-module]')
      if (!row) return { groupId }
      const modules = latest.current.value.modules.filter(m => m.groupId === groupId), i = modules.findIndex(m => m.id === row.dataset.categoryModule)
      return { groupId, before: y < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? modules[i]?.id : modules[i + 1]?.id }
    }
    const update = () => {
      const g = gesture.current; if (!g?.active || !last) return
      g.slot = hit(last.x, last.y); setDrag({ ...g, x: last.x, y: last.y })
      let scroll: HTMLElement | null = root.current
      while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement
      if (scroll) { const r = scroll.getBoundingClientRect(); const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom)
        if (last.x >= r.left && last.x <= r.right) { if (last.y < top + 40) scroll.scrollTop -= 10; else if (last.y > bottom - 40) scroll.scrollTop += 10 }
      }
      frame = requestAnimationFrame(update)
    }
    const move = (e: PointerEvent) => {
      const g = gesture.current; if (!g || g.pointer !== e.pointerId) return
      if (!g.active && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 7) return
      e.preventDefault(); last = { x: e.clientX, y: e.clientY }
      if (!g.active) { g.active = true; g.handle.setPointerCapture?.(e.pointerId); update() }
    }
    const up = (e: PointerEvent) => { if (gesture.current && gesture.current.pointer !== undefined && gesture.current.pointer === e.pointerId) { gesture.current.slot = hit(e.clientX, e.clientY); cancelAnimationFrame(frame); endRef.current(true) } }
    const cancel = () => { cancelAnimationFrame(frame); endRef.current(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && gesture.current) { e.preventDefault(); e.stopImmediatePropagation(); cancel() } }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', escape, true)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', escape, true); gesture.current = undefined }
  }, [])
  const handle = (item: CategoryItem, name: string) => <button type="button" className={css.dragHandle} disabled={disabled} data-handle-id={item.id} aria-label={'拖动排序：' + name} aria-pressed={drag?.item.id === item.id} title="拖动排序；空格开始，方向键调整，回车确认，Esc 取消" onPointerDown={e => {
    if (e.button !== 0) return; e.stopPropagation(); setMoving(''); gesture.current = { item, name, pointer: e.pointerId, handle: e.currentTarget, x: e.clientX, y: e.clientY, active: false }
  }} onKeyDown={e => {
    if ((e.key === ' ' || e.key === 'Enter') && !gesture.current) {
      e.preventDefault(); const groupId = item.kind === 'module' ? value.modules.find(m => m.id === item.id)!.groupId : ''
      const g = { item, name, handle: e.currentTarget, x: 0, y: 0, active: true, slot: { groupId, before: item.id } }
      gesture.current = g; setDrag(g); setMessage(`正在移动${name}，上下调整顺序，左右切换分组，回车确认`); return
    }
    const g = gesture.current; if (!g || g.pointer !== undefined) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); end(true); return }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    const preview = g.slot ? moveCategory(value, item, g.slot) : value
    if (item.kind === 'module' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const index = value.groups.findIndex(v => v.id === g.slot?.groupId), next = value.groups[index + (e.key === 'ArrowLeft' ? -1 : 1)]
      if (next) g.slot = { groupId: next.id }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const siblings = item.kind === 'group' ? preview.groups : preview.modules.filter(m => m.groupId === g.slot?.groupId)
      const i = siblings.findIndex(v => v.id === item.id), next = i + (e.key === 'ArrowUp' ? -1 : 1)
      if (next >= 0 && next < siblings.length) g.slot = { groupId: g.slot?.groupId ?? '', before: e.key === 'ArrowUp' ? siblings[next]?.id : siblings[next + 1]?.id }
    }
    setDrag({ ...g }); setMessage(`目标：${value.groups.find(v => v.id === g.slot?.groupId)?.name ?? '分组顺序'}，${g.slot?.before ? '插入到目标前' : '放到末尾'}`)
  }}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{[6,12,18].flatMap(y => [9,15].map(x => <circle key={x+','+y} cx={x} cy={y} r="1.5"/>))}</svg></button>
  const trash = (id: string, name: string, group: boolean) => <button type="button" className={css.categoryIcon} title={'删除'+name} aria-label={(group?'删除分组：':'删除模块：')+name} disabled={disabled || !!drag} onClick={() => onRemove(id, group)}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7"/></svg></button>
  const marker = (kind: CategoryItem['kind'], groupId: string, before?: string) => drag?.active && drag.item.kind === kind && drag.slot?.groupId === groupId && drag.slot?.before === before ? <div className={css.dropLine} aria-hidden="true"/> : null
  return <div ref={root} className={css.categoryList}>
    <p>拖动左侧手柄调整顺序，模块也可拖到其他分组。保存后生效。</p>
    <span className={css.srOnly} role="status">{message}</span>
    {value.groups.map(g => <React.Fragment key={g.id}>{marker('group','',g.id)}<div className={css.editGroup} data-category-group={g.id} data-dragging={drag?.active && drag.item.id === g.id} data-drop-target={drag?.item.kind === 'module' && drag.slot?.groupId === g.id}>
      <div className={css.categoryRow}>{handle({kind:'group',id:g.id},g.name)}<input aria-label="分组名称" disabled={disabled} value={g.name} onChange={e=>onChange({...value,groups:value.groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x)})}/><span className={css.count}>{value.modules.filter(m=>m.groupId===g.id).length}</span>{trash(g.id,g.name,true)}</div>
      <div className={css.categoryModules}>
        {value.modules.filter(m=>m.groupId===g.id).map(m=><React.Fragment key={m.id}>{marker('module',g.id,m.id)}<div className={css.categoryRow} data-category-module={m.id} data-dragging={drag?.active && drag.item.id===m.id}>{handle({kind:'module',id:m.id},m.name)}<input aria-label="模块名称" disabled={disabled} value={m.name} onChange={e=>onChange({...value,modules:value.modules.map(x=>x.id===m.id?{...x,name:e.target.value}:x)})}/><button type="button" className={css.categoryIcon} disabled={disabled || !!drag} aria-label={'移动到分组：'+m.name} title="移动到分组" aria-expanded={moving===m.id} onClick={()=>setMoving(moving===m.id?'':m.id)}>···</button>{trash(m.id,m.name,false)}</div>{moving===m.id&&<label className={css.moveMenu}>移动到分组 <select aria-label="模块所属分组" value={m.groupId} onChange={e=>{onChange(moveCategory(value,{kind:'module',id:m.id},{groupId:e.target.value}));setMoving('')}}>{value.groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}</React.Fragment>)}
        {marker('module',g.id)}
        {!value.modules.some(m=>m.groupId===g.id)&&<div className={css.emptyDrop}>拖动模块到这里</div>}
      </div>
      <button type="button" className={css.categoryAdd} disabled={disabled || !!drag} onClick={()=>onChange({...value,modules:[...value.modules,{id:'m-'+crypto.randomUUID(),name:'新模块',groupId:g.id}]})}><InventoryIcon name="plus"/>新增模块标签</button>
    </div></React.Fragment>)}
    {marker('group','')}
    <button type="button" className={css.categoryAdd} disabled={disabled || !!drag} onClick={()=>onChange({...value,groups:[...value.groups,{id:'g-'+crypto.randomUUID(),name:'新分组'}]})}><InventoryIcon name="plus"/>新增分组</button>
    {drag?.active&&drag.pointer!==undefined&&<div className={css.dragGhost} style={{left:drag.x+14,top:drag.y+12}}>{drag.name}<small>{drag.slot?'松开放置':'移入目标分组'}</small></div>}
  </div>
}
