/**
 * Rename post directories that contain special characters (+, #, &)
 * which cause issues with Vite's build pipeline.
 * Also updates references in knowledge layout.yaml files.
 */

import fs from 'fs'
import path from 'path'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const postsDir = path.join(rootDir, 'posts')
const knowledgeDir = path.join(rootDir, 'knowledge')

function sanitizeDirName(name) {
  return name
    .replace(/C\+\+/g, 'Cpp')
    .replace(/C#/g, 'CSharp')
    .replace(/c#/g, 'csharp')
    .replace(/\+/g, '-plus-')
    .replace(/&/g, '-and-')
    .replace(/#/g, '-sharp-')
}

const renames = []

// Find and rename directories
const postDirs = fs.readdirSync(postsDir)
for (const dir of postDirs) {
  const fullPath = path.join(postsDir, dir)
  if (!fs.statSync(fullPath).isDirectory()) continue

  const newName = sanitizeDirName(dir)
  if (newName !== dir) {
    const newPath = path.join(postsDir, newName)
    console.log(`Rename: ${dir} -> ${newName}`)
    fs.renameSync(fullPath, newPath)
    renames.push({ oldName: dir, newName })
  }
}

// Update knowledge layout.yaml files
if (renames.length > 0 && fs.existsSync(knowledgeDir)) {
  const knowledgeTopics = fs.readdirSync(knowledgeDir)
  for (const topic of knowledgeTopics) {
    const layoutPath = path.join(knowledgeDir, topic, 'layout.yaml')
    if (!fs.existsSync(layoutPath)) continue

    let content = fs.readFileSync(layoutPath, 'utf-8')
    let modified = false

    for (const { oldName, newName } of renames) {
      if (content.includes(oldName)) {
        content = content.replaceAll(oldName, newName)
        modified = true
      }
    }

    if (modified) {
      fs.writeFileSync(layoutPath, content, 'utf-8')
      console.log(`Updated layout: ${topic}/layout.yaml`)
    }
  }
}

console.log(`\nDone. Renamed ${renames.length} directories.`)
