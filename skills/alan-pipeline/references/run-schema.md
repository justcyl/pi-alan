# Run Schema

Run 是行动单元，驱动项目推进。使用 YAML 格式，通过 pi-alan 扩展工具管理。

## 文件位置

```
.pipeline/runs/<slug>.yaml
```

## 字段定义

```yaml
created: 2026-03-30T14:00:00.000Z

description: |
  验证 debiased k=1 能否在 SynthWiki-32k 上匹配 k=5 精度，
  方法是用 Llama-3-8B 跑 3 seeds (42/43/44) 对比 BLEU。

checker: |
  - 完成 3 seeds 的实验运行
  - 产出 finding card 记录 BLEU mean±std
  - finding card links 指向假设 card

context: |
  基础模型：Llama-3-8B（见 cards/use-llama3-8b）
  数据集：SynthWiki-32k
  不调超参，使用论文默认配置。

status: active

blocked_by:
  - runs/setup-experiment-env

result_of: []

log:
  - at: 2026-03-30T14:30:00.000Z
    type: progress
    detail: "等待 runs/setup-experiment-env 完成"
```

## 字段说明

| 字段 | 必填 | 可变 | 说明 |
|------|------|------|------|
| `created` | ✅ | ❌ | 创建时间戳（工具自动填） |
| `description` | ✅ | ❌ | 为什么存在 + 大致怎么做。高层意图，不写逐步脚本 |
| `checker` | ✅ | ❌ | done-when 标准——看产出判断是否完成，不是 win-condition |
| `context` | ❌ | ✅ | 背景知识、card 引用。执行中可补充新依赖 |
| `status` | ✅ | ✅ | `active` / `done` / `cancelled` / `superseded` |
| `blocked_by` | ❌ | 追加 | 前置 run 路径（计划依赖，弱约束） |
| `result_of` | ❌ | 追加 | 产出物路径（cards、drafts、plots） |
| `log` | ❌ | 追加 | 执行日志，只追加不修改 |

## Status 说明

| 状态 | 含义 | 典型场景 |
|------|------|---------|
| `active` | 正在执行或等待执行 | — |
| `done` | checker 定义的交付物全部产出 | 实验跑完，不管结果好不好 |
| `cancelled` | 主动放弃 | "方向行不通" |
| `superseded` | 被新 run 取代 | "改用新方法，见 runs/xxx" |

**done ≠ 假设被支持。** run 完成的标准是交付物是否齐全，不是结果是否理想。证伪假设的实验是一个成功完成的 run。

## checker 写作原则

checker 是 done-when，不是 win-condition：

| ✅ 正确 | ❌ 错误 |
|---------|---------|
| "3 seeds 完成 + BLEU 记录" | "BLEU 差距 ≤ 2 分" |
| "产出 finding card" | "假设被支持" |
| "drafts/experiments.md 已写" | "写作质量满足发表要求" |

## description 写作原则

写高层意图，不写逐步脚本。自测：agent 只看 description 能知道**为什么做**和**大致怎么做**，具体步骤靠自己判断。

| ✅ 正确 | ❌ 太细 |
|---------|---------|
| "验证 k=1 能否匹配 k=5，跑 3 seeds 对比 BLEU" | "1. ssh server 2. cd /exp 3. python run.py --seed 42..." |

## Log 条目

```yaml
- at: 2026-03-31T10:20:00.000Z
  type: observation
  detail: "seed=42 BLEU=33.5"
```

### Log 类型

| type | 回答什么 | 典型内容 |
|------|---------|---------|
| `progress` | 做了什么？ | "配置实验环境完毕" |
| `observation` | 知道了什么？（任务级） | "seed=42 BLEU=33.5" |
| `issue` | 出了什么问题？ | "vllm 版本冲突" |
| `decision` | 做了什么选择？（任务级） | "降级到 vllm 0.4.1" |
| `output` | 产出了什么？ | "产出 cards/baseline-bleu-33" |

**任务级 vs 项目级**：log 里的 observation/decision 是执行过程中的记录。如果一个 observation 对整个项目有持久意义（如关键实验结果），应升级为 finding card。如果一个 decision 约束后续工作（如选定基础模型），应升级为 decision card。

## 示例

### 验证假设（已完成）

```yaml
created: 2026-03-30T14:00:00.000Z

description: |
  验证 debiased k=1 能否在 SynthWiki-32k 上匹配 k=5 精度，
  方法是用 Llama-3-8B 跑 3 seeds 对比 BLEU。

checker: |
  - 完成 3 seeds (42/43/44) 的实验运行
  - 产出 finding card 记录 BLEU mean±std
  - finding card links 指向假设 card

context: |
  基础模型：Llama-3-8B（见 cards/use-llama3-8b）
  数据集：SynthWiki-32k

status: done

blocked_by:
  - runs/setup-experiment-env

result_of:
  - cards/baseline-bleu-33

log:
  - at: 2026-03-30T14:30:00.000Z
    type: progress
    detail: "环境就绪，开始跑实验"
  - at: 2026-03-31T09:15:00.000Z
    type: observation
    detail: "seed=42 BLEU=33.5"
  - at: 2026-04-01T17:40:00.000Z
    type: observation
    detail: "seed=43,44 完成，均值 33.2±0.4"
  - at: 2026-04-02T10:00:00.000Z
    type: output
    detail: "产出 cards/baseline-bleu-33"
  - at: 2026-04-02T10:05:00.000Z
    type: decision
    detail: "标记 done — 三组实验完成，finding card 已产出"
```

### 被取代的 run

```yaml
created: 2026-03-29T11:00:00.000Z

description: |
  使用 Mistral-7B 跑 baseline 实验，验证排序方法的基础性能。

checker: |
  - 完成 3 seeds 运行
  - 产出 finding card

status: superseded

log:
  - at: 2026-03-30T09:00:00.000Z
    type: observation
    detail: "Mistral-7B context window 仅 8k，不满足实验需求"
  - at: 2026-03-30T09:15:00.000Z
    type: decision
    detail: "superseded — 改用 Llama-3-8B，见 runs/verify-debiased-k1"
```
