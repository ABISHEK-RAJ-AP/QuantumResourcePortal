# Open OnDemand (`vendor-references/ondemand`)

## Purpose

Web **gateway to HPC**: files, job submission/monitoring, interactive apps, project-scoped workflows — no SSH client install for researchers.

**Users:** Researchers, HPC operators supporting clusters.

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| `apps/dashboard/package.json` | Bootstrap 5, jQuery, **DataTables**, Turbo Rails, esbuild, Sass (no React SPA) |
| `apps/shell/app.js` | Express routes for web shell/SSH |
| Framework | **Ruby on Rails** (`apps/dashboard/config/routes.rb`) |

## Key directories

- `apps/dashboard/` — main portal  
- `apps/myjobs/` — job composer  
- `apps/shell/` — terminal app  
- `apps/*/config/routes.rb` — routing  

## Sample routes (code)

`apps/dashboard/config/routes.rb`:

- `resources :projects` — project hub  
- `GET .../jobs/:cluster/:jobid` — job details (turbo_stream)  
- `POST .../stop_job`, `DELETE .../delete_job`  
- `resources :workflows` — submit/save/load/clone  
- `resources :launchers` — interactive apps  
- `files/:fs(/*filepath)` — file browser (when enabled)  

## Licence

**MIT** (`LICENSE.txt` — Ohio Supercomputer Center copyright header)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Job table + cluster dimension | Rails Turbo patterns in React |
| Workflow composer step flow | jQuery DataTables code copy |
| Project-scoped job context | Filesystem proxy security model wholesale |

## Limitations

Requires configured clusters/schedulers; not runnable as vanilla `rails s` without OSC-style install.

## QRP modules influenced

Operations Centre, Jobs, Queues, Dispatch monitoring, project hub execution tab.