/**
 * run-widget.ts — Minimal widget showing the currently bound run's status and recent log.
 *
 * Only visible when a run is bound to the session via RunShow.
 */

import type { Run } from "./types.js";
import type { RunStore } from "./run-store.js";

export type UICtx = {
  setWidget(
    key: string,
    content: undefined | ((tui: any, theme: any) => { render(): string[]; invalidate(): void }),
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void;
};

const MAX_LOG_LINES = 3;

const STATUS_ICONS: Record<string, string> = {
  active: "▶",
  done: "✔",
  cancelled: "✖",
  superseded: "↷",
};

export class RunWidget {
  private uiCtx: UICtx | undefined;
  private boundSlug: string | undefined;
  private registered = false;

  constructor(private store: RunStore) {}

  setUICtx(ctx: UICtx) {
    this.uiCtx = ctx;
  }

  /** Bind this widget to a run slug. */
  bind(slug: string) {
    this.boundSlug = slug;
    this.update();
  }

  /** Unbind — remove widget. */
  unbind() {
    this.boundSlug = undefined;
    if (this.uiCtx) {
      this.uiCtx.setWidget("pi-alan", undefined);
      this.registered = false;
    }
  }

  getBoundSlug(): string | undefined {
    return this.boundSlug;
  }

  /** Refresh widget content from disk. */
  update() {
    if (!this.uiCtx || !this.boundSlug) return;

    const result = this.store.get(this.boundSlug);
    if (!result.run) {
      this.unbind();
      return;
    }

    const slug = this.boundSlug;
    const run = result.run;

    if (!this.registered) {
      this.uiCtx.setWidget("pi-alan", (tui: any, theme: any) => ({
        render: () => this.renderLines(slug, run, tui, theme),
        invalidate: () => {},
      }), { placement: "aboveEditor" });
      this.registered = true;
    }
  }

  private renderLines(slug: string, _cachedRun: Run, _tui: any, theme: any): string[] {
    // Re-read from disk on each render to stay fresh
    const result = this.store.get(slug);
    if (!result.run) return [];
    const run = result.run;

    const icon = STATUS_ICONS[run.status] ?? "?";
    const statusColor = run.status === "active" ? "accent" : run.status === "done" ? "success" : "dim";
    const desc = run.description.split("\n")[0].trim();
    const header = `${theme.fg(statusColor, icon)} ${theme.fg("accent", slug)} ${theme.fg("dim", `[${run.status}]`)} ${desc}`;

    const lines = [header];

    // Show recent log entries
    if (run.log && run.log.length > 0) {
      const recent = run.log.slice(-MAX_LOG_LINES);
      for (const entry of recent) {
        const ts = entry.at.replace(/T/, " ").replace(/\.\d+Z$/, "").slice(5); // MM-DD HH:MM:SS
        const typeIcon = logTypeIcon(entry.type);
        lines.push(`  ${theme.fg("dim", ts)} ${typeIcon} ${entry.detail.slice(0, 70)}`);
      }
    }

    // Show blocker status if any unresolved
    const blockers = this.store.checkBlockers(slug);
    if (blockers.unresolved.length > 0) {
      lines.push(`  ${theme.fg("warning", `⏳ blocked by: ${blockers.unresolved.join(", ")}`)}`);
    }

    // Show outputs if any
    if (run.result_of && run.result_of.length > 0) {
      lines.push(`  ${theme.fg("dim", `★ outputs: ${run.result_of.join(", ")}`)}`);
    }

    return lines;
  }
}

function logTypeIcon(type: string): string {
  switch (type) {
    case "progress":    return "→";
    case "observation": return "◆";
    case "issue":       return "✖";
    case "decision":    return "◇";
    case "output":      return "★";
    default:            return "·";
  }
}
