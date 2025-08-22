# Environment Variables

Authoritative mapping of environment variables used in this repo.

## Required
- OPENAI_API_KEY — required by `src/config/environment.ts`.

## Optional (Core)
- ANTHROPIC_API_KEY — optional alternative LLM provider.
- LOG_LEVEL — one of: error | warn | info | debug (validated in `src/config/environment.ts`).
- NODE_ENV — development | production (used in `src/config/environment.ts`).

## Platform Integrations
- TELEGRAM_BOT_TOKEN — enables Telegram features. Required for raids (see below).
- DISCORD_API_TOKEN — enables Discord features.
- TWITTER_API_KEY, TWITTER_API_SECRET_KEY, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET — enables Twitter features.
- TWITTER_USERNAME, TWITTER_* feature toggles — present in `.env.example` and used by platform modules if enabled.

## Database
- DATABASE_URL — if using an external Postgres. Default may be local (PGLite) in services.
- Note: `.env.example` shows `POSTGRES_URL` for legacy compatibility; the runtime reads `DATABASE_URL` in `src/config/environment.ts`. Prefer `DATABASE_URL` or export an alias in your shell.

## NUBI Feature Flags (used by code in `src/config/environment.ts`)
- RAIDS_ENABLED — `true|false` to enable Telegram raids.
- AUTO_RAIDS — `true|false` to allow scheduled/automatic raids.
- RAID_INTERVAL_HOURS — integer (>=1).
- MAX_CONCURRENT_RAIDS — integer (>=1).
- RAID_DURATION_MINUTES — integer (>=5).
- MIN_RAID_PARTICIPANTS — integer (>=1).

## Additional Feature Flags (present in `.env.example`)
- ENABLE_RAID_BOT, ENABLE_TELEGRAM_BOT, ENABLE_DISCORD_BOT, ENABLE_TWITTER_BOT, ...

Note: Some flags are defined in `.env.example` but not read in `src/config/environment.ts`. Keep the two in sync when wiring new features. Prefer adding validations for any new required variables to `environment.ts`, and update `.env.example` accordingly.

## Supabase / Edge Functions (optional)
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — see `.env.supabase`.
- EDGE_FUNCTIONS_ENABLED — gate for calling Supabase functions.
- WEBHOOK_PROCESSOR_URL, ANALYTICS_ENGINE_URL, RAID_COORDINATOR_URL, SECURITY_FILTER_URL, TASK_QUEUE_URL, PERSONALITY_EVOLUTION_URL — endpoints for edge functions.

## Policy
- Do not commit real secrets. `.env.example` must be updated on any new env var addition.
- On CI, use provider secrets storage; on local, use `.env` only.
