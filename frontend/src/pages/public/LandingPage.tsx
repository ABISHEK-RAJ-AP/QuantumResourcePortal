import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  ScrollText,
  FileStack,
  BarChart3,
  Boxes,
  Users,
  Send,
  Shield,
  type LucideIcon,
} from 'lucide-react'

import { LandingChrome } from '@/components/marketing/LandingChrome'
import { PublicShell } from '@/components/marketing/PublicShell'
import { GridPulse } from '@/components/ui/grid-pulse'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    icon: ClipboardCheck,
    title: 'Stage-gated approvals',
    body: 'Multi-step review with organization quota evaluation before authorise. Every decision is on the audit trail.',
  },
  {
    icon: Gauge,
    title: 'Capacity you can explain',
    body: 'Daily shot ledger, reservations, and org-wide metering rollups.',
  },
  {
    icon: ScrollText,
    title: 'Evidence on demand',
    body: 'Governance events, dispatch attempts, and exports your auditors can verify.',
  },
]

const FEATURES = [
  { icon: FileStack, title: 'Approvals', body: 'Org review queue, stage history, quota gate at decide.' },
  { icon: BarChart3, title: 'Quotas & metering', body: 'Organization ledger, caps, usage rollups.' },
  { icon: Boxes, title: 'Inventory & pools', body: 'Fleet catalogue, pools, provider manifests.' },
  { icon: Users, title: 'Organization & projects', body: 'People & access, roles, project-scoped workloads.' },
  { icon: Send, title: 'Dispatch reconcile', body: 'Attempt ledger for authorise and reconcile outcomes.' },
  { icon: Shield, title: 'Audit & evidence', body: 'Append-only governance events and exports.' },
]

const WORKFLOW_STEPS = [
  { n: '01', title: 'Register', body: 'Create your organization and first administrator, then invite members.' },
  { n: '02', title: 'Submit', body: 'Open a research project and submit a workload to the org review queue.' },
  { n: '03', title: 'Review', body: 'Policy stages run at organization scope; quota must pass before authorise.' },
  { n: '04', title: 'Reconcile', body: 'Dispatch attempts and outcomes land on the org audit trail.' },
]

const FAQ = [
  {
    q: 'What is the Quantum Resource Portal?',
    a: 'CDAC-operated platform: each customer organization gets an isolated tenant with projects, approvals, quotas, inventory, and audit exports.',
  },
  {
    q: 'How do I start a review?',
    a: 'Sign in to your organization, open Approvals, and submit or decide workloads on your project policy stages.',
  },
  {
    q: 'Where is procurement?',
    a: 'Procurement is not in this release. Register platform inventory and track capacity in the organization quota ledger.',
  },
]

function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="qrp-landing-feature-card group">
      <Icon className="qrp-landing-tile__icon" aria-hidden />
      <h3 className="qrp-landing-tile__title">{title}</h3>
      <p className="qrp-landing-tile__body">{body}</p>
    </article>
  )
}

