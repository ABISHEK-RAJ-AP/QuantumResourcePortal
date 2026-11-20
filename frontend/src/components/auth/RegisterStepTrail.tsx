import { Check } from 'lucide-react'

const STEPS = [
  { id: 'org', label: 'Organization' },
  { id: 'admin', label: 'Administrator' },
  { id: 'security', label: 'Security' },
] as const

export type RegisterTrailStep = (typeof STEPS)[number]['id']

export function RegisterStepTrail({ current }: { current: RegisterTrailStep }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)

  return (
    <div className="reg-step-trail-wrap">
      <div className="reg-wizard-steps" role="list" aria-label="Registration progress">
        {STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          let cls = 'reg-wizard-step'
          if (done) cls += ' reg-wizard-step--done'
          else if (active) cls += ' reg-wizard-step--current'

          return (
            <span key={step.id} className={cls} role="listitem" aria-current={active ? 'step' : undefined}>
              {done ? (
                <Check className="reg-wizard-step__check" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className="reg-wizard-step__num" aria-hidden>
                  {i + 1}
                </span>
              )}
              <span className="reg-wizard-step__label">{step.label}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}