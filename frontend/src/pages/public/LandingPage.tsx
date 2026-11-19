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
  { title: 'Submit', body: 'Package a workload from an approved project and submit for review.' },
  { title: 'Review', body: 'Technical and operations stages follow published policy.' },
  { title: 'Authorise', body: 'Quota passes; decisions advance the request.' },
  { title: 'Reconcile', body: 'Dispatch attempts and outcomes land on the audit trail.' },
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
    q: 'Where is procurement?',
    a: 'Procurement is not in this release. Register inventory and track capacity in the quota ledger.',
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
          <section className="qrp-landing-hero flex min-h-[min(72dvh,720px)] w-full flex-col items-center justify-center px-6 py-14 text-center sm:px-10 sm:py-20 lg:py-24">
            <div className="qrp-landing-hero__inner fade-up pointer-events-auto">
              <p className="qrp-landing-hero__eyebrow">C-DAC · Quantum Resource Portal</p>
              <h1 className="qrp-landing-hero__title type-trim text-balance">
                Govern workloads from submit to reconcile
              </h1>
              <p className="qrp-landing-hero__lead hyphenate mx-auto max-w-xl text-pretty">
                Approvals, quotas, fleet, dispatch, and audit exports for one institution.
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
                <h2 className="qrp-landing-section__title">What operators run here</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Request, review, authorise, and reconcile with exportable records.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <article className="qrp-landing-tile qrp-landing-tile--lead">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{CAPABILITIES[0].title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{CAPABILITIES[0].body}</p>
                </article>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CAPABILITIES.slice(1).map((item) => (
                    <article key={item.title} className="qrp-landing-tile">
                      <h3 className="text-base font-semibold tracking-tight text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="modules" className="scroll-mt-28">
              <div className="qrp-landing-section-head max-w-3xl">
                <h2 className="qrp-landing-section__title">Workspace routes</h2>
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
                <h2 className="qrp-landing-section__title">From submit to reconcile</h2>
                <p className="mt-2 text-sm text-muted-foreground">Stages follow policy configured for your institution.</p>
              </div>
              <div className="mt-8 qrp-landing-steps">
                {WORKFLOW.map((step) => (
                  <div key={step.title} className="qrp-landing-step">
                    <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="faq" className="scroll-mt-28 max-w-3xl">
              <div className="qrp-landing-section-head border-b-0 pb-0">
                <h2 className="qrp-landing-section__title">Before you sign in</h2>
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