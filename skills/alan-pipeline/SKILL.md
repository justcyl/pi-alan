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
# 写入 .pipeline/cards/<slug>.md
write .pipeline/cards/debiased-k1-matches-k5.md
```

文件结构：

```markdown
---
type: hypothesis          # hypothesis | finding | decision
status: active            # active | archived
links:
  - cards/other-card
  - runs/some-run
---

# 标题（可验证的主张 / 发现了什么 / 选择了什么）

1-3 句摘要。

## 正文（按 type 组织，不强制）
```

三种 type 的推荐结构见 [references/card-schema.md](references/card-schema.md)。

### 查找 card

```bash
# 列出所有 card
ls .pipeline/cards/

# 按 type 过滤
grep -l "type: finding" .pipeline/cards/*.md

# 按内容搜索
grep -rl "BLEU" .pipeline/cards/
```

### 归档 card

编辑 frontmatter 将 `status: active` 改为 `status: archived`。不要删除文件。

## Run 操作

Run 通过 5 个专用工具管理（由 pi-run 扩展提供）：

| 工具 | 用途 |
|------|------|
| `RunCreate` | 创建 run：指定 slug、goal、checker 等 |
| `RunList` | 列出所有 run，可按 status 过滤 |
| `RunGet` | 查看 run 完整详情 |
| `RunUpdate` | 追加 log、改 status、加 blocked_by |
| `RunShow` | 绑定 run 到当前 session，显示 widget |

### 创建 run

```
RunCreate({
  slug: "verify-debiased-k1",
  goal: "在 SynthWiki-32k 上跑 debiased k=1 vs k=5 对比实验",
  checker: "- 完成 3 seeds\n- BLEU mean±std\n- 差距 ≤ 2 分",
  description: "1. 加载 Llama-3-8B\n2. 跑 3 seeds\n3. 对比 BLEU",
  links: ["cards/debiased-k1-matches-k5"],
  blocked_by: ["runs/setup-env"]
})
```

Run 的 goal、description、checker、context、links 创建后**不可修改**。要改目标，archive 旧 run 建新的。

### 执行 run 时的 log 记录

用 `RunUpdate` 追加 log，选择合适的 type：

| type | 记什么 | 示例 |
|------|--------|------|
| `progress` | 做了什么 | "配置实验环境完毕" |
| `observation` | 知道了什么 | "seed=42 BLEU=33.5" |
| `issue` | 出了什么问题 | "vllm 版本冲突" |
| `decision` | 做了什么选择 | "降级到 0.4.1" |
| `output` | 造出了什么 | "产出 cards/baseline-bleu-33" |

```
RunUpdate({
  slug: "verify-debiased-k1",
  log_entry: { type: "observation", detail: "seed=42 BLEU=33.5" }
})
```

### 完成 run

标 done 前，对照 checker 逐条检查：

```
RunUpdate({ slug: "verify-debiased-k1", status: "done" })
```

工具会回显 checker 内容，确认所有条件满足。

### 绑定 session

开始处理某个 run 时，绑定它到当前 session 以显示状态 widget：

```
RunShow({ slug: "verify-debiased-k1" })
```

完成后解绑：`RunShow({ slug: "" })`

Run 的完整字段定义见 [references/run-schema.md](references/run-schema.md)。

## Card 与 Run 的关系

```
hypothesis card ──── "待验证" ────→ run（实验）
                                      │
                                      ▼ 产出
                                   finding card
                                      │
                                      ▼ 驱动
decision card ←── "基于发现做出选择"
      │
      ▼ 约束
   下一个 run
```

典型流转：

1. 写一张 **hypothesis** card（"debiased k=1 能匹配 k=5"）
2. 创建一个 **run** 来验证它（goal 指向这张 card）
3. 执行 run，过程中记 log
4. 实验完成，产出 **finding** card（"BLEU=33.2±0.4"）
5. 基于 finding 写 **decision** card（"确定用 debiased k=1"）
6. 决策约束下一个 run

## 规则

### 什么时候创建 card

- 获得了一个**可验证的主张** → hypothesis
- 观察到了**确定性的事实**（实验结果、文献结论） → finding
- 做出了**约束后续工作的选择** → decision

### 什么时候创建 run

- 需要执行一个**有明确完成标准的行动**（跑实验、写章节、验证假设、搭环境）

### 不做什么

- **不捏造**：数据、引用、实验结果不编造。不确定就标 TBD。
- **不重复**：card 之间、run 之间用 links 引用，不复制内容。
- **不删除**：不要的 card 标 archived，不要的 run 标 archived。文件保留。
- **一事一卡**：一张 card 只说一件事。想说两件事就建两张。
