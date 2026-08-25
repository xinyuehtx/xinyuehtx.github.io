---
title: "Harbor 轨迹查看器（Trajectory Viewer）"
description: "🔗 姊妹项目 —— Claude Code Trajectory Viewer"
hidden: true
recommend: false
editLink: false
lastUpdated: false
---
<div class="project-page-header">
  <p class="project-meta"><span class="proj-lang"><i class="proj-dot" style="--dot:#3178c6"></i>TypeScript</span> · <span>⭐ 3</span> · <span>🕒 更新于 2026-08-07</span></p>
  <p class="project-actions"><a class="proj-btn proj-btn-primary" href="https://github.com/xinyuehtx/harbor-trajectory-viewer" target="_blank" rel="noreferrer">GitHub 仓库</a> <a class="proj-btn" href="https://xinyuehtx.github.io/harbor-trajectory-viewer/" target="_blank" rel="noreferrer">在线 Demo ↗</a></p>
</div>

[English](https://github.com/xinyuehtx/harbor-trajectory-viewer/blob/main/README.md) · **简体中文**

将 [Harbor](https://github.com/harbor-framework/harbor) 的 **ATIF** 智能体轨迹文件
——即 Harbor 为一次 agent 运行写入的 `*.trajectory.json` 日志——渲染为清爽、易读的
网页界面。你可以完整查看用户提问、智能体推理、工具调用与观察结果的**步骤时间线**；
Token / 成本指标；被委派的子智能体；当运行修改了文件时，还能以 **红/绿代码 diff** 查看
改动。把它指向一整个 **jobs 文件夹**，即可在侧栏切换各个任务（并显示状态与 reward）。

_ATIF（Agent Trajectory Interchange Format）是 Harbor 用于记录 agent 运行的标准化 JSON
格式——详见[规范](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md)。_

**在线演示：** <https://xinyuehtx.github.io/harbor-trajectory-viewer/>（把 `.json` 拖进页面即可）

> 🔗 **姊妹项目 —— [Claude Code Trajectory Viewer](https://github.com/xinyuehtx/cc-trajectory-viewer)**
> 同样的思路，面向 **[Claude Code](https://claude.com/claude-code)** 的 `.jsonl` 会话日志：
> 浏览器端查看时间线、聚合的工具调用分组与按文件的代码差异。
> 如果本工具对你有帮助，也欢迎给 **[cc-trajectory-viewer](https://github.com/xinyuehtx/cc-trajectory-viewer)** 点个 ⭐。

## 界面预览

| 时间线 | 差异 |
| --- | --- |
| ![时间线标签页](https://raw.githubusercontent.com/xinyuehtx/harbor-trajectory-viewer/main/docs/screenshots/timeline-dark.png) | ![差异标签页](https://raw.githubusercontent.com/xinyuehtx/harbor-trajectory-viewer/main/docs/screenshots/diffs-dark.png) |

浅色主题 —— 按文件聚合的 diff 与左侧目录树：

![差异标签页 · 浅色](https://raw.githubusercontent.com/xinyuehtx/harbor-trajectory-viewer/main/docs/screenshots/diffs-light.png)

## 功能特性

- 🧭 **时间线（Timeline）标签页** —— 展示用户 / 智能体消息与可折叠的**推理**
  （`reasoning_content`），并将**连续的工具调用聚合为可折叠的分组（cluster）**。
  **系统**步骤会显示上下文管理徽标（压缩 / 边界）。
- 🌈 **Diff 标签页** —— 将编辑类工具调用（Claude Code 的 `Edit` / `Write` / `MultiEdit`、
  OpenHands 的 `str_replace_editor` 等）重建为按文件的 diff，可在**单栏**与**双栏**视图间
  切换，并带左侧目录树。
- 📊 **指标** —— prompt / completion / 缓存 token 与总成本；优先取 `final_metrics`，否则按
  步骤累加。
- 🧩 **子智能体** —— 内嵌的 `subagent_trajectories` 会在侧栏列出，被委派的
  `subagent_trajectory_ref` 以 chip 呈现；点击即可下钻，并有面包屑返回上层。
- 🗂️ **jobs 文件夹** —— 打开一个目录，其下每个 `trajectory.json` 都会成为可选择的任务
  （侧栏显示 模型 / id、状态与 reward）。
- 🌐 **标注（面向 Agent 的 skill）** —— 生成一个 sidecar 文件，为**每个工具调用分组添加
  一行摘要**，并把**每条消息翻译**为目标语言，与原文并排展示。
- 🖥️ **两种打开方式** —— 从命令行打开文件或文件夹，或在浏览器里拖拽 / 上传（纯静态，
  可部署到 GitHub Pages）。
- 🔒 **纯本地** —— CLI 的所有内容都由 `localhost` 提供，不会上传任何数据。

## 快速开始（命令行）

无需安装：

```bash
npx @tengxiaohtx/harbor-trajectory-viewer path/to/trajectory.json
```

或全局安装：

```bash
npm install -g @tengxiaohtx/harbor-trajectory-viewer
hbtv path/to/trajectory.json
```

打开一个 **jobs 文件夹**（递归发现其下所有 `trajectory.json`）：

```bash
hbtv path/to/jobs/
```

不带参数运行则以上传模式打开浏览器：

```bash
hbtv
```

### 命令行用法

```
hbtv [file.json | dir] [options]     打开一个轨迹文件，或一个 jobs 文件夹（默认命令）
hbtv extract <file.json> [opts]      生成标注脚手架（.hbtv.json）
hbtv skill install [--dir <dir>]     把 Claude Code skill 安装到 .claude/skills

view 选项：
  -p, --port <n>   监听端口（默认 4180）
  -a, --ann <f>    要叠加的标注 JSON（默认使用同目录的 <file>.hbtv.json）
      --no-open    不自动打开浏览器

extract 选项：
  -o, --out <f>    输出路径（默认 <file>.hbtv.json）
      --lang <s>   记录在脚手架中的目标语言（例如 "简体中文"）

  -h, --help       显示帮助
  -v, --version    显示版本
```

## 轨迹文件在哪里？

Harbor 会把 ATIF 轨迹（名为 `trajectory.json` 或 `*.trajectory.json`）写入某次任务的
日志 / 输出目录。打开当前目录下最新的一个：

```bash
hbtv "$(ls -t **/*trajectory*.json 2>/dev/null | head -1)"
```

## 打开一个 jobs 文件夹

把 CLI 指向一个目录，它会递归找出每个 `trajectory.json`，并结合路径与各任务的同级
`job.json` / `verifier/reward.json` 生成任务条目：

```bash
hbtv path/to/jobs/
```

侧栏会把每个任务列为 **模型 / job-id**，并显示运行**状态**与平均 **reward**，点击即可切换。
这非常适合对比同一任务在不同模型上的表现。典型目录结构：

```
jobs/
  <模型>/<job-id>/…/agent/trajectory.json
  <模型>/<job-id>/job.json          # 状态、ids
  <模型>/<job-id>/…/verifier/reward.json
```

## 仅用浏览器

查看器是纯静态 SPA，无需后端。打开
[在线演示](https://xinyuehtx.github.io/harbor-trajectory-viewer/)（或你自己的 Pages 部署），
把 `.json` 文件拖到页面上即可。也可以通过 `?src=<url>` 指向一个已托管的文件。

## 标注：摘要与翻译

查看器可以叠加一个同目录的 sidecar 文件 `*.hbtv.json`，为**每组连续工具调用**添加一行
**摘要（summary）**，并为**每条消息**添加**翻译（translation）**。可由 `view-trajectory`
这个 skill 驱动 Agent 自动生成，也可以手动完成：

```bash
# 1) 生成脚手架 —— 枚举所有消息与工具调用分组，并正确绑定 key
hbtv extract trajectory.json --lang "简体中文"

# 2) 在 trajectory.json.hbtv.json 中填写空的 "summary" / "translation" 字段

# 3) 查看 —— 会自动加载同目录的 .hbtv.json
hbtv trajectory.json
```

摘要会显示在每个分组的标题栏；翻译显示在每条消息下方（可在侧边栏开关）。
只需编辑 `summary` / `translation` 字段——`id` / `original` / `tools` 字段用于把标注
绑定到界面上的正确位置，请勿改动。

## Claude Code skill

npm 包内置了一个位于 `skill/view-trajectory/` 的 skill。把它安装到项目级（或用户级）的
`.claude/skills/`：

```bash
hbtv skill install            # 安装到 ./.claude/skills
hbtv skill install --dir ~    # 安装到 ~/.claude/skills（对所有项目生效）
```

之后你就可以让 Claude Code 按需执行——例如 *“看看这次运行的轨迹”* 或
*“把这段轨迹总结并翻译成中文”*——它会定位最新的 `trajectory.json`，按需生成标注，
并打开查看器。

## 本地开发

```bash
pnpm install
pnpm dev            # Vite 开发服务器（上传模式）
pnpm build          # 产物输出到 dist/
node bin/cli.js path/to/trajectory.json   # 用真实构建产物测试 CLI
pnpm typecheck
```

技术栈：React 18 + Vite + TypeScript，图标用 `lucide-react`。Markdown 使用 `marked` +
`DOMPurify`，语法高亮使用 `highlight.js`，diff 使用 `diff`（jsdiff）。CLI（`bin/cli.js`）
仅使用 Node.js 内置模块。

## 自行部署（GitHub Pages）

推送到 `main` 分支后，[Pages 工作流](https://github.com/xinyuehtx/harbor-trajectory-viewer/blob/main/.github/workflows/deploy-pages.yml) 会自动构建并部署。
在仓库设置中把 **Pages → Source 设为 GitHub Actions**。构建使用 `base: './'`，因此可在任意
子路径下工作。

## 发布到 npm

发布由 [`npm-publish.yml`](https://github.com/xinyuehtx/harbor-trajectory-viewer/blob/main/.github/workflows/npm-publish.yml) 自动完成：
先添加仓库密钥 `NPM_TOKEN`，然后创建一个 GitHub Release。也可手动发布：

```bash
npm login
npm publish --access public   # 通过 prepublishOnly 触发构建
```

## 轨迹格式（ATIF）

一个 JSON 对象：`schema_version`、`agent` 与一个 `steps[]` 数组。每个 step 的 `source`
为 `system` / `user` / `agent`，包含 `message`（字符串或多模态内容块）、可选的
`reasoning_content`、`tool_calls[]`、内嵌的 `observation.results[]`（通过 `source_call_id`
与工具调用对应）以及 `metrics`。根对象还可携带 `final_metrics` 与内嵌的
`subagent_trajectories[]`。详见
[ATIF 规范](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md)。

## 许可证

MIT © xinyuehtx
