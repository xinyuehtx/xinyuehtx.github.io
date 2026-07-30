# RFC 0001 · GitHub 原创项目自动聚合 + 博客科技感重设计

- 状态：**草案（待批准）**
- 作者：黄腾霄 / Claude Code
- 日期：2026-07-30
- 关联需求：
  1. 聚合原创（非 fork）仓库的 blog 内容到本博客
  2. 聚合原创仓库的 GitHub Page 作为「项目介绍」
  3. 定时任务自动检测并提 PR（固定分支，避免 PR 膨胀）
  4. 全站设计审查，强化科技感

---

## 1. 背景与目标

本仓库 `xinyuehtx.github.io` 是基于 **VitePress + @sugarat/theme** 的个人技术博客（156 篇存量文章 + AI 专栏）。

作者名下的多个**原创开源项目**（agentmon、agentic-html、cc-stagehand、agent-connect、doc-agent-extension…）各自维护着：

- 一个 `blog/` 目录（项目研发复盘文章）
- 一个 GitHub Pages 站点 / README（项目介绍）

这些内容目前散落在各仓库，没有在个人博客里汇聚。本 RFC 的目标是：

1. **自动**把这些原创项目的 blog 文章、项目介绍同步进本博客；
2. 用**定时任务 + 固定分支单一 PR**保持长期更新，且不产生 PR 垃圾；
3. 借这次改造顺带做一轮**科技感设计升级**。

### 非目标

- 不改动 156 篇存量博客与 AI 专栏的任何内容；
- 不同步 fork 仓库、归档的老旧仓库（2016–2019 的 C# 练手项目等）；
- 不做评论系统、全文检索后端等与本需求无关的功能。

---

## 2. 现状调研（已核实）

### 2.1 博客结构

```
posts/<slug>/index.md          # 每篇博客一个目录，frontmatter: title/date/tags/description
knowledge/ai/                  # AI 专栏
pages/                         # 独立页面（当前为空）
public/                        # 静态资源
.vitepress/config.mts          # 站点配置（nav / themeConfig / srcExclude）
.vitepress/theme/{index.ts,custom.css}   # 「Digital Meridian」深青绿主题
.github/workflows/deploy.yml   # push 到 main/master 自动构建部署 Pages
```

- 博客文章 frontmatter 约定：`title` / `date` / `tags` / `description`。
- `srcExclude` 已排除 `README.md`、`scripts/**`、`knowledge/**/docs/**`。
- @sugarat/theme 的文章流由 frontmatter 中带 `date` 的页面聚合而成。

### 2.2 原创仓库盘点（`fork=false`，来自 GitHub API）

**有 blog/ 目录的（需求 1 来源）：**

| 仓库 | blog 文章 | 说明 |
|---|---|---|
| `agentmon` | 3 篇 | macOS Agent 长任务监控桌宠（Swift） |
| `agentic-html` | 2 篇 | Agent 原生 HTML 编辑器（TypeScript） |

**已开启 GitHub Pages 的（需求 2 来源）：**

| 仓库 | Pages | README |
|---|---|---|
| `agent-connect` | `xinyuehtx.github.io/agent-connect/` | README.zh-CN.md |
| `agentmon` | `xinyuehtx.github.io/agentmon/` | README.md（中文） |
| `cc-stagehand` | `xinyuehtx.github.io/cc-stagehand/` | README.zh-CN.md |
| `doc-agent-extension` | `xinyuehtx.github.io/doc-agent-extension/` | README.md |

> 关键事实：源仓库的 blog 文章是**纯 Markdown（H1 标题 + 正文，无 YAML frontmatter）**，图片/链接多为**相对路径**（如 `../docs/x.png`）。导入时必须合成 frontmatter，并把相对链接改写成绝对 raw 链接。

### 2.3 选择标准（"原创项目"的精确定义）

一个仓库进入「精选项目」集合，当且仅当：

```
fork == false
且 名字 ∉ {xinyuehtx.github.io, testblog.github.io, "-"}   # 排除博客自身与测试/空仓库
且 (has_pages == true  或  存在 blog/ 目录)                  # 有对外内容才值得收录
```

当前命中 5 个：`agentmon`、`agentic-html`、`cc-stagehand`、`agent-connect`、`doc-agent-extension`。老旧 C# 练手仓库因不满足条件被自动过滤。**该规则写死在同步脚本里，新增符合条件的仓库会被自动纳入。**

