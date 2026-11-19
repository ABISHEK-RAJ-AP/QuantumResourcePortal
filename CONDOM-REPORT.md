# Condom report: Quantum Resource Portal (QRP)

2026-11-19 · mode: full (security + legal) · checked by automated first pass with the Condom skill

> This is an automated first pass, not legal advice and not a penetration test. It lists what was checked, what was found, and what was not looked at. Items marked **lawyer** need a human lawyer.

## What would hurt first

1. **Open redirect after login** — crafted `from` state can send users to `//attacker.example` after a real sign-in → validate relative paths only (Claude can patch; owner re-test).
2. **No privacy/terms surface** — if anyone outside your org uses the portal, you lack the pages regulators and enterprise buyers expect → draft policies from what the code actually collects (**owner** + **lawyer** review).
3. **PostgreSQL RLS off by default** — app-layer tenant checks are solid, but a mistaken read-only SQL user or SQL injection would not get a second fence → enable RLS before internet-facing production (**owner** ops decision; Claude can help migrations).

## Do these now (owner)

- [ ] Before any **production** URL on the public internet: set `QRE_ENV=production`, `QRE_MFA_REQUIRED` explicitly, TLS on `QRE_DATABASE_URL`, and `QRE_CORS_ORIGINS` to real SPA origins (`backend/qre/core/config.py`).
- [ ] If this VM is reachable beyond a trusted LAN: treat **lab demo passwords** in docs as compromised; rotate admin passwords and restrict firewall to VPN.
- [ ] Decide audience: **internal C-DAC/lab only** vs **external tenants** — legal section below depends on that answer.

## Assumptions (no owner reply — cautious defaults)

| Question | Assumption used |
| --- | --- |
| Users / market | India, primarily government / lab operators; may expand to EU later |
| Minors | No intentional use under 13 |
| Scale / revenue | &lt;1,000 users; no payments in product |
| Operator | Individual or small team (not stated as registered company in repo) |
| Sensitive data | Usernames, audit logs, operational telemetry — not clinical health |
| Live probing | **Not** run against a production URL without owner consent — code review + local config only |

## The app (profile)

| Signal | Evidence |
| --- | --- |
| Stack | FastAPI + PostgreSQL + session cookies; React/Vite SPA (`backend/qre`, `frontend/`) |
| Auth | Local login, Argon2id, server-side sessions, CSRF on unsafe methods (`backend/qre/core/deps.py`, integration tests) |
| RBAC | `require_permission` / `require_role`; startup asserts no unguarded API routes (`backend/qre/gateway/app.py`) |
| Payments | None (no Stripe/webhooks in repo) |
| AI in product | None in request path |
| Trackers | No gtag/PostHog/Sentry in frontend source grep |
| Lab features | Demo seed/simulation only when `QRE_ENV=lab` + `PLATFORM_ADMIN` (`backend/qre/seed/api.py`) |
| Secrets in git | `backend/.env` gitignored; not in `git log` |
| Legal pages | No `/privacy`, `/terms` routes in frontend |

## Security findings

| # | Finding | Status | Severity | Where |
| --- | --- | --- | --- | --- |
| 1 | Open redirect after login (SEC-AUTH-01) | CONFIRMED | High | `frontend/src/pages/public/LoginPage.tsx:60`, `MfaPage.tsx:66` |
| 2 | Open redirect same pattern on MFA success | CONFIRMED | High | `frontend/src/pages/public/MfaPage.tsx:66` |
| 3 | No global IP rate limit on login (only per-account lockout) | LIKELY | Medium | `backend/qre/services/svc02_identity/service.py` — lockout at `config.py:57-59`; no 429 middleware |
| 4 | PostgreSQL RLS disabled (second isolation layer) | CONFIRMED | Medium | `backend/.env.example:50` `QRE_RLS_ENABLED=false` |
| 5 | Security headers (HSTS, CSP, X-Frame-Options) not set in app | LIKELY | Low | `backend/qre/gateway/app.py` — CORS only |
| 6 | OpenAPI/Swagger public on API | CONFIRMED | Low | `backend/qre/gateway/app.py:165-168` |
| 7 | Session cookie `Secure` off in lab | CONFIRMED | Low (lab) / High (if mis-profiled) | `backend/qre/core/config.py:124-126` |

### 1. Open redirect after login (SEC-AUTH-01)

- **What could happen:** After a real login, the app navigates to attacker-controlled URL if `from` is `//evil.com`.
- **Evidence:** `navigate(from.startsWith('/') ? from : '/qrp')` accepts `//host` because it starts with `/`.
- **Fix:** Allow only relative paths: e.g. `from` must match `^/[A-Za-z0-9_./?=&%-]*$` and must not start with `//` or contain `:` before path. Default `/qrp`. **Who:** Claude.
- **Source:** Condom `references/security/auth-access.md` SEC-AUTH-01 · read 2026-11-16

