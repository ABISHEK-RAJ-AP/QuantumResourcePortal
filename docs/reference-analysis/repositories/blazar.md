# OpenStack Blazar (`vendor-references/blazar`)

## Purpose

**Resource reservation / lease** service for OpenStack: host leases, instance reservations, floating IP reservations — time-window capacity holds.

**Users:** Cloud operators, project tenants via Horizon (Horizon not cloned in QRP).

## Verified stack

| Artifact | Finding |
| --- | --- |
| `pyproject.toml` | `name = "blazar"`, **Apache-2.0** |
| `setup.py` | Python OpenStack service pattern |
| API | `blazar/api/v1/leases/v1_0.py`, `oshosts/`, `floatingips/` |

No `package.json` — API-first Python service.

## Key directories

- `blazar/api/v1/leases/` — lease CRUD semantics  
- `blazar/api/v1/oshosts/` — host reservation  
- `blazar/tests/api/v1/` — contract tests (read for state machine)  

## Sample API areas (code)

REST v1 under `blazar/api/v1/` — lease lifecycle, validation (`validation.py`), request logging.

## Licence

**Apache-2.0** (`pyproject.toml`)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Lease state transitions & conflict checks | Requiring OpenStack to preview UI |
| Host/pool reservation vocabulary | Coupling QRP to Nova APIs directly |

## Limitations

Needs OpenStack dev environment; no standalone HTML UI in this repo.

## QRP modules influenced

Reservations, Scheduling, Virtual Pools, Quotas (hold vs consume).