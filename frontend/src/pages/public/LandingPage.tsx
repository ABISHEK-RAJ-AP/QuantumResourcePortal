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
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const guard = ''

const CAPABILITIES = [
  {
    icon: Shield,
    title: 'Govern workloads',
    body: 'Multi-stage approvals, quotas, and policy trails without inventing missing evidence.',
  },
  {
    icon: Server,
    title: 'Operate the fleet',
    body: 'Backends, queues, incidents, and jobs in one workspace for the active institution.',
  },
  {
    icon: ScrollText,
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
        <section className="relative z-10 flex min-h-[calc(100svh-7.5rem)] flex-col items-center justify-center px-4 py-16 sm:px-8 lg:px-10">
          <div className="fade-up pointer-events-auto mx-auto w-full max-w-3xl rounded-[var(--radius)] border border-border bg-card px-6 py-10 text-center shadow-card sm:px-10 sm:py-12">
            <p data-grid-avoid className={cn('mb-2 text-sm text-muted-foreground', guard)}>
              Centre for Development of Advanced Computing
            </p>
            <h1
              data-grid-avoid
              className={cn(
                'text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl',
                guard,
              )}
            >
              Quantum Resource Portal
            </h1>
            <p
              data-grid-avoid
              className={cn('mx-auto mt-4 max-w-prose text-pretty text-base text-muted-foreground sm:text-lg', guard)}
            >
              Govern quantum workloads end to end — approvals, capacity, operations, and evidence for your tenant.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/login" className="btn-primary w-full gap-2 px-6 py-3 text-base sm:w-auto sm:min-w-[160px]">
                Enter portal
                <ArrowRight className="size-4" />
              </Link>
              <Link to="/register" className="btn-secondary w-full px-6 py-3 text-base sm:w-auto sm:min-w-[160px]">
                Request access
              </Link>
            </div>
          </div>
        </section>

        <main className="relative z-10 mx-auto w-full max-w-7xl space-y-24 px-4 py-20 sm:px-8 lg:px-10">
          <section id="capabilities" className="scroll-mt-28">
            <div className="flex flex-col justify-between gap-6 border-b border-border pb-4 md:flex-row md:items-end">
              <div>
                <h2
                  data-grid-avoid
                  className={cn(
                    'text-3xl font-semibold tracking-tight text-foreground sm:text-4xl',
                    guard,
                  )}
                >
                  Approvals, capacity, and evidence in one workspace
                </h2>
              </div>
              <p data-grid-avoid className={cn('max-w-md text-sm leading-relaxed text-muted-foreground', guard)}>
                Approvals, capacity, fleet posture, and evidence for the active tenant — aligned to G1–G3.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon
                return (
                  <article
                    key={item.title}
                    className={cn(
                      'relative overflow-hidden rounded-[var(--radius)] border border-border bg-card p-6 shadow-card',
                    )}
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-inner)] bg-accent text-accent-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 data-grid-avoid className={cn('mt-4 text-lg font-semibold text-foreground', guard)}>
                      {item.title}
                    </h3>
                    <p data-grid-avoid className={cn('mt-2 text-sm leading-relaxed text-muted-foreground', guard)}>
                      {item.body}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>

          <section id="modules" className="scroll-mt-28">
            <div className="mx-auto max-w-3xl space-y-2 text-center">
              <h2
                data-grid-avoid
                className={cn('text-3xl font-semibold tracking-tight text-foreground sm:text-4xl', guard)}
              >
                Operator modules for the live fleet
              </h2>
              <p data-grid-avoid className={cn('text-base text-muted-foreground', guard)}>
                Surfaces operators use day to day — not charter-only placeholders.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((item) => {
                const Icon = item.icon
                return (
                  <article
                    key={item.title}
                    className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-card p-6 shadow-card"
                  >
                    <div className="relative z-[1] flex items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <h3 data-grid-avoid className={cn('text-base font-semibold text-foreground', guard)}>
                          {item.title}
                        </h3>
                        <p data-grid-avoid className={cn('mt-1.5 text-sm leading-relaxed text-muted-foreground', guard)}>
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
            className="scroll-mt-28 rounded-[var(--radius)] border border-border bg-card p-8 shadow-card sm:p-12"
          >
            <div className="max-w-2xl">
              <h2 data-grid-avoid className={cn('text-3xl font-semibold tracking-tight text-foreground', guard)}>
                From submit to reconcile
              </h2>
              <p data-grid-avoid className={cn('mt-2 text-sm text-muted-foreground', guard)}>
                Real stage trail — submission, review, dispatch, evidence.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map((step) => (
                <div
                  key={step.n}
                  className="relative overflow-hidden rounded-[var(--radius-inner)] border border-border bg-surface p-6"
                >
                  <span className="text-base font-semibold tabular-nums text-primary">{step.n}</span>
                  <h3 data-grid-avoid className={cn('mt-3 text-lg font-semibold text-foreground', guard)}>
                    {step.title}
                  </h3>
                  <p data-grid-avoid className={cn('mt-2 text-xs leading-relaxed text-muted-foreground', guard)}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="scroll-mt-28 mx-auto max-w-3xl">
            <div className="space-y-2 text-center">
              <h2 data-grid-avoid className={cn('text-3xl font-semibold tracking-tight text-foreground', guard)}>
                Common questions
              </h2>
            </div>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {FAQ.map((item, idx) => {
                const open = openFaq === idx
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-4 py-6 text-left text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      aria-expanded={open}
                    >
                      <span data-grid-avoid className={guard}>
                        {item.q}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-5 shrink-0 text-muted-foreground transition-transform',
                          open && 'rotate-180 text-primary',
                        )}
                      />
                    </button>
                    {open && (
                      <p data-grid-avoid className={cn('pb-6 text-sm leading-relaxed text-muted-foreground', guard)}>
                        {item.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-[var(--radius)] border border-border bg-card p-10 text-center shadow-card sm:p-14">
            <div className="mx-auto max-w-2xl space-y-4">
              <h2 data-grid-avoid className={cn('text-3xl font-semibold tracking-tight text-foreground', guard)}>
                Open the operator workspace
              </h2>
              <p data-grid-avoid className={cn('text-base text-muted-foreground', guard)}>
                Sign in, open Approvals, and walk the live stage trail.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <Link to="/login" className="btn-primary gap-2 px-6 py-3 text-base">
                  Sign in <ArrowRight className="size-4" />
                </Link>
                <Link to="/register" className="btn-secondary px-6 py-3 text-base">
                  Request access
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicShell>
  )
}
