import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Scroll progress + back-to-top (Q-TeleScope public marketing parity). */
export function LandingChrome() {
  const [progress, setProgress] = useState(0)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0
      setProgress(p)
      setShowTop(window.scrollY > 480)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div
        className="qrp-landing-scroll-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      >
        <div className="qrp-landing-scroll-progress__bar" style={{ transform: `scaleX(${progress})` }} />
      </div>
      {showTop ? (
        <button
          type="button"
          className="qrp-landing-back-top"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp size={20} aria-hidden />
        </button>
      ) : null}
    </>
  )
}