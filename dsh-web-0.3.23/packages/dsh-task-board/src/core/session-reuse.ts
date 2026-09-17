/**
 * Session-reuse rule (issue #1419): decides which task runs continue in the
 * previous execution's conversation. Pure, so the fail-closed conditions stay
 * unit-testable without a gateway.
 */
import type { TaskRecord } from './tasks.ts'

/**
 * Pick the session a new execution of this task may continue in, or undefined
 * to mint a fresh conversation. Reuse requires ALL of:
 * - the task opted in (`reuseSession === true`);
 * - the task's newest execution carries a session id and has settled (an open
 *   execution would have made the ledger refuse the run in the first place);
 * - the roster is known and that session is present and idle.
 *
 * An unknown roster (session/list unavailable) never reuses: minting a fresh
 * conversation is always safe, prompting into a session we cannot see is not.
 * @param task - the task about to run.
 * @param idleSessionIds - ids the last roster saw as present and not running;
 *   undefined when that roster is unknown.
 * @returns the session id to continue in, or undefined for a fresh session.
 */
export function reusableSessionId(
  task: TaskRecord,
  idleSessionIds: ReadonlySet<string> | undefined,
): string | undefined {
  if (task.reuseSession !== true || idleSessionIds === undefined) return undefined
  const last = task.executions[task.executions.length - 1]
  if (last === undefined || last.sessionId === undefined || last.endedAt === undefined) return undefined
  return idleSessionIds.has(last.sessionId) ? last.sessionId : undefined
}
