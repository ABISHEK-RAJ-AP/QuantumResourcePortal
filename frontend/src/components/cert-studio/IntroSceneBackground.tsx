import { useEffect, useState } from 'react'

import { BlueParticleWeb } from '@/components/cert-studio/BlueParticleWeb'
import { LoginWireBackdrop } from '@/components/cert-studio/LoginWireBackdrop'
import { useTheme } from '@/components/theme/ThemeProvider'
import { prefersReducedMotion } from '@/lib/motionPrefs'

/** Full-viewport Cert Studio intro: particle web (light) / neon wire (dark). */
export function IntroSceneBackground({ className = '' }: { className?: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const showAnimatedBg = !prefersReducedMotion()
  const [mountLight, setMountLight] = useState(!isDark)
  const [mountDark, setMountDark] = useState(isDark)

  useEffect(() => {
    const fadeMs = 380
    let timer: number | undefined
    if (isDark) {
      setMountDark(true)
      timer = window.setTimeout(() => setMountLight(false), fadeMs)
    } else {
      setMountLight(true)
      timer = window.setTimeout(() => setMountDark(false), fadeMs)
    }
    return () => window.clearTimeout(timer)
  }, [isDark])

  return (
    <div className={`intro-scene-bg ${className}`.trim()} aria-hidden>
      {mountLight ? (
        <div className={`intro-scene-bg__layer intro-scene-bg__layer--light${isDark ? ' is-fading-out' : ''}`}>
          <div className="intro-scene-bg__light-gradient" />
          {showAnimatedBg && !isDark ? <BlueParticleWeb /> : null}
        </div>
      ) : null}
      {mountDark ? (
        <div className={`intro-scene-bg__layer intro-scene-bg__layer--dark${!isDark ? ' is-fading-out' : ''}`}>
          {isDark && showAnimatedBg ? (
            <LoginWireBackdrop variant="dark" progress={0.72} />
          ) : isDark ? (
            <div className="landing-hero-canvas-fallback landing-hero-canvas-fallback--dark" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}