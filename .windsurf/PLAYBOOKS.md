# Playbooks (ElizaOS Workspace)

Common tasks with precise steps.

## Add a New Action
1) Create `src/actions/my-action.ts` exporting `{ name, similes, description, validate, handler, examples }`.
2) Wrap with `withActionMiddleware(myAction)` and register in `src/nubi-plugin.ts` under `actions`.
3) Keep `validate()` cheap; block self-messages; add unit tests.
4) Update docs if user-facing behavior changes.

## Add a New Provider
1) Create `src/providers/my-provider.ts` exporting a `Provider` with `dynamic: true` when per-request.
2) Bound memory reads; return `{ text?, values?, data? }`.
3) Register in `nubi-plugin.providers`.
4) Add tests for provider behavior and performance.

## Add a New Evaluator
1) Create `src/evaluators/my-evaluator.ts`.
2) Register in `nubi-plugin.evaluators` at the correct position (security first).
3) Sample frequency if not critical (avoid `alwaysRun`).
4) Tests: ensure order and side effects are correct.

## Add a New Service
1) Create `src/services/my-service.ts` with a minimal API; include retries/backoff.
2) Register in `nubi-plugin.services` with a stable name.
3) Expose health checks or passive signals for `/health`.
4) Integration tests around service boundaries.

## Modify Sessions API
1) Edit `src/routes/sessions-routes.ts` respecting current limits and error codes.
2) Add tests for new parameters or endpoints.
3) Keep handlers small; delegate to `sessions` service.

## Add Telegram Raid Feature
1) Ensure env (`TELEGRAM_BOT_TOKEN`, `RAIDS_ENABLED=true`).
2) Adjust tuning vars in `.env` (`RAID_*`).
3) Wire any new raid modules in `src/telegram-raids/` via a service/registry.
4) Test in a sandbox group; respect rate limits.

## Introduce a New Platform (e.g., Slack)
1) Create a service encapsulating the platform client.
2) Add env vars to `.env.example` and validations if required.
3) Add actions/providers only as orchestration; never call SDKs directly from actions.
4) Document in `.windsurf/PLATFORMS_GUIDE.md`.

## Diagnose Production Latency
1) Check `/health` and service availability.
2) Inspect logs with `LOG_LEVEL=debug` temporarily (avoid secrets).
3) Verify provider counts & LLM usage; switch to small model where appropriate.
4) Review `PERFORMANCE_BUDGETS.md` and adjust budgets.
