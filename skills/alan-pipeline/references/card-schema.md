# Card Schema

Card 是原子化的知识单元，每张只说一件事。

## 文件位置

```
.pipeline/cards/<slug>.md              # p0 + p1 cards
.pipeline/cards/archived/<slug>.md     # p2 cards
```

文件名为描述性短名，kebab-case。如 `debiased-sorting-method.md`、`bleu-baseline-results.md`。

## YAML Front Matter

```yaml
---
id: M01                   # 跨卡片唯一编号（见编号规则）
category: method           # method | exp | framing
priority: p0               # p0 | p1 | p2
tags: [debiasing, attention]
links:
  - cards/bleu-baseline-results
  - runs/verify-debiased-k1
---
```

| 字段 | 说明 |
|------|------|
| `id` | 跨卡片唯一编号，格式：`{类别前缀}{序号}`。M=method, E=exp, F=framing |
| `category` | `method`：方法论。`exp`：实验与结果。`framing`：叙事框架（intro, related work, discussion, conclusion） |
| `priority` | `p0`：核心事实，已验证，长期有效。`p1`：中间状态，脆弱或待验证。`p2`：归档，不再纳入项目上下文 |
| `tags` | 自由填写的关键词列表，用于检索 |
| `links` | 指向相关 card 或 run 的路径列表 |

## 编号规则

每张 card 有一个全局唯一编号，由类别前缀 + 两位序号组成：

| 类别 | 前缀 | 示例 |
|------|------|------|
| method | M | M01, M02, M03 |
| exp | E | E01, E02, E03 |
| framing | F | F01, F02, F03 |

**卡片内的 section 用 `{id}.{n}` 编号：**

```markdown
## M01.1 核心思路
...

## M01.2 与 k=5 baseline 的关系
...

## M01.3 局限
...
```

**跨卡片引用**直接使用编号：`见 M01.2`、`E03.1 的结果支持 M01.1`。

编号一经分配不可复用。card 归档后编号保留，新 card 继续递增。

## Priority 说明

| 级别 | 含义 | 目录 | 示例 |
|------|------|------|------|
| `p0` | 核心事实——已验证、长期有效、其他 card 依赖它 | `cards/` | 确认的实验结果、已选定的模型、经证实的方法 |
| `p1` | 中间状态——合理但脆弱，待更多证据或可能被修改 | `cards/` | 初步假设、单次实验结果、暂定的写作框架 |
| `p2` | 归档——被取代、被证伪、或不再相关 | `cards/archived/` | 被新方法替代的旧方法、被证伪的假设 |

**Priority 变更**：
- p1 → p0：假设被多次实验支持后升级
- p1 → p2：假设被证伪或被取代，移入 archived/
- p0 → p2：极少见，仅当根基性认知被推翻时

## Body 结构

必须有 `#` 标题，格式：`# {id} 标题文字`。标题下首段为 1-3 句摘要。

**每个 `##` section 必须带 `{id}.{n}` 编号。** 这是跨卡片引用的基础。

### method 推荐结构

```markdown
# M01 Debiased k=1 Sorting

单次 position-bias estimation 消除排序偏差，使 k=1 匹配 k=5 精度。

## M01.1 核心思路
## M01.2 关键假设
## M01.3 与已有方法的区别
## M01.4 局限
```

### exp 推荐结构

```markdown
# E01 Debiased k=1 在 SynthWiki-32k 上的 BLEU

3 seeds 均值 33.2±0.4，与 k=5 baseline 差距 0.6 分。

## E01.1 实验设置
## E01.2 结果
## E01.3 分析
## E01.4 局限
```

### framing 推荐结构

```markdown
# F01 Introduction 框架

以 long-context QA 的排序开销为切入，引出 debiased single-pass 方案。

## F01.1 问题陈述
## F01.2 现有方案的不足
## F01.3 本文贡献
```

## 单一事实原则

**同一事实只存在于一张 card 中。** 如果两张 card 有重叠内容：

1. 提取重叠部分为一张独立的小 card
2. 原来的两张 card 用引用替代重叠内容：`见 M03.1`

**检查时机**：每次创建新 card 前，检查现有 active cards 是否已覆盖相关内容。

## 示例

### method (p0)

```markdown
---
id: M01
category: method
priority: p0
tags: [debiasing, attention-sorting, single-pass]
links:
  - cards/bleu-baseline-results
  - runs/verify-debiased-k1
---

# M01 Debiased k=1 Attention Sorting

单次 per-prompt position-bias estimation 消除 long-context QA 中的排序偏差，
使 k=1 Attention Sorting 在 BLEU 上与 k=5 差距 ≤ 2 分。

## M01.1 核心思路

在每个 prompt 上估计一次 position bias 分布，用于修正排序得分。
不需要多次排序（k=5），单次即可。

## M01.2 关键假设

position bias 主要集中在首尾 token 的 attention 分配上，
且 bias pattern 在同一 prompt 内相对稳定。

## M01.3 局限

仅在 SynthWiki-32k 上验证。更长 context 或其他 benchmark 的表现未知。
```

### exp (p1)

```markdown
---
id: E01
category: exp
priority: p1
tags: [bleu, synthwiki, llama3, baseline]
links:
  - cards/debiased-sorting-method
  - runs/verify-debiased-k1
---

# E01 Debiased k=1 BLEU on SynthWiki-32k

3 seeds (42/43/44) 均值 33.2±0.4。k=5 baseline 33.8±0.3，差距 0.6 分。
p1：单 benchmark 结果，待更多数据集验证后可升 p0。

## E01.1 实验设置

模型：Llama-3-8B。数据集：SynthWiki-32k。
Greedy decoding，默认超参。见 M01.1 了解方法细节。

## E01.2 结果

| seed | k=1 BLEU | k=5 BLEU |
|------|----------|----------|
| 42   | 33.5     | 34.1     |
| 43   | 32.9     | 33.6     |
| 44   | 33.1     | 33.7     |

## E01.3 分析

差距远低于 2 分阈值，支持 M01.2 的假设。

## E01.4 局限

仅 SynthWiki-32k。需要在 NarrativeQA、QuALITY 上重复验证。
```

### framing (p1)

```markdown
---
id: F01
category: framing
priority: p1
tags: [introduction, motivation]
links:
  - cards/debiased-sorting-method
---

# F01 Introduction 框架

以 long-context QA 的多次排序开销为切入，引出 debiased single-pass 方案。

## F01.1 问题陈述

long-context QA 中 Attention Sorting 需要 k≥5 次排序才能稳定，
计算开销随 k 线性增长。

## F01.2 现有方案的不足

- 直接降低 k 会引入 position bias 导致排序错误
- 现有 debiasing 方法需要离线统计，不适合在线场景

## F01.3 本文贡献

1. 提出 per-prompt single-pass debiasing（见 M01.1）
2. 在 SynthWiki-32k 上验证 k=1 匹配 k=5（见 E01.2）
3. 分析 bias pattern 的 prompt 内稳定性
```
