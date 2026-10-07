// Injected into the upstream Models editor by the checked build patch.
function WorkbenchModelKeyInput(props) {
  const { savedProvider, savedKey, ...input } = props;
  const [visible, setVisible] = react.useState(false);
  const [saved, setSaved] = react.useState('');
  const [busy, setBusy] = react.useState(false);
  const [error, setError] = react.useState('');
  const generation = react.useRef(0);
  react.useEffect(() => {
    setVisible(false); setSaved(''); setError('');
    return () => { generation.current++; };
  }, [savedProvider]);
  async function toggle() {
    if (visible) { generation.current++; setVisible(false); setSaved(''); return; }
    if (input.value || !savedKey) { setVisible(true); return; }
    const version = ++generation.current;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/capabilities/models/reveal', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: savedProvider })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '无法查看已保存的 Key');
      if (version === generation.current) { setSaved(data.apiKey); setVisible(true); }
    } catch (cause) { if (version === generation.current) setError(cause instanceof Error ? cause.message : '查看失败'); }
    finally { if (version === generation.current) setBusy(false); }
  }
  return react.createElement('div', { style: { minWidth: 0 } },
    react.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
      react.createElement('input', { ...input, type: visible ? 'text' : 'password', autoComplete: 'off', spellCheck: false,
        value: input.value || (visible ? saved : ''), placeholder: savedKey ? '********' : input.placeholder,
        style: { flex: 1, minWidth: 0 }, onChange: event => { generation.current++; setSaved(''); setBusy(false); input.onChange(event); } }),
      react.createElement('button', { type: 'button', disabled: busy, onClick: toggle,
        title: visible ? '隐藏 API Key' : '显示 API Key', 'aria-label': visible ? '隐藏 API Key' : '显示 API Key', 'aria-pressed': visible,
        style: { display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, border: '1px solid currentColor', borderRadius: 8, background: 'transparent', color: 'inherit', cursor: 'pointer' } },
        react.createElement('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
          react.createElement('path', { d: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z' }),
          react.createElement('circle', { cx: 12, cy: 12, r: 2.5 }),
          visible ? null : react.createElement('path', { d: 'M3 21 21 3' })))),
    error ? react.createElement('p', { role: 'alert', style: { color: 'var(--color-danger, #bf4040)', overflowWrap: 'anywhere' } }, error) : null);
}