### 3. Login abuse without global throttle (SEC-ABUSE-01 partial)

- **What could happen:** Attacker rotates usernames to bypass per-account lockout and hammer login/CAPTCHA.
- **Evidence:** Account lockout exists (`auth_lockout_*`); gateway comment says rate limit “arrives in later phases” (`backend/qre/gateway/middleware/__init__.py`); no 429 implementation found.
- **Fix:** Edge or middleware rate limit on `POST /api/v1/auth/login` and `/auth/captcha` per IP. **Who:** Claude + owner (Redis already optional).
- **Prove missing:** No live burst test run (would need owner OK on deployed URL).

### 4. RLS disabled (SEC-ACCESS-13 defense in depth)

- **What could happen:** If DB credentials leak or a query forgets `tenant_id`, Postgres does not block cross-tenant reads.
- **Evidence:** `QRE_RLS_ENABLED=false` in example env; handlers generally filter `ctx.tenant_id` (e.g. `backend/qre/services/svc03_projects/service.py:93-95`).
- **Fix:** Enable RLS policies per tenant column before multi-tenant internet production. **Who:** owner + Claude.

## Legal findings

### Applies to you now (if external users or enterprise procurement)

| # | Gap | Law / frame | Exposure | Who fixes |
| --- | --- | --- | --- | --- |
| 1 | No privacy policy page (LAW-PRIV-01) | DPDP Act 2023 (India) / GDPR if EU users | Complaints, contract blockers | owner + lawyer; Claude can draft **DRAFT** from code |
| 2 | No terms of use (LAW-TERMS-01) | Contract / acceptable use | No binding rules for operators | owner + lawyer |
| 3 | No accessibility statement | RPwD Act 2016 (India) / EU if applicable | Public-sector procurement risk | owner |

### Doesn't apply to you yet

| Law / area | Why not | What would change that |
| --- | --- | --- |
| PCI / subscription cancel laws | No payments | Adding billing |
| COPPA / children's privacy | No child-directed UX | Opening signup to minors |
| GDPR full program | Assumed mostly India lab today | EU users, marketing, or EU hosting |
| CAN-SPAM / marketing SMS | No marketing email in app | Adding newsletters |

### Couldn't tell

| Question | Why it matters |
| --- | --- |
| Is the deployed VM internet-public? | Open redirect + lab demo matter more if yes |
| Will third parties (non-C-DAC) get accounts? | Privacy/terms become mandatory, not nice-to-have |

## Checked and clear (Ten + core)

| ID | Plain name |
| --- | --- |
| SEC-SECRET-01/02 | No payment/AI provider secrets in SPA build (`grep VITE_`, `import.meta.env`) |
| SEC-ACCESS-03 | No service-role DB key in frontend |
| SEC-PAY-01/02/03 | No payment flows |
| SEC-ACCESS-05 | Startup `assert_api_router_guarded` on protected routes |
| SEC-ACCESS-04 | Sample project detail enforces `tenant_id` match |
| SEC-ACCESS-07 | Admin routes use `require_role` / `require_permission`, not UI-only |
| SEC-SECRET-03 | `.env` not tracked; `.gitignore` includes `backend/.env` |
| SEC-AUTH-06 | CSRF enforced on unsafe API methods with session |
| SEC-AUTH-09 | Login lockout after failed attempts (per account) |
| LAW-TRACK-01 | No ad/analytics pixels in repo |
| SEC-AI-01/02 | No LLM endpoints |

## Not checked

| What | Why |
| --- | --- |
| Live login redirect exploit | Harmless proof needs running SPA; not executed without URL approval |
| Dependency CVE scan (`pip audit`, `npm audit`) | Out of quick pass — run in CI |
| Full IDOR sweep on every `{id}` route | Code spot-check only |
| Penetration test / OWASP ZAP | Out of scope for Condom |
| Mobile app store rules | No mobile build |
| Air-gapped production hardening | Owner deployment specific |

## Fix log

| Finding | Change | Re-test | Commit |
| --- | --- | --- | --- |
| SEC-AUTH-01 | `safeReturnPath()`; Login + MFA use it | `frontend/src/lib/safeReturnPath.test.ts` (vitest) | pending in this push |

## Still open

- **SEC-AUTH-01** — fixed in SPA; add server-side redirect allow-list if backend ever issues `next` URLs.
- Legal pages — need owner facts (data retention, subprocessors, contact).
- Rate limiting — product decision on thresholds.