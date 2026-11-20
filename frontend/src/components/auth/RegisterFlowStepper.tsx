import { Check } from 'lucide-react'

const STEPS = ['Organisation', 'Your details', 'Security', 'Verify email'] as const

export type RegisterFlowPhase = 'type' | 'details' | 'security' | 'verify'

export function phaseToStepIndex(phase: RegisterFlowPhase): number {
  switch (phase) {
    case 'type':
      return 0
    case 'details':
      return 1
    case 'security':
      return 2
    case 'verify':
      return 3
    default:
      return 0
  }
}

/** Horizontal 4-step bar — matches Q-TeleScope / gov register mock. */
export function RegisterFlowStepper({ phase }: { phase: RegisterFlowPhase }) {
  const current = phaseToStepIndex(phase)

  return (
    <div className="qrp-reg-step-trail-wrap">
      <ol className="qrp-reg-step-trail" aria-label="Registration progress">
        {STEPS.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={label}
              className={`qrp-reg-step-trail__step${active ? ' qrp-reg-step-trail__step--active' : ''}${done ? ' qrp-reg-step-trail__step--done' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="qrp-reg-step-trail__num" aria-hidden>
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="qrp-reg-step-trail__label">{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}