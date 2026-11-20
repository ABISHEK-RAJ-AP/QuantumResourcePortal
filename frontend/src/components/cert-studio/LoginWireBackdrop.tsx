import { GEMINI_WIRE_PATHS } from '@/components/cert-studio/geminiWirePaths'

const DARK_STROKES = ['#2dffbe', '#5eead4', '#38bdf8', '#60a5fa', '#34d399', '#a78bfa']

/** Cert Studio dark-mode wire backdrop (ported from qre-theme). */
export function LoginWireBackdrop({
  variant = 'dark',
  progress = 0.72,
}: {
  variant?: 'light' | 'dark'
  progress?: number
}) {
  const isDark = variant === 'dark'

  return (
    <div className={`login-wire-backdrop${isDark ? ' login-wire-backdrop--dark' : ''}`} aria-hidden>
      <svg viewBox="0 0 1440 890" preserveAspectRatio="xMidYMid slice" className="login-wire-backdrop__svg">
        <defs>
          <filter id="qrpLoginWireBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isDark ? 1.5 : 2.5} />
          </filter>
          {isDark ? (
            <filter id="qrpLoginWireGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>
        {GEMINI_WIRE_PATHS.map((path, index) => {
          const stagger = index * 0.08
          const lineProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger + 0.01)))
          const stroke = isDark ? DARK_STROKES[index % DARK_STROKES.length] : path.stroke
          return (
            <path
              key={`${path.stroke}-${index}`}
              d={path.d}
              fill="none"
              stroke={stroke}
              strokeWidth={isDark ? 2.75 : 2.25}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - lineProgress}
              filter={isDark ? 'url(#qrpLoginWireGlow)' : 'url(#qrpLoginWireBlur)'}
              className="login-wire-backdrop__path"
              opacity={isDark ? 0.92 : 0.88}
            />
          )
        })}
      </svg>
    </div>
  )
}