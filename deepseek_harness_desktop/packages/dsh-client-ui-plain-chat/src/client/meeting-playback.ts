async function event(media: HTMLMediaElement, name: string, signal: AbortSignal, action?: () => void) {
  return new Promise<void>((resolve, reject) => {
    const done = (error?: Error) => { clearTimeout(timer); media.removeEventListener(name, ready); media.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); error ? reject(error) : resolve() }
    const ready = () => done()
    const failed = () => done(new Error('录音加载或定位失败，请重试'))
    const aborted = () => done(new Error('已取消定位'))
    const timer = setTimeout(() => done(new Error('录音加载或定位超时，请重试')), 15000)
    media.addEventListener(name, ready, { once: true }); media.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) { aborted(); return }
    try { action?.() } catch { failed() }
  })
}
export async function playAt(media: HTMLMediaElement, seconds: number, signal: AbortSignal) {
  if (media.readyState < 1) await event(media, 'loadedmetadata', signal)
  signal.throwIfAborted()
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(media.duration) || seconds >= media.duration) throw new Error('来源时间超出录音范围，无法准确定位')
  if (Math.abs(media.currentTime - seconds) > 0.05 || media.seeking) await event(media, 'seeked', signal, () => { media.currentTime = seconds })
  signal.throwIfAborted()
  try { await media.play() } catch { throw new Error('无法自动播放，请点击播放器播放按钮') }
}