---

## 3. 设计方案

### 3.1 内容落位（Bot 独占目录，隔离风险）

同步脚本只写以下两个「Bot 独占」区域，**每次运行前先清空再重建**，保证幂等；**绝不触碰**存量 `posts/<slug>/`、`knowledge/`：

```
posts/oss/<repo>/<slug>.md     # 需求1：导入的项目 blog 文章（进入主文章流）
projects/index.md              # 需求2 + 需求4：项目展示页（自动生成卡片）
projects/<repo>.md             # 需求2：单个项目介绍页（由 README 生成）
.vitepress/projects.data.ts    # 项目元数据（供首页/展示页消费）
```

- **导入的 blog 文章**放在 `posts/oss/**`：带合成 `date` frontmatter，自然出现在博客文章流里；清空只需 `rm -rf posts/oss`，与手写文章零交集。
- **项目介绍**放在 `projects/**`：`projects/<repo>.md` 是单项目详情，`projects/index.md` 是聚合展示页。

### 3.2 需求 1：blog 文章导入

对每个含 `blog/` 目录的精选仓库，逐篇 `blog/*.md`：

1. **标题**：取正文第一个 `# H1`，无则用文件名。
2. **日期**：调 `commits?path=blog/<file>` 取该文件**最早提交日期**作为发布日期（稳定、可复现）。
3. **标签**：`[<repo>, '开源项目']`。
4. **摘要**：取首个 `>` 引用块或首段纯文本，截断为 `description`。
5. **链接/图片改写**：相对路径 → `https://raw.githubusercontent.com/xinyuehtx/<repo>/<branch>/...`（图片）或 `https://github.com/xinyuehtx/<repo>/blob/<branch>/...`（文档链接）。
6. **溯源脚注**：正文末尾追加「> 本文首发于 [`<repo>`](repo链接) 仓库」。
7. 写入 `posts/oss/<repo>/<slug>.md`。

### 3.3 需求 2：项目介绍导入

对每个精选仓库：

1. 取 README（优先 `README.zh-CN.md`，回退 `README.md`）。
2. 生成 `projects/<repo>.md`：
   - frontmatter：`title`、`description`；
   - 顶部信息条：语言、Star 数、最近更新、**GitHub 仓库**按钮、**在线 Demo/Pages**按钮（若 `has_pages`）；
   - README 正文（去除 CI badge 噪声、改写相对链接为绝对链接）。
3. 收集元数据（name/desc/language/stars/pagesUrl/repoUrl/updatedAt/blogCount）写入 `.vitepress/projects.data.ts`。

### 3.4 需求 3：定时同步 + 固定分支单一 PR

新增 `.github/workflows/sync-projects.yml`：

```
on:
  schedule: [ cron: "23 19 * * *" ]   # 每日一次（UTC，约北京时间凌晨），错峰非整点
  workflow_dispatch:                   # 支持手动触发
permissions:
  contents: write
  pull-requests: write
steps:
  - checkout
  - setup node + pnpm
  - run: node scripts/sync-github-projects.mjs   # 用 GITHUB_TOKEN 读公开仓库，避免限流
  - uses: peter-evans/create-pull-request@v6
      with:
        branch: bot/sync-projects        # ← 固定分支
        base: master
        title: "chore(sync): 同步原创项目 blog 与项目介绍"
        commit-message: ...
        body: ...（本次变更摘要）
        delete-branch: false
```

**为什么不会 PR 膨胀**：`peter-evans/create-pull-request` 对**同一分支**只维护**一个 PR**——已存在则更新该分支与 PR，不存在才新建。配合固定分支 `bot/sync-projects`，全程只有 1 个滚动更新的 PR。无变更时脚本输出零 diff，action 直接跳过、不建 PR。

**部署联动**：PR 合并进 `master` → 触发既有 `deploy.yml` → 自动发布。同步分支的推送不会触发部署（只监听 main/master）。

**前置条件（需作者在 GitHub 设置里开启一次）**：
`Settings → Actions → General → Workflow permissions` 勾选
**"Allow GitHub Actions to create and approve pull requests"**，否则 action 无权建 PR。此项会在实现完成后明确提示。

### 3.5 需求 4：科技感设计审查与升级

**现状评估**：已有「Digital Meridian」深青绿玻璃态主题（网格底纹、噪点、光边卡片、hover 光晕），基础不错。不足：

