export interface ClassificationResult {
  key: string
  name: string
  moduleId: string | null
  target: string
  reason: string
  status: 'applied' | 'unclassified' | 'skipped' | 'failed' | 'undone'
  appliedRevision?: number
}
export interface ClassificationReport {
  id: string
  model: string
  createdAt: string
  results: ClassificationResult[]
  undone?: boolean
}
export interface ClassificationJob {
  id: string
  phase: 'running' | 'done' | 'cancelled' | 'failed'
  total: number
  processed: number
  model: string
  error?: string
  report?: ClassificationReport
}
