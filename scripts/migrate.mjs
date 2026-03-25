/**
 * Jekyll → VitePress 博文迁移脚本
 *
 * 功能：
 * 1. 遍历 _posts/ 下所有 .md 文件
 * 2. 解析 Jekyll front matter，转换为 VitePress 格式
 * 3. 从文件名提取日期和标题，创建 posts/<title>/index.md
 * 4. 扫描图片引用，将 media/ 中的图片复制到 posts/<title>/images/
 * 5. 更新图片引用路径
 * 6. 输出迁移报告
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const POSTS_SRC = path.join(ROOT, '_posts')
const MEDIA_SRC = path.join(ROOT, 'media')
const POSTS_DEST = path.join(ROOT, 'posts')

// 统计
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  imagesCopied: 0,
  imagesMissing: 0,
  drafts: 0,
  failedFiles: [],
  missingImages: []
}

/**
 * 从文件名中提取日期和标题
 * 格式: YYYY-M-D-标题.md 或 直接 标题.md
 */
function parseFileName(fileName) {
  const nameWithoutExt = fileName.replace(/\.md$/, '')

  // 匹配日期前缀: YYYY-M-D- 或 YYYY-MM-DD-
  const dateMatch = nameWithoutExt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})-(.+)$/)
  if (dateMatch) {
    const year = dateMatch[1]
    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')
    return {
      dateFromFileName: `${year}-${month}-${day}`,
      titleFromFileName: dateMatch[4]
    }
  }

  return {
    dateFromFileName: null,
    titleFromFileName: nameWithoutExt
  }
}

/**
 * 解析 Jekyll front matter
 */
function parseFrontMatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) {
    return { frontMatter: {}, body: content }
  }

  const fmText = fmMatch[1]
  const body = content.slice(fmMatch[0].length)
  const frontMatter = {}

  for (const line of fmText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '---') continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()

    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    frontMatter[key] = value
  }

  return { frontMatter, body }
}

/**
 * 清理标题中的日期前缀
 * "2020-6-17-从0开始实现redux中间件机制" → "从0开始实现redux中间件机制"
 */
function cleanTitle(title) {
  return title.replace(/^\d{4}-\d{1,2}-\d{1,2}-/, '')
}

/**
 * 标准化日期格式为 YYYY-MM-DD
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null

  // 移除时区信息和时间部分（只保留日期）
  const cleaned = dateStr.trim().split(/\s+/)[0]

  // 尝试解析 YYYY-M-D 格式
  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const year = match[1]
    const month = match[2].padStart(2, '0')
    const day = match[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return cleaned
}

/**
 * 将 categories (空格分隔) 和 tags (空格分隔) 合并为 tags 数组
 */
function mergeTags(categories, tags) {
  const categoryList = categories ? categories.split(/\s+/).filter(Boolean) : []
  const tagList = tags ? tags.split(/\s+/).filter(Boolean) : []

  // 合并去重（保留原始大小写，但去重时忽略大小写）
  const seen = new Set()
  const merged = []

  for (const tag of [...categoryList, ...tagList]) {
    const lower = tag.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      merged.push(tag)
    }
  }

  return merged
}

/**
 * 生成 VitePress front matter
 */
function generateFrontMatter(data) {
  const lines = ['---']

  lines.push(`title: "${data.title}"`)
  lines.push(`date: ${data.date}`)

  if (data.tags && data.tags.length > 0) {
    lines.push('tags:')
    for (const tag of data.tags) {
      lines.push(`  - ${tag}`)
    }
  }

  if (data.description) {
    lines.push(`description: "${data.description}"`)
  }

  if (data.draft) {
    lines.push('draft: true')
  }

  lines.push('---')
  return lines.join('\n')
}

/**
 * 处理文章正文
 * - 移除摘要分隔符 -----
 * - 更新图片引用路径
 * - 复制引用的图片
 */
function processBody(body, articleDir) {
  let processed = body

  // 移除 Jekyll 摘要分隔符 (独立一行的 -----)
  processed = processed.replace(/\n-----\n/g, '\n\n')
  processed = processed.replace(/^\n-----\n/g, '\n\n')

  // 查找并处理所有图片引用
  // 匹配 ![alt](../media/xxx) 和 ![alt](/media/xxx)
  const imageRegex = /!\[([^\]]*)\]\((\.\.\/media\/|\/media\/)([^)]+)\)/g
  let match

  const imagesDir = path.join(articleDir, 'images')

  while ((match = imageRegex.exec(processed)) !== null) {
    const fullMatch = match[0]
    const alt = match[1]
    const imageName = match[3]

    // 查找源图片
    const srcImagePath = path.join(MEDIA_SRC, imageName)

    if (fs.existsSync(srcImagePath)) {
      // 确保 images 目录存在
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      // 复制图片
      const destImagePath = path.join(imagesDir, imageName)
      fs.copyFileSync(srcImagePath, destImagePath)
      stats.imagesCopied++
    } else {
      stats.imagesMissing++
      stats.missingImages.push(`${imageName} (referenced in article)`)
    }

    // 更新引用路径
    const newRef = `![${alt}](./images/${imageName})`
    processed = processed.replace(fullMatch, newRef)
  }

  // 重置 regex lastIndex（因为上面用了 replace 可能改变了字符串）
  // 再处理一次，确保所有引用都被替换（replace 不会漏掉）
  processed = processed.replace(
    /!\[([^\]]*)\]\((\.\.\/media\/|\/media\/)([^)]+)\)/g,
    (fullMatch, alt, prefix, imageName) => {
      const srcImagePath = path.join(MEDIA_SRC, imageName)
      if (fs.existsSync(srcImagePath)) {
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true })
        }
        const destImagePath = path.join(imagesDir, imageName)
        if (!fs.existsSync(destImagePath)) {
          fs.copyFileSync(srcImagePath, destImagePath)
          stats.imagesCopied++
        }
      }
      return `![${alt}](./images/${imageName})`
    }
  )

  return processed
}

