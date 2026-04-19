---
name: alan-pipeline
description: 管理研究项目的 card（知识单元）和 run（执行单元）。当用户需要记录实验发现、提出假设、做出决策、创建/执行研究任务时使用。适用于 .pipeline/ 目录存在的项目。
---

# Research Pipeline

用 card 和 run 两种原子单元驱动研究项目。

- **Card** — 一张说一件事的知识卡片，按类别存放，有结构性编号
- **Run** — 一个可执行的行动单元（跑实验 / 写章节 / 验证假设）

```
.pipeline/
  cards/
    method/<slug>.md       # 方法论 cards (p0, p1)
    exp/<slug>.md          # 实验与结果 cards (p0, p1)
    framing/<slug>.md      # 叙事框架 cards (p0, p1)
    archived/<slug>.md     # 归档 cards (p2，不分类别)
  runs/<slug>.yaml         # 执行单元，纯 YAML
```

## Card 操作

Card 是普通 Markdown 文件，用 `read`/`write`/`edit` 直接操作。

### 创建 card

```bash
write .pipeline/cards/{category}/{slug}.md
```

文件结构：

```markdown
---
category: method           # method | exp | framing
priority: p0               # p0 | p1 | p2
tags: [keyword1, keyword2]
links:
  - cards/method/other-card
  - runs/some-run
---

# 标题

1-3 句摘要。

## 1. 第一个要点
...

## 2. 第二个要点
...
```

完整 schema 和示例见 [references/card-schema.md](references/card-schema.md)。

### Section 编号与跨卡片引用

每个 `##` section 必须有序号：`## 1.`、`## 2.`、…

**跨卡片引用**格式：`{category}/{slug}#{section}`

```
method/debiased-sorting#2    →  method/debiased-sorting.md 的 ## 2.
exp/bleu-baseline#1          →  exp/bleu-baseline.md 的 ## 1.
```

当用户说「改 method/debiased-sorting#2」，直接定位到对应文件的 `## 2.` section。

### Priority 分级

| 级别 | 含义 | 目录 |
|------|------|------|
| `p0` | 核心事实——已验证，长期有效，其他 card 依赖它 | `cards/{category}/` |
| `p1` | 中间状态——合理但脆弱，待验证或可能修改 | `cards/{category}/` |
| `p2` | 归档——被取代、被证伪、不再相关 | `cards/archived/` |

变更：p1→p0（多次验证后升级）、p1→p2 / p0→p2（移入 archived/，写明原因）。

### 归档（降为 p2）

```bash
mkdir -p .pipeline/cards/archived
mv .pipeline/cards/{category}/{slug}.md .pipeline/cards/archived/{slug}.md
# edit frontmatter: priority: p2
# body 末尾加归档原因
```

归档后不保留原类别目录，统一放 `archived/`。

### 修改规则

**Slug 是身份。Slug 不变 = 同一张 card。**

| 操作 | 允许？ |
|------|--------|
| 改错别字、补格式 | ✅ |
| 补充/修改 section 内容 | ✅ |
| 新增 section（末尾追加新序号） | ✅ |
| 改变核心命题/主张 | ❌ 新建 card，旧 card 降为 p2 |
| 改变 category | ❌ 新建 card，mv 到对应目录 |

### 单一事实原则

**同一事实只存在于一张 card 中。** 创建新 card 前：

1. 检查现有 active cards 是否已覆盖相关内容
2. 如有重叠 → 提取重叠部分为独立小 card，原 card 改用引用：`见 method/debiased-sorting#1`
3. 不允许两张 card 说同一件事

### 维护

**p0 和 p1 cards 必须保持不过时。** 每当创建或修改 card 时：

1. 检查 links 中引用的 active cards 是否因新信息过时
2. 核心主张被取代 → 降为 p2，移入 archived/
3. 只需补充 → 原地修改（新增 section 或更新已有 section）

### 查找 card

```bash
ls .pipeline/cards/method/                                # method cards
ls .pipeline/cards/exp/                                   # exp cards
grep -l "priority: p0" .pipeline/cards/method/*.md        # p0 method cards
grep -l "debiasing" .pipeline/cards/**/*.md               # by tag
grep -rn "method/debiased-sorting#2" .pipeline/cards/     # who references this section
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
  description: "验证 method/debiased-sorting#2 的假设：debiased k=1 在 SynthWiki-32k 上匹配 k=5 精度",
  checker: "- 3 seeds 全部完成\n- BLEU mean±std 已记录\n- 产出 exp card",
  context: "方法见 method/debiased-sorting\n数据集：SynthWiki-32k",
  blocked_by: ["runs/setup-env"]
})
```

**description** = 为什么 + 大致怎么做（不可变）。可用 card 路径引用。
**checker** = done-when，不是 win-condition。即使假设被证伪，只要交付物齐全就是 done。

### Log 记录

| type | 记什么 | 示例 |
|------|--------|------|
| `progress` | 做了什么 | "3 seeds 全部跑完" |
| `observation` | 任务级观测 | "seed=42 BLEU=33.5" |
| `issue` | 遇到什么障碍 | "vllm 版本冲突" |
| `decision` | 任务级决策 | "降级到 vllm 0.4.1" |
| `output` | 产出了什么 | "产出 exp/bleu-baseline" |

**observation/decision 是任务级执行记录。** 项目级发现和决策应升级为 card。

### 记录产出（provenance）

```
RunUpdate({
  slug: "verify-k1",
  add_result_of: ["cards/exp/bleu-baseline"],
  log_entry: { type: "output", detail: "产出 exp/bleu-baseline" }
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
method card ──── 定义方法 ────→ run（验证实验）
                                  │
                                  ▼ 产出 (result_of)
                               exp card
                                  │
                                  ▼ 支撑
framing card ←── 引用 exp card 的结果构建叙事
      │
      ▼ 驱动
   下一个 run
```

## 规则

- **一事一卡**：一张 card 只说一件事。有重叠就拆分 + 引用。
- **不捏造**：数据、引用不编造。不确定就标 TBD。
- **不重复**：card 之间用路径引用（`见 method/debiased-sorting#2`），不复制内容。
- **不删除**：不要的 card 降为 p2 移入 archived/，不要的 run 标 cancelled/superseded。
- **Log 不沉淀知识**：任务级记录留 log；项目级升级为 card。
- **Active 不过时**：新建/修改 card 时检查关联 cards，过时就降级。

## Git 维护

每次修改 card（创建、编辑、归档）后，立即提交：

```bash
git add .pipeline/cards/
git commit -m "pipeline: update cards (<列出变更的 slug>)"
```

保持 `.pipeline/cards/` 下没有未提交的变更。
