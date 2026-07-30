#!/usr/bin/env node
/**
 * sync-github-projects.mjs
 * ------------------------------------------------------------------
 * 从 GitHub 拉取「xinyuehtx」名下的原创（非 fork）项目，聚合到本博客：
 *   1. 导入各仓库 blog/*.md → posts/oss/<repo>/<slug>.md（进入文章流）
 *   2. 由 README 生成项目介绍 → projects/<repo>.md
 *   3. 生成项目展示页 projects/index.md + 元数据 .vitepress/theme/projects.generated.ts
 *
 * 选择标准（精选项目）：fork==false 且不在排除名单 且 (has_pages 或 存在 blog/)。
 *
 * 幂等：每次运行先清空 Bot 独占目录再重建，输出确定性排序、日期取自 git 历史，
 *       无实质变化则无 diff。绝不触碰手写的 posts/<slug>/ 与 knowledge/。
 *
 * 认证：优先 process.env.GITHUB_TOKEN；本地缺省时回退 `gh auth token`。
 * ------------------------------------------------------------------
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const OWNER = 'xinyuehtx'
const EXCLUDE = new Set(['xinyuehtx.github.io', 'testblog.github.io', '-'])

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const POSTS_OSS_DIR = path.join(ROOT, 'posts', 'oss')
const PROJECTS_DIR = path.join(ROOT, 'projects')
const DATA_FILE = path.join(ROOT, '.vitepress', 'theme', 'projects.generated.ts')

// ---- 认证 token ----------------------------------------------------
function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}
const TOKEN = resolveToken()

// ---- GitHub API 封装 ----------------------------------------------
const API = 'https://api.github.com'
const baseHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'xinyuehtx-blog-sync',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
}

async function api(pathname, { raw = false } = {}) {
  const url = pathname.startsWith('http') ? pathname : `${API}${pathname}`
  const res = await fetch(url, { headers: baseHeaders })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`)
  }
  return raw ? res.text() : res.json()
}

async function fetchRaw(repo, branch, filePath) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${repo}/${branch}/${filePath}`
  const res = await fetch(url, { headers: { 'User-Agent': 'xinyuehtx-blog-sync' } })
  if (!res.ok) return null
  return res.text()
}

// ---- 仓库发现 ------------------------------------------------------
async function listNonForkRepos() {
  const out = []
  for (let page = 1; page <= 10; page++) {
    const arr = await api(`/users/${OWNER}/repos?per_page=100&type=owner&page=${page}`)
    if (!arr || arr.length === 0) break
    out.push(...arr)
    if (arr.length < 100) break
  }
  return out.filter((r) => !r.fork && !EXCLUDE.has(r.name))
}

async function getTreePaths(repo, branch) {
  const data = await api(`/repos/${OWNER}/${repo}/git/trees/${branch}?recursive=1`)
  if (!data || !Array.isArray(data.tree)) return []
  return data.tree.filter((n) => n.type === 'blob').map((n) => n.path)
}

async function getTopics(repo) {
  try {
    const data = await api(`/repos/${OWNER}/${repo}/topics`)
    return data?.names ?? []
  } catch {
    return []
  }
}

// 取某文件最早提交日期（发布日期，稳定不随后续编辑变化）
async function getEarliestCommitDate(repo, branch, filePath) {
  let page = 1
  let oldest = null
  while (page <= 10) {
    const arr = await api(
      `/repos/${OWNER}/${repo}/commits?sha=${branch}&path=${encodeURIComponent(filePath)}&per_page=100&page=${page}`
    )
    if (!arr || arr.length === 0) break
    oldest = arr[arr.length - 1]?.commit?.author?.date ?? oldest
    if (arr.length < 100) break
    page++
  }
  return oldest ? oldest.slice(0, 10) : null
}

// ---- Markdown 处理 -------------------------------------------------

// 把相对链接/图片改写为 GitHub 绝对链接。baseDir 为该文件在仓库中的所在目录。
function rewriteLinks(md, { repo, branch, baseDir }) {
  const rawBase = `https://raw.githubusercontent.com/${OWNER}/${repo}/${branch}`
  const blobBase = `https://github.com/${OWNER}/${repo}/blob/${branch}`

  const isExternal = (u) =>
    /^(https?:)?\/\//i.test(u) || u.startsWith('#') || u.startsWith('mailto:') || u.startsWith('data:')

  const resolve = (rel) => {
    // 去掉查询/锚点后再解析路径
    const [p, hash = ''] = rel.split('#')
    const joined = path.posix.normalize(path.posix.join(baseDir, p)).replace(/^\.?\//, '')
    return { joined, hash: hash ? `#${hash}` : '' }
  }

  // 图片: ![alt](url "title")
  md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (m, alt, url, title = '') => {
    if (isExternal(url)) return m
    const { joined } = resolve(url)
    return `![${alt}](${rawBase}/${joined}${title})`
  })

  // 普通链接: [text](url) —— 指向仓库内文件时改写为 blob 链接
  md = md.replace(/\[([^\]]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (m, text, url, title = '') => {
    if (isExternal(url)) return m
    if (url.startsWith('!')) return m
    const { joined, hash } = resolve(url)
    return `[${text}](${blobBase}/${joined}${hash}${title})`
  })

  // HTML <img src="rel">
  md = md.replace(/(<img[^>]*\ssrc=")([^"]+)(")/g, (m, pre, url, post) => {
    if (isExternal(url)) return m
    const { joined } = resolve(url)
    return `${pre}${rawBase}/${joined}${post}`
  })

  return md
}

// 去掉常见的 shields.io 徽章行，减少噪声
function stripBadges(md) {
  return md
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      // 整行仅由徽章链接组成
      const withoutBadges = t.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '').replace(/!\[[^\]]*\]\(https?:\/\/img\.shields\.io[^)]*\)/g, '').trim()
      return withoutBadges.length > 0
    })
    .join('\n')
}

function firstH1(md) {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : null
}

function stripFirstH1(md) {
  return md.replace(/^\s*#\s+.+?\s*$/m, '').replace(/^\s+/, '')
}

// 去掉行内 markdown 语法，得到纯文本
function cleanInline(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 链接 → 文字
    .replace(/<https?:\/\/[^>]+>/g, '') // 自动链接 <url>
    .replace(/https?:\/\/\S+/g, '') // 裸 url
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// 看起来像元数据（slug / 关联链接）而非真正简介
function looksLikeMeta(t) {
  return /slug|关联[:：]|在线文档|online doc/i.test(t)
}

function extractDescription(md) {
  // 0) 居中标语 <p align="center">…</p>（README 常见）
  const pBlocks = md.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
  for (const block of pBlocks) {
    const inner = block.replace(/<[^>]+>/g, ' ') // 去掉所有 HTML 标签（含 img/a）
    if (looksLikeMeta(inner)) continue
    const d = cleanInline(inner)
    if (d.length >= 10) return truncate(d, 120)
  }

  const lines = md.split('\n')
  // 优先首个「非元数据」引用块
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('>')) {
      if (looksLikeMeta(t)) continue
      const d = cleanInline(t)
      if (d.length >= 10) return truncate(d, 120)
    }
  }
  // 否则首个足够长的正文段落
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('```') || t.startsWith('|') || t.startsWith('<')) continue
    if (looksLikeMeta(t)) continue
    const d = cleanInline(t)
    if (d.length >= 10) return truncate(d, 120)
  }
  return ''
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}

function yamlEscape(s) {
  return String(s).replace(/"/g, '\\"')
}

// ---- 生成器 --------------------------------------------------------

async function buildBlogPost(repo, branch, filePath) {
  const raw = await fetchRaw(repo, branch, filePath)
  if (!raw) return null

  const slug = path.basename(filePath, '.md')
  const title = firstH1(raw) || slug
  const date = (await getEarliestCommitDate(repo, branch, filePath)) || '2026-01-01'
  const description = extractDescription(raw)

  let body = stripFirstH1(raw)
  body = rewriteLinks(body, { repo, branch, baseDir: path.posix.dirname(filePath) })

  const repoUrl = `https://github.com/${OWNER}/${repo}`
  const srcUrl = `${repoUrl}/blob/${branch}/${filePath}`

  const fm = [
    '---',
    `title: "${yamlEscape(title)}"`,
    `date: ${date}`,
    'tags:',
    `  - ${repo}`,
    '  - 开源项目',
    ...(description ? [`description: "${yamlEscape(description)}"`] : []),
    '---',
    ''
  ].join('\n')

  const footer = `\n\n---\n\n> 📦 本文首发于开源项目 [\`${repo}\`](${repoUrl}) 仓库 · [查看原文](${srcUrl})\n`

  return { slug, content: fm + body.trim() + footer, title, date }
}

async function buildProjectPage(project, raw) {
  const { repo, branch } = project

  const repoUrl = `https://github.com/${OWNER}/${repo}`
  const displayTitle = (raw && firstH1(raw)) || repo
  const desc = project.description || ''

  const metaBits = []
  if (project.language) metaBits.push(`<span class="proj-lang"><i class="proj-dot" style="--dot:${langColor(project.language)}"></i>${project.language}</span>`)
  metaBits.push(`<span>⭐ ${project.stars}</span>`)
  metaBits.push(`<span>🕒 更新于 ${project.pushedDate}</span>`)
  if (project.blogCount) metaBits.push(`<span>📝 ${project.blogCount} 篇研发笔记</span>`)

  const actions = [`<a class="proj-btn proj-btn-primary" href="${repoUrl}" target="_blank" rel="noreferrer">GitHub 仓库</a>`]
  if (project.pagesUrl) actions.push(`<a class="proj-btn" href="${project.pagesUrl}" target="_blank" rel="noreferrer">在线 Demo ↗</a>`)

  const header = [
    '<div class="project-page-header">',
    `  <p class="project-meta">${metaBits.join(' · ')}</p>`,
    `  <p class="project-actions">${actions.join(' ')}</p>`,
    '</div>',
    ''
  ].join('\n')

  let bodyMd = ''
  if (raw) {
    bodyMd = stripFirstH1(stripBadges(raw))
    bodyMd = rewriteLinks(bodyMd, { repo, branch, baseDir: '' })
  } else {
    bodyMd = desc || '_该项目暂无 README。_'
  }

  const fm = [
    '---',
    `title: "${yamlEscape(displayTitle)}"`,
    ...(desc ? [`description: "${yamlEscape(desc)}"`] : []),
    'hidden: true', // 不进入博客文章流（仅作为项目介绍页）
    'recommend: false',
    'editLink: false',
    'lastUpdated: false',
    '---',
    ''
  ].join('\n')

  return fm + header + '\n' + bodyMd.trim() + '\n'
}

function buildProjectsIndex(projects) {
  const fm = [
    '---',
    'title: 开源项目',
    'description: 黄腾霄的原创开源项目集合',
    'hidden: true', // 展示页本身不进入文章流
    'recommend: false',
    'aside: false',
    'editLink: false',
    'lastUpdated: false',
    '---',
    ''
  ].join('\n')

  const intro = [
    '# 🚀 开源项目',
    '',
    '> 这里是我原创（非 fork）的开源项目，内容由 [自动同步机制](https://github.com/xinyuehtx/xinyuehtx.github.io/blob/master/rfcs/0001-github-projects-sync-and-tech-redesign.md) 定期从各仓库聚合更新。',
    '',
    '<ProjectGrid />',
    ''
  ].join('\n')

  return fm + intro
}

function buildDataFile(projects) {
  const header =
    '// ⚠️ 此文件由 scripts/sync-github-projects.mjs 自动生成，请勿手动编辑。\n' +
    '// Auto-generated. Do not edit by hand.\n\n' +
    'export interface ProjectMeta {\n' +
    '  name: string\n  repo: string\n  description: string\n  language: string | null\n' +
    '  stars: number\n  pushedDate: string\n  repoUrl: string\n  pagesUrl: string | null\n' +
    '  introPath: string\n  blogCount: number\n  topics: string[]\n}\n\n'
  return header + 'export const projects: ProjectMeta[] = ' + JSON.stringify(projects, null, 2) + '\n'
}

// GitHub linguist 常见语言色
function langColor(lang) {
  const map = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Swift: '#f05138',
    Rust: '#dea584',
    'C#': '#178600',
    Python: '#3572A5',
    Go: '#00ADD8',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Vue: '#41b883',
    Shell: '#89e051'
  }
  return map[lang] || '#8b98a5'
}

// ---- 主流程 --------------------------------------------------------
async function cleanBotDirs() {
  await fs.rm(POSTS_OSS_DIR, { recursive: true, force: true })
  await fs.rm(PROJECTS_DIR, { recursive: true, force: true })
  await fs.rm(DATA_FILE, { force: true })
}

async function main() {
  if (!TOKEN) {
    console.warn('⚠️  未检测到 GITHUB_TOKEN（也无法从 gh 获取），将以未认证方式请求，可能触发限流。')
  }

  console.log('▶ 发现非 fork 仓库…')
  const repos = await listNonForkRepos()

  console.log(`  共 ${repos.length} 个候选，筛选精选项目…`)
  const featured = []
  for (const r of repos) {
    const branch = r.default_branch
    const paths = await getTreePaths(r.name, branch)
    const blogFiles = paths
      .filter((p) => /^blog\/[^/]+\.md$/.test(p) && !p.endsWith('.gitkeep'))
      .sort()
    const isFeatured = r.has_pages || blogFiles.length > 0
    if (!isFeatured) continue

    const readmePath = paths.includes('README.zh-CN.md')
      ? 'README.zh-CN.md'
      : paths.includes('README.md')
        ? 'README.md'
        : null
    const topics = await getTopics(r.name)

    featured.push({
      repo: r.name,
      branch,
      description: r.description || '',
      language: r.language || null,
      stars: r.stargazers_count || 0,
      pushedDate: (r.pushed_at || r.updated_at || '').slice(0, 10),
      hasPages: !!r.has_pages,
      pagesUrl: r.has_pages ? `https://${OWNER}.github.io/${r.name}/` : null,
      repoUrl: `https://github.com/${OWNER}/${r.name}`,
      blogFiles,
      readmePath,
      topics
    })
  }

  // 展示排序：按最近推送倒序（稳定，日期粒度）
  featured.sort((a, b) => (b.pushedDate.localeCompare(a.pushedDate)) || a.repo.localeCompare(b.repo))
  console.log(`  精选 ${featured.length} 个项目：${featured.map((f) => f.repo).join(', ')}`)

  await cleanBotDirs()
  await fs.mkdir(PROJECTS_DIR, { recursive: true })

  const projectsMeta = []
  for (const p of featured) {
    console.log(`▶ 处理 ${p.repo}（blog: ${p.blogFiles.length}）`)

    // README（用于介绍页 + 简介兜底），只拉一次
    const readme = p.readmePath ? await fetchRaw(p.repo, p.branch, p.readmePath) : null
    const description = p.description || (readme ? extractDescription(readme) : '')

    // 1) 导入 blog 文章
    let blogCount = 0
    for (const bf of p.blogFiles) {
      const post = await buildBlogPost(p.repo, p.branch, bf)
      if (!post) continue
      const dir = path.join(POSTS_OSS_DIR, p.repo)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, `${post.slug}.md`), post.content, 'utf8')
      blogCount++
    }

    // 2) 项目介绍页
    const projPage = await buildProjectPage({ ...p, description, blogCount }, readme)
    await fs.writeFile(path.join(PROJECTS_DIR, `${p.repo}.md`), projPage, 'utf8')

    // 3) 元数据
    projectsMeta.push({
      name: p.repo,
      repo: p.repo,
      description,
      language: p.language,
      stars: p.stars,
      pushedDate: p.pushedDate,
      repoUrl: p.repoUrl,
      pagesUrl: p.pagesUrl,
      introPath: `/projects/${p.repo}`,
      blogCount,
      topics: p.topics
    })
  }

  // 4) 展示页 + 数据文件
  await fs.writeFile(path.join(PROJECTS_DIR, 'index.md'), buildProjectsIndex(projectsMeta), 'utf8')
  await fs.writeFile(DATA_FILE, buildDataFile(projectsMeta), 'utf8')

  console.log(`✅ 同步完成：${projectsMeta.length} 个项目介绍，${projectsMeta.reduce((s, p) => s + p.blogCount, 0)} 篇导入文章。`)
}

main().catch((err) => {
  console.error('❌ 同步失败：', err)
  process.exit(1)
})
