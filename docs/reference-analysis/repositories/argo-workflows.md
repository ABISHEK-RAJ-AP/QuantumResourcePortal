# Argo Workflows (`vendor-references/argo-workflows`)

## Purpose

**Kubernetes workflow engine**: DAG steps, retries, inputs/outputs, event history — operational pattern for evidence and long-running dispatch pipelines.

**Users:** Platform engineers, SREs, data/ML ops.

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| `ui/package.json` | **React** UI, webpack, `license: "Apache-2.0"`, Node ≥20 |
| Dependencies | `argo-ui` (git dep), `chart.js`, `@dagrejs/dagre` (workflow graph) |

Controller: Go (main repo); UI is separable reference for **workflow visualization**.

## Key directories

- `ui/src/` — workflow UI components  
- `workflow/` — controller logic  
- `pkg/apis/` — CRD types  

## Sample UI routes

Dev: `yarn start` in `ui/` (webpack-dev-server) against cluster API — requires K8s + Argo install.

## Licence

**Apache-2.0** (`ui/package.json`; root `LICENSE`)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Step graph + failure/retry semantics | Embedding Argo UI bundle |
| Event history for evidence | Requiring K8s for QRP core |

## Limitations

Cluster mandatory for meaningful UI; QRP should reimplement **simplified** timeline/DAG for dispatch/evidence.

## QRP modules influenced

Evidence, Incidents (failure chains), Dispatch attempt detail, Audit (execution events).