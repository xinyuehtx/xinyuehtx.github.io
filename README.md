# xinyuehtx.github.io

黄腾霄的技术博客，基于 [VitePress](https://vitepress.dev/) + [@sugarat/theme](https://github.com/ATQQ/sugar-blog) 构建。

HomePage: [xinyuehtx.github.io](https://xinyuehtx.github.io/)

## 本地开发

```bash
# 安装依赖（需要 pnpm 10+）
pnpm install

# 生成知识库侧边栏配置
node scripts/generate-knowledge-sidebar.mjs

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 预览构建产物
pnpm preview
```

## 目录结构

```
├── posts/                  # 博客文章（扁平目录，每篇文章一个子目录）
│   ├── index.md            # 博客列表页
│   ├── oss/                # 🤖 自动同步：从原创仓库 blog/ 导入的文章（勿手动编辑）
│   │   └── <repo>/<slug>.md
│   └── <article-name>/
│       ├── index.md        # 文章内容
│       └── images/         # 文章配图
├── projects/               # 🤖 自动同步：原创开源项目介绍（勿手动编辑）
│   ├── index.md            # 项目展示页
│   └── <repo>.md           # 单个项目介绍（由仓库 README 生成）
├── knowledge/              # 知识库专栏（按主题组织）
│   └── <topic>/
│       ├── layout.yaml     # 目录树结构定义
│       ├── index.md        # 专栏首页
│       └── docs/           # 专栏补充文档（可选）
├── draft/                  # 本地草稿（已被 .gitignore 忽略，不会提交）
├── pages/                  # 独立页面
├── public/                 # 静态资源（如 avatar.png）
├── rfcs/                   # 设计文档（RFC）
├── scripts/                # 构建脚本
│   └── sync-github-projects.mjs  # 🤖 原创项目聚合同步脚本
├── .vitepress/             # VitePress 配置与主题定制
│   ├── config.mts          # 站点配置
│   ├── theme/              # 主题扩展（custom.css、index.ts、components/）
│   │   └── projects.generated.ts  # 🤖 自动生成的项目元数据（勿手动编辑）
│   └── knowledge-sidebar.json  # 自动生成，勿手动编辑
└── .github/workflows/      # GitHub Actions（部署 + 定时同步）
```

## 内容贡献指南

### 新建博客文章

1. 在 `posts/` 下创建文章目录，目录名即为 URL 路径：

   ```
   posts/my-new-article/
   ├── index.md
   └── images/
       └── screenshot.png
   ```

2. 在 `index.md` 中添加 front matter：

   ```yaml
   ---
   title: 文章标题
   date: 2026-01-01
   tags:
     - 前端
     - 架构
   description: 一句话简介，会显示在文章列表中
   ---

   正文内容从这里开始...
   ```

3. **图片引用**：图片放在文章目录的 `images/` 下，使用相对路径引用：

   ```markdown
   ![截图说明](./images/screenshot.png)
   ```

4. **文章 URL**：最终访问路径为 `https://xinyuehtx.github.io/posts/my-new-article/`

### 草稿模式

在 front matter 中添加 `draft: true`，文章会提交到 Git 但不会发布到网站：

```yaml
---
title: 草稿文章
date: 2026-01-01
draft: true
---
```

如果只是本地写作、不想提交到 Git，可以把文件放在 `draft/` 目录下（该目录已被 `.gitignore` 忽略）。

### 知识库专栏

知识库专栏用于将分散的博客文章按主题组织成结构化的知识体系。每个专栏对应 `knowledge/` 下的一个子目录。

#### 创建新专栏

1. 创建专栏目录：

   ```
   knowledge/my-topic/
   ├── layout.yaml    # 目录树结构（必需）
   └── index.md       # 专栏首页（必需）
   ```

2. 编写 `index.md` 专栏首页：

   ```yaml
   ---
   title: 专栏名称
   ---

   ## 专栏名称

   简要介绍本专栏的内容范围。

   请使用左侧目录树浏览文章。
   ```

3. 编写 `layout.yaml` 定义目录树结构：

   ```yaml
   title: 专栏名称
   description: 专栏简介
   items:
     - title: 章节一
       children:
         - title: 已有博客文章标题
           post: /posts/article-name/
         - title: 专栏补充文档标题
           doc: /knowledge/my-topic/docs/extra-doc
     - title: 章节二
       children:
         - title: 另一篇文章
           post: /posts/another-article/
   ```

   - **`post`**：引用 `posts/` 下已有的博客文章
   - **`doc`**：引用 `knowledge/<topic>/docs/` 下的专栏补充文档（用于专栏独有的、不适合作为独立博客发布的内容）

4. 如果需要专栏补充文档，在 `docs/` 下创建：

   ```
   knowledge/my-topic/docs/
   └── extra-doc.md
   ```

5. 在 `.vitepress/config.mts` 的 `nav` 中添加专栏入口：

   ```ts
   nav: [
     // ...
     { text: '新专栏', link: '/knowledge/my-topic/' },
   ]
   ```

#### 更新专栏目录

修改 `layout.yaml` 后，需要重新生成侧边栏配置：

```bash
node scripts/generate-knowledge-sidebar.mjs
```

该命令会读取所有 `knowledge/*/layout.yaml`，生成 `.vitepress/knowledge-sidebar.json`。此文件由脚本自动生成，**请勿手动编辑**。

### 添加独立页面

在 `pages/` 下创建 `.md` 文件即可，需要在 `config.mts` 的 `nav` 中手动添加导航链接。

## 🤖 原创项目自动同步

本站会定期把 [@xinyuehtx](https://github.com/xinyuehtx) 名下**原创（非 fork）**项目的内容聚合进来，设计见 [`rfcs/0001-github-projects-sync-and-tech-redesign.md`](./rfcs/0001-github-projects-sync-and-tech-redesign.md)。

- **导入的博客**：各仓库 `blog/*.md` → `posts/oss/<repo>/`，进入博客文章流。
- **项目介绍**：各仓库 README → `projects/<repo>.md`，并在 `/projects/` 展示页与首页「精选开源项目」区展示。
- **选择标准**：`fork == false` 且（已开启 GitHub Pages 或含 `blog/` 目录），排除博客自身。

### 手动运行同步

```bash
# 需要 GITHUB_TOKEN（或已登录 gh）；本地会调用 GitHub API
GITHUB_TOKEN=$(gh auth token) node scripts/sync-github-projects.mjs
```

脚本会先清空 `posts/oss/`、`projects/` 再重建（幂等），**不会触碰手写文章**。

### 定时任务与 PR

`.github/workflows/sync-projects.yml` 每日运行同步脚本，并通过 `peter-evans/create-pull-request` 把变更提交到**固定分支 `bot/sync-projects`**、复用**同一个滚动 PR**——不会产生 PR 膨胀，无实质变化时不提交。合并到 `master` 后触发部署。

> ⚠️ **首次启用需在仓库设置里开启一次**：
> `Settings → Actions → General → Workflow permissions` 勾选
> **"Allow GitHub Actions to create and approve pull requests"**，否则同步任务无权创建 PR。

## 部署

推送到 `main` 或 `master` 分支后，GitHub Actions 会自动执行以下流程：

1. 安装依赖（`pnpm install`）
2. 生成知识库侧边栏（`node scripts/generate-knowledge-sidebar.mjs`）
3. 构建 VitePress（`pnpm build`）
4. 部署到 GitHub Pages

部署配置见 `.github/workflows/deploy.yml`。

## 技术栈

- **静态站点生成**：[VitePress](https://vitepress.dev/) v1.6+
- **博客主题**：[@sugarat/theme](https://github.com/ATQQ/sugar-blog) v0.5+
- **图表支持**：[Mermaid](https://mermaid.js.org/)（通过 vitepress-plugin-mermaid）
- **包管理器**：pnpm 10+
- **部署**：GitHub Pages + GitHub Actions
