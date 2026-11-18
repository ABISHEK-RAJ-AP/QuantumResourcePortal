# HPC Toolset Tutorial (`vendor-references/hpc-toolset-tutorial`)

## Purpose

**Integration lab** showing ColdFront + Open OnDemand + Open XDMoD working together for HPC centre operations.

**Users:** HPC staff learning the toolset; QRP engineers studying cross-system data flow.

## Verified stack

| Artifact | Finding |
| --- | --- |
| README | **Archived — no longer supported** (banner at top) |
| Content | Docker-oriented docs linking `/coldfront`, `/ondemand`, `/xdmod` subdirs |
| Clone size | ~262M (includes tutorial assets/docs) |

No `package.json` at root — orchestration via docs + Docker (see `docs/getting_started.md`).

## Key directories

- `docs/` — requirements, getting started, applications  
- Submodule-style paths referenced: `coldfront/`, `ondemand/`, `xdmod/` inside tutorial tree  

## Licence

Root `LICENSE` file present — read for redistribution terms before publishing screenshots.

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| **Integration topology** CF → OOD → XDMoD | Assuming compose still works unchanged |
| Workshop narratives for operator training | Merging tutorial containers into QRP prod |

## Limitations

**Archived repository** — verify with UBCCR/OSC before relying on Docker compose for Phase 2 screenshots.

## QRP modules influenced

End-to-end mental model for all governance + execution + metering modules.