# Vendor reference clones (read-only archaeology)

Shallow git clones of OSS projects that model parts of the QRP governance lifecycle. **Not vendored into the product** — for UI/API pattern study only.

**Doc:** [`docs/research/VENDOR_REFERENCE_UI.md`](../docs/research/VENDOR_REFERENCE_UI.md)

## One-shot setup

```bash
cd "$(git rev-parse --show-toplevel)"
bash vendor-references/clone-all.sh
```

## Manual clone (same as script)

```bash
ROOT="$(pwd)/vendor-references"
mkdir -p "$ROOT"
clone() { git clone --depth 1 "$1" "$2" 2>/dev/null || echo "skip/fail: $2"; }

clone https://github.com/coldfront/coldfront.git           "$ROOT/coldfront"
clone https://github.com/OSC/ondemand.git                  "$ROOT/ondemand"
clone https://github.com/ubccr/xdmod.git                   "$ROOT/xdmod"
clone https://github.com/qbraid/qbraid.git                 "$ROOT/qbraid"
clone https://github.com/team-QMP/FTQMP-Scheduler.git      "$ROOT/ftqmp-scheduler"
clone https://github.com/openstack/blazar.git              "$ROOT/blazar"
clone https://github.com/argoproj/argo-workflows.git     "$ROOT/argo-workflows"
clone https://github.com/ubccr/hpc-toolset-tutorial.git  "$ROOT/hpc-toolset-tutorial"
clone https://github.com/LibreBooking/librebooking.git   "$ROOT/librebooking"
clone https://github.com/kortix-ai/CompanyOS.git         "$ROOT/companyos"
clone https://github.com/project-codeflare/codeflare.git "$ROOT/codeflare"
clone https://github.com/google/quota-monitoring-solution.git "$ROOT/quota-monitoring-solution"
clone https://github.com/GovTechSG/cstack-quota-monitoring.git "$ROOT/cstack-quota-monitoring"
```

**Integrated lab:** After clone, `cd vendor-references/hpc-toolset-tutorial` and use Docker per upstream README (ColdFront + OnDemand + XDMoD together).

## Size warning

| Repo | Approx. note |
| --- | --- |
| `ondemand` | Very large — shallow clone still ~hundreds of MB |
| `xdmod` | Large PHP stack |
| `blazar` | OpenStack slice; use for API/docs grep |
| `argo-workflows` | Large Go monorepo |
| `coldfront`, `ftqmp-scheduler`, `qbraid` | Reasonable for local browse |

Add `vendor-references/*/` to personal `.gitignore` if you do not want clones in git status (clones are intentionally **not** committed to QRP).

## Licence

Each upstream LICENSE applies. Do not copy GPL/AGPL UI assets into QRP without legal review; prefer pattern documentation only.