/**
 * 将文件夹名中的不安全字符替换
 */
function sanitizeDirName(name) {
  // 保留中文、英文、数字、连字符、下划线、括号、点
  // 替换其他特殊字符
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 迁移单篇文章
 */
function migratePost(fileName) {
  const srcPath = path.join(POSTS_SRC, fileName)
  const content = fs.readFileSync(srcPath, 'utf-8')

  const { dateFromFileName, titleFromFileName } = parseFileName(fileName)
  const { frontMatter, body } = parseFrontMatter(content)

  // 确定日期
  const date = normalizeDate(frontMatter.date) || dateFromFileName
  if (!date) {
    console.error(`  ❌ 无法确定日期: ${fileName}`)
    stats.failed++
    stats.failedFiles.push(`${fileName} (无日期)`)
    return
  }

  // 确定标题
  const rawTitle = frontMatter.title || titleFromFileName
  const title = cleanTitle(rawTitle)

  // 确定是否为草稿
  const isDraft = frontMatter.published === 'false'
  if (isDraft) stats.drafts++

  // 合并标签
  const tags = mergeTags(frontMatter.categories, frontMatter.tags)

  // 描述
  const description = frontMatter.description || ''

  // 创建目标目录
  const dirName = sanitizeDirName(titleFromFileName)
  const articleDir = path.join(POSTS_DEST, dirName)

  if (!fs.existsSync(articleDir)) {
    fs.mkdirSync(articleDir, { recursive: true })
  }

  // 处理正文（图片引用更新 + 图片复制）
  const processedBody = processBody(body, articleDir)

  // 生成新的 front matter
  const newFrontMatter = generateFrontMatter({
    title,
    date,
    tags,
    description,
    draft: isDraft
  })

  // 写入目标文件
  const destPath = path.join(articleDir, 'index.md')
  const finalContent = newFrontMatter + '\n' + processedBody
  fs.writeFileSync(destPath, finalContent, 'utf-8')

  stats.success++
  console.log(`  ✅ ${fileName} → posts/${dirName}/index.md`)
}

// ========== 主流程 ==========

console.log('🚀 开始迁移 Jekyll 博文到 VitePress...\n')

// 确保目标目录存在
if (!fs.existsSync(POSTS_DEST)) {
  fs.mkdirSync(POSTS_DEST, { recursive: true })
}

// 检查源目录
if (!fs.existsSync(POSTS_SRC)) {
  console.error('❌ 找不到 _posts/ 目录')
  process.exit(1)
}

if (!fs.existsSync(MEDIA_SRC)) {
  console.warn('⚠️  找不到 media/ 目录，图片将不会被复制')
}

// 获取所有 .md 文件
const files = fs.readdirSync(POSTS_SRC).filter(f => f.endsWith('.md'))
stats.total = files.length

console.log(`📄 找到 ${files.length} 篇文章\n`)

// 逐个迁移
for (const file of files) {
  try {
    migratePost(file)
  } catch (error) {
    console.error(`  ❌ 迁移失败: ${file} - ${error.message}`)
    stats.failed++
    stats.failedFiles.push(`${file} (${error.message})`)
  }
}

// 输出报告
console.log('\n' + '='.repeat(60))
console.log('📊 迁移报告')
console.log('='.repeat(60))
console.log(`总文章数:     ${stats.total}`)
console.log(`成功迁移:     ${stats.success}`)
console.log(`迁移失败:     ${stats.failed}`)
console.log(`草稿文章:     ${stats.drafts}`)
console.log(`图片已复制:   ${stats.imagesCopied}`)
console.log(`图片缺失:     ${stats.imagesMissing}`)

if (stats.failedFiles.length > 0) {
  console.log('\n❌ 失败文件:')
  for (const f of stats.failedFiles) {
    console.log(`  - ${f}`)
  }
}

if (stats.missingImages.length > 0) {
  console.log('\n⚠️  缺失图片 (前 20 个):')
  for (const img of stats.missingImages.slice(0, 20)) {
    console.log(`  - ${img}`)
  }
  if (stats.missingImages.length > 20) {
    console.log(`  ... 还有 ${stats.missingImages.length - 20} 个`)
  }
}

console.log('\n✨ 迁移完成!')
