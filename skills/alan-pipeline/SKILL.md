---
name: alan-pipeline
description: 管理研究项目的 card（知识单元）和 run（执行单元）。当用户需要记录实验发现、提出假设、做出决策、创建/执行研究任务时使用。适用于 .pipeline/ 目录存在的项目。
---

# Research Pipeline

用 card 和 run 两种原子单元驱动研究项目。

- **Card** — 一张说一件事的知识卡片，带跨卡片编号
- **Run** — 一个可执行的行动单元（跑实验 / 写章节 / 验证假设）

```
.pipeline/
  cards/<slug>.md              # p0 + p1 cards（活跃）
  cards/archived/<slug>.md     # p2 cards（归档）
  runs/<slug>.yaml             # 执行单元，纯 YAML
```

## Card 操作

Card 是普通 Markdown 文件，用 `read`/`write`/`edit` 直接操作。

### 创建 card

```bash
write .pipeline/cards/<slug>.md
```

文件结构：

```markdown
---
id: M01                    # 跨卡片唯一编号
category: method            # method | exp | framing
priority: p0                # p0 | p1 | p2
tags: [keyword1, keyword2]
links:
  - cards/other-card
  - runs/some-run
---

# M01 标题

1-3 句摘要。

## M01.1 第一个要点
...

## M01.2 第二个要点
...
```

完整 schema 和示例见 [references/card-schema.md](references/card-schema.md)。

### 编号规则

每张 card 有全局唯一 ID = `{类别前缀}{序号}`：

| 类别 | 前缀 | 覆盖 |
|------|------|------|
| method | M | 方法论、算法、技术方案 |
| exp | E | 实验设置、结果、分析 |
| framing | F | intro, related work, discussion, conclusion |

**Section 编号**：`{id}.{n}`（如 `M01.1`, `E03.2`）。跨卡片引用直接用编号：`见 M01.2`。

编号一经分配不可复用。创建新 card 前先 `ls` 确认下一个可用序号。

### Priority 分级

| 级别 | 含义 | 目录 |
|------|------|------|
| `p0` | 核心事实——已验证，长期有效，其他 card 依赖它 | `cards/` |
| `p1` | 中间状态——合理但脆弱，待验证或可能修改 | `cards/` |
| `p2` | 归档——被取代、被证伪、不再相关 | `cards/archived/` |

变更：p1→p0（多次验证后升级）、p1→p2（证伪或取代，移入 archived/）。

### 归档（降为 p2）

```bash
mkdir -p .pipeline/cards/archived
mv .pipeline/cards/<slug>.md .pipeline/cards/archived/<slug>.md
# edit frontmatter: priority: p2
# body 末尾加归档原因
```

### 修改规则

**ID 和标题是身份。ID 不变 = 同一张 card。**

| 操作 | 允许？ |
|------|--------|
| 改错别字、补格式 | ✅ |
| 补充 section、加局限 | ✅（新增 section 用下一个编号） |
| 修改摘要措辞（不改命题） | ✅ |
| 改变核心命题/主张 | ❌ 新建 card，旧 card 降为 p2 |
| 改变 category | ❌ 新建 card |

### 单一事实原则

**同一事实只存在于一张 card 中。** 创建新 card 前：

1. 检查现有 active cards 是否已覆盖相关内容
2. 如有重叠 → 提取重叠部分为独立小 card，原 card 用引用替代：`见 M03.1`
3. 不允许两张 card 说同一件事

### 维护

**p0 和 p1 cards 必须保持不过时。** 每当创建或修改 card 时：

1. 检查 links 中引用的 active cards 是否因新信息过时
2. 核心主张被取代 → 降为 p2
3. 只需补充 → 原地修改（加 section 或更新已有 section）

### 查找 card

```bash
ls .pipeline/cards/*.md                              # active cards
grep -l "category: exp" .pipeline/cards/*.md          # by category
grep -l "priority: p0" .pipeline/cards/*.md           # by priority
grep -l "debiasing" .pipeline/cards/*.md              # by tag
grep -rn "M01.2" .pipeline/cards/                     # who references M01.2
```

## Run 操作

Run 通过 5 个专用工具管理（由 pi-alan 扩展提供）：

| 工具 | 用途 |
|------|------|
| `RunCreate` | 创建 run：slug、description、checker 等 |
| `RunList` | 列出所有 run，可按 status 过滤 |
| `RunGet` | 查看 run 完整详情 |
| `RunUpdate` | 追加 log、改 status/context/tags、加 blocked_by/result_of |
| `RunShow` | 绑定 run 到当前 session，显示 widget |

### 创建 run

```
RunCreate({
  slug: "verify-debiased-k1",
  description: "验证 M01.2 的假设：debiased k=1 在 SynthWiki-32k 上匹配 k=5 精度",
  checker: "- 3 seeds 全部完成\n- BLEU mean±std 已记录\n- 产出 exp card",
  context: "模型：Llama-3-8B（见 M01）\n数据集：SynthWiki-32k",
  blocked_by: ["runs/setup-env"]
})
```

**description** = 为什么 + 大致怎么做（不可变）。可用 card 编号引用。
**checker** = done-when，不是 win-condition。即使假设被证伪，只要交付物齐全就是 done。

### Log 记录

| type | 记什么 | 示例 |
|------|--------|------|
| `progress` | 做了什么 | "3 seeds 全部跑完" |
| `observation` | 任务级观测 | "seed=42 BLEU=33.5" |
| `issue` | 遇到什么障碍 | "vllm 版本冲突" |
| `decision` | 任务级决策 | "降级到 vllm 0.4.1" |
| `output` | 产出了什么 | "产出 cards/bleu-baseline-results (E01)" |

**observation/decision 是任务级执行记录。** 项目级发现和决策应升级为 card。

### 记录产出（provenance）

```
RunUpdate({
  slug: "verify-k1",
  add_result_of: ["cards/bleu-baseline-results"],
  log_entry: { type: "output", detail: "产出 E01" }
})
```

### Context 可变

执行中引入新依赖，直接更新 context：

```
RunUpdate({
  slug: "verify-k1",
  context: "模型：Llama-3-8B\n数据集：SynthWiki-32k\n新增：debiasing 策略见 M01.1"
})
```

### 完成 / 取消 / 取代

```
RunUpdate({ slug: "verify-k1", status: "done" })
RunUpdate({ slug: "old-run", status: "cancelled" })
RunUpdate({ slug: "old-run", status: "superseded" })
```

Run 完整字段见 [references/run-schema.md](references/run-schema.md)。

## Card 与 Run 的关系

```
method card (M01) ──── 定义方法 ────→ run（验证实验）
                                        │
                                        ▼ 产出 (result_of)
                                     exp card (E01)
                                        │
                                        ▼ 支撑
framing card (F01) ←── 引用 E01.2 的结果构建叙事
      │
      ▼ 驱动
   下一个 run
```

## 规则

- **一事一卡**：一张 card 只说一件事。有重叠就拆分 + 引用。
- **不捏造**：数据、引用不编造。不确定就标 TBD。
- **不重复**：card 之间用编号引用（`见 M01.2`），不复制内容。
- **不删除**：不要的 card 降为 p2 移入 archived/，不要的 run 标 cancelled/superseded。
- **Log 不沉淀知识**：任务级记录留 log；项目级升级为 card。
- **Active 不过时**：新建/修改 card 时检查关联 cards，过时就降级。

## Git 维护

每次修改 card（创建、编辑、归档）后，立即提交：

```bash
git add .pipeline/cards/
git commit -m "pipeline: update cards (<列出变更的 id>)"
```

保持 `.pipeline/cards/` 下没有未提交的变更。
