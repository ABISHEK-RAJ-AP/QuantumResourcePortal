# LibreBooking (`vendor-references/librebooking`)

## Purpose

**Resource booking** system: calendars, credits/quotas, approvals, waitlists — closest OSS calendar UX to QRP reservation holds.

**Users:** Facility managers, bookers, approvers.

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| `composer.json` | PHP `LibreBooking\` PSR-4, **GPL-3.0-only** |
| Root `package.json` | Node **≥20.19** — **lint only** for `Web/scripts/`, `Web/css/` (not a separate SPA build for full app) |
| UI | PHP-rendered `Web/` with JS/CSS assets |

## Key directories

- `src/` — PHP application core  
- `Web/` — scripts, CSS, user-facing pages  
- `tests/e2e/` — Dockerized Playwright (`test:e2e:up`)  

## Sample routes

PHP front controller pattern — inspect `Web/` and routing bootstrap in Phase 2. E2E tests imply schedule/booking flows under Docker compose.

## Licence

**GPL-3.0-only** (`composer.json`, `LICENSE.md`)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Calendar grid, conflict UX, waitlist | Copying PHP pages |
| Credit/quota display on booking | GPL asset merge |

## Limitations

Primary UI is PHP; run via Docker e2e for faithful screenshots.

## QRP modules influenced

Reservations, Scheduling, Quotas (consumption vs hold).