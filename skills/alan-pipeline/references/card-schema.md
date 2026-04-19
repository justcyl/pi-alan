# Card Schema

Card 是原子化的知识单元，每张只说一件事。

## 文件位置

```
.pipeline/cards/method/<slug>.md       # 方法论 (p0, p1)
.pipeline/cards/exp/<slug>.md          # 实验与结果 (p0, p1)
.pipeline/cards/framing/<slug>.md      # 叙事框架 (p0, p1)
.pipeline/cards/archived/<slug>.md     # 归档 (p2)
```

文件名为描述性短名，kebab-case。如 `debiased-sorting.md`、`bleu-baseline.md`。

## YAML Front Matter

```yaml
---
category: method           # method | exp | framing
priority: p0               # p0 | p1 | p2
tags: [debiasing, attention]
links:
  - cards/exp/bleu-baseline
  - runs/verify-debiased-k1
---
```

| 字段 | 说明 |
|------|------|
| `category` | `method`：方法论、算法、技术方案。`exp`：实验设置、结果、分析。`framing`：intro, related work, discussion, conclusion |
| `priority` | `p0`：核心事实，已验证，长期有效。`p1`：中间状态，脆弱或待验证。`p2`：归档，不再纳入上下文 |
| `tags` | 自由填写的关键词列表，用于检索 |
| `links` | 指向相关 card（用路径）或 run 的列表 |

## Body 结构

必须有 `#` 标题。标题下首段为 1-3 句摘要。

**每个 `##` section 必须有序号**，从 1 开始：

```markdown
## 1. 核心思路
## 2. 关键假设
## 3. 局限
```

**跨卡片引用格式**：`{category}/{slug}#{section}`

```
method/debiased-sorting#2    →  method/debiased-sorting.md 的 ## 2.
exp/bleu-baseline#1          →  exp/bleu-baseline.md 的 ## 1.
```

section 序号在同一 card 内唯一，新增 section 追加到末尾，**已有序号不可修改**（修改会破坏其他 card 的引用）。

## Category 说明

### method

方法论——本文提出或使用的技术方案。

```markdown
# 标题（方法名称）

摘要（方法核心是什么，解决什么问题）

## 1. 核心思路
## 2. 关键假设
## 3. 与已有方法的区别
## 4. 局限
```

### exp

实验与结果——实验设置、观测数据、分析。

```markdown
# 标题（实验名称 + 核心结论）

摘要（一句话结论）

## 1. 实验设置
## 2. 结果
## 3. 分析
## 4. 局限
```

### framing

叙事框架——用于 intro, related work, discussion, conclusion 的写作素材。

```markdown
# 标题（这段叙事说什么）

摘要

## 1. 问题陈述 / 现有方案的不足 / 本文贡献 / ...
## 2. ...
```

## Priority 说明

| 级别 | 含义 | 典型场景 |
|------|------|---------|
| `p0` | 核心事实——已验证，长期有效 | 确认的实验结果、经证实的方法、已选定的技术路线 |
| `p1` | 中间状态——合理但脆弱 | 初步实验结果（单次）、暂定的写作框架、待更多数据验证的方法假设 |
| `p2` | 归档——被取代或证伪 | 被新方法替代的旧方案、被实验推翻的假设 |

**p1 → p0**：多次实验支持后升级，在 body 中补充验证证据。
**p1/p0 → p2**：移文件到 archived/，edit priority: p2，body 末尾写归档原因。

## 示例

### method (p1)

```markdown
---
category: method
priority: p1
tags: [debiasing, attention-sorting, single-pass]
links:
  - cards/exp/bleu-baseline
---

# Debiased k=1 Attention Sorting

单次 per-prompt position-bias estimation 消除 long-context QA 中的排序偏差，
使 k=1 Attention Sorting 在 BLEU 上与 k=5 差距 ≤ 2 分。p1：待更多 benchmark 验证。

## 1. 核心思路

在每个 prompt 上估计一次 position bias 分布，用于修正排序得分。
不需要多次排序（k≥5），单次即可。

## 2. 关键假设

position bias 主要集中在首尾 token 的 attention 分配上，
且 bias pattern 在同一 prompt 内相对稳定。

## 3. 与已有方法的区别

现有方案需要离线统计 bias；本方法 per-prompt 在线估计，适合动态场景。

## 4. 局限

仅在 SynthWiki-32k 上验证。更长 context 或其他 benchmark 的表现未知。
```

### exp (p1)

```markdown
---
category: exp
priority: p1
tags: [bleu, synthwiki, llama3]
links:
  - cards/method/debiased-sorting
  - runs/verify-debiased-k1
---

# Debiased k=1 BLEU on SynthWiki-32k: 33.2±0.4

3 seeds (42/43/44) 均值 33.2±0.4。k=5 baseline 33.8±0.3，差距 0.6 分。
p1：单 benchmark 结果，待更多数据集验证。

## 1. 实验设置

模型：Llama-3-8B。数据集：SynthWiki-32k。Greedy decoding，默认超参。
方法细节见 method/debiased-sorting#1。

## 2. 结果

| seed | k=1 BLEU | k=5 BLEU |
|------|----------|----------|
| 42   | 33.5     | 34.1     |
| 43   | 32.9     | 33.6     |
| 44   | 33.1     | 33.7     |

## 3. 分析

差距 0.6 分，远低于 2 分阈值，支持 method/debiased-sorting#2。

## 4. 局限

仅 SynthWiki-32k。需要在 NarrativeQA、QuALITY 上重复验证后可升 p0。
```

### framing (p1)

```markdown
---
category: framing
priority: p1
tags: [introduction, motivation]
links:
  - cards/method/debiased-sorting
  - cards/exp/bleu-baseline
---

# Introduction 框架：以排序开销引出 single-pass debiasing

以 long-context QA 的多次排序开销为切入，引出 debiased single-pass 方案。

## 1. 问题陈述

long-context QA 中 Attention Sorting 需要 k≥5 次排序才能稳定，
计算开销随 k 线性增长。

## 2. 现有方案的不足

- 直接降低 k 会引入 position bias 导致排序错误
- 现有 debiasing 方法需要离线统计，不适合在线场景

## 3. 本文贡献

1. 提出 per-prompt single-pass debiasing（见 method/debiased-sorting#1）
2. 在 SynthWiki-32k 上验证 k=1 匹配 k=5（见 exp/bleu-baseline#2）
3. 分析 bias pattern 的 prompt 内稳定性（见 method/debiased-sorting#2）
```
