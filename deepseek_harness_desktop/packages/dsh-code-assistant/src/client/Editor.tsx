import React, { useEffect, useRef, useState } from 'react'

let loading: Promise<any> | undefined
const base = '/api/capabilities/code-assistant/editor'
function loadMonaco(): Promise<any> {
  if (!loading) loading = new Promise((resolve, reject) => {
    const w = window as any
    if (w.monaco?.editor) return resolve(w.monaco)
    const script = document.createElement('script')
    script.src = base + '/vs/loader.js'
    script.onerror = () => { loading = undefined; reject(new Error('本地编辑器资源加载失败')) }
    script.onload = () => {
      w.MonacoEnvironment = { baseUrl: base + '/' }
      w.require.config({ paths: { vs: base + '/vs' } })
      w.require(['vs/editor/editor.main'], () => resolve(w.monaco), (error: Error) => { loading = undefined; reject(error) })
    }
    document.head.appendChild(script)
  })
  return loading
}
const language = (path: string) => ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', py: 'python', md: 'markdown', css: 'css', html: 'html', yml: 'yaml', yaml: 'yaml', sh: 'shell', ps1: 'powershell', sql: 'sql', cs: 'csharp', cpp: 'cpp', java: 'java', go: 'go', rs: 'rust' }[path.split('.').at(-1) ?? ''] || 'plaintext')
export function CodeEditor({ path, value, before, readOnly, onChange, onSelect }: { path: string; value: string; before?: string; readOnly?: boolean; onChange?: (text: string) => void; onSelect?: (text: string) => void }) {
  const element = useRef<HTMLDivElement>(null), handle = useRef<any>(null), listener = useRef({ onChange, onSelect }); listener.current = { onChange, onSelect }
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false, editor: any, original: any, modified: any, observer: MutationObserver
    void loadMonaco().then(monaco => {
      if (disposed || !element.current) return
      const theme = () => {
        const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number)
        monaco.editor.setTheme(bg && (bg[0]! + bg[1]! + bg[2]!) / 3 < 130 ? 'vs-dark' : 'vs')
      }
      theme(); observer = new MutationObserver(theme); observer.observe(document.documentElement, { attributes: true }); observer.observe(document.body, { attributes: true })
      const options = { automaticLayout: true, fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, readOnly: !!readOnly, padding: { top: 12 }, renderLineHighlight: 'gutter', wordWrap: 'off', tabSize: 2 }
      modified = monaco.editor.createModel(value, language(path))
      if (before !== undefined) { original = monaco.editor.createModel(before, language(path)); editor = monaco.editor.createDiffEditor(element.current, { ...options, readOnly: true, renderSideBySide: true, originalEditable: false }); editor.setModel({ original, modified }) }
      else { editor = monaco.editor.create(element.current, { ...options, model: modified }); editor.onDidChangeModelContent(() => listener.current.onChange?.(modified.getValue())) }
      const active = before === undefined ? editor : editor.getModifiedEditor()
      active.onDidChangeCursorSelection((event: any) => listener.current.onSelect?.(modified.getValueInRange(event.selection)))
      handle.current = { editor, modified, original }
    }).catch(error => { if (!disposed) setError(error.message) })
    return () => { disposed = true; handle.current = null; observer?.disconnect(); editor?.dispose(); original?.dispose(); modified?.dispose() }
  }, [path, before !== undefined])
  useEffect(() => { const h = handle.current; if (h && h.modified.getValue() !== value) h.modified.setValue(value); if (h?.original && before !== undefined && h.original.getValue() !== before) h.original.setValue(before); h?.editor.updateOptions({ readOnly: readOnly || before !== undefined }) }, [value, before, readOnly])
  return error ? <div><p role="alert">{error}</p><textarea aria-label="代码文本" value={value} readOnly={readOnly || before !== undefined} onChange={event => onChange?.(event.target.value)} style={{ width: '100%', height: '45vh', fontFamily: 'monospace' }} /></div> : <div ref={element} style={{ width: '100%', height: '100%', minHeight: 250 }} aria-label={before === undefined ? '代码编辑器' : '代码差异编辑器'} />
}
