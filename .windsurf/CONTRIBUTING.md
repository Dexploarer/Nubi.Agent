# Contributing (ElizaOS Workspace)

## Local Setup
- Install Bun and Node.
- Copy `.env.example` ➜ `.env` and fill required secrets (see `.windsurf/ENV_VARS.md`).
- Install deps: `bun install`.
- Dev server: `bun run dev`.
- Build: `bun run build`.

## Branching & Commits
- Branch: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`.
- Commits: conventional style recommended (e.g., `feat: add NUBI help action`).

## Before Opening a PR
- Run: `bun run check-all` (tsc + prettier + tests).
- Update `.env.example` for new env vars.
- Add/Update tests for actions/providers/evaluators/services affected.
- Update README or in-repo docs if user-facing behavior changed.
- Review with `.windsurf/CODE_REVIEW_CHECKLIST.md`.

## Code Organization
- Actions in `src/actions/` and registered in `src/nubi-plugin.ts` via `withActionMiddleware`.
- Providers in `src/providers/` and registered in `nubi-plugin.providers`.
- Evaluators in `src/evaluators/` and ordered with security first.
- Services in `src/services/` and registered in `nubi-plugin.services`.
- Routes in `src/routes/` and mounted in `nubi-plugin.routes`.

## Security & Performance
- Keep security evaluator first; validate inputs; never log secrets.
- Respect performance budgets in `.windsurf/PERFORMANCE_BUDGETS.md`.
- Prefer services for I/O and long-running tasks.

## Testing
- Use Bun test; see `.windsurf/TESTING_GUIDE.md`.
- Mock external dependencies. Avoid network calls in tests.

## Publishing/Release
- Follow `.windsurf/RELEASE_CHECKLIST.md`.
