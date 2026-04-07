---
name: alan-pipeline
description: 管理研究项目的 card（知识单元）和 run（执行单元）。当用户需要记录实验发现、提出假设、做出决策、创建/执行研究任务时使用。适用于 .pipeline/ 目录存在的项目。
---

# Research Pipeline

用 card 和 run 两种原子单元驱动研究项目。

- **Card** — 一张说一件事的知识卡片（假设 / 发现 / 决策）
- **Run** — 一个可执行的行动单元（跑实验 / 写章节 / 验证假设）

```
.pipeline/
  cards/<slug>.md         # 知识单元，Markdown + YAML frontmatter
  runs/<slug>.yaml        # 执行单元，纯 YAML
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
type: hypothesis          # hypothesis | finding | decision
status: active            # active | archived
tags: [keyword1, keyword2] # 自由关键词，方便检索
links:
  - cards/other-card
  - runs/some-run
---

# 标题（可验证的主张 / 发现了什么 / 选择了什么）

1-3 句摘要。

## 正文（按 type 组织，不强制）
```

三种 type 的推荐结构见 [references/card-schema.md](references/card-schema.md)。

### Card 修改规则

**标题是身份。标题不变 = 同一张 card。**

| 操作 | 允许？ |
|------|--------|
| 改错别字、补格式 | ✅ |
| 补充证据、加局限 | ✅ |
| 修改摘要措辞（不改命题） | ✅ |
| 改变核心命题/主张 | ❌ 新建 card，旧 card 标 archived |
| type 从 hypothesis 变成 finding | ❌ 新建 card |

### Card 状态

- `active` — 在工作集中
- `archived` — 不再纳入项目上下文（被取代、被证伪、不再相关）。归档原因写在 body 中。

### 查找 card

```bash
ls .pipeline/cards/
grep -l "type: finding" .pipeline/cards/*.md
grep -rl "BLEU" .pipeline/cards/
grep -l "debiasing" .pipeline/cards/*.md    # search by tag
```

## Run 操作

Run 通过 5 个专用工具管理（由 pi-alan 扩展提供）：

| 工具 | 用途 |
|------|------|
| `RunCreate` | 创建 run：slug、description、checker 等 |
| `RunList` | 列出所有 run，可按 status 过滤 |
| `RunGet` | 查看 run 完整详情 |
| `RunUpdate` | 追加 log、改 status/context、加 blocked_by/result_of |
| `RunShow` | 绑定 run 到当前 session，显示 widget |

### 创建 run

```
RunCreate({
  slug: "verify-debiased-k1",
  description: "验证 debiased k=1 能否在 SynthWiki-32k 上匹配 k=5 精度，方法是用 Llama-3-8B 跑 3 seeds 对比 BLEU",
  checker: "- 3 seeds 全部完成\n- BLEU mean±std 已记录\n- 产出 finding card",
  context: "基础模型：Llama-3-8B（见 cards/use-llama3-8b）\n数据集：SynthWiki-32k",
  blocked_by: ["runs/setup-env"]
})
```

**description** = 为什么 + 大致怎么做（不可变）。写得高层，不要写逐步脚本。
**checker** = done-when，不是 win-condition。即使假设被证伪，只要交付物齐全，run 就是 done。

### Log 记录

| type | 记什么 | 示例 |
|------|--------|------|
| `progress` | 做了什么 | "3 seeds 全部跑完" |
| `observation` | 任务级观测 | "seed=42 BLEU=33.5" |
| `issue` | 遇到什么障碍 | "vllm 版本冲突" |
| `decision` | 任务级决策 | "降级到 vllm 0.4.1" |
| `output` | 产出了什么 | "产出 cards/baseline-bleu-33" |

**observation/decision 是任务级执行记录。** 项目级的发现和决策应升级为 card。

### 记录产出（provenance）

run 产出了 card、draft、plot 时，用 `add_result_of` 记录：

```
RunUpdate({
  slug: "verify-k1",
  add_result_of: ["cards/baseline-bleu-33"],
  log_entry: { type: "output", detail: "产出 cards/baseline-bleu-33" }
})
```

### Context 可变

执行过程中引入新的 card 依赖、新的背景信息，直接更新 context：

```
RunUpdate({
  slug: "verify-k1",
  context: "基础模型：Llama-3-8B\n数据集：SynthWiki-32k\n新增：debiasing 策略见 cards/debiasing-strategy"
})
```

### 完成 / 取消 / 取代

```
RunUpdate({ slug: "verify-k1", status: "done" })        # 交付物齐全
RunUpdate({ slug: "old-run", status: "cancelled" })      # 主动放弃
RunUpdate({ slug: "old-run", status: "superseded" })     # 被新 run 取代
```

标 done 时工具会回显 checker，确认所有交付物存在。

Run 的完整字段定义见 [references/run-schema.md](references/run-schema.md)。

## Card 与 Run 的关系

```
hypothesis card ──── "待验证" ────→ run（实验）
                                      │
                                      ▼ 产出 (result_of)
                                   finding card
                                      │
                                      ▼ 驱动
decision card ←── "基于发现做出选择"
      │
      ▼ 约束 (context)
   下一个 run
```

## 规则

- **一事一卡**：一张 card 只说一件事。
- **不捏造**：数据、引用不编造。不确定就标 TBD。
- **不重复**：card/run 之间用 links/blocked_by/result_of 引用，不复制内容。
- **不删除**：不要的 card 标 archived，不要的 run 标 cancelled/superseded。
- **Log 不沉淀知识**：任务级 observation/decision 留在 log；项目级发现和决策升级为 card。
