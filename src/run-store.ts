/**
 * run-store.ts — YAML file-backed run store.
 *
 * Each run is a separate file: .pipeline/runs/<slug>.yaml
 * Immutable fields: created, description, checker
 * Mutable fields: status, context, blocked_by, result_of, log
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { Run, RunStatus, LogEntry, LogType } from "./types.js";

const RUNS_DIR = join(".pipeline", "runs");

function ensureDir(): void {
  if (!existsSync(RUNS_DIR)) {
    mkdirSync(RUNS_DIR, { recursive: true });
  }
}

function runPath(slug: string): string {
  return join(RUNS_DIR, `${slug}.yaml`);
}

/** Validate slug: kebab-case, no path traversal */
function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "slug must be kebab-case (lowercase alphanumeric + hyphens)";
  }
  if (slug.includes("..") || slug.includes("/")) {
    return "slug must not contain path separators";
  }
  return null;
}

export class RunStore {

  /** Create a new run. Returns error string or null on success. */
  create(slug: string, fields: {
    description: string;
    checker: string;
    context?: string;
    tags?: string[];
    blocked_by?: string[];
  }): { error?: string } {
    const slugErr = validateSlug(slug);
    if (slugErr) return { error: slugErr };

    ensureDir();
    const path = runPath(slug);
    if (existsSync(path)) {
      return { error: `run "${slug}" already exists` };
    }

    const run: Run = {
      created: new Date().toISOString(),
      description: fields.description,
      checker: fields.checker,
      ...(fields.context ? { context: fields.context } : {}),
      status: "active",
      ...(fields.tags && fields.tags.length > 0 ? { tags: fields.tags } : {}),
      ...(fields.blocked_by && fields.blocked_by.length > 0 ? { blocked_by: fields.blocked_by } : {}),
    };

    writeFileSync(path, YAML.stringify(run, { lineWidth: 0 }), "utf-8");
    return {};
  }

  /** List all runs. Returns slug + status + description (first line). */
  list(statusFilter?: RunStatus): { slug: string; status: RunStatus; description: string; blocked_by?: string[] }[] {
    ensureDir();
    const files = readdirSync(RUNS_DIR).filter(f => f.endsWith(".yaml"));
    const results: { slug: string; status: RunStatus; description: string; blocked_by?: string[] }[] = [];

    for (const file of files) {
      try {
        const raw = readFileSync(join(RUNS_DIR, file), "utf-8");
        const run = YAML.parse(raw) as Run;
        if (statusFilter && run.status !== statusFilter) continue;
        const slug = file.replace(/\.yaml$/, "");
        results.push({
          slug,
          status: run.status,
          description: run.description.split("\n")[0].trim(),
          ...(run.blocked_by && run.blocked_by.length > 0 ? { blocked_by: run.blocked_by } : {}),
        });
      } catch {
        // skip corrupt files
      }
    }

    return results;
  }

  /** Get full run by slug. */
  get(slug: string): { run?: Run; error?: string } {
    const slugErr = validateSlug(slug);
    if (slugErr) return { error: slugErr };

    const path = runPath(slug);
    if (!existsSync(path)) {
      return { error: `run "${slug}" not found` };
    }

    try {
      const raw = readFileSync(path, "utf-8");
      const run = YAML.parse(raw) as Run;
      return { run };
    } catch (e: any) {
      return { error: `failed to parse run: ${e.message}` };
    }
  }

  /** Update mutable fields: status, context, log (append), blocked_by (append), result_of (append). */
  update(slug: string, fields: {
    status?: RunStatus;
    context?: string;
    tags?: string[];
    log_entry?: { type: LogType; detail: string };
    add_blocked_by?: string[];
    add_result_of?: string[];
  }): { run?: Run; changes: string[]; warnings: string[]; error?: string } {
    const slugErr = validateSlug(slug);
    if (slugErr) return { error: slugErr, changes: [], warnings: [] };

    const path = runPath(slug);
    if (!existsSync(path)) {
      return { error: `run "${slug}" not found`, changes: [], warnings: [] };
    }

    let run: Run;
    try {
      run = YAML.parse(readFileSync(path, "utf-8")) as Run;
    } catch (e: any) {
      return { error: `failed to parse run: ${e.message}`, changes: [], warnings: [] };
    }

    const changes: string[] = [];
    const warnings: string[] = [];

    // Status change
    if (fields.status !== undefined && fields.status !== run.status) {
      run.status = fields.status;
      changes.push(`status → ${fields.status}`);
    }

    // Context update (replace)
    if (fields.context !== undefined) {
      run.context = fields.context;
      changes.push("context updated");
    }

    // Tags update (replace)
    if (fields.tags !== undefined) {
      run.tags = fields.tags;
      changes.push(`tags → [${fields.tags.join(", ")}]`);
    }

    // Append log entry
    if (fields.log_entry) {
      if (!run.log) run.log = [];
      const entry: LogEntry = {
        at: new Date().toISOString(),
        type: fields.log_entry.type,
        detail: fields.log_entry.detail,
      };
      run.log.push(entry);
      changes.push(`log += [${entry.type}] ${entry.detail.slice(0, 60)}`);
    }

    // Append blocked_by
    if (fields.add_blocked_by && fields.add_blocked_by.length > 0) {
      if (!run.blocked_by) run.blocked_by = [];
      for (const dep of fields.add_blocked_by) {
        if (run.blocked_by.includes(dep)) {
          warnings.push(`"${dep}" already in blocked_by`);
          continue;
        }
        const depSlug = dep.replace(/^runs\//, "");
        const depPath = runPath(depSlug);
        if (!existsSync(depPath)) {
          warnings.push(`"${dep}" does not exist (added anyway)`);
        }
        run.blocked_by.push(dep);
        changes.push(`blocked_by += ${dep}`);
      }
    }

    // Append result_of
    if (fields.add_result_of && fields.add_result_of.length > 0) {
      if (!run.result_of) run.result_of = [];
      for (const output of fields.add_result_of) {
        if (run.result_of.includes(output)) {
          warnings.push(`"${output}" already in result_of`);
          continue;
        }
        run.result_of.push(output);
        changes.push(`result_of += ${output}`);
      }
    }

    if (changes.length > 0) {
      writeFileSync(path, YAML.stringify(run, { lineWidth: 0 }), "utf-8");
    }

    return { run, changes, warnings };
  }

  /** Check blocked_by status for a run. Returns list of unresolved blockers. */
  checkBlockers(slug: string): { unresolved: string[]; resolved: string[]; missing: string[] } {
    const result = this.get(slug);
    if (!result.run || !result.run.blocked_by) {
      return { unresolved: [], resolved: [], missing: [] };
    }

    const unresolved: string[] = [];
    const resolved: string[] = [];
    const missing: string[] = [];

    for (const dep of result.run.blocked_by) {
      const depSlug = dep.replace(/^runs\//, "");
      const depResult = this.get(depSlug);
      if (!depResult.run) {
        missing.push(dep);
      } else if (depResult.run.status === "done") {
        resolved.push(dep);
      } else {
        unresolved.push(dep);
      }
    }

    return { unresolved, resolved, missing };
  }
}
