export type ExecutionStatus = 'running' | 'waiting' | 'done' | 'review' | 'failed' | 'stopped' | 'interrupted'
export type ExecutionEvent = { id: string; seq: number; key: string; title: string; status: ExecutionStatus; startedAt: string; updatedAt: string; detail?: string; model?: string; current?: number; total?: number }
export type ExecutionRecord = {
  schema: 1; id: string; taskId: string; operation: string; input: string; inputKind: 'user' | 'operation'; startedAt: string; finishedAt?: string;
  status: ExecutionStatus; summary?: string; model?: string; roleVersion?: number; mode?: string; events: ExecutionEvent[]; seq: number;
  jev?: { enabled: boolean; revision: number; runId: string }; result?: { text: string; kind: string }; warning?: string;
}
export type ExecutionPage = { items: ExecutionRecord[]; total: number; nextOffset?: number }
