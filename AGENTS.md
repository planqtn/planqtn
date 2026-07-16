# AGENTS.md — Working agreement for AI agents

This file is the constitution for AI coding agents working in the PlanqTN
repository. Read it before making changes, and follow it on every task.

For full setup, architecture, and workflow details, see
[`DEVELOPMENT.md`](DEVELOPMENT.md). This file is the short, enforceable version.

## Repository map (components)

PlanqTN is a monorepo. Most features live in the browser UI; the backend
components exist for long-running jobs and heavier computation. Key architecture
point: the UI only talks to Supabase (auth, edge functions, database, realtime),
and Supabase edge functions call the API and Jobs on Cloud Run.

| Component            | Path                       | What it is                                                                                 | Docs section |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| Python library       | `planqtn/`                 | Tensor-network QEC / quantum LEGO framework. Core algorithms.                              | The PlanqTN python library |
| Web UI (Studio)      | `app/ui/`                  | React 19 + Vite + Chakra UI + Zustand. Served as a Cloud Run service. Most features live here. | Web UI features |
| API                  | `app/planqtn_api/`         | Web service for fast, non-JS logic (returns tensor networks / LEGOs).                      | PlanqTN API |
| Background Jobs      | `app/planqtn_jobs/`        | Containerized long-running computations (e.g. weight enumerators), run on k8s / Cloud Run. | PlanqTN Background Jobs |
| CLI (`htn`)          | `app/planqtn_cli/`         | The `htn` tool for local/dev kernels, images, and cloud deploys.                           | PlanqTN CLI |
| Types                | `app/planqtn_types/`       | Shared data contracts between Python and TypeScript components.                            | PlanqTN Types |
| Edge functions       | `app/supabase/functions/`  | Supabase functions bridging the UI to Jobs/API (local k8s vs Cloud Run variants).          | PlanqTN Edge Functions |
| Docs                 | `docs/`                    | Material for MkDocs site, packaged into the UI container on build.                         | Documentation |

Two concepts worth understanding before touching backend/auth code (see the
PlanqTN Studio section in `DEVELOPMENT.md`):

- **User context**: authentication, task store, quotas, user content database.
- **Runtime context**: task management functions, API functions, realtime
  messaging. Can be local (a `local`/`dev` kernel) or the hosted cloud.

Common dev entry points: `hack/htn ui start --dev` (UI dev server),
`hack/htn kernel start` (dev kernel), `hack/cli_build.sh --install` (install the
`htn` CLI). See `DEVELOPMENT.md` for the full workflows.

## The prime directive: run checks after every change

**After each change, run the relevant `check/*` script(s) and make them pass
before you consider the task done.** Do not end a turn with unverified changes.

- Always run checks from the **repository root**. Every `check/*` script exits
  early if it is not run from the root.
- Run the narrowest check that covers what you touched (see the map below). If a
  change spans multiple components, run each relevant check.
- If a check fails, fix it and re-run until it passes. Never disable, skip, or
  weaken a check to make it "pass" (no `--no-verify`, no deleting assertions, no
  adding lint-ignores just to silence errors) unless the user explicitly asks.
- If a check cannot run in your environment (e.g. it needs Docker, a kernel, or
  cloud credentials), say so explicitly and state what you could not verify.

## Which check to run

Run these from the repo root after touching the corresponding area:

| You changed...                                  | Run this check          |
| ----------------------------------------------- | ----------------------- |
| `planqtn/**` (Python library)                   | `check/planqtn`         |
| `app/ui/**`, `docs/**`, or `*.md`               | `check/ui-and-docs`     |
| `app/planqtn_api/**` or `app/planqtn_types/**`  | `check/api`             |
| `app/planqtn_jobs/**`                            | `check/jobs`            |
| `app/planqtn_cli/**`                             | `check/cli`             |

Notes:

- `check/planqtn` runs `black --check`, `flake8`, `mypy`, `pylint`, doctests,
  and `pytest`.
- `check/ui-and-docs` runs markdown doctests, `prettier --check`, `eslint`, the
  UI build (`tsc` + vite), and the UI test suite. (This is the real UI check;
  `check/all` currently references a non-existent `check/ui`.)
- `check/api` and `check/jobs` run `black --check` on the relevant packages plus
  `pytest`.
- `check/cli` runs `prettier --check`, `eslint`, and the build.
- Integration checks (`check/integration`, `check/api-integration`,
  `check/jobs-integration`) require a running kernel and `KERNEL_ENV`; only run
  them when the task calls for it. See `DEVELOPMENT.md`.

## Auto-fixing formatting and lint

Prefer running the auto-fixers before re-running a check:

- Python: `black planqtn` (or the relevant `app/planqtn_*` package).
- UI: `cd app/ui && npx prettier --write src --config ../.prettierrc && npx eslint --fix src`
- CLI: `cd app/planqtn_cli && npx prettier --write src --config ../.prettierrc && npx eslint --fix src`

## General conventions

- **Match the existing style.** Follow surrounding patterns; do not introduce
  new libraries or frameworks without a clear reason.
- **Keep changes scoped.** Don't reformat or refactor unrelated code just
  because a formatter would touch it.
- **Pinned tool versions are intentional** (e.g. `black==25.1.0`,
  `mypy==1.16.0`). Don't bump them casually.
- **PlanqTN Types are a shared contract** between Python and TypeScript. Changes
  under `app/planqtn_types` and matching UI types must be kept in sync.
- Do not add comments that merely narrate what the code does.
