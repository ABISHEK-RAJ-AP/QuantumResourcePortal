#!/usr/bin/env bash
# Shallow-clone OSS references for QRP UI/architecture study (not production deps).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${HOME}/miniforge3/bin:${PATH:-}"

clone_one() {
  local url="$1"
  local dir="$2"
  if [[ -d "$dir/.git" ]]; then
    printf '[vendor-ref] exists %s\n' "$(basename "$dir")"
    return 0
  fi
  printf '[vendor-ref] cloning %s …\n' "$(basename "$dir")"
  git clone --depth 1 --single-branch "$url" "$dir" || printf '[vendor-ref] FAILED %s\n' "$url" >&2
}

mkdir -p "$ROOT"

clone_one https://github.com/coldfront/coldfront.git "$ROOT/coldfront"
clone_one https://github.com/team-QMP/FTQMP-Scheduler.git "$ROOT/ftqmp-scheduler"
clone_one https://github.com/qbraid/qbraid.git "$ROOT/qbraid"
clone_one https://github.com/ubccr/xdmod.git "$ROOT/xdmod"
clone_one https://github.com/OSC/ondemand.git "$ROOT/ondemand"
clone_one https://github.com/openstack/blazar.git "$ROOT/blazar"
clone_one https://github.com/argoproj/argo-workflows.git "$ROOT/argo-workflows"

# Integrated HPC stack + cloud/quota + booking (non-quantum references)
clone_one https://github.com/ubccr/hpc-toolset-tutorial.git "$ROOT/hpc-toolset-tutorial"
clone_one https://github.com/LibreBooking/librebooking.git "$ROOT/librebooking"
clone_one https://github.com/kortix-ai/CompanyOS.git "$ROOT/companyos"
clone_one https://github.com/project-codeflare/codeflare.git "$ROOT/codeflare"
clone_one https://github.com/google/quota-monitoring-solution.git "$ROOT/quota-monitoring-solution"
clone_one https://github.com/GovTechSG/cstack-quota-monitoring.git "$ROOT/cstack-quota-monitoring"

printf '[vendor-ref] done. See docs/research/VENDOR_REFERENCE_UI.md\n'
printf '[vendor-ref] integrated stack: cd %s/hpc-toolset-tutorial && follow README (Docker)\n' "$ROOT"