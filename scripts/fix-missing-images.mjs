/**
 * Find and comment out image/video references that point to non-existent files.
 * This prevents VitePress build errors from broken asset references.
 */

import fs from 'fs'
import path from 'path'

const postsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'posts')

let totalFixed = 0
let totalRemoved = 0

const postDirs = fs.readdirSync(postsDir)

for (const dir of postDirs) {
  const postDir = path.join(postsDir, dir)
  const indexPath = path.join(postDir, 'index.md')
  if (!fs.existsSync(indexPath)) continue

  const content = fs.readFileSync(indexPath, 'utf-8')
  const lines = content.split('\n')
  let modified = false

  const newLines = lines.map((line, idx) => {
    // Check markdown image references: ![alt](path)
    const mdImageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (mdImageMatch) {
      const imgPath = mdImageMatch[2]
      // Skip external URLs
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) return line
      // Resolve relative path
      const resolvedPath = path.resolve(postDir, imgPath)
      if (!fs.existsSync(resolvedPath)) {
        console.log(`  Removed broken image ref in ${dir}/index.md:${idx + 1} -> ${imgPath}`)
        modified = true
        totalRemoved++
        // Comment it out as HTML comment so content is preserved but not rendered
        return `<!-- broken image: ${line.trim()} -->`
      }
    }

    // Check HTML img tags: <img src="path" ...>
    const htmlImgMatch = line.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/)
    if (htmlImgMatch) {
      const imgPath = htmlImgMatch[1]
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) return line
      const resolvedPath = path.resolve(postDir, imgPath)
      if (!fs.existsSync(resolvedPath)) {
        console.log(`  Removed broken img tag in ${dir}/index.md:${idx + 1} -> ${imgPath}`)
        modified = true
        totalRemoved++
        return `<!-- broken image: ${line.trim()} -->`
      }
    }

    // Check HTML video tags: <video src="path" ...>
    const htmlVideoMatch = line.match(/<video\s+[^>]*src=["']([^"']+)["'][^>]*>/)
    if (htmlVideoMatch) {
      const videoPath = htmlVideoMatch[1]
      if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) return line
      const resolvedPath = path.resolve(postDir, videoPath)
      if (!fs.existsSync(resolvedPath)) {
        console.log(`  Removed broken video tag in ${dir}/index.md:${idx + 1} -> ${videoPath}`)
        modified = true
        totalRemoved++
        return `<!-- broken video: ${line.trim()} -->`
      }
    }

    return line
  })

  if (modified) {
    fs.writeFileSync(indexPath, newLines.join('\n'), 'utf-8')
    totalFixed++
    console.log(`Fixed: ${dir}/index.md`)
  }
}

console.log(`\nDone. Fixed ${totalFixed} files, removed ${totalRemoved} broken references.`)
