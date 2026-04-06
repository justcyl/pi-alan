# Run Schema

Run 是行动单元，驱动项目推进。使用 YAML 格式，通过 pi-run 扩展工具管理。

## 文件位置

```
.pipeline/runs/<slug>.yaml
```

## 字段定义

```yaml
created: 2026-03-30T14:00:00.000Z

goal: |
  在 SynthWiki-32k 上跑 debiased k=1 vs k=5 对比实验，
  验证 debiased k=1 能否匹配 k=5 精度。

description: |
  1. 加载 Llama-3-8B，配置 debiased k=1 sorting
  2. 对 SynthWiki-32k 跑 3 seeds (42/43/44)，greedy decoding
  3. 同配置跑 k=5 baseline 作为对照
  4. 汇总 BLEU mean±std，产出 finding card

checker: |
  - 完成 3 seeds 的实验运行
  - 产出 finding card 记录 BLEU mean±std
  - BLEU 差距 ≤ 2 分视为通过

context: |
  基础模型：Llama-3-8B（见 cards/use-llama3-8b）
  数据集：SynthWiki-32k
  不调超参，使用论文默认配置。

status: active

links:
  - cards/debiased-k1-matches-k5
  - cards/use-llama3-8b

blocked_by:
  - runs/setup-experiment-env

log:
  - at: 2026-03-30T14:30:00.000Z
    type: progress
    detail: "等待 runs/setup-experiment-env 完成"
```

## 字段说明

| 字段 | 必填 | 可变 | 说明 |
|------|------|------|------|
| `created` | ✅ | ❌ | 创建时间戳（工具自动填） |
| `goal` | ✅ | ❌ | 做什么 |
| `description` | ❌ | ❌ | 怎么做——步骤、方法、操作流程 |
| `checker` | ✅ | ❌ | 完成标准。标 done 时工具会回显此内容供确认 |
| `context` | ❌ | ❌ | 背景知识和引用 |
| `status` | ✅ | ✅ | `active` / `done` / `archived` |
| `links` | ❌ | ❌ | 关联的 card 或 run 路径 |
| `blocked_by` | ❌ | 追加 | 前置 run 路径列表（弱约束，不阻止执行） |
| `log` | ❌ | 追加 | 执行日志，只追加不修改已有条目 |

## 不可变性

`created`、`goal`、`description`、`checker`、`context`、`links` 一经写入不可修改（工具层面不暴露修改接口）。

可变字段：
- `status`：状态流转
- `blocked_by`：通过 `RunUpdate` 的 `add_blocked_by` 追加
- `log`：通过 `RunUpdate` 的 `log_entry` 追加

要改目标就建新 run，旧 run 标 `status: archived`。

## Log 条目结构

```yaml
- at: 2026-03-31T10:20:00.000Z   # 时间戳（工具自动填）
  type: observation                # progress | observation | issue | decision | output
  detail: "seed=42 跑完，BLEU=33.5"
```

### Log 类型

| type | 回答什么 | 典型内容 |
|------|---------|---------|
| `progress` | 做了什么？ | "配置实验环境"、"开始撰写 main results" |
| `observation` | 知道了什么？ | "BLEU=33.5"、"context window 仅 8k" |
| `issue` | 出了什么问题？ | "vllm 版本冲突"、"显存不足需要降精度" |
| `decision` | 做了什么选择？ | "降级到 0.4.1"、"archived — 改用 Llama-3-8B" |
| `output` | 造出了什么？ | "产出 cards/baseline-bleu-33"、"生成 plots/ablation.png" |

## 示例

### 验证假设（已完成）

```yaml
created: 2026-03-30T14:00:00.000Z

goal: |
  在 SynthWiki-32k 上跑 debiased k=1 vs k=5 对比实验，
  验证 cards/debiased-k1-matches-k5 中的假设。

checker: |
  - 完成 3 seeds (42/43/44) 的实验运行
  - 产出 finding card 记录 BLEU mean±std
  - finding card links 指向假设 card

status: done

links:
  - cards/debiased-k1-matches-k5

blocked_by:
  - runs/setup-experiment-env

log:
  - at: 2026-03-30T14:30:00.000Z
    type: progress
    detail: "配置实验环境完毕，开始跑实验"
  - at: 2026-03-31T09:15:00.000Z
    type: observation
    detail: "seed=42 跑完，BLEU=33.5"
  - at: 2026-04-01T17:40:00.000Z
    type: observation
    detail: "seed=43,44 跑完，均值 33.2±0.4"
  - at: 2026-04-02T10:00:00.000Z
    type: output
    detail: "产出 cards/baseline-bleu-33"
  - at: 2026-04-02T10:05:00.000Z
    type: decision
    detail: "标记 done — BLEU=33.2±0.4，与 k=5 差距 0.8 分，假设成立"
```

### 写作任务（进行中）

```yaml
created: 2026-04-03T09:00:00.000Z

goal: |
  基于已完成的实验 findings，撰写论文 Experiments section 初稿。

checker: |
  - 产出 drafts/experiments.md
  - 覆盖 main results、ablation、rigor 三个子节
  - 所有数据引用对应的 finding cards

status: active

links:
  - cards/baseline-bleu-33
  - cards/ablation-no-bias-est

blocked_by:
  - runs/verify-debiased-k1
  - runs/run-ablation

log:
  - at: 2026-04-03T09:30:00.000Z
    type: progress
    detail: "依赖已就绪，开始撰写"
  - at: 2026-04-03T11:00:00.000Z
    type: progress
    detail: "main results 表格完成"
```

### 被归档的 run

```yaml
created: 2026-03-29T11:00:00.000Z

goal: |
  使用 Mistral-7B 跑 baseline 实验。

checker: |
  - 完成 3 seeds 运行
  - 产出 finding card

status: archived

log:
  - at: 2026-03-30T09:00:00.000Z
    type: observation
    detail: "发现 Mistral-7B context window 仅 8k，不满足实验需求"
  - at: 2026-03-30T09:15:00.000Z
    type: decision
    detail: "archived — 改用 Llama-3-8B，见 cards/use-llama3-8b"
```
