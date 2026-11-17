import { useEffect, useState } from 'react'

import { AuthFridgeSvgLoop } from '@/components/marketing/AuthFridgeSvgLoop.jsx'

import '@/components/marketing/auth-fridge.css'

/** Dilution-refrigerator loop — same asset as Q-TeleScope auth hero. */
export function AuthFridgeVisual() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(motion.matches)
    sync()
    motion.addEventListener('change', sync)
    return () => motion.removeEventListener('change', sync)
  }, [])

  return (
    <div className="auth-fridge" role="img" aria-label="Dilution refrigerator animation">
      <AuthFridgeSvgLoop reduced={reduced} />
    </div>
  )
}