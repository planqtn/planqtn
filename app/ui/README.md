# PlanqTN Studio UI

React + Vite app for [PlanqTN Studio](https://planqtn.com). Source is in
`app/ui/`.

## Development

From the repository root:

```
hack/htn ui start --dev
```

That serves the UI at http://localhost:5173. Setup, User context, container
builds, and checks are documented in [`DEVELOPMENT.md`](../../DEVELOPMENT.md).

Requires Node.js 22 (see CI). Checks:

```
check/ui-and-docs
```

## Layout

```
app/ui/src/
├── features/         # Canvas, LEGOs, PCM, auth, panels, …
├── stores/           # Zustand canvas and UI state
├── transformations/  # ZX, fuse, graph-state rewrites
├── lib/              # Tensor network / GF2 helpers used in the browser
├── components/       # Shared chrome (modals, floating panels)
├── schemas/          # Canvas state JSON schemas
└── main.tsx
```

End-user docs live in [`docs/planqtn-studio/`](../../docs/planqtn-studio/).
