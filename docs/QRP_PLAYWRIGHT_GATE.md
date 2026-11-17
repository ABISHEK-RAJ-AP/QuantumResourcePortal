# Sprint 12 push gate — Playwright + build

Do not `git push` until all rows pass on the target VM/stack.

| Check | Command | Pass |
| --- | --- | --- |
| Typecheck + build | `cd frontend && npm run build` | |
| Unit | `cd frontend && npm test -- --run` | |
| E2E smoke | `cd frontend && npm run test:e2e:smoke` | |
| E2E full | `cd frontend && npm run test:e2e` | |
| RBAC (optional) | `E2E_RUN_RBAC=1 npm run test:e2e -- rbac-authorization.spec.ts` | |

Artifacts: failure traces under `frontend/test-results/`; update `docs/qa/sprint-12/` screenshots when visual sign-off is requested.