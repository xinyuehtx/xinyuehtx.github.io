import BlogTheme from '@sugarat/theme'
import type { Theme } from 'vitepress'
import { h, nextTick, watch } from 'vue'
import './custom.css'
import ProjectCard from './components/ProjectCard.vue'
import ProjectGrid from './components/ProjectGrid.vue'
import HeroCanvas from './components/HeroCanvas.vue'

const theme: Theme = {
  ...BlogTheme,
  // 包裹主题 Layout，在顶部插入首页动态背景（组件内部用 fixed 定位 + 仅首页显示）
  Layout() {
    return h(BlogTheme.Layout as any, null, {
      'layout-top': () => h(HeroCanvas)
    })
  },
  enhanceApp(ctx) {
    BlogTheme.enhanceApp?.(ctx)

    ctx.app.component('ProjectCard', ProjectCard)
    ctx.app.component('ProjectGrid', ProjectGrid)

    const { router } = ctx
    if (typeof window !== 'undefined') {
      const updateBodyClass = (path: string) => {
        const isHome = path === '/' || path === '/index.html'
        const isBlogList = path.startsWith('/posts')
        document.documentElement.classList.toggle('is-home-page', isHome)
        document.documentElement.classList.toggle('is-blog-page', isBlogList)
      }

      watch(
        () => router.route.path,
        (path) => {
          updateBodyClass(path)

          // SPA 导航后，如果 URL 包含 query 参数，手动触发 popstate 事件
          // 让 @sugarat/theme 的 useBrowserLocation() 重新读取 URL 参数
          // 解决从首页 Feature 卡片点击带 ?tag=xxx 参数的链接时 tag filter 不生效的问题
          nextTick(() => {
            if (window.location.search) {
              window.dispatchEvent(new PopStateEvent('popstate'))
            }
          })
        },
        { immediate: true }
      )
    }
  }
}

export default theme
