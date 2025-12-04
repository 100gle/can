# Repository Guidelines

## Project Structure & Module Organization
The Go backend lives in `main.go`, `app.go`, and future packages under the root module defined in `go.mod`. Keep exported bindings grouped per feature and surface them through `Bind` in `main.go`. React + Vite assets live in `frontend/src`, with helpers at `frontend/src/lib`, resilient styling in `App.css`/`style.css`, and static files in `frontend/src/assets/images`. Generated binaries and icons belong in `build/`; avoid editing them manually. Architectural notes reside in `docs/`; whenever UX or API behavior shifts, update the relevant spec before opening a PR.

## Build, Test, and Development Commands
`wails dev` — hot reloads Go and Vite in one window; ideal for full-stack work.  
`PNPM_HOME=... pnpm install --frozen-lockfile --dir frontend` — installs UI deps exactly as locked.  
`pnpm --dir frontend dev` — runs Vite-only preview when you do not need the Go bridge.  
`pnpm --dir frontend build && wails build` — produces the `frontend/dist` bundle and native packages.  
`go test ./...` — executes all Go unit tests (add them alongside the code they cover).

## Coding Style & Naming Conventions
Run `gofmt`, `goimports`, and `go vet ./...` before committing; Go files use tabs and idiomatic receiver naming (e.g., `func (a *App)`). TypeScript follows strict mode; keep imports path-aware via the `@/*` alias and prefer functional components with explicit prop types. For UI utilities, keep filenames lowercase-hyphen or camelCase (`useTheme.ts`). CSS sticks to utility-first classes; shared theme tokens belong in `App.css`.

## Testing Guidelines
Adopt table-driven Go tests named `<file>_test.go`, covering both success and failure paths. Frontend logic should eventually be covered via Vitest + React Testing Library; place specs under `frontend/src/__tests__` or `ComponentName.test.tsx`. When tests are absent, document manual verification steps in the PR and run `wails dev` to exercise the Go ↔ UI bridge.

## Commit & Pull Request Guidelines
History is compact (`wip`), so treat each new commit as a narrative anchor: present-tense, 72-character subject, optional body describing rationale and risk. Reference issues as `Refs #123`. Pull requests should include: what changed, why it matters, screenshots/gifs for UI updates, command output for builds/tests, and any follow-up todos.

## Security & Configuration Tips
Secrets never belong in the repo; prefer OS keychains and runtime prompts. Review `wails.json` before changing identifiers or bundle IDs, because it controls asset embedding and signing. When handling credentials in Go, pass context-aware structs rather than globals and reset in `App.startup` to avoid stale state across rebuilds.
