<script setup lang="ts">
import { withBase } from 'vitepress'

interface ProjectMeta {
  name: string
  repo: string
  description: string
  language: string | null
  stars: number
  pushedDate: string
  repoUrl: string
  pagesUrl: string | null
  introPath: string
  blogCount: number
  topics: string[]
}

defineProps<{ project: ProjectMeta }>()

const langColors: Record<string, string> = {
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
const dot = (lang: string | null) => (lang && langColors[lang]) || '#8b98a5'
</script>

<template>
  <div class="pcard">
    <div class="pcard-glow" aria-hidden="true"></div>

    <div class="pcard-head">
      <a class="pcard-title" :href="withBase(project.introPath)">{{ project.name }}</a>
      <span v-if="project.language" class="pcard-lang">
        <i class="pcard-dot" :style="{ background: dot(project.language) }"></i>{{ project.language }}
      </span>
    </div>

    <p class="pcard-desc">{{ project.description || '—' }}</p>

    <div v-if="project.topics && project.topics.length" class="pcard-topics">
      <span v-for="t in project.topics.slice(0, 4)" :key="t" class="pcard-topic">#{{ t }}</span>
    </div>

    <div class="pcard-foot">
      <span class="pcard-stat" title="Star">★ {{ project.stars }}</span>
      <span v-if="project.blogCount" class="pcard-stat" title="研发笔记">✎ {{ project.blogCount }}</span>
      <span class="pcard-stat pcard-date" title="最近更新">{{ project.pushedDate }}</span>
      <span class="pcard-spacer"></span>
      <a class="pcard-link" :href="project.repoUrl" target="_blank" rel="noreferrer" title="GitHub 仓库">Code</a>
      <a
        v-if="project.pagesUrl"
        class="pcard-link"
        :href="project.pagesUrl"
        target="_blank"
        rel="noreferrer"
        title="在线 Demo"
        >Demo ↗</a
      >
      <a class="pcard-link pcard-link-primary" :href="withBase(project.introPath)" title="项目详情">详情 →</a>
    </div>
  </div>
</template>
