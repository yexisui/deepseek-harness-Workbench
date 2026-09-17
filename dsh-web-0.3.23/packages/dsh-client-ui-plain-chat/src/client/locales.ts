export const zh = {
  placeholder: '输入消息，开始对话', send: '发送消息', sending: '正在准备会话…',
  mode: '普通聊天', workspace: '选择工作区（可选）', history: '聊天',
  hint: '直接提问或写作；处理项目文件时再选择工作区。',
  model: '使用设置中的默认模型，进入会话后可切换。',
  failed: '无法开始对话，内容已保留。请检查模型与连接后重试。',
  unavailable: '普通聊天未加载，请重启 DSH 后刷新页面。',
}
export const en: Record<keyof typeof zh, string> = {
  placeholder: 'Type a message to start chatting', send: 'Send message', sending: 'Preparing conversation…',
  mode: 'Chat', workspace: 'Choose workspace (optional)', history: 'Chats',
  hint: 'Ask questions or write. Choose a workspace for project files.',
  model: 'Uses your default model; you can change it in the conversation.',
  failed: 'Unable to start. Your draft is saved. Check your model and connection, then retry.',
  unavailable: 'Chat is not loaded. Restart DSH and refresh the page.',
}
export type ChatKey = keyof typeof zh
