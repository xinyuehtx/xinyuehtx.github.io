import fs from 'fs'
import path from 'path'

const postsDir = path.resolve(import.meta.dirname, '..', 'posts')
const dirs = fs.readdirSync(postsDir).filter(d => fs.statSync(path.join(postsDir, d)).isDirectory())

const articles = []
for (const dir of dirs) {
  const fp = path.join(postsDir, dir, 'index.md')
  if (!fs.existsSync(fp)) continue
  const content = fs.readFileSync(fp, 'utf-8')
  const fm = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) continue

  const titleMatch = fm[1].match(/title:\s*"?([^"\n]+)"?/)
  const dateMatch = fm[1].match(/date:\s*(\S+)/)
  const draftMatch = fm[1].match(/draft:\s*(\S+)/)
  const tags = []
  const tagSection = fm[1].match(/tags:\n((?:\s+-\s+.+\n?)*)/)
  if (tagSection) {
    const tagLines = tagSection[1].match(/\s+-\s+(.+)/g)
    if (tagLines) tagLines.forEach(l => tags.push(l.replace(/\s+-\s+/, '').trim()))
  }
  articles.push({
    dir,
    title: titleMatch ? titleMatch[1] : dir,
    date: dateMatch ? dateMatch[1] : '',
    draft: draftMatch ? draftMatch[1] === 'true' : false,
    tags
  })
}

// Group by tags
const tagMap = {}
for (const a of articles) {
  for (const t of a.tags) {
    const lower = t.toLowerCase()
    if (!tagMap[lower]) tagMap[lower] = { tag: t, articles: [] }
    tagMap[lower].articles.push({ dir: a.dir, title: a.title, date: a.date })
  }
}

// Sort by count
const sorted = Object.entries(tagMap).sort((a, b) => b[1].articles.length - a[1].articles.length)
console.log('=== Tag Statistics ===')
for (const [key, val] of sorted) {
  console.log(`${val.tag}: ${val.articles.length}`)
}
console.log(`\n--- Total articles: ${articles.length} ---`)

// Output detailed grouping for knowledge base
const groups = {
  'wpf': ['wpf'],
  'csharp': ['c#', '.net', 'test', 'moq'],
  'wcf': ['wcf'],
  'frontend': ['前端', 'redux', 'javascript', 'react', 'taro', 'electron', 'webpack', 'nodejs'],
  'architecture': ['架构', 'uml', 'restful', 'graphql', 'hateoas'],
  'tools': ['git', 'nginx', 'frp', 'curl', 'nvm']
}

console.log('\n=== Knowledge Base Groups ===')
for (const [group, matchTags] of Object.entries(groups)) {
  const seen = new Set()
  const matched = []
  for (const a of articles) {
    if (seen.has(a.dir)) continue
    for (const t of a.tags) {
      if (matchTags.includes(t.toLowerCase())) {
        seen.add(a.dir)
        matched.push(a)
        break
      }
    }
  }
  matched.sort((a, b) => a.date.localeCompare(b.date))
  console.log(`\n[${group}] (${matched.length} articles):`)
  for (const a of matched) {
    console.log(`  - ${a.date} | ${a.title} | ${a.dir}`)
  }
}
