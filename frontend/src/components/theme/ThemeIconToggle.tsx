import { useEffect, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ThemeIconToggle({
  dark,
  onToggle,
  label,
  className,
  sunClassName,
}: {
  dark: boolean
  onToggle: () => void
  label: string
  className?: string
  sunClassName?: string
}) {
  const [swapping, setSwapping] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    },
    [],
  )
  return (
    <button
      type="button"
      className={cn(
        'qrp-icon-swap grid size-9 place-items-center rounded-lg border border-input hover:bg-accent',
        swapping && 'is-swapping',
        className,
      )}
      aria-label={label}
      title={label}
      onClick={() => {
        setSwapping(true)
        onToggle()
        if (timer.current != null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setSwapping(false), 160)
      }}
    >
      <span className="qrp-icon-swap__icon">
        {dark ? <Sun className={cn('size-4', sunClassName ?? 'text-amber-500')} /> : <Moon className="size-4" />}
      </span>
    </button>
  )
}