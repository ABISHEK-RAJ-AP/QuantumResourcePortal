import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Shield } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

type CyberMatrixHeroProps = {
  className?: string
  children?: ReactNode
  showDefaultContent?: boolean
  eyebrow?: string
  title?: string
  description?: string
  ctaLabel?: string
  ctaTo?: string
}

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>/?;:[]{}|!@#$%^*_+-='

type GridMeta = { cols: number; rows: number; cellW: number; cellH: number }

/**
 * Auth cyber-matrix with cursor spotlight + tile scramble near pointer.
 */
export function CyberMatrixHero({
  className,
  children,
  showDefaultContent = true,
  eyebrow = 'C-DAC governance',
  title = 'Quantum Resource Portal',
  description = 'Approvals, capacity, operations, and evidence for the active institution — on a secure national compute fabric.',
  ctaLabel = 'Enter portal',
  ctaTo = '/login',
}: CyberMatrixHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const metaRef = useRef<GridMeta>({ cols: 0, rows: 0, cellW: 1, cellH: 1 })
  const pointerRef = useRef({ x: -9999, y: -9999, active: false })
  const hotRef = useRef<Set<number>>(new Set())
  const rafRef = useRef(0)
  const dirtyRef = useRef(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !gridRef.current || !rootRef.current) return

    const grid = gridRef.current
    const root = rootRef.current
    const spot = spotRef.current
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.body.classList.contains('a11y-pause-anim')

    const createGrid = () => {
      grid.innerHTML = ''
      hotRef.current.clear()
      const cell = Math.max(22, Math.min(32, Math.round(Math.min(window.innerWidth, window.innerHeight) / 36)))
      const cols = Math.min(48, Math.max(12, Math.floor(window.innerWidth / cell)))
      const rows = Math.min(28, Math.max(8, Math.floor(window.innerHeight / cell)))
      metaRef.current = { cols, rows, cellW: cell, cellH: cell }
      grid.style.setProperty('--columns', String(cols))
      grid.style.setProperty('--rows', String(rows))
      const frag = document.createDocumentFragment()
      for (let i = 0; i < cols * rows; i++) {
        const tile = document.createElement('span')
        tile.className = 'tile'
        tile.textContent = CHARS[Math.floor(Math.random() * CHARS.length)] ?? '#'
        tile.style.setProperty('--intensity', '0')
        frag.appendChild(tile)
      }
      grid.appendChild(frag)
    }

    const RADIUS = 170
    const RADIUS_SQ = RADIUS * RADIUS

    const clearHot = () => {
      const tiles = grid.children
      for (const i of hotRef.current) {
        const el = tiles[i] as HTMLElement | undefined
        if (!el) continue
        el.style.setProperty('--intensity', '0')
        el.classList.remove('tile--hot')
      }
      hotRef.current.clear()
    }

    const paint = () => {
      rafRef.current = 0
      if (!dirtyRef.current) return
      dirtyRef.current = false

      const { cols, rows, cellW, cellH } = metaRef.current
      const tiles = grid.children
      if (!cols || !tiles.length) return

      const { x, y, active } = pointerRef.current

      if (spot) {
        if (active && !reduced) {
          spot.style.setProperty('--sx', `${x}px`)
          spot.style.setProperty('--sy', `${y}px`)
          spot.style.opacity = '1'
        } else {
          spot.style.opacity = '0'
        }
      }

      if (!active || reduced) {
        clearHot()
        return
      }

      const c0 = Math.max(0, Math.floor((x - RADIUS) / cellW))
      const c1 = Math.min(cols - 1, Math.ceil((x + RADIUS) / cellW))
      const r0 = Math.max(0, Math.floor((y - RADIUS) / cellH))
      const r1 = Math.min(rows - 1, Math.ceil((y + RADIUS) / cellH))

      const nextHot = new Set<number>()

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c
          const el = tiles[i] as HTMLElement | undefined
          if (!el) continue
          const cx = (c + 0.5) * cellW
          const cy = (r + 0.5) * cellH
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          if (d2 > RADIUS_SQ) continue
          const intensity = 1 - Math.sqrt(d2) / RADIUS
          el.style.setProperty('--intensity', intensity.toFixed(3))
          if (intensity > 0.3) {
            el.classList.add('tile--hot')
            if (intensity > 0.5 && Math.random() > 0.7) {
              el.textContent = CHARS[Math.floor(Math.random() * CHARS.length)] ?? '#'
            }
          } else {
            el.classList.remove('tile--hot')
          }
          nextHot.add(i)
        }
      }

      for (const i of hotRef.current) {
        if (nextHot.has(i)) continue
        const el = tiles[i] as HTMLElement | undefined
        if (!el) continue
        el.style.setProperty('--intensity', '0')
        el.classList.remove('tile--hot')
      }
      hotRef.current = nextHot
    }

    const schedule = () => {
      dirtyRef.current = true
      if (!rafRef.current) rafRef.current = requestAnimationFrame(paint)
    }

    const onMove = (e: MouseEvent) => {
      if (reduced) return
      const rect = grid.getBoundingClientRect()
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      }
      metaRef.current.cellW = rect.width / metaRef.current.cols
      metaRef.current.cellH = rect.height / metaRef.current.rows
      schedule()
    }

    const onLeave = () => {
      pointerRef.current.active = false
      schedule()
    }

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(createGrid, 120)
    }

    createGrid()
    root.addEventListener('mousemove', onMove, { passive: true })
    root.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', onResize)

    return () => {
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(resizeTimer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isClient])

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex h-full min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-[#0b1220] dark:bg-black',
        className,
      )}
    >
      <div className="cyber-matrix-orbs" aria-hidden>
        <span className="cyber-matrix-orbs__a" />
        <span className="cyber-matrix-orbs__b" />
      </div>
      <div ref={gridRef} aria-hidden className="cyber-matrix-tiles" />
      <div ref={spotRef} className="cyber-matrix-spot" aria-hidden />

      <div className={cn('pointer-events-none relative z-10 w-full px-6 py-10', children ? 'max-w-2xl' : 'max-w-3xl')}>
        <div className="pointer-events-auto">
          {children ? (
            children
          ) : showDefaultContent ? (
            <div className="rounded-xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur-md sm:p-8">
              <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-1.5">
                <Shield className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-medium text-gray-200">{eyebrow}</span>
              </div>

              <h1 className="fade-up fade-up-delay-1 mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl">
                {title}
              </h1>

              <p className="fade-up fade-up-delay-2 mx-auto mb-10 max-w-2xl text-base text-gray-400 md:text-lg">{description}</p>

              <div className="fade-up fade-up-delay-3">
                <Link
                  to={ctaTo}
                  className="mx-auto inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 font-semibold text-black shadow-lg transition-colors duration-300 hover:bg-gray-200"
                >
                  {ctaLabel}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CyberMatrixHero
