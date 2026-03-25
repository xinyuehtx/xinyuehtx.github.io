/**
 * Fix angle brackets in markdown files that cause Vue compiler errors.
 * Escapes < and > inside inline code (backticks) and plain text
 * that are NOT inside fenced code blocks (``` ... ```).
 * This prevents Vue from treating C# generics like <T>, <bool> as HTML tags.
 */

import fs from 'fs'
import path from 'path'

const postsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'posts')

function fixAngleBrackets(content) {
  const lines = content.split('\n')
  const result = []
  let inCodeBlock = false

  for (const line of lines) {
    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    // Don't modify lines inside fenced code blocks
    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // Don't modify lines that are pure HTML tags (like <br>, <hr>, <img>, <div>, etc.)
    // or markdown image lines
    if (/^\s*<\/?(?:br|hr|img|div|span|p|table|tr|td|th|thead|tbody|ul|ol|li|a|em|strong|code|pre|blockquote|h[1-6]|details|summary|sup|sub|del|ins|mark|abbr|ruby|rt|rp|bdo|bdi|wbr|meter|progress|output|video|audio|source|canvas|svg|path|circle|rect|line|polygon|polyline|ellipse|g|text|use|defs|clippath|lineargradient|radialgradient|stop|symbol|mask|pattern|image|foreignobject|animate|animatetransform|set)[\s>\/]/i.test(line.trim())) {
      result.push(line)
      continue
    }

    // Process the line: escape angle brackets in inline code and plain text
    // Strategy: split by inline code spans, process each segment
    let fixed = ''
    let i = 0
    const len = line.length

    while (i < len) {
      // Check for inline code (backtick)
      if (line[i] === '`') {
        // Find matching closing backtick(s)
        let backtickCount = 0
        let j = i
        while (j < len && line[j] === '`') {
          backtickCount++
          j++
        }
        // Find closing backticks
        const closingPattern = '`'.repeat(backtickCount)
        const closeIdx = line.indexOf(closingPattern, j)
        if (closeIdx !== -1) {
          // Inside inline code: escape angle brackets
          const codeContent = line.substring(j, closeIdx)
          const escapedCode = codeContent
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
          fixed += closingPattern + escapedCode + closingPattern
          i = closeIdx + backtickCount
        } else {
          // No closing backtick found, treat as plain text
          fixed += line[i]
          i++
        }
      } else if (line[i] === '<') {
        // Check if this looks like a C#/programming generic type (not a real HTML tag)
        // Real HTML tags: <div>, <span>, <br/>, <img src="...">, </div>, etc.
        // C# generics: <T>, <bool>, <string>, <IDuplexSessionChannel>, <TResult>, etc.
        const remaining = line.substring(i)

        // Check for HTML comments
        if (remaining.startsWith('<!--')) {
          const endComment = line.indexOf('-->', i + 4)
          if (endComment !== -1) {
            fixed += line.substring(i, endComment + 3)
            i = endComment + 3
            continue
          }
        }

        // Check for closing HTML tags like </div>
        const closingTagMatch = remaining.match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/)
        if (closingTagMatch) {
          const tagName = closingTagMatch[1].toLowerCase()
          if (isHtmlTag(tagName)) {
            fixed += closingTagMatch[0]
            i += closingTagMatch[0].length
            continue
          }
        }

        // Check for opening HTML tags like <div>, <img src="...">, <br/>
        const openingTagMatch = remaining.match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*\/?>/)
        if (openingTagMatch) {
          const tagName = openingTagMatch[1].toLowerCase()
          if (isHtmlTag(tagName)) {
            fixed += openingTagMatch[0]
            i += openingTagMatch[0].length
            continue
          }
        }

        // Not a recognized HTML tag - escape it
        fixed += '&lt;'
        i++
      } else if (line[i] === '>') {
        // Check if this is part of a markdown blockquote or HTML
        if (i === 0 || (i > 0 && /^\s*$/.test(line.substring(0, i)))) {
          // Blockquote
          fixed += '>'
          i++
        } else {
          // Check if previous context suggests this closes an HTML tag
          // Look back to find if there's an unescaped < that started an HTML tag
          const beforeThis = fixed
          const lastLt = beforeThis.lastIndexOf('<')
          const lastEscLt = beforeThis.lastIndexOf('&lt;')
          if (lastLt > lastEscLt && lastLt !== -1) {
            // There's a real < before this >, it's part of HTML
            fixed += '>'
          } else {
            fixed += '&gt;'
          }
          i++
        }
      } else {
        fixed += line[i]
        i++
      }
    }

    result.push(fixed)
  }

  return result.join('\n')
}

function isHtmlTag(tagName) {
  const htmlTags = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
    'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
    'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
    'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
    'i', 'iframe', 'img', 'input', 'ins', 'kbd',
    'label', 'legend', 'li', 'link',
    'main', 'map', 'mark', 'menu', 'meta', 'meter',
    'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output',
    'p', 'param', 'picture', 'pre', 'progress',
    'q', 'rp', 'rt', 'ruby',
    's', 'samp', 'script', 'search', 'section', 'select', 'small', 'source', 'span',
    'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
    'u', 'ul', 'var', 'video', 'wbr',
    'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'g', 'text', 'use', 'defs',
    'clippath', 'lineargradient', 'radialgradient', 'stop', 'symbol', 'mask', 'pattern', 'image',
    'foreignobject', 'animate', 'animatetransform', 'set'
  ])
  return htmlTags.has(tagName)
}

// Process all posts
let totalFixed = 0
const postDirs = fs.readdirSync(postsDir)

for (const dir of postDirs) {
  const indexPath = path.join(postsDir, dir, 'index.md')
  if (!fs.existsSync(indexPath)) continue

  const original = fs.readFileSync(indexPath, 'utf-8')
  const fixed = fixAngleBrackets(original)

  if (fixed !== original) {
    fs.writeFileSync(indexPath, fixed, 'utf-8')
    totalFixed++
    console.log(`Fixed: ${dir}/index.md`)
  }
}

console.log(`\nDone. Fixed ${totalFixed} files.`)
