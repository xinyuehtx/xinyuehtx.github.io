---
title: "doc-agent-extension"
description: "将「浏览器选区定位」与「本地官方 CLI 执行」打通的 AI 文档编辑扩展。"
hidden: true
recommend: false
editLink: false
lastUpdated: false
---
<div class="project-page-header">
  <p class="project-meta"><span class="proj-lang"><i class="proj-dot" style="--dot:#3178c6"></i>TypeScript</span> · <span>⭐ 0</span> · <span>🕒 更新于 2026-07-23</span></p>
  <p class="project-actions"><a class="proj-btn proj-btn-primary" href="https://github.com/xinyuehtx/doc-agent-extension" target="_blank" rel="noreferrer">GitHub 仓库</a> <a class="proj-btn" href="https://xinyuehtx.github.io/doc-agent-extension/" target="_blank" rel="noreferrer">在线 Demo ↗</a></p>
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/xinyuehtx/doc-agent-extension/main/packages/chrome-extension/icons/icon.svg" width="88" alt="doc-agent-extension logo" />
</p>

<p align="center">
  将「浏览器选区定位」与「本地官方 CLI 执行」打通的 AI 文档编辑扩展。
</p>

<p align="center">
  <a href="https://github.com/xinyuehtx/doc-agent-extension/actions/workflows/build-extension.yml"><img src="https://github.com/xinyuehtx/doc-agent-extension/actions/workflows/build-extension.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/xinyuehtx/doc-agent-extension/releases"><img src="https://img.shields.io/github/v/release/xinyuehtx/doc-agent-extension?include_prereleases&sort=semver" alt="Release" /></a>
  <a href="https://xinyuehtx.github.io/doc-agent-extension/"><img src="https://img.shields.io/badge/docs-online-6366f1" alt="Docs" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-06b6d4" alt="MV3" />
</p>

> 📖 **在线文档**：<https://xinyuehtx.github.io/doc-agent-extension/>

在钉钉文档 / 飞书 / Notion 页面像 VSCode 元素选择器一样**拾取要改的地方**，由本地官方 CLI（`dws` / `lark-cli` / `ntn`）**实际执行变更**。浏览器只做定位，不接触任何凭据。

> 架构详见 `rfcs/selection-cli-editing.md` 与 `specs/selection-cli-editing.md`。协作工作流见 `AGENTS.md`。

## 架构（方案 A）

```
[浏览器] 选择器 overlay → SelectionContext(provider/surface/doc/target/snapshot)
   → [Gateway] /selection /edit  → CLI 代理(白名单, shell:false) / 可选 qodercli
   → dws | lark-cli | ntn  → 官方 OpenAPI → 改文档 / 多维表 → 结果回流高亮
```

- **浏览器只做定位**，不执行变更；变更全部走官方 CLI。
- **钉钉优先**打通「文字 + 多维表」，飞书 / Notion 适配器已就绪但默认未启用（分端灰度）。
- 本地 Agent(qodercli) **可选**：Direct 模式直连 CLI 模板；Agent 模式让 qodercli 推理后调 CLI。

## 执行模式（隐藏 MCP，可一键回切）

| 模式 | 开关 | 行为 |
|---|---|---|
| `cli`（默认） | `AGENT_EXECUTION_MODE=cli` + 扩展 `EXECUTION_MODE='cli'` | 选区+CLI 链路；**不挂 `/bridge`**、不生成 mcp-config |
| `mcp`（回滚） | `AGENT_EXECUTION_MODE=mcp` + 扩展 `EXECUTION_MODE='mcp'` | 恢复原页内 MCP 链路（代码保留） |

## 快速开始

```bash
pnpm install

# 1) 启动 Gateway（CLI 模式，默认端口 19836）
AGENT_EXECUTION_MODE=cli pnpm start:gateway
#   健康检查：curl http://127.0.0.1:19836/health   → executionMode:"cli"
#   CLI 状态：curl -XPOST http://127.0.0.1:19836/setup/detect -d '{"providers":["dingtalk"]}'

# 2) 构建扩展并在 Chrome 加载 packages/chrome-extension/dist（开发者模式）
pnpm build:ext
```

在扩展侧边栏中：
1. **Setup 向导**：检测 → 安装缺失 CLI → 装 skill → OAuth 登录（授权 URL 流式回传）。
2. **拾取选区**：进入拾取态，点选文字段落或多维表单元格/记录。
3. 输入指令、选择 **Direct / Agent** 模式并执行；结果与 CLI 输出流式回显。

## 一键配置 / 启动（脚本 + Agent skill）

不想记命令？用仓库自带脚本一步到位（环境检查 → 装依赖 → 构建扩展 → 后台起 Gateway → 健康检查 → 检测 CLI）：

```bash
bash scripts/setup.sh up          # 一键
bash scripts/setup.sh gateway status   # 查看 Gateway
bash scripts/setup.sh gateway stop     # 停止 Gateway
bash scripts/setup.sh help             # 全部命令
```

> 仅有两步需人工：在 Chrome 加载 `packages/chrome-extension/dist`、在浏览器完成 OAuth 授权。

**让 AI Agent 代劳**：本仓库内置 Claude Code skill [`setup-and-run`](https://github.com/xinyuehtx/doc-agent-extension/blob/main/.claude/skills/setup-and-run/SKILL.md)。在项目里对 Claude Code 说「配置并启动 doc-agent-extension」，或直接 `/setup-and-run`，Agent 会调用上面的脚本完成配置与启动，并把人工收尾步骤讲清楚。

## 安装（发布版）

每次推送 `v*` 标签，GitHub Actions 会自动构建并在 [Releases](https://github.com/xinyuehtx/doc-agent-extension/releases) 附带 `doc-agent-extension-chrome-mv3-vX.Y.Z.zip`：

1. 下载并解压该 zip。
2. 打开 `chrome://extensions`，开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择解压后的目录即可。

> 需要本地运行 Gateway（`pnpm start:gateway`）配合扩展使用。

## 常用命令

```bash
pnpm build       # 全量构建（gateway tsc + 扩展 vite）
pnpm test        # 全部单元/集成测试
pnpm typecheck   # 见各包 tsc --noEmit
pnpm docs:dev    # 本地预览文档站点（VitePress）
pnpm docs:build  # 构建文档站点
```

## 需要的本地 CLI

| 产品 | CLI | 文字 | 多维表 | 登录 |
|---|---|---|---|---|
| 钉钉 | `dws`（dingtalk-workspace-cli） | `doc block` | `aitable record` | `dws auth login` |
| 飞书 | `lark-cli`（@larksuite/cli） | `docs` | `base` | `lark-cli auth login` |
| Notion | `ntn` | blocks/`api` | database | `ntn login` |

## 发布与文档

- **扩展发布**：给提交打 `vX.Y.Z` 标签 → `.github/workflows/build-extension.yml` 自动构建、打包、创建 Release。
- **文档站点**：`docs/`（VitePress）经 `.github/workflows/deploy-docs.yml` 部署到 GitHub Pages。

## License

[MIT](https://github.com/xinyuehtx/doc-agent-extension/blob/main/LICENSE)
