# SQL & Persistence Guide

## When Using @elizaos/plugin-sql
- Keep schemas in `src/schemas/`; repositories in `src/repositories/`.
- Use repository pattern to decouple queries from actions/services.
- Version migrations; test up/down; avoid destructive changes without backups.

## Supabase (Optional)
- Env: see `.env.supabase` for URL/keys and Edge Function URLs.
- Use Edge Functions via a service; never embed secrets in client code.

## Memory Service
- `src/services/database-memory-service.ts` can supply enhanced context; ensure bounded queries and indices on session/user.

## Analytics
- Aggregate queries for `/api/sessions/analytics`; avoid N+1 by precomputing daily stats where feasible.
