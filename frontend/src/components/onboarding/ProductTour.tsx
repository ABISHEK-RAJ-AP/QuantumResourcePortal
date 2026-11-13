import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { TourStep } from '@/lib/qrpTour'
import { cn } from '@/lib/utils'

function findTourTarget(targetId: string) {
  return document.querySelector(`[data-tour="${targetId}"]`) as HTMLElement | null
}

function measureTarget(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const pad = 8
  return {
    top: Math.max(8, rect.top - pad),
    left: Math.max(8, rect.left - pad),
    width: Math.min(rect.width + pad * 2, window.innerWidth - 16),
    height: Math.min(rect.height + pad * 2, Math.round(window.innerHeight * 0.58), window.innerHeight - 16),
  }
}

function placePopover(box: { top: number; left: number; width: number; height: number }) {
  const w = Math.min(340, window.innerWidth - 24)
  const h = 220
  const sidebarHit = box.left < 280 && box.width < 320
  if (sidebarHit) {
    return {
      top: Math.min(box.top, window.innerHeight - h - 16),
      left: Math.min(box.left + box.width + 12, window.innerWidth - w - 12),
    }
  }
  let top = box.top + box.height + 12
  let left = Math.min(Math.max(16, box.left), window.innerWidth - w - 12)
  if (top + h > window.innerHeight) {
    top = Math.max(16, box.top - h - 12)
  }
  return { top, left }
}

export function ProductTour({
  open,
  steps,
  onClose,
  onStep,
  initialStep = 0,
}: {
  open: boolean
  steps: TourStep[]
  onClose: () => void
  onStep?: (step: TourStep) => void
  initialStep?: number
}) {
  const [index, setIndex] = useState(initialStep)
  const [spot, setSpot] = useState<ReturnType<typeof measureTarget> | null>(null)
  const [popover, setPopover] = useState({ top: 80, left: 24 })
  const scrolledStepRef = useRef('')
  const rafRef = useRef(0)
  const notifiedRef = useRef('')

  const step = steps[index]

  const reposition = useCallback(
    (opts: { scroll?: boolean } = {}) => {
      const { scroll = false } = opts
      if (!open || !step) return
      const el = findTourTarget(step.target)
      if (!el || !el.isConnected) {
        setSpot(null)
        setPopover({ top: 88, left: 288 })
        return
      }
      const stepKey = `${index}:${step.target}`
      if (scroll && scrolledStepRef.current !== stepKey) {
        scrolledStepRef.current = stepKey
        try {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        } catch {
          /* ignore */
        }
      }
      const box = measureTarget(el)
      setSpot(box)
      setPopover(placePopover(box))
    },
    [open, step, index],
  )

  useEffect(() => {
    if (!open) return
    setIndex(initialStep)
    scrolledStepRef.current = ''
    notifiedRef.current = ''
    setSpot(null)
  }, [open, initialStep])

  useEffect(() => {
    setSpot(null)
    scrolledStepRef.current = ''
  }, [index])

  useEffect(() => {
    if (!open || !step) return
    const key = `${index}:${step.target}`
    if (notifiedRef.current === key) return
    notifiedRef.current = key
    onStep?.(step)
  }, [open, step, index, onStep])

  useLayoutEffect(() => {
    if (!open || !step) return undefined
    reposition({ scroll: true })
    let tries = 0
    const retry = window.setInterval(() => {
      tries += 1
      const el = findTourTarget(step.target)
      if (el?.isConnected || tries > 20) {
        window.clearInterval(retry)
        if (el?.isConnected) reposition({ scroll: true })
      }
    }, 120)
    return () => window.clearInterval(retry)
  }, [reposition, index, open, step])

  useEffect(() => {
    if (!open) return undefined
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => reposition({ scroll: false }))
    }
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, steps.length])

  if (!open || !step) return null

  const atEnd = index >= steps.length - 1

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-[top,left,width,height] duration-200"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : null}
      <div
        className={cn(
          'absolute z-[101] w-[min(340px,calc(100vw-24px))] rounded-xl border border-border bg-card p-4 shadow-xl',
        )}
        style={{ top: popover.top, left: popover.left }}
      >
        <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        {step.lesson ? (
          <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">{step.lesson}</p>
        ) : null}
        {!spot ? (
          <p className="mt-2 text-xs text-warning">Waiting for this region. Next skips ahead.</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1} / {steps.length}
          </span>
          <div className="flex gap-1.5">
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>
              Skip
            </button>
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary px-2 py-1 text-xs"
              onClick={() => (atEnd ? onClose() : setIndex((i) => i + 1))}
            >
              {atEnd ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
