# qBraid (`vendor-references/qbraid`)

## Purpose

**Platform-agnostic quantum runtime** Python SDK: provider abstraction, device profiles, job submission, transpiler bridges (Qiskit, Braket, etc.).

**Users:** Quantum developers, lab integrators.

**Note:** This clone is the **SDK repo**, not a full qBraid web portal — UI patterns are mostly indirect (API + tests).

## Verified stack

| Artifact | Finding |
| --- | --- |
| `pyproject.toml` | Python ≥3.10, **Apache-2.0**, package `qbraid` |
| Layout | `qbraid/` package, extensive `tests/runtime/*` per provider |

No root `package.json`.

## Key directories

- `qbraid/runtime/` — provider jobs, devices, results  
- `qbraid/transpiler/` — circuit conversion  
- `tests/runtime/` — IBM, AWS, Azure, Rigetti, etc. remote tests  

## Sample API patterns (code)

Runtime modules expose device listing, job submit, result fetch — grep `qbraid/runtime` for `Job` / `Provider` classes in Phase 2.

## Licence

**Apache-2.0** (`pyproject.toml`)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Provider adapter interface shapes | Hardcoding one vendor in QRP core |
| Job metadata (shots, backend id) | Assuming portal UI exists in this clone |

## Limitations

Live provider tests need credentials; SDK-only for UI reference.

## QRP modules influenced

Providers, Backends, Jobs, Dispatch, quantum-specific detail panels.