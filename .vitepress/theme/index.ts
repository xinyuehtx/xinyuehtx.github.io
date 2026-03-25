import BlogTheme from '@sugarat/theme'
import type { Theme } from 'vitepress'
import { nextTick, watch } from 'vue'
import './custom.css'

const theme: Theme = {
  ...BlogTheme,
  enhanceApp(ctx) {
    BlogTheme.enhanceApp?.(ctx)

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
