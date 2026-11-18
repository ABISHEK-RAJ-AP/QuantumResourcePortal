# CodeFlare vs MCAD

Two related **project-codeflare** repositories — different artifacts.

## A. CodeFlare Pipelines (`vendor-references/codeflare`)

### Purpose

**Ray**-based parallel ML pipelines — unified workflow across Spark/sklearn-scale workloads.

### Verified stack

- `setup.py` — **Apache-2.0** header, Python setuptools  
- **Not** the Kubernetes dispatcher UI

### QRP influence

General “pipeline stage” thinking — **secondary** to MCAD for QRP dispatch queues.

---

## B. Multi-Cluster App Dispatcher (`vendor-references/mcad`)

### Purpose

**Kubernetes controller** for batch jobs: queues (FIFO/priority), multi-cluster dispatch, AppWrapper abstraction.

### Verified stack

| Artifact | Finding |
| --- | --- |
| README | **Apache-2.0**, Go controller |
| Clone | Added Phase 1 2026-11-18 (`clone-all.sh`) |
| Size | ~5.4M shallow |

Key paths: `doc/build/`, `doc/deploy/`, controller source under repo root (Go).

### QRP influence

**Primary** reference for Dispatch, Queues, multi-backend placement, quota-aware queuing.

---

## Licence (both)

**Apache-2.0**

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| MCAD queue + dispatch policies | Running MCAD without K8s |
| AppWrapper “holistic job” abstraction | Confusing Ray pipelines with dispatch |

## Limitations

MCAD needs cluster; CodeFlare needs Ray. Neither provides QRP-ready React UI.

## QRP modules influenced

Dispatch, Reconciliation, Queues, Virtual Pools (Priority 3–4).