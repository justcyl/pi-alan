/**
 * pi-run — Research pipeline run management extension for pi.
 *
 * Tools:
 *   RunCreate  — Create a new run (.pipeline/runs/<slug>.yaml)
 *   RunList    — List runs with optional status filter
 *   RunGet     — Get full run details by slug
 *   RunUpdate  — Update status, append log, add blocked_by
 *   RunShow    — Bind a run to this session (shows widget)
 *
 * Design:
 *   - Only activates when .pipeline/ directory exists in cwd
 *   - YAML files in .pipeline/runs/, one per run
 *   - Immutable core fields (goal, description, checker, context, links)
 *   - Mutable: status, log (append-only), blocked_by (append-only)
 *   - blocked_by is weak constraint (warn, don't block)
 *   - Widget only shown when a run is bound via RunShow
 *   - No system reminder — non-intrusive
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { RunStore } from "./run-store.js";
import { RunWidget, type UICtx } from "./run-widget.js";

function textResult(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], details: undefined as any };
}

export default function (pi: ExtensionAPI) {
  // ── Gate: only activate when .pipeline/ exists ──
  if (!RunStore.hasPipeline()) return;

  const store = new RunStore();
  const widget = new RunWidget(store);

  // Grab UI context from lifecycle events
  function refreshCtx(ctx: ExtensionContext) {
    widget.setUICtx(ctx.ui as UICtx);
    widget.update();
  }

  pi.on("before_agent_start", async (_event, ctx) => refreshCtx(ctx));
  pi.on("tool_execution_start", async (_event, ctx) => refreshCtx(ctx));

  // ──────────────────────────────────────────────────
  // Tool 1: RunCreate
  // ──────────────────────────────────────────────────

  pi.registerTool({
    name: "RunCreate",
    label: "RunCreate",
    description: `Create a research pipeline run. Each run is stored as \`.pipeline/runs/<slug>.yaml\`.

A run is an atomic execution unit — running an experiment, writing a section, verifying a hypothesis.

## Fields

- **slug**: kebab-case identifier, becomes the filename (e.g. "verify-debiased-k1")
- **goal**: What to achieve (immutable after creation)
- **checker**: Completion criteria — how to know the run is done (immutable)
- **description**: How to do it — steps, methods (optional, immutable)
- **context**: Background knowledge, references (optional, immutable)
- **links**: Related cards or run paths (optional, immutable)
- **blocked_by**: Prerequisite run paths (optional, mutable via RunUpdate)

All fields except status, log, and blocked_by are immutable after creation. To change goals, archive this run and create a new one.`,
    parameters: Type.Object({
      slug: Type.String({ description: "kebab-case identifier (e.g. 'verify-debiased-k1')" }),
      goal: Type.String({ description: "What to achieve — the run objective" }),
      checker: Type.String({ description: "Completion criteria — how to verify the run is done" }),
      description: Type.Optional(Type.String({ description: "How to do it — steps, methods, procedures" })),
      context: Type.Optional(Type.String({ description: "Background knowledge, model specs, dataset info" })),
      links: Type.Optional(Type.Array(Type.String(), { description: "Related card/run paths (e.g. 'cards/use-llama3-8b')" })),
      blocked_by: Type.Optional(Type.Array(Type.String(), { description: "Prerequisite run paths (e.g. 'runs/setup-env')" })),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { slug, ...fields } = params;
      const result = store.create(slug, fields);

      if (result.error) {
        return Promise.resolve(textResult(`Error: ${result.error}`));
      }

      const blockers = store.checkBlockers(slug);
      let msg = `Run "${slug}" created → .pipeline/runs/${slug}.yaml`;
      if (blockers.unresolved.length > 0) {
        msg += `\n⚠ Unresolved blockers: ${blockers.unresolved.join(", ")}`;
      }
      if (blockers.missing.length > 0) {
        msg += `\n⚠ Missing runs: ${blockers.missing.join(", ")}`;
      }

      return Promise.resolve(textResult(msg));
    },
  });

  // ──────────────────────────────────────────────────
  // Tool 2: RunList
  // ──────────────────────────────────────────────────

  pi.registerTool({
    name: "RunList",
    label: "RunList",
    description: `List all research pipeline runs from \`.pipeline/runs/\`.

Returns each run's slug, status, goal summary, and unresolved blockers.
Use the optional status filter to narrow results (active, done, archived).`,
    parameters: Type.Object({
      status: Type.Optional(Type.Union([
        Type.Literal("active"),
        Type.Literal("done"),
        Type.Literal("archived"),
      ], { description: "Filter by status" })),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const runs = store.list(params.status);

      if (runs.length === 0) {
        const suffix = params.status ? ` with status "${params.status}"` : "";
        return Promise.resolve(textResult(`No runs found${suffix} in .pipeline/runs/`));
      }

      const lines = runs.map(r => {
        let line = `[${r.status}] ${r.slug} — ${r.goal}`;
        if (r.blocked_by && r.blocked_by.length > 0) {
          const blockers = store.checkBlockers(r.slug);
          if (blockers.unresolved.length > 0) {
            line += ` (blocked by: ${blockers.unresolved.join(", ")})`;
          }
        }
        return line;
      });

      return Promise.resolve(textResult(lines.join("\n")));
    },
  });

  // ──────────────────────────────────────────────────
  // Tool 3: RunGet
  // ──────────────────────────────────────────────────

  pi.registerTool({
    name: "RunGet",
    label: "RunGet",
    description: `Get full details of a research pipeline run by slug.

Returns all fields: goal, description, checker, context, status, links, blocked_by, and the complete log.
Use this to understand a run before starting work or to review progress.`,
    parameters: Type.Object({
      slug: Type.String({ description: "Run slug (e.g. 'verify-debiased-k1')" }),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const result = store.get(params.slug);
      if (result.error) {
        return Promise.resolve(textResult(`Error: ${result.error}`));
      }

      const run = result.run!;
      const lines: string[] = [];

      lines.push(`# ${params.slug} [${run.status}]`);
      lines.push("");
      lines.push(`**Goal:** ${run.goal.trim()}`);
      if (run.description) {
        lines.push("");
        lines.push(`**Description:**\n${run.description.trim()}`);
      }
      lines.push("");
      lines.push(`**Checker:**\n${run.checker.trim()}`);
      if (run.context) {
        lines.push("");
        lines.push(`**Context:**\n${run.context.trim()}`);
      }
      if (run.links && run.links.length > 0) {
        lines.push("");
        lines.push(`**Links:** ${run.links.join(", ")}`);
      }
      if (run.blocked_by && run.blocked_by.length > 0) {
        const blockers = store.checkBlockers(params.slug);
        lines.push("");
        lines.push(`**Blocked by:**`);
        for (const dep of run.blocked_by) {
          if (blockers.resolved.includes(dep)) {
            lines.push(`  ✅ ${dep} (done)`);
          } else if (blockers.missing.includes(dep)) {
            lines.push(`  ❓ ${dep} (not found)`);
          } else {
            lines.push(`  ⏳ ${dep}`);
          }
        }
      }
      if (run.log && run.log.length > 0) {
        lines.push("");
        lines.push(`**Log:** (${run.log.length} entries)`);
        for (const entry of run.log) {
          const ts = entry.at.replace(/T/, " ").replace(/\.\d+Z$/, "");
          lines.push(`  ${ts} [${entry.type}] ${entry.detail}`);
        }
      }
      lines.push("");
      lines.push(`Created: ${run.created}`);

      return Promise.resolve(textResult(lines.join("\n")));
    },
  });

  // ──────────────────────────────────────────────────
  // Tool 4: RunUpdate
  // ──────────────────────────────────────────────────

  pi.registerTool({
    name: "RunUpdate",
    label: "RunUpdate",
    description: `Update a research pipeline run's mutable fields.

Only three things can be changed after creation:
- **status**: active → done / archived
- **log**: Append a structured log entry (type + detail)
- **blocked_by**: Add new prerequisite run paths

Immutable fields (goal, description, checker, context, links) cannot be modified. To change goals, archive this run and create a new one.

## Log entry types

| type | what it answers | example |
|------|----------------|---------|
| progress | 做了什么？ | "配置实验环境完毕" |
| observation | 知道了什么？ | "seed=42 BLEU=33.5" |
| issue | 出了什么问题？ | "vllm 版本冲突" |
| decision | 做了什么选择？ | "降级到 0.4.1" |
| output | 造出了什么？ | "产出 cards/baseline-bleu-33" |

## Marking done

When setting status to "done", the checker criteria will be shown in the response. Verify all criteria are met before marking done.`,
    parameters: Type.Object({
      slug: Type.String({ description: "Run slug" }),
      status: Type.Optional(Type.Union([
        Type.Literal("active"),
        Type.Literal("done"),
        Type.Literal("archived"),
      ], { description: "New status" })),
      log_entry: Type.Optional(Type.Object({
        type: Type.Union([
          Type.Literal("progress"),
          Type.Literal("observation"),
          Type.Literal("issue"),
          Type.Literal("decision"),
          Type.Literal("output"),
        ], { description: "Log entry type" }),
        detail: Type.String({ description: "What happened" }),
      }, { description: "Append a log entry" })),
      add_blocked_by: Type.Optional(Type.Array(Type.String(), { description: "Add prerequisite run paths" })),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { slug, ...fields } = params;

      // If marking done, pre-fetch checker for echo
      let checkerEcho = "";
      if (fields.status === "done") {
        const pre = store.get(slug);
        if (pre.run) {
          checkerEcho = pre.run.checker;
        }
      }

      const result = store.update(slug, fields);

      if (result.error) {
        return Promise.resolve(textResult(`Error: ${result.error}`));
      }

      if (result.changes.length === 0) {
        return Promise.resolve(textResult(`No changes applied to "${slug}".`));
      }

      let msg = `Updated "${slug}":\n${result.changes.map(c => `  • ${c}`).join("\n")}`;

      if (result.warnings.length > 0) {
        msg += `\n\nWarnings:\n${result.warnings.map(w => `  ⚠ ${w}`).join("\n")}`;
      }

      // Echo checker when marking done
      if (fields.status === "done" && checkerEcho) {
        msg += `\n\n── Checker (verify these are met) ──\n${checkerEcho.trim()}`;
      }

      // Refresh widget if this is the bound run
      if (widget.getBoundSlug() === slug) {
        widget.update();
      }

      return Promise.resolve(textResult(msg));
    },
  });

  // ──────────────────────────────────────────────────
  // Tool 5: RunShow
  // ──────────────────────────────────────────────────

  pi.registerTool({
    name: "RunShow",
    label: "RunShow",
    description: `Bind a run to this session and show its status as a persistent widget above the editor.

The widget displays the run's slug, status, goal, recent log entries, and blocker status.
Use this when you start working on a specific run to keep its context visible.

Call with no slug (or slug "") to unbind and hide the widget.`,
    parameters: Type.Object({
      slug: Type.Optional(Type.String({ description: "Run slug to bind, or empty to unbind" })),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Unbind
      if (!params.slug || params.slug === "") {
        const prev = widget.getBoundSlug();
        widget.unbind();
        if (prev) {
          return Promise.resolve(textResult(`Unbound from run "${prev}". Widget hidden.`));
        }
        return Promise.resolve(textResult("No run was bound."));
      }

      // Bind
      const result = store.get(params.slug);
      if (result.error) {
        return Promise.resolve(textResult(`Error: ${result.error}`));
      }

      const run = result.run!;
      widget.bind(params.slug);

      const blockers = store.checkBlockers(params.slug);
      let msg = `Bound to run "${params.slug}" [${run.status}]\nGoal: ${run.goal.split("\n")[0].trim()}`;
      if (blockers.unresolved.length > 0) {
        msg += `\n⚠ Unresolved blockers: ${blockers.unresolved.join(", ")}`;
      }
      if (run.log && run.log.length > 0) {
        msg += `\nLast log: [${run.log[run.log.length - 1].type}] ${run.log[run.log.length - 1].detail}`;
      }

      return Promise.resolve(textResult(msg));
    },
  });
}
