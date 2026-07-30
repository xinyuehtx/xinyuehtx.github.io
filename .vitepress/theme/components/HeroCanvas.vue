<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let cleanup: (() => void) | null = null

onMounted(() => {
  if (typeof window === 'undefined') return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return

  let w = 0
  let h = 0
  let dpr = Math.min(window.devicePixelRatio || 1, 2)

  type P = { x: number; y: number; vx: number; vy: number }
  let pts: P[] = []

  const brand = () =>
    document.documentElement.classList.contains('dark')
      ? [77, 217, 200]
      : [26, 138, 125]

  const resize = () => {
    w = window.innerWidth
    h = Math.min(window.innerHeight, 900)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = w * dpr
    el.height = h * dpr
    el.style.width = w + 'px'
    el.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.min(70, Math.floor((w * h) / 22000))
    pts = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28
    }))
  }

  const draw = () => {
    const [r, g, b] = brand()
    ctx.clearRect(0, 0, w, h)

    for (const p of pts) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > w) p.vx *= -1
      if (p.y < 0 || p.y > h) p.vy *= -1
    }

    // 连线
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const c = pts[j]
        const dx = a.x - c.x
        const dy = a.y - c.y
        const dist = Math.hypot(dx, dy)
        if (dist < 130) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - dist / 130) * 0.16})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(c.x, c.y)
          ctx.stroke()
        }
      }
    }
    // 节点
    for (const p of pts) {
      ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }

    raf = requestAnimationFrame(draw)
  }

  resize()
  window.addEventListener('resize', resize)

  if (reduce) {
    draw()
    cancelAnimationFrame(raf) // 只画一帧，静态呈现
  } else {
    draw()
  }

  cleanup = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <canvas ref="canvas" class="hero-canvas" aria-hidden="true"></canvas>
</template>
