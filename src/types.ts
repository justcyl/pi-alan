/**
 * types.ts — Research pipeline run types, mirroring TASK.md schema (renamed to Run).
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
export type RunStatus = "active" | "done" | "archived";

/** Full run structure (stored as .pipeline/runs/<slug>.yaml) */
export interface Run {
  created: string;
  goal: string;
  description?: string;
  checker: string;
  context?: string;
  status: RunStatus;
  links?: string[];
  blocked_by?: string[];
  log?: LogEntry[];
}
