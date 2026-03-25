import { defineConfig } from 'vitepress'
import { getThemeConfig as blogTheme } from '@sugarat/theme/node'
import { withMermaid } from 'vitepress-plugin-mermaid'
import knowledgeSidebar from './knowledge-sidebar.json'

const blogThemeConfig = blogTheme({
  author: '黄腾霄',
  home: {
    hoverSpin: false
  },
  // 文章默认作者
  recommend: {
    title: '🎈 相关文章',
    nextText: '换一组',
    pageSize: 9,
    empty: '暂无相关文章',
    style: 'sidebar',
    sort: 'date'
  },
  search: false, // 使用 VitePress 内置搜索
  comment: false // 暂不启用评论
})

export default withMermaid(
  defineConfig({
    extends: blogThemeConfig,
    lang: 'zh-CN',
    title: '黄腾霄的博客',
    description: 'AI前端 & 架构',
    lastUpdated: true,
    cleanUrls: true,
    ignoreDeadLinks: true,

    head: [
      ['link', { rel: 'icon', type: 'image/png', href: '/avatar.png' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
      ['link', { href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap', rel: 'stylesheet' }],
      ['meta', { name: 'author', content: '黄腾霄' }],
      ['meta', { name: 'keywords', content: 'AI, 前端, 架构, 技术博客' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: '黄腾霄的博客' }],
      ['meta', { property: 'og:description', content: 'AI前端 & 架构' }],
      ['meta', { property: 'og:site_name', content: '黄腾霄的博客' }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'twitter:title', content: '黄腾霄的博客' }],
      ['meta', { name: 'twitter:description', content: 'AI前端 & 架构' }]
    ],

    srcExclude: [
      'README.md',
      'scripts/**',
      'knowledge/**/docs/**'
    ],

    themeConfig: {
      logo: '/avatar.png',
      nav: [
        { text: '首页', link: '/' },
        { text: '博客', link: '/posts/' },
        { text: 'AI 专栏', link: '/knowledge/ai/' },
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/xinyuehtx' }
      ],
      footer: {
        message: '基于 VitePress + @sugarat/theme 构建',
        copyright: '© 2017-2026 黄腾霄'
      },
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
            modal: {
              noResultsText: '无法找到相关结果',
              resetButtonTitle: '清除查询条件',
              footer: { selectText: '选择', navigateText: '切换' }
            }
          }
        }
      },
      lastUpdated: {
        text: '最后更新于',
        formatOptions: {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      },
      outline: {
        level: [2, 3],
        label: '页面导航'
      },
      docFooter: {
        prev: '上一篇',
        next: '下一篇'
      },
      sidebar: {
        ...knowledgeSidebar
      }
    },

    sitemap: {
      hostname: 'https://xinyuehtx.github.io'
    },

    markdown: {
      html: true
    },

    vite: {
      optimizeDeps: {
        exclude: ['@sugarat/theme'],
        include: [
          'mermaid',
          'dayjs',
          'dayjs/plugin/advancedFormat.js',
          'dayjs/plugin/customParseFormat.js',
          'dayjs/plugin/duration.js',
          'dayjs/plugin/isoWeek.js',
          '@braintree/sanitize-url',
          'cytoscape',
          'cytoscape-cose-bilkent',
          'cytoscape-fcose',
          'dompurify',
          'd3',
          'dagre-d3-es/src/dagre/index.js',
          'dagre-d3-es/src/graphlib/index.js',
          'dagre-d3-es/src/graphlib/json.js',
          'khroma',
          'lodash-es/clone.js',
          'lodash-es/memoize.js',
          'lodash-es/merge.js',
          'marked',
          'roughjs',
          'ts-dedent',
          'uuid'
        ]
      }
    },

    mermaid: {},
    mermaidPlugin: {
      class: 'mermaid'
    }
  })
)
