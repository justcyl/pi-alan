/**
 * types.ts — Research pipeline run types.
 */

/** Log entry types */
export type LogType = "progress" | "observation" | "issue" | "decision" | "output";

/** A single append-only log entry */
export interface LogEntry {
  at: string;       // ISO-8601 timestamp
  type: LogType;
  detail: string;
}

/** Run status */
export type RunStatus = "active" | "done" | "cancelled" | "superseded";

/** Full run structure (stored as .pipeline/runs/<slug>.yaml) */
export interface Run {
  created: string;
  description: string;
  checker: string;
  context?: string;
  status: RunStatus;
  blocked_by?: string[];
  result_of?: string[];
  log?: LogEntry[];
}
