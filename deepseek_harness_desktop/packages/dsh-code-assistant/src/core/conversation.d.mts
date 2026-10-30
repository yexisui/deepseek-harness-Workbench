export type QuestionSummary = { id: string; title: string; index: number; createdAt?: number; status: string; statusLabel: string }
export type ConversationRound = QuestionSummary & { messages: any[] }
export function toolResult(part: any): { command: boolean; exit: number | null; failed: boolean; status: string; label: string }
export function groupConversation(messages?: any[], taskStatus?: string): { rounds: ConversationRound[]; unassigned: any[] }
export function visibleConversation(task?: { messages?: any[]; status?: string; removedQuestionIds?: string[] } | null): { rounds: ConversationRound[]; unassigned: any[] }
export function questionSummaries(task: { messages?: any[]; status?: string; removedQuestionIds?: string[] }): QuestionSummary[]
