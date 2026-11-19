import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  Server,
  Shield,
  ScrollText,
  Users,
} from 'lucide-react'

import { PublicShell } from '@/components/marketing/PublicShell'
import { GridPulse } from '@/components/ui/grid-pulse'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

/** Halo so lit cells stay clear of copy. */
const guard =
  '[text-shadow:0_0_6px_var(--color-background),0_0_14px_var(--color-background),0_0_30px_var(--color-background)]'

const CAPABILITIES = [
  {
    title: 'Govern workloads',
    body: 'Multi-stage approvals, quotas, and policy trails without inventing missing evidence.',
  },
  {
    title: 'Operate the fleet',
    body: 'Backends, queues, incidents, and jobs in one workspace for the active institution.',
  },
  {
    title: 'Keep an audit trail',
    body: 'Reservations, metering, evidence snapshots, and activity stay readable for review.',
  },
]

const MODULES = [
  { icon: ClipboardCheck, title: 'Approvals', body: 'Policy-driven stage trail with quota checks before decide.' },
  { icon: Gauge, title: 'Quotas & metering', body: 'Daily shot ledger, headroom, and connector rollups.' },
  { icon: Server, title: 'Inventory & pools', body: 'Register assets, virtual pools, and provider manifests.' },
  { icon: Users, title: 'Projects & users', body: 'Project membership and role directory for operators.' },
  { icon: Shield, title: 'Reconciliation', body: 'G3 attempt ledger for authorise and reconcile outcomes.' },
  { icon: ScrollText, title: 'Evidence & audit', body: 'Append-only governance events and capture snapshots.' },
]

const WORKFLOW = [
  { n: '01', title: 'Submit', body: 'Create a workload package from a project and submit for review.' },
  { n: '02', title: 'Review', body: 'Technical and operations stages follow the published policy.' },
  { n: '03', title: 'Authorise', body: 'Quota passes and decisions move the request forward.' },
  { n: '04', title: 'Reconcile', body: 'Dispatch attempts and outcomes stay on the audit trail.' },
]

const FAQ = [
  {
    q: 'What is the Quantum Resource Portal?',
    a: 'C-DAC’s governance workspace for quantum workloads — approvals, capacity, operations, and evidence for the active institution.',
  },
  {
    q: 'How do I start a demo review?',
    a: 'Sign in as admin (use the Demo accounts button on Sign in), open Approvals, and use Start demo review.',
  },
  {
    q: 'Is procurement included?',
    a: 'No. Procurement and entitlements writes stay out of this release. Use inventory and the quota ledger for live capacity controls.',
  },
]

