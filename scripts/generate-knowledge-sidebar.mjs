// Generate VitePress sidebar config from knowledge/*/layout.yaml

import fs from 'fs'
import path from 'path'
import { parse } from 'yaml'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(__dirname, '..')
const KNOWLEDGE_DIR = path.join(ROOT, 'knowledge')
const OUTPUT_FILE = path.join(ROOT, '.vitepress', 'knowledge-sidebar.json')

function buildSidebarItems(items) {
  return items.map(item => {
    if (item.children) {
      return {
        text: item.title,
        collapsed: false,
        items: buildSidebarItems(item.children)
      }
    }

    if (item.post) {
      return {
        text: item.title,
        link: item.post
      }
    }

    if (item.doc) {
      return {
        text: item.title,
        link: item.doc
      }
    }

    return { text: item.title }
  })
}

const sidebar = {}
const knowledgeDirs = fs.readdirSync(KNOWLEDGE_DIR).filter(d =>
  fs.statSync(path.join(KNOWLEDGE_DIR, d)).isDirectory()
)

for (const dir of knowledgeDirs) {
  const layoutPath = path.join(KNOWLEDGE_DIR, dir, 'layout.yaml')
  if (!fs.existsSync(layoutPath)) continue

  const content = fs.readFileSync(layoutPath, 'utf-8')
  const layout = parse(content)

  const sidebarKey = `/knowledge/${dir}/`
  sidebar[sidebarKey] = [
    {
      text: layout.title,
      items: buildSidebarItems(layout.items)
    }
  ]

  console.log(`✅ ${dir}: ${layout.title} (${layout.items.length} sections)`)
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sidebar, null, 2), 'utf-8')
console.log(`\n📄 Sidebar config written to: .vitepress/knowledge-sidebar.json`)
