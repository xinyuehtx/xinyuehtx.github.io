/**
 * Remap all blog post tags to a simplified set:
 * AI, LLM, Agent, 架构, 前端, 其他
 */

import fs from 'fs'
import path from 'path'

const postsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'posts')

const tagMapping = {
  // 架构
  '架构': '架构',
  '代码设计': '架构',
  'UML': '架构',

  // 前端
  '前端': '前端',
  'JavaScript': '前端',
  'javascript': '前端',
  'JS': '前端',
  'js': '前端',
  '小程序': '前端',
  'taro': '前端',
  'React': '前端',
  'react': '前端',
  'Nodejs': '前端',
  'nodejs': '前端',
  'NodeJS': '前端',
  'CSS': '前端',
  'css': '前端',
  'HTML': '前端',
  'html': '前端',
  'Vue': '前端',
  'vue': '前端',

  // AI (currently no posts, but ready for future)
  'AI': 'AI',
  'ai': 'AI',
  'LLM': 'LLM',
  'llm': 'LLM',
  'Agent': 'Agent',
  'agent': 'Agent',
}

// Everything else maps to '其他'

let totalModified = 0

const postDirs = fs.readdirSync(postsDir)

for (const dir of postDirs) {
  const indexPath = path.join(postsDir, dir, 'index.md')
  if (!fs.existsSync(indexPath)) continue

  const content = fs.readFileSync(indexPath, 'utf-8')

  // Extract front matter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) continue

  const frontMatter = fmMatch[1]
  const afterFrontMatter = content.slice(fmMatch[0].length)

  // Parse tags from YAML list format
  const tagsMatch = frontMatter.match(/tags:\n((?:\s+-\s+.+\n?)+)/)
  if (!tagsMatch) continue

  const originalTags = tagsMatch[1]
    .split('\n')
    .map(line => line.replace(/^\s+-\s+/, '').trim())
    .filter(Boolean)

  // Remap tags
  const newTagsSet = new Set()
  for (const tag of originalTags) {
    const mapped = tagMapping[tag]
    if (mapped) {
      newTagsSet.add(mapped)
    } else {
      newTagsSet.add('其他')
    }
  }

  const newTags = Array.from(newTagsSet)

  // Check if tags actually changed
  const oldSorted = [...originalTags].sort().join(',')
  const newSorted = [...newTags].sort().join(',')
  if (oldSorted === newSorted) continue

  // Rebuild tags YAML
  const newTagsYaml = newTags.map(tag => `  - ${tag}`).join('\n')
  const newFrontMatter = frontMatter.replace(
    /tags:\n((?:\s+-\s+.+\n?)+)/,
    `tags:\n${newTagsYaml}\n`
  )

  const newContent = `---\n${newFrontMatter}\n---${afterFrontMatter}`
  fs.writeFileSync(indexPath, newContent, 'utf-8')
  totalModified++

  console.log(`${dir}: [${originalTags.join(', ')}] -> [${newTags.join(', ')}]`)
}

console.log(`\nDone. Modified ${totalModified} files.`)