- 首页仅 Hero + 3 个 feature，信息密度低，缺少「项目」这一核心内容；
- Hero 静态，缺乏动态科技感；
- 没有统一的项目卡片组件。

**升级项（克制、性能优先、尊重 `prefers-reduced-motion`）**：

1. **首页项目展示区**：`index.md`（`layout: home`）的 frontmatter 之后追加「精选开源项目」区块，渲染项目卡片（数据来自 `projects.data.ts`）。
2. **`/projects/` 展示页 + 导航入口**：nav 增加「开源项目」。
3. **可复用组件**（注册进 theme）：
   - `<ProjectCard>`：语言色点、Star、标签、仓库/Demo 按钮、hover 光晕；
   - `<ProjectGrid>`：响应式网格。
4. **Hero 增强**：轻量 canvas/SVG 动态背景（粒子连线或流光网格），reduced-motion 时降级为静态。
5. **细节打磨**：标题渐变、卡片景深、暗色模式对比度、滚动条与选区、构建信息页脚。

组件与样式改动**仅新增/扩展**，不破坏 @sugarat/theme 既有渲染。

---

## 4. 涉及文件清单

**新增**
```
rfcs/0001-github-projects-sync-and-tech-redesign.md   # 本文档
scripts/sync-github-projects.mjs                      # 同步脚本
.github/workflows/sync-projects.yml                   # 定时任务
projects/index.md                                     # 项目展示页（脚本生成）
projects/<repo>.md                                    # 项目介绍（脚本生成）
posts/oss/<repo>/<slug>.md                            # 导入的 blog（脚本生成）
.vitepress/projects.data.ts                           # 项目元数据（脚本生成）
.vitepress/theme/components/ProjectCard.vue
.vitepress/theme/components/ProjectGrid.vue
.vitepress/theme/components/HeroCanvas.vue            # 动态背景
```

**修改**
```
.vitepress/config.mts          # nav 增加「开源项目」；srcExclude 视情况调整
.vitepress/theme/index.ts      # 注册全局组件
.vitepress/theme/custom.css    # 科技感样式增强
index.md                       # 首页追加项目展示区
README.md                      # 补充「自动同步机制」说明
.gitignore                     # 视情况（projects/ 与 posts/oss/ 是否入库——入库）
```

> 说明：脚本产物（`projects/**`、`posts/oss/**`、`projects.data.ts`）**提交入库**，这样即使不跑脚本也能正常构建；同步靠定时 PR 更新它们。

---

## 5. 幂等性与稳定性

- 脚本每次先删后建 Bot 独占目录，输出**确定性排序**（按仓库名、文件名排序；日期取自 git 历史而非运行时间），保证「无实质变化 → 无 diff → 无 PR」。
- 网络失败/单仓库异常：跳过该仓库并告警，不影响其余仓库（部分成功优于全失败）。
- 图片不落库：统一改写为 GitHub raw 绝对链接，避免二进制同步与体积膨胀。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 误删手写文章 | Bot 只操作 `posts/oss/**` 与 `projects/**`，路径前缀隔离 |
| 上游 Markdown 破坏构建 | `ignoreDeadLinks` 已开；导入时清洗；本地 `pnpm build` 验证 |
| GitHub Actions 无权建 PR | 文档提示开启仓库设置项 |
| API 限流 | Actions 内用 `GITHUB_TOKEN` 认证请求 |
| 动画影响性能/晕动 | 轻量实现 + `prefers-reduced-motion` 降级 |

## 7. 验收标准

1. `node scripts/sync-github-projects.mjs` 本地可跑，生成 5 个项目介绍 + agentmon/agentic-html 共 5 篇导入 blog。
2. `pnpm build` 通过，`projects/` 与导入文章正常渲染，图片可加载。
3. 首页出现「精选开源项目」区块；`/projects/` 展示页与导航可用。
4. `sync-projects.yml` 手动触发能在 `bot/sync-projects` 上更新同一个 PR。
5. 存量 156 篇文章与 AI 专栏零改动。

## 8. 实施步骤（批准后执行）

1. 写同步脚本 → 本地运行生成内容 → `pnpm build` 验证。
2. 加定时任务 workflow。
3. 设计升级（组件 + 首页 + 样式）→ 再次 `pnpm build` 验证。
4. 更新 README，提示开启仓库 PR 权限。
5. 汇总变更，交付。
