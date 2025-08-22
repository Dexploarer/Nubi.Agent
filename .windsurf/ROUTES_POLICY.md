# Routes Policy

## Design
- Keep handlers small; defer to services for heavy logic.
- Validate inputs strictly; return typed errors with codes where helpful.

## Sessions API
- Implemented in `src/routes/sessions-routes.ts` with endpoints for create, message, history, renew, heartbeat, delete, list, analytics.
- Enforce limits (history limit<=100, analytics days<=30). Use 503 when `sessions` service unavailable.

## Health
- `/health` must not leak secrets; return service presence flags and timestamps only.

## Versioning
- Prefer `/api/{version}/...` for breaking changes.
