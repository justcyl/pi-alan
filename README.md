# pi-alan

Research pipeline run management extension for [pi](https://github.com/badlogic/pi-mono).

## What is a Run?

A **run** is an atomic execution unit in a research pipeline — running an experiment, writing a section, verifying a hypothesis. Each run is a YAML file in `.pipeline/runs/<slug>.yaml` with:

- **goal** — what to achieve (immutable)
- **checker** — completion criteria (immutable)
- **description** — how to do it (immutable)
- **context** — background knowledge (immutable)
- **links** — related cards/runs (immutable)
- **blocked_by** — prerequisite runs (mutable, weak constraint)
- **status** — `active` / `done` / `archived` (mutable)
- **log** — structured append-only execution journal (mutable)

## Install

```bash
pi install /path/to/pi-run
```

## Activation

The extension **only activates when `.pipeline/` exists** in the current working directory. No `.pipeline/` directory = no tools registered = zero overhead.

## Tools

| Tool | Description |
|------|-------------|
| `RunCreate` | Create a new run with goal, checker, and optional fields |
| `RunList` | List runs, optionally filtered by status |
| `RunGet` | Get full details of a run by slug |
| `RunUpdate` | Append log entries, change status, add blockers |
| `RunShow` | Bind a run to this session → show widget |

## Widget

Call `RunShow` with a slug to display a persistent widget above the editor:

```
▶ verify-debiased-k1 [active] Run debiased k=1 vs k=5 experiment…
  04-03 11:00 → main results 表格完成
  04-03 09:30 → 依赖已就绪，开始撰写
  ⏳ blocked by: runs/setup-env
```

Call `RunShow` with no slug to unbind and hide the widget.

## Immutability Model

Core fields are write-once. `RunUpdate` only exposes:
- `status` — state transitions
- `log_entry` — append structured journal entries (`progress` / `observation` / `issue` / `decision` / `output`)
- `add_blocked_by` — add new prerequisites

To change a run's goal, archive it and create a new one.

## Example

```yaml
# .pipeline/runs/verify-debiased-k1.yaml
created: 2026-03-30T14:00:00.000Z
goal: |
  在 SynthWiki-32k 上跑 debiased k=1 vs k=5 对比实验
checker: |
  - 完成 3 seeds 的实验运行
  - 产出 finding card 记录 BLEU mean±std
  - BLEU 差距 ≤ 2 分视为通过
status: active
links:
  - cards/debiased-k1-matches-k5
blocked_by:
  - runs/setup-env
log:
  - at: 2026-03-30T14:30:00.000Z
    type: progress
    detail: 配置实验环境完毕，开始跑实验
  - at: 2026-03-31T09:15:00.000Z
    type: observation
    detail: seed=42 BLEU=33.5
```

## Bundled Skill: research-pipeline

The package includes a `research-pipeline` skill that teaches the agent how to work with both **cards** and **runs**.

The skill is auto-discovered by pi when the extension is installed. The agent loads it on-demand when working in a `.pipeline/` project.

### What the skill covers

- **Card operations** — creating/editing `.pipeline/cards/<slug>.md` with YAML frontmatter (hypothesis / finding / decision)
- **Run operations** — using the 5 Run tools for the full lifecycle
- **Card ↔ Run flow** — hypothesis → run (验证) → finding → decision → next run
- **Schema references** — detailed field definitions and examples in `references/`

```
skills/research-pipeline/
├── SKILL.md                        # Main instructions
└── references/
    ├── card-schema.md              # Card field spec + examples
    └── run-schema.md               # Run field spec + examples
```

## License

MIT