export function LandingPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [openFaq, setOpenFaq] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = mainRef.current
    if (!root) return undefined
    const nodes = root.querySelectorAll('.qrp-landing-reveal')
    if (!nodes.length) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      nodes.forEach((n) => n.classList.add('is-visible'))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible')
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  return (
    <PublicShell>
      <LandingChrome />
      <div className={cn('qrp-landing-canvas relative isolate flex-1', dark ? 'bg-background' : 'bg-surface')}>
        <div className="qrp-landing-bg-wash pointer-events-none absolute inset-0 z-0" aria-hidden />
        <GridPulse
          key={theme}
          className="qrp-landing-bg-grid absolute inset-0 z-0 text-foreground"
          cell={36}
          ambient={1.1}
          maxLit={64}
          reach={2.2}
        />
        <section className="qrp-landing-hero relative z-10 flex min-h-[min(88dvh,880px)] w-full flex-col items-center justify-center px-6 py-20 text-center sm:px-10 sm:py-28 lg:py-32">
          <p className="qrp-landing-hero__eyebrow">Quantum Resource Portal</p>
          <h1 className="qrp-landing-hero__title type-trim text-balance max-w-5xl">
            Quantum resource governance for{' '}
            <span className="qrp-landing-hero__accent">every organization on the platform</span>
          </h1>
          <p className="qrp-landing-hero__lead hyphenate mx-auto mt-8 max-w-3xl text-pretty">
            CDAC operates the shared provider fabric; your org gets isolated projects, approvals, quotas, metering, and
            audit exports — Cert Studio–grade access and Q-TeleScope–grade ops density.
          </p>
          <div className="qrp-landing-hero__actions mt-12">
            <Link to="/login" className="btn-primary landing-hero-cta inline-flex items-center gap-2">
              Sign in
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Need an account?{' '}
            <Link to="/register" className="fs-link font-semibold text-primary">
              Register your organization
            </Link>
          </p>
          <div className="qrp-landing-hero__fade pointer-events-none absolute inset-x-0 bottom-0 h-32" aria-hidden />
        </section>

        <main id="main-content" ref={mainRef} className="qrp-landing-main relative z-10 space-y-24 pb-24 lg:space-y-28">
          <section id="capabilities" className="qrp-landing-section scroll-mt-28 qrp-landing-reveal">
            <div className="mx-auto max-w-3xl space-y-2 text-center">
              <span className="qrp-landing-kicker qrp-landing-kicker--accent">Console</span>
              <h2 className="qrp-landing-section__title">What you get</h2>
              <p className="text-base text-muted-foreground">
                Per-organization policy stages, capacity ledgers, and exportable records — Q-TeleScope ops density.
              </p>
            </div>
            <div className="qrp-landing-feature-grid mt-12">
              {CAPABILITIES.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section id="features" className="qrp-landing-section scroll-mt-28 qrp-landing-reveal">
            <div className="mx-auto max-w-3xl space-y-2 text-center">
              <span className="qrp-landing-kicker qrp-landing-kicker--accent">Modules</span>
              <h2 className="qrp-landing-section__title">Approvals, quotas, audit</h2>
              <p className="text-base text-muted-foreground">Fleet inventory, dispatch, and project access.</p>
            </div>
            <div className="qrp-landing-feature-grid qrp-landing-feature-grid--modules mt-12">
              {FEATURES.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section id="workflow" className="qrp-landing-workflow scroll-mt-28 qrp-landing-reveal p-8 sm:p-12">
            <div className="max-w-2xl">
              <span className="qrp-landing-kicker qrp-landing-kicker--accent">Workflow</span>
              <h2 className="qrp-landing-section__title mt-1">From request to audit</h2>
              <p className="mt-2 text-sm text-muted-foreground">Submit, review, authorise, then reconcile dispatch.</p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((s) => (
                <article key={s.n} className="qrp-landing-tile qrp-landing-tile--step">
                  <span className="qrp-landing-tile__step">{s.n}</span>
                  <h3 className="qrp-landing-tile__title">{s.title}</h3>
                  <p className="qrp-landing-tile__body">{s.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="faq" className="scroll-mt-28 qrp-landing-reveal mx-auto max-w-3xl">
            <div className="space-y-2 text-center">
              <span className="qrp-landing-kicker qrp-landing-kicker--accent">FAQ</span>
              <h2 className="qrp-landing-section__title">Questions</h2>
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
                      <span className="type-title-clamp">{item.q}</span>
                      <ChevronDown
                        className={cn(
                          'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
                          open && 'rotate-180 text-primary',
                        )}
                      />
                    </button>
                    {open ? (
                      <p id={answerId} className="hyphenate pb-6 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="qrp-landing-cta qrp-landing-reveal p-10 text-center sm:p-14">
            <div className="mx-auto max-w-2xl space-y-4">
              <h2 className="qrp-landing-section__title">Open the workspace</h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Sign in to your organization workspace, or register a new org on lab deployments.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link to="/login" className="btn-primary landing-hero-cta inline-flex items-center gap-2">
                  Sign in
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/register" className="btn-secondary landing-hero-cta inline-flex items-center gap-2">
                  Register organization
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicShell>
  )
}