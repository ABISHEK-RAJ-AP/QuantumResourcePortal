import { useEffect, useRef } from 'react'

import { prefersReducedMotion } from '@/lib/motionPrefs'

const PARTICLE_COUNT = 220
const CONNECT_DISTANCE = 145
const MOUSE_RADIUS = 120
const NODE_COLOR = 'rgba(26, 86, 219, 0.82)'
const LINE_BASE = 'rgba(26, 86, 219,'

/** Cert Studio light-mode particle web (ported from qre-theme). */
export function BlueParticleWeb({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })
  const rafRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let width = 0
    let height = 0
    const particles: { x: number; y: number; vx: number; vy: number }[] = []

    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const initParticles = () => {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.55,
          vy: (Math.random() - 0.5) * 0.55,
        })
      }
    }

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const onLeave = () => {
      mouseRef.current = { x: null, y: null }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i]!
        let targetX = p.x + p.vx
        let targetY = p.y + p.vy

        const mouse = mouseRef.current
        if (mouse.x != null && mouse.y != null) {
          const dx = targetX - mouse.x
          const dy = targetY - mouse.y
          const distance = Math.hypot(dx, dy)
          if (distance > 0 && distance < MOUSE_RADIUS) {
            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS
            targetX -= (dx / distance) * force * 1.5
            targetY -= (dy / distance) * force * 1.5
          }
        }

        if (targetX <= 0 || targetX >= width) p.vx *= -1
        if (targetY <= 0 || targetY >= height) p.vy *= -1

        p.x = Math.max(0, Math.min(width, targetX))
        p.y = Math.max(0, Math.min(height, targetY))
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i]!
          const b = particles[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < CONNECT_DISTANCE) {
            const alpha = 1 - dist / CONNECT_DISTANCE
            ctx.strokeStyle = `${LINE_BASE}${alpha * 0.48})`
            ctx.lineWidth = 1.25
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = NODE_COLOR
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    const onResize = () => {
      resize()
      initParticles()
    }

    resize()
    initParticles()
    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  if (prefersReducedMotion()) {
    return <div className={`blue-particle-web__static ${className}`.trim()} aria-hidden />
  }

  return <canvas ref={canvasRef} className={`blue-particle-web__canvas ${className}`.trim()} aria-hidden />
}