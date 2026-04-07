# Card Schema

Card 是原子化的知识单元，每张只说一件事。

## 文件位置

```
.pipeline/cards/<slug>.md
```

文件名为描述性短名，kebab-case。如 `debiased-k1-matches-k5.md`、`use-llama3-8b.md`。

## YAML Front Matter

```yaml
---
type: hypothesis        # hypothesis | finding | decision
status: active          # active | archived
tags: []                # 自由关键词，方便检索
links: []               # 指向其他 card 或 run 的路径
---
```

| 字段 | 说明 |
|------|------|
| `type` | `hypothesis`：认为可能成立，待验证。`finding`：已观察/已学到。`decision`：约束性选择 |
| `status` | `active`：在工作集中。`archived`：不再纳入项目上下文（被取代、被证伪、不再相关），归档原因写在 body 中 |
| `tags` | 自由填写的关键词列表，用于分类和检索 |
| `links` | 指向相关 card 或 run 的路径列表，不区分关系类型 |

时间信息由文件系统维护，不在 YAML 中重复。

## Body

必须有 `#` 标题，标题下首段为 1-3 句摘要。其余内容按 type 给出推荐结构，不强制。

### hypothesis 推荐结构

```markdown
# <可验证的主张>

<摘要>

## 为什么可信
## 什么会改变判断
## 为什么可能失败
```

### finding 推荐结构

```markdown
# <发现了什么>

<摘要>

## 证据
## 意味着什么
## 局限
```

### decision 推荐结构

```markdown
# <选择了什么>

<摘要>

## 理由
## 考虑过的替代方案
## 何时重审
```

## 示例

### hypothesis

```markdown
---
type: hypothesis
status: active
tags: [debiasing, attention-sorting, synthwiki]
links:
  - cards/gap-no-single-pass-debiasing
  - cards/use-synthwiki-benchmark
---

# Debiased k=1 sorting 在 SynthWiki-32k 上匹配 k=5 精度

单次 per-prompt position-bias estimation 足以消除 long-context QA 中的主要排序偏差，
使 k=1 Attention Sorting 在 BLEU 上与 k=5 差距 ≤ 2 分。

## 为什么可信
position bias 主要集中在首尾 token 的 attention 分配上，
且 bias pattern 在同一 prompt 内相对稳定。

## 什么会改变判断
- BLEU ≥ 32 on SynthWiki-32k → 支持
- BLEU < 28 → 反驳

## 为什么可能失败
1. bias 分布可能高度 context-dependent，单次估计捕获不了
2. debiasing 引入的估计噪声可能抵消排序修正的收益
```

### finding

```markdown
---
type: finding
status: active
tags: [debiasing, bleu, synthwiki, llama3]
links:
  - cards/debiased-k1-matches-k5
  - runs/verify-debiased-k1
---

# Debiased k=1 在 SynthWiki-32k 上 BLEU=33.2±0.4

3 seeds (42/43/44) 均值 33.2，标准差 0.4。
与 k=5 baseline (33.8±0.3) 差距 0.6 分，远低于 2 分阈值。

## 证据
| seed | k=1 BLEU | k=5 BLEU |
|------|----------|----------|
| 42   | 33.5     | 34.1     |
| 43   | 32.9     | 33.6     |
| 44   | 33.1     | 33.7     |

## 意味着什么
debiased k=1 可替代 k=5，节省 80% 排序计算开销。

## 局限
仅在 SynthWiki-32k 上验证，更长 context 或其他 benchmark 未测试。
```

### decision

```markdown
---
type: decision
status: active
tags: [model-selection, llama3]
links:
  - cards/baseline-bleu-33
  - cards/use-mistral-7b
---

# 使用 Llama-3-8B 作为基础模型

选择 Llama-3-8B 替代 Mistral-7B，因为后者 context window 仅 8k，不满足实验需求。

## 理由
1. Llama-3-8B context window 128k，满足 long-context QA
2. 社区支持更好，复现更容易
3. 参数量相近，对比公平

## 考虑过的替代方案
- Mistral-7B：context 8k，不够（archived，见 cards/use-mistral-7b）
- Qwen2-7B：context 32k 够用，但社区复现案例少

## 何时重审
如果出现 7B 级别、128k context、性能更好的开源模型。
```
