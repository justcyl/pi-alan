/**
 * pi-alan — Research pipeline management extension for pi.
 *
 * Tools:
 *   RunCreate  — Create a new run (.pipeline/runs/<slug>.yaml)
 *   RunList    — List runs with optional status filter
 *   RunGet     — Get full run details by slug
 *   RunUpdate  — Update status, context, append log/blocked_by/result_of
 *   RunShow    — Bind a run to this session (shows widget)
 *
 * Design:
 *   - YAML files in .pipeline/runs/, one per run
 *   - Immutable: description, checker
 *   - Mutable: status, context, blocked_by, result_of, log
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
- **description**: Why this run exists and what approach to take — high-level intent, not a step-by-step script (immutable)
- **checker**: Done-when criteria — how a third party can verify the run is complete by looking at outputs only. NOT a win-condition: a run that disproves a hypothesis is still done if it produced the expected deliverables (immutable)
- **context**: Background knowledge, references to cards (optional, mutable via RunUpdate)
- **blocked_by**: Prerequisite run paths (optional, mutable via RunUpdate)

Immutable fields: description, checker. To change intent, mark this run cancelled/superseded and create a new one.`,
    parameters: Type.Object({
      slug: Type.String({ description: "kebab-case identifier (e.g. 'verify-debiased-k1')" }),
      description: Type.String({ description: "Why this run exists + high-level approach" }),
      checker: Type.String({ description: "Done-when criteria — what outputs must exist, NOT whether results are good" }),
      context: Type.Optional(Type.String({ description: "Background knowledge, references to cards" })),
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

Returns each run's slug, status, description summary, and unresolved blockers.
Use the optional status filter to narrow results.`,
    parameters: Type.Object({
      status: Type.Optional(Type.Union([
        Type.Literal("active"),
        Type.Literal("done"),
        Type.Literal("cancelled"),
        Type.Literal("superseded"),
      ], { description: "Filter by status" })),
    }),

    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const runs = store.list(params.status);

      if (runs.length === 0) {
        const suffix = params.status ? ` with status "${params.status}"` : "";
        return Promise.resolve(textResult(`No runs found${suffix} in .pipeline/runs/`));
      }

      const lines = runs.map(r => {
        let line = `[${r.status}] ${r.slug} — ${r.description}`;
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

Returns all fields including description, checker, context, status, blocked_by, result_of, and the complete log.`,
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
      lines.push(`**Description:** ${run.description.trim()}`);
      lines.push("");
      lines.push(`**Checker:**\n${run.checker.trim()}`);
      if (run.context) {
        lines.push("");
        lines.push(`**Context:**\n${run.context.trim()}`);
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
      if (run.result_of && run.result_of.length > 0) {
        lines.push("");
        lines.push(`**Outputs:** ${run.result_of.join(", ")}`);
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

## What can be changed

- **status**: active → done / cancelled / superseded
- **context**: Replace context (background knowledge, card references — grows during execution)
- **log**: Append a structured log entry (type + detail)
- **blocked_by**: Add prerequisite run paths
- **result_of**: Add output paths (cards, drafts, plots produced by this run)

Immutable fields (description, checker) cannot be modified. To change intent, mark this run cancelled/superseded and create a new one.

## Log entry types

| type | what it records | example |
|------|----------------|---------|
| progress | 做了什么 | "配置实验环境完毕" |
| observation | 任务级观测 | "seed=42 BLEU=33.5" |
| issue | 遇到什么障碍 | "vllm 版本冲突" |
| decision | 任务级决策 | "降级到 vllm 0.4.1" |
| output | 产出了什么 | "产出 cards/baseline-bleu-33" |

Note: observation/decision here are task-scoped execution records. Project-level findings and decisions should be elevated to cards.

## Marking done

When setting status to "done", the checker criteria will be shown in the response — verify all deliverables exist. A run that disproves a hypothesis is still done if it produced the expected outputs.

## Recording outputs

When a run produces durable outputs (cards, drafts, plots), use add_result_of to record provenance:
\`\`\`json
{"slug": "verify-k1", "add_result_of": ["cards/baseline-bleu-33"], "log_entry": {"type": "output", "detail": "产出 cards/baseline-bleu-33"}}
\`\`\``,
    parameters: Type.Object({
      slug: Type.String({ description: "Run slug" }),
      status: Type.Optional(Type.Union([
        Type.Literal("active"),
        Type.Literal("done"),
        Type.Literal("cancelled"),
        Type.Literal("superseded"),
      ], { description: "New status" })),
      context: Type.Optional(Type.String({ description: "Replace context (background knowledge, card references)" })),
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
      add_result_of: Type.Optional(Type.Array(Type.String(), { description: "Add output paths (cards, drafts, plots)" })),
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
        msg += `\n\n── Checker (verify these deliverables exist) ──\n${checkerEcho.trim()}`;
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

The widget displays the run's slug, status, description, recent log entries, blocker status, and outputs.
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
      let msg = `Bound to run "${params.slug}" [${run.status}]\n${run.description.split("\n")[0].trim()}`;
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
