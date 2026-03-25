import { test, expect } from '@playwright/test'

test.describe('首页', () => {
  test('页面标题包含"黄腾霄"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/黄腾霄/)
  })

  test('Hero 区域显示正确的名称和描述', async ({ page }) => {
    await page.goto('/')
    const heroName = page.locator('.VPHero .name')
    await expect(heroName).toContainText('黄腾霄')

    const heroTagline = page.locator('.VPHero .tagline')
    await expect(heroTagline).toContainText('AI前端')
  })

  test('头像图片加载成功', async ({ page }) => {
    await page.goto('/')
    const heroImage = page.locator('.VPHero .VPImage')
    await expect(heroImage).toBeVisible()

    const imageSrc = await heroImage.getAttribute('src')
    expect(imageSrc).toContain('avatar.png')
  })

  test('导航栏包含正确的链接', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('.VPNav')

    await expect(nav.getByText('首页')).toBeVisible()
    await expect(nav.getByText('博客', { exact: true })).toBeVisible()
    await expect(nav.getByText('知识库')).toBeVisible()
  })

  test('Feature 卡片正确显示（3 个）', async ({ page }) => {
    await page.goto('/')
    const features = page.locator('.VPFeature')
    await expect(features).toHaveCount(3)

    await expect(features.nth(0)).toContainText('C# / .NET')
    await expect(features.nth(1)).toContainText('前端开发')
    await expect(features.nth(2)).toContainText('架构设计')
  })

  test('页脚信息正确', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('.VPFooter')
    await expect(footer).toContainText('VitePress')
    await expect(footer).toContainText('黄腾霄')
  })
})

test.describe('博客页', () => {
  test('首页博客列表正常渲染且有文章', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const blogListWrapper = page.locator('.blog-list-wrapper')
    await expect(blogListWrapper).toBeVisible({ timeout: 10_000 })

    const articles = page.locator('.blog-item')
    await expect(articles.first()).toBeVisible({ timeout: 10_000 })
    const articleCount = await articles.count()
    expect(articleCount).toBeGreaterThan(0)
  })

  test('搜索功能可用', async ({ page }) => {
    await page.goto('/')
    const searchButton = page.locator('#local-search button, .VPNavBarSearchButton, button[aria-label*="搜索"]')
    await expect(searchButton.first()).toBeVisible()
  })
})

test.describe('导航功能', () => {
  test('点击"博客"导航到博客页', async ({ page }) => {
    await page.goto('/')
    await page.locator('.VPNav').getByText('博客', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/posts')
  })

  test('社交链接指向正确的 GitHub 地址', async ({ page }) => {
    await page.goto('/')
    const githubLink = page.locator('a[href*="github.com/xinyuehtx"]')
    await expect(githubLink.first()).toBeVisible()

    const href = await githubLink.first().getAttribute('href')
    expect(href).toContain('github.com/xinyuehtx')
  })
})

test.describe('模块移除验证', () => {
  test('精选文章模块不存在', async ({ page }) => {
    await page.goto('/')
    await page.locator('.VPNav').getByText('博客', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const hotArticle = page.getByText('精选文章')
    await expect(hotArticle).toHaveCount(0)
  })

  test('友联模块不存在', async ({ page }) => {
    await page.goto('/')
    await page.locator('.VPNav').getByText('博客', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const friendLink = page.getByText('Gitee 镜像')
    await expect(friendLink).toHaveCount(0)
  })
})
