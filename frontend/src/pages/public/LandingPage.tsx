import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronDown } from 'lucide-react'

import { PublicShell } from '@/components/marketing/PublicShell'
import { GridPulse } from '@/components/ui/grid-pulse'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    title: 'Stage-gated approvals',
    body: 'Multi-step review with quota evaluation before authorise — decisions stay on the audit trail.',
  },
  {
    title: 'Capacity you can explain',
    body: 'Daily shot ledger, reservations, and metering rollups for the active institution.',
  },
  {
    title: 'Evidence on demand',
    body: 'Append-only governance events, dispatch attempts, and exports operators can hand to auditors.',
  },
]

const MODULES = [
  { title: 'Approvals', body: 'Open queue, stage history, quota gate at decide.' },
  { title: 'Quotas & metering', body: 'Ledger, caps, connector rollups.' },
  { title: 'Inventory & pools', body: 'Assets, virtual pools, provider manifests.' },
  { title: 'Projects & access', body: 'Membership, roles, project-scoped requests.' },
  { title: 'Dispatch reconcile', body: 'G3 attempt ledger for authorise and reconcile outcomes.' },
  { title: 'Audit & evidence', body: 'Governance events, snapshots, verification.' },
]

const WORKFLOW = [
  { n: '01', title: 'Submit', body: 'Package a workload from an approved project and submit for review.' },
  { n: '02', title: 'Review', body: 'Technical and operations stages follow published policy.' },
  { n: '03', title: 'Authorise', body: 'Quota passes; decisions advance the request.' },
  { n: '04', title: 'Reconcile', body: 'Dispatch attempts and outcomes land on the audit trail.' },
]

const FAQ = [
  {
    q: 'What is the Quantum Resource Portal?',
    a: 'C-DAC’s governance workspace for quantum workloads: approvals, capacity, fleet operations, and evidence for one institution at a time.',
  },
  {
    q: 'How do I start a review?',
    a: 'Sign in, open Approvals, and submit or open a workload on your project policy stages.',
  },
  {
    q: 'Is procurement in this build?',
    a: 'No. Procurement and entitlement writes are out of scope. Use inventory registration and the quota ledger for capacity control.',
  },
]

export function LandingPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <PublicShell>
      <div className={cn('relative isolate flex-1', dark ? 'bg-background' : 'bg-surface')}>
        <GridPulse className="qrp-landing-bg-grid absolute inset-0 z-0" cell={40} ambient={0.45} maxLit={36} reach={1.5} />
        <main id="main-content" className="relative z-10 flex flex-col">
          <section className="qrp-landing-hero flex min-h-[min(88dvh,88svh,880px)] w-full flex-col items-center justify-center px-6 py-16 text-center sm:px-10 sm:py-24 lg:py-28">
            <div className="qrp-landing-hero__inner fade-up pointer-events-auto">
              <p className="qrp-landing-hero__eyebrow">Quantum Resource Portal</p>
              <h1 className="qrp-landing-hero__title type-trim text-balance">
                Govern quantum workloads from submit to reconcile
              </h1>
              <p className="qrp-landing-hero__lead hyphenate mx-auto max-w-2xl text-pretty">
                Approvals, quotas, fleet status, dispatch, and audit exports for one institution.
              </p>
              <div className="qrp-landing-hero__actions mt-10">
                <Link to="/login" className="btn-primary landing-hero-cta inline-flex items-center gap-2">
                  Sign in
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Need an account?{' '}
                <Link to="/register" className="fs-link font-semibold text-primary">
                  Request access
                </Link>
              </p>
            </div>
            <div className="qrp-landing-hero__fade pointer-events-none absolute inset-x-0 bottom-0 h-24" aria-hidden />
          </section>

          <div className="qrp-landing-main space-y-0">
            <section id="capabilities" className="scroll-mt-28">
              <div className="qrp-landing-section-head">
                <div>
                  <span className="qrp-landing-kicker">Console</span>
                  <h2 className="qrp-landing-section__title mt-1">What operators run here</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Request, review, authorise, and reconcile with exportable records.
                  </p>
                </div>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CAPABILITIES.map((item, i) => (
                  <article key={item.title} className={cn('qrp-landing-tile', i === 0 && 'qrp-landing-tile--lead md:col-span-1')}>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="modules" className="scroll-mt-28">
              <div className="qrp-landing-section-head max-w-3xl">
                <span className="qrp-landing-kicker">Modules</span>
                <h2 className="qrp-landing-section__title mt-1">Workspace routes</h2>
              </div>
              <div className="mt-8 qrp-landing-module-list">
                {MODULES.map((item) => (
                  <div key={item.title} className="qrp-landing-module-row">
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="workflow" className="scroll-mt-28">
              <div className="qrp-landing-section-head max-w-2xl">
                <span className="qrp-landing-kicker">Workflow</span>
                <h2 className="qrp-landing-section__title mt-1">From submit to reconcile</h2>
                <p className="text-sm text-muted-foreground">The stage trail your institution configures in policy.</p>
              </div>
              <div className="mt-8 qrp-landing-steps">
                {WORKFLOW.map((step) => (
                  <div key={step.n} className="qrp-landing-step">
                    <span className="text-xs font-semibold tabular-nums text-primary">{step.n}</span>
                    <h3 className="mt-1 text-base font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="faq" className="scroll-mt-28 max-w-3xl">
              <div className="qrp-landing-section-head border-b-0 pb-0">
                <h2 className="qrp-landing-section__title">Questions before sign-in</h2>
              </div>
              <div className="mt-6 divide-y divide-border border-y border-border">
                {FAQ.map((item, idx) => {
                  const open = openFaq === idx
                  const answerId = `faq-answer-${idx}`
                  return (
                    <div key={item.q}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        onClick={() => setOpenFaq(open ? -1 : idx)}
                        aria-expanded={open}
                        aria-controls={answerId}
                      >
                        <span className="type-title-clamp">{item.q}</span>
                        <ChevronDown
                          className={cn(
                            'size-5 shrink-0 text-muted-foreground transition-transform',
                            open && 'rotate-180 text-primary',
                          )}
                        />
                      </button>
                      {open ? (
                        <p id={answerId} className="hyphenate pb-5 text-sm leading-relaxed text-muted-foreground">
                          {item.a}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </PublicShell>
  )
}