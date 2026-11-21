import { Link } from 'react-router'

import { PublicShell } from '@/components/marketing/PublicShell'
import { Card } from '@/components/layout/Page'

/** DRAFT — operator must review before external users. */
export function PrivacyPage() {
  return (
    <PublicShell>
      <main id="main-content" className="qrp-landing-main mx-auto max-w-2xl py-10 text-left">
        <h1 className="type-page-title type-trim">Privacy</h1>
        <Card className="hyphenate mt-4 space-y-3 text-left text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Quantum Resource Portal</strong> stores account identifiers, role
            assignments, governance and operational records you enter, and audit events. Sessions use HTTP-only cookies;
            the API does not ship analytics pixels in this build.
          </p>
          <p>Data stays in your deployment&apos;s PostgreSQL unless you configure exports. Operators control retention and backups.</p>
          <p className="text-xs">This page is a placeholder — not legal advice. Replace with counsel-reviewed text before public launch.</p>
        </Card>
        <p className="mt-4 text-sm">
          <Link className="fs-link" to="/legal/terms">
            Terms of use
          </Link>
          {' · '}
          <Link className="fs-link" to="/login">
            Sign in
          </Link>
        </p>
      </main>
    </PublicShell>
  )
}

export function TermsPage() {
  return (
    <PublicShell>
      <main id="main-content" className="qrp-landing-main mx-auto max-w-2xl py-10 text-left">
        <h1 className="type-page-title type-trim">Terms of use</h1>
        <Card className="hyphenate mt-4 space-y-3 text-left text-sm leading-relaxed text-muted-foreground">
          <p>
            Use this portal only if you are authorised by your organisation. Do not share credentials. Operational actions
            are logged to the audit trail.
          </p>
          <p>The service is provided as deployed — no warranty in this lab profile. Report abuse to your platform administrator.</p>
          <p className="text-xs">Draft only — have legal counsel review before external or procurement use.</p>
        </Card>
        <p className="mt-4 text-sm">
          <Link className="fs-link" to="/legal/privacy">
            Privacy (draft)
          </Link>
          {' · '}
          <Link className="fs-link" to="/">
            Home
          </Link>
        </p>
      </main>
    </PublicShell>
  )
}