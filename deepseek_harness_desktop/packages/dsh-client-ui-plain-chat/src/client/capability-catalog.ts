import type { ChatKey } from './locales.ts'
import type { AssistantRole } from './role-catalog.ts'

export type Capability = 'browser' | 'documents' | 'sheets' | 'knowledge' | 'files' | 'mail'
export type Category = 'all' | 'web' | 'office' | 'data'
export type Item = { id: Capability; name: ChatKey; description: ChatKey; category: Category; provider: string; color: string }
// Demonstration data only. This editor intentionally has no host, storage or tool API dependency.
export const catalog: Item[] = [
  { id: 'browser', name: 'capBrowser', description: 'capBrowserDesc', category: 'web', provider: 'BrowserSkill', color: '#5275df' },
  { id: 'documents', name: 'capDocuments', description: 'capDocumentsDesc', category: 'office', provider: 'Documents', color: '#9870d4' },
  { id: 'sheets', name: 'capSheets', description: 'capSheetsDesc', category: 'office', provider: 'Spreadsheets', color: '#299c80' },
  { id: 'knowledge', name: 'capKnowledge', description: 'capKnowledgeDesc', category: 'data', provider: 'Knowledge', color: '#cc9439' },
  { id: 'files', name: 'capFiles', description: 'capFilesDesc', category: 'data', provider: 'Files', color: '#c27955' },
  { id: 'mail', name: 'capMail', description: 'capMailDesc', category: 'office', provider: 'Mail', color: '#ca698b' },
]
export const initial: Record<AssistantRole | 'create', Capability[]> = {
  create: [], analyst: ['documents', 'knowledge'], marketing: ['browser', 'documents'], manager: ['documents', 'sheets'], developer: ['browser', 'files'],
}
export const dragType = 'application/x-dsh-capability-preview'
export type Options = { enabled: boolean; browser: string; access: string; sites: string; read: boolean; fill: boolean; submit: boolean; confirm: boolean; location: string }
export const defaults = (): Options => ({ enabled: true, browser: 'Edge', access: 'specific', sites: '', read: true, fill: true, submit: false, confirm: true, location: '' })
