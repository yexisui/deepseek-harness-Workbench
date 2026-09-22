import React, { useEffect, useId, useRef, useState } from 'react'
import type { RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import type { RoleIconSpec } from '../../../dsh-capabilities/src/core/appearance.ts'
import { capabilityClient } from './capability-client.ts'
import { appearanceStyle, RoleAppearanceIcon, roleAppearanceDefaults, roleAppearanceIconId, roleIconOptions } from './RoleAppearance.tsx'
import { appearancePalette, hexToHsl, hslToHex, normalizeHex, swatchInk } from './appearance-color.ts'
import { centeredImage, loadRoleIconFile, loadSavedRoleIcon, renderRoleIcon, type ImageAdjustment } from './appearance-image.ts'
import s from './RoleAppearanceEditor.module.css'

type Appearance = { color: string; icon?: RoleIconSpec }
type Props = { roleId?: string; value: RoleDefinition; initialAppearance: Appearance; onChange: (patch: Appearance) => void; onBusyChange?: (busy: boolean) => void }

export function RoleAppearanceEditor({ roleId, value, initialAppearance, onChange, onBusyChange }: Props) {
  const uid = useId(), [tab, setTab] = useState<'builtin' | 'png'>(value.icon?.kind === 'png' ? 'png' : 'builtin')
  const [hex, setHex] = useState(value.color), [source, setSource] = useState<HTMLImageElement | null>(null)
  const [adjustment, setAdjustment] = useState<ImageAdjustment>({ ...centeredImage }), [preview, setPreview] = useState('')
  const [dirty, setDirty] = useState(false), [working, setWorking] = useState<'read' | 'upload' | null>(null), [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null), generation = useRef(0), mounted = useRef(true)
  const current = useRef({ value, onChange, onBusyChange }); current.current = { value, onChange, onBusyChange }
  const lastColor = useRef(value.color), hue = useRef(hexToHsl(value.color))
  const invalidHex = normalizeHex(hex) === undefined, pending = !!working || dirty || invalidHex
  useEffect(() => {
    if (lastColor.current !== value.color) { lastColor.current = value.color; hue.current = hexToHsl(value.color); setHex(value.color) }
  }, [value.color])
  useEffect(() => { current.current.onBusyChange?.(pending) }, [pending])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current++; current.current.onBusyChange?.(false) }
  }, [])
  const color = normalizeHex(value.color) ?? '#78869f'
  const changeColor = (next: string, rebase = true) => {
    lastColor.current = next
    if (rebase) hue.current = hexToHsl(next)
    setHex(next); current.current.onChange({ color: next, icon: current.current.value.icon })
  }
  const discardImage = () => {
    generation.current++; setSource(null); setPreview(''); setDirty(false); setWorking(null); setError('')
    setAdjustment({ ...centeredImage }); if (fileInput.current) fileInput.current.value = ''
  }
  const reset = (appearance: Appearance) => {
    discardImage(); setTab(appearance.icon?.kind === 'png' ? 'png' : 'builtin')
    lastColor.current = appearance.color; hue.current = hexToHsl(appearance.color); setHex(appearance.color)
    onChange({ color: appearance.color, icon: appearance.icon })
  }
  const chooseIcon = (icon: RoleIconSpec) => { discardImage(); onChange({ color: current.current.value.color, icon }) }
  const loadImage = async (load: () => Promise<HTMLImageElement>) => {
    const token = ++generation.current
    setWorking('read'); setError(''); setSource(null); setPreview(''); setDirty(false)
    try {
      const image = await load()
      if (!mounted.current || generation.current !== token) return
      const result = renderRoleIcon(image, centeredImage)
      setSource(image); setAdjustment({ ...centeredImage }); setPreview(result); setDirty(true)
    } catch (reason) {
      if (mounted.current && generation.current === token) setError(reason instanceof Error ? reason.message : '图片处理失败，请重试。')
    } finally { if (mounted.current && generation.current === token) setWorking(null) }
  }
  const adjust = (next: ImageAdjustment) => {
    if (!source) return
    // Any new adjustment invalidates a pending upload without overwriting the saved icon.
    generation.current++; setWorking(null); setError('')
    try { setPreview(renderRoleIcon(source, next)); setAdjustment(next); setDirty(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '图片处理失败。') }
  }
  const applyImage = async () => {
    if (!preview || !dirty || working) return
    const token = ++generation.current, dataUrl = preview
    setWorking('upload'); setError('')
    try {
      const assetId = await capabilityClient.uploadRoleIcon(dataUrl)
      if (!mounted.current || generation.current !== token) return
      current.current.onChange({ color: current.current.value.color, icon: { kind: 'png', assetId } })
      setDirty(false)
    } catch (reason) { if (mounted.current && generation.current === token) setError(reason instanceof Error ? reason.message : '图片保存失败，请重试。') }
    finally { if (mounted.current && generation.current === token) setWorking(null) }
  }
  const changeTab = (next: 'builtin' | 'png') => { if (tab !== next) { discardImage(); setTab(next) } }
  const selectedIcon = roleAppearanceIconId(roleId, value.icon)
  const PreviewIcon = ({ className = '' }: { className?: string }) => preview && tab === 'png'
    ? <span className={`${s.localIcon} ${className}`} style={appearanceStyle(color)} data-role-appearance-icon="png" aria-hidden="true"><img src={preview} alt=""/></span>
    : <RoleAppearanceIcon roleId={roleId} icon={value.icon} color={color} className={className}/>
  const name = value.name.trim() || '未命名岗位助手'
  return <details className={s.editor}>
    <summary className={s.summary}><span className={s.chevron} aria-hidden="true">›</span><span>外观与配色</span><span className={s.summaryColor} style={{ background: color }} aria-label={`主题色 ${color}`}/><RoleAppearanceIcon roleId={roleId} icon={value.icon} color={color} className={s.summaryIcon}/></summary>
    <div className={s.layout}>
      <div className={s.controls}>
        <section className={s.colorSection} aria-label="岗位主题色">
          <div className={s.sectionHeading}><h4>主题颜色</h4><span>点选六角色块</span></div>
          <div className={s.honeycomb} role="group" aria-label="六角颜色盘">{appearancePalette.map((row, index) => <div key={index} className={s.hexRow}>{row.map(swatch => <button type="button" key={swatch} className={s.swatch} title={swatch.toUpperCase()} aria-label={`主题色 ${swatch}`} aria-pressed={color === swatch} style={{ background: swatch, color: swatchInk(swatch) }} onClick={() => changeColor(swatch)}>{color === swatch && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>}</button>)}</div>)}</div>
          <label className={s.rangeLabel}><span>明暗 <output>{Math.round(hexToHsl(color).lightness)}%</output></span><input type="range" min="0" max="100" step="1" aria-label="主题色明暗" value={Math.round(hexToHsl(color).lightness)} onChange={event => changeColor(hslToHex(hue.current.hue, hue.current.saturation, Number(event.target.value)), false)}/></label>
          <label className={s.hexLabel}><span>HEX</span><span className={s.colorSample} style={{ background: color }}/><input aria-label="HEX 色值" value={hex} maxLength={7} spellCheck={false} aria-invalid={invalidHex} onChange={event => {
            const text = event.target.value; setHex(text)
            const normalized = normalizeHex(text)
            if (normalized) { lastColor.current = normalized; hue.current = hexToHsl(normalized); onChange({ color: normalized, icon: current.current.value.icon }) }
          }} onBlur={() => setHex(color)}/></label>
          {invalidHex && <p className={s.help}>请输入 3 位或 6 位十六进制色值，例如 #4263BA。</p>}
        </section>
        <section className={s.iconSection} aria-label="岗位图标">
          <h4>岗位图标</h4>
          <div className={s.tabs} role="tablist" aria-label="图标来源"><button type="button" role="tab" id={`${uid}-builtin-tab`} aria-controls={`${uid}-builtin-panel`} aria-selected={tab === 'builtin'} onClick={() => changeTab('builtin')}>推荐图标</button><button type="button" role="tab" id={`${uid}-png-tab`} aria-controls={`${uid}-png-panel`} aria-selected={tab === 'png'} onClick={() => changeTab('png')}>自定义 PNG</button></div>
          {tab === 'builtin' ? <div id={`${uid}-builtin-panel`} role="tabpanel" aria-labelledby={`${uid}-builtin-tab`} className={s.iconGrid}>{roleIconOptions.map(option => <button type="button" key={option.id} title={option.name} aria-label={`图标：${option.name}`} aria-pressed={selectedIcon === option.id} onClick={() => chooseIcon({ kind: 'builtin', id: option.id })}><RoleAppearanceIcon icon={{ kind: 'builtin', id: option.id }} color={color}/><span>{option.name}</span>{selectedIcon === option.id && <span className={s.iconCheck} aria-hidden="true">✓</span>}</button>)}</div>
          : <div id={`${uid}-png-panel`} role="tabpanel" aria-labelledby={`${uid}-png-tab`} className={s.imagePanel}>
            <input ref={fileInput} type="file" accept="image/png,.png" aria-label="上传 PNG 图标" className={s.fileInput} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void loadImage(() => loadRoleIconFile(file)) }}/>
            <button type="button" className={s.uploadButton} onClick={() => fileInput.current?.click()}><span aria-hidden="true">＋</span>{source || value.icon?.kind === 'png' ? '重新选择 PNG' : '选择 PNG 图片'}</button>
            <p className={s.help}>支持透明背景，保留图片原色。最大 2 MB、4096 × 4096 像素。</p>
            {!source && value.icon?.kind === 'png' && <div className={s.imageActions}><button type="button" disabled={!!working} onClick={() => { const icon = current.current.value.icon; if (icon?.kind === 'png') void loadImage(() => loadSavedRoleIcon(icon.assetId)) }}>调整当前图片</button></div>}
            {source && <><div className={s.imageStage}><img src={preview} alt="PNG 图标调整预览"/></div><label className={s.rangeLabel}><span>缩放 <output>{Math.round(adjustment.scale * 100)}%</output></span><input aria-label="PNG 缩放" type="range" min="50" max="200" value={Math.round(adjustment.scale * 100)} onChange={event => adjust({ ...adjustment, scale: Number(event.target.value) / 100 })}/></label><label className={s.rangeLabel}><span>水平位置 <output>{adjustment.x}%</output></span><input aria-label="PNG 水平位置" type="range" min="-50" max="50" value={adjustment.x} onChange={event => adjust({ ...adjustment, x: Number(event.target.value) })}/></label><label className={s.rangeLabel}><span>垂直位置 <output>{adjustment.y}%</output></span><input aria-label="PNG 垂直位置" type="range" min="-50" max="50" value={adjustment.y} onChange={event => adjust({ ...adjustment, y: Number(event.target.value) })}/></label><div className={s.imageActions}><button type="button" onClick={() => adjust({ ...centeredImage })}>恢复居中</button><button type="button" className={s.applyButton} disabled={!dirty || !!working} onClick={() => void applyImage()}>{working === 'upload' ? '应用中…' : dirty ? '应用图片' : '已应用图片'}</button></div><p className={s.help}>{dirty ? '调整后点击“应用图片”，再保存岗位。' : '图片已加入岗位草稿，保存岗位后生效。'}</p></>}
            {working === 'read' && <p className={s.help} role="status">正在读取图片…</p>}
            {error && <p className={s.error} role="alert">{error}</p>}
          </div>}
        </section>
      </div>
      <aside className={s.previews} aria-label="外观即时预览" style={appearanceStyle(color)}>
        <div className={s.sectionHeading}><h4>即时预览</h4><span>三个入口同步展示</span></div>
        <span className={s.previewCaption}>岗位卡片</span><div className={s.previewCard}><div className={s.previewCardTop}><PreviewIcon/><span className={s.previewBadge}>岗位助手</span></div><strong>{name}</strong><p>{value.duties.trim() || '在这里预览助手的职责、图标和主题颜色。'}</p><div className={s.previewSelected}>✓ 已选定</div></div>
        <span className={s.previewCaption}>左上角入口</span><div className={s.toolbarPreview}><PreviewIcon className={s.smallIcon}/><strong>{name}</strong><span aria-hidden="true">›</span></div>
        <span className={s.previewCaption}>新对话选项</span><div className={s.choicePreview}><PreviewIcon className={s.smallIcon}/><strong>{name}</strong><span className={s.previewCheck} aria-hidden="true">✓</span></div>
        <p className={s.help}>文字随当前主题保持清晰，PNG 不随主题色染色。</p>
      </aside>
    </div>
    <div className={s.footer}><button type="button" onClick={() => reset(roleAppearanceDefaults(roleId))}>恢复默认外观</button><button type="button" onClick={() => reset(initialAppearance)}>撤销本次外观修改</button></div>
  </details>
}
