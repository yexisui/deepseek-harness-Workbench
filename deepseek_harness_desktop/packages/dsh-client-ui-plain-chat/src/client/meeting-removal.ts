/** Keep the conversation reachable until its server deletion is confirmed. */
export async function removeMeetingConversation(jobId: string, title: string, removeLocal: () => void, confirm = (message: string) => window.confirm(message)) {
  if (!confirm(`移除“${title}”？将停止正在处理的任务，并永久删除此会议的录音、转写和纪要，无法撤销。`)) return false
  const response = await fetch(`/api/capabilities/meeting/job/${encodeURIComponent(jobId)}`, { method: 'DELETE', credentials: 'same-origin' })
  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `会议移除失败（${response.status}），原入口已保留`)
  }
  removeLocal()
  return true
}
