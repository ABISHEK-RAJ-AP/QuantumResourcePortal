# Sprint 8 — Playwright smoke gate

Prerequisites:

1. Backend on port **8010** (`make dev-api` or VM stack).
2. Frontend dev server **5176** (Playwright starts it unless already running).
3. Admin account matching `frontend/e2e/auth.ts` defaults or `E2E_ADMIN_USER` / `E2E_ADMIN_PW`.

## Smoke (sprint 8 default)

From `frontend/`:

```bash
npm run test:e2e:smoke
```

Runs signed-in nav and workspace hub specs (desktop project only).

After `make seed-demo`, also run:

```bash
npm run test:e2e -- e2e/module-detail.spec.ts
```

Covers approval **Quota evaluation** panel and job **Execution timeline** tab (skips when queue/jobs empty).

## Full gate (pre-push sprint 12)

```bash
npm run test:e2e
```

## RBAC live stack (optional)

```bash
E2E_RUN_RBAC=1 npm run test:e2e -- rbac-authorization.spec.ts
```

Requires researcher credentials (`E2E_RESEARCHER_USER` / `E2E_RESEARCHER_PW`).