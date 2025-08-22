# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (core modules like `nubi-plugin.ts`, `nubi-character.ts`, services, routes, providers, middleware).
- Tests: `src/__tests__/` (unit/integration) and `src/__tests__/cypress` (Cypress).
- Frontend: `src/frontend/` (built assets under `src/frontend/dist`).
- Config & Data: `config/`, `data/`, `supabase/` (DB, storage, and env-backed settings).
- Entry: `src/index.ts`; build output in `dist/`.

## Build, Test, and Development Commands
- `bun run dev`: Start local ElizaOS agent in dev mode.
- `bun run start`: Start agent; use `start:production` for `.env.production`.
- `bun run build`: Type-check, Vite build, and bundle via `tsup`.
- `bun run test`: Run Bun tests (unit/integration) after installing test deps.
- `bun run cy:open` / `cy:run`: Open/run Cypress (component/e2e) tests.
- `bun run check-all`: Type-check, format check, and tests in one pass.

## Coding Style & Naming Conventions
- TypeScript, 2-space indentation; rely on Prettier defaults.
- File names: kebab-case for modules (`security-filter.ts`), PascalCase for types/interfaces.
- Exports: prefer named exports from feature modules; avoid default unless ergonomic.
- Run `bun run format` and `bun run format:check` before pushing.

## Testing Guidelines
- Frameworks: Bun test runner for unit/integration; Cypress for component/e2e.
- Locations: place unit/integration in `src/__tests__` with `*.test.ts`.
- Coverage: aim to cover services, routes, and critical flows (e.g., message bus, providers).
- Commands: `bun run test`, `bun run test:coverage`, `bun run cypress:e2e`.

## Commit & Pull Request Guidelines
- Commits: imperative, concise, scoped (emoji optional):
  - Example: "🛡️ Implement SecurityFilter detection for API key leaks"
- PRs: include description, linked issues, test plan (commands + results), and relevant logs/screenshots.
- Quality gate: ensure `bun run check-all` passes and CI is green.

## Security & Configuration Tips
- Secrets live in `.env` files; never commit secrets. Use `.env.example` as a template.
- Verify Supabase and provider keys before running `start:production`.
- Avoid logging sensitive data in services/middleware; prefer structured logs.