export function LandingPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <PublicShell>
      {/* Landing only (between public header and footer): pointer trail across all sections */}
      <div className={cn('relative isolate flex-1', dark ? 'bg-background' : 'bg-surface')}>
        <GridPulse className="z-0 opacity-90" ambient={1} maxLit={96} reach={2.2} />
        <main id="main-content" className="relative z-10 flex flex-col">
        <section className="qrp-landing-hero flex min-h-[min(92dvh,92svh,920px)] w-full flex-col items-center justify-center px-6 py-20 text-center sm:px-10 sm:py-28 lg:py-32">
          <div className="qrp-landing-hero__inner fade-up pointer-events-auto">
            <p data-grid-avoid className={cn('qrp-landing-hero__eyebrow acr', guard)}>
              C-DAC · Quantum platform
            </p>
            <h1 data-grid-avoid className={cn('qrp-landing-hero__title type-trim text-balance', guard)}>
              Quantum Resource Portal
            </h1>
            <p data-grid-avoid className={cn('qrp-landing-hero__lead hyphenate max-w-3xl text-pretty', guard)}>
              Govern quantum workloads end to end — approvals, capacity, operations, and evidence for your tenant.
            </p>
            <div className="qrp-landing-hero__actions mt-10">
              <Link to="/login" className="btn-primary landing-hero-cta gap-2">
                Enter portal
                <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link to="/register" className="btn-secondary landing-hero-cta">
                Request access
              </Link>
            </div>
          </div>
          <div className="qrp-landing-hero__fade pointer-events-none absolute inset-x-0 bottom-0 h-24" aria-hidden />
        </section>

        <div className="mx-auto w-full max-w-7xl space-y-24 px-4 py-20 sm:px-8 lg:px-10">
          <section id="capabilities" className="scroll-mt-28">
            <div className="qrp-landing-section-head flex flex-col justify-between gap-6 border-b border-border pb-4 md:flex-row md:items-end">
              <div>
                <h2 data-grid-avoid className={cn('qrp-landing-section__title', guard)}>
                  Approvals, capacity, and evidence in one workspace
                </h2>
              </div>
              <p data-grid-avoid className={cn('hyphenate max-w-md text-sm leading-relaxed text-muted-foreground', guard)}>
                Approvals, capacity, fleet posture, and evidence for the active tenant — aligned to{' '}
                <abbr className="acr" title="Governance stages">
                  G1–G3
                </abbr>
                .
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {CAPABILITIES.map((item) => (
                <article
                  key={item.title}
                  className="craft-card qrp-landing-card relative overflow-hidden p-6"
                >
                  <h3 data-grid-avoid className={cn('type-section-title type-title-clamp text-foreground', guard)}>
                    {item.title}
                  </h3>
                  <p data-grid-avoid className={cn('hyphenate mt-2 text-sm leading-relaxed text-muted-foreground', guard)}>
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section id="modules" className="scroll-mt-28">
            <div className="qrp-landing-section-head max-w-3xl space-y-2">
              <h2 data-grid-avoid className={cn('qrp-landing-section__title', guard)}>
                Operator modules for the live fleet
              </h2>
              <p data-grid-avoid className={cn('hyphenate text-base text-muted-foreground text-pretty', guard)}>
                Operator surfaces for governance, capacity, and fleet oversight.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((item) => {
                const Icon = item.icon
                return (
                  <article
                    key={item.title}
                    className="craft-card qrp-landing-card relative overflow-hidden p-6"
                  >
                    <div className="relative z-[1] flex items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                      <div className="min-w-0">
                        <h3 data-grid-avoid className={cn('type-section-title type-title-clamp text-foreground', guard)}>
                          {item.title}
                        </h3>
                        <p data-grid-avoid className={cn('hyphenate mt-1.5 text-sm leading-relaxed text-muted-foreground', guard)}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section
            id="workflow"
            className="craft-card qrp-landing-band scroll-mt-28 p-8 sm:p-12"
          >
            <div className="max-w-2xl">
              <h2 data-grid-avoid className={cn('qrp-landing-section__title type-trim', guard)}>
                From submit to reconcile
              </h2>
              <p data-grid-avoid className={cn('hyphenate mt-2 text-sm text-muted-foreground', guard)}>
                Real stage trail — submission, review, dispatch, evidence.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map((step) => (
                <div
                  key={step.n}
                  className="craft-inset qrp-landing-step relative overflow-hidden bg-surface p-6"
                >
                  <span className="text-base font-semibold tabular-nums text-primary">{step.n}</span>
                  <h3 data-grid-avoid className={cn('type-section-title mt-3 text-foreground', guard)}>
                    {step.title}
                  </h3>
                  <p data-grid-avoid className={cn('hyphenate mt-2 text-xs leading-relaxed text-muted-foreground', guard)}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="scroll-mt-28 mx-auto max-w-3xl">
            <div className="space-y-2 text-left">
              <h2 data-grid-avoid className={cn('qrp-landing-section__title', guard)}>
                Common questions
              </h2>
            </div>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {FAQ.map((item, idx) => {
                const open = openFaq === idx
                const answerId = `faq-answer-${idx}`
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-4 py-6 text-left text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      aria-expanded={open}
                      aria-controls={answerId}
                    >
                      <span data-grid-avoid className={cn('type-title-clamp', guard)}>
                        {item.q}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-5 shrink-0 text-muted-foreground transition-transform',
                          open && 'rotate-180 text-primary',
                        )}
                      />
                    </button>
                    {open ? (
                      <p
                        id={answerId}
                        data-grid-avoid
                        className={cn('hyphenate pb-6 text-sm leading-relaxed text-muted-foreground', guard)}
                      >
                        {item.a}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section
            id="get-started"
            className="craft-card qrp-landing-band scroll-mt-28 p-10 text-center sm:p-14"
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
              <h2 data-grid-avoid className={cn('qrp-landing-section__title type-trim', guard)}>
                Open the operator workspace
              </h2>
              <p data-grid-avoid className={cn('hyphenate text-base text-muted-foreground text-pretty', guard)}>
                Sign in, open Approvals, and walk the live stage trail.
              </p>
              <div className="qrp-landing-hero__actions mt-2">
                <Link to="/login" className="btn-primary landing-hero-cta inline-flex items-center gap-2">
                  Sign in
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link to="/register" className="btn-secondary landing-hero-cta">
                  Request access
                </Link>
              </div>
            </div>
          </section>
        </div>
        </main>
      </div>
    </PublicShell>
  )
}
