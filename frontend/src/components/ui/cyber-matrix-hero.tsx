import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Shield } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

type CyberMatrixHeroProps = {
  className?: string
  /** When set, replaces the default marketing CTA card. */
  children?: ReactNode
  /** Show default C-DAC / portal marketing copy. */
  showDefaultContent?: boolean
  eyebrow?: string
  title?: string
  description?: string
  ctaLabel?: string
  ctaTo?: string
}

/**
 * Character-grid atmosphere for auth. Cap cell count + rAF pointer (was full-viewport getBoundingClientRect spam).
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
  const gridRef = useRef<HTMLDivElement>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !gridRef.current) return

    const grid = gridRef.current
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>/?;:"[]{}\\|!@#$%^&*()_+-='

    const createGrid = () => {
      grid.innerHTML = ''
      // Sparse static grid — no pointer intensity / text-shadow thrash (Chrome/Edge)
      const size = Math.max(96, Math.round(Math.min(window.innerWidth, window.innerHeight) / 10))
      const columns = Math.min(10, Math.floor(window.innerWidth / size))
      const rows = Math.min(7, Math.floor(window.innerHeight / size))
      grid.style.setProperty('--columns', String(columns))
      grid.style.setProperty('--rows', String(rows))
      for (let i = 0; i < columns * rows; i++) {
        const tile = document.createElement('div')
        tile.classList.add('tile')
        tile.textContent = chars[Math.floor(Math.random() * chars.length)] ?? '#'
        grid.appendChild(tile)
      }
    }

    window.addEventListener('resize', createGrid)
    createGrid()

    return () => {
      window.removeEventListener('resize', createGrid)
    }
  }, [isClient])

  return (
    <div className={cn('relative flex h-full min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-[#0b1220] dark:bg-black', className)}>
      <div ref={gridRef} id="tiles" aria-hidden className="cyber-matrix-tiles" />

      <div className={cn('relative z-10 w-full px-6 py-10', children ? 'max-w-2xl' : 'max-w-3xl')}>
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
  )
}

export default CyberMatrixHero
