# Security Policy (ElizaOS)

## Core Principles
- **Evaluator-first**: Security evaluator must run first in `src/nubi-plugin.ts`.
- **Least privilege**: Services and actions access only what they need.
- **Validate inputs**: Strictly validate action inputs; sanitize outbound content.
- **No secrets in logs**: Use `logger` and filter/scrub; respect `LOG_LEVEL`.
- **Deterministic safeguards**: Timeouts, retries with backoff, circuit breakers for integrations.

## Threat Controls
- **Prompt injection**: Detect via security evaluator; strip or neutralize instructions attempting to escape policy.
- **Abuse / spam**: Rate-limit by user/room; backoff on repeated failures; blocklists in a service.
- **Link safety**: Use a link detection/verifier service (see `src/telegram-raids/link-detection-service.ts`).
- **Self-trigger**: In actions `validate()`, avoid responding to own messages (`message.entityId === runtime.agentId`).
- **Attachments**: Verify content types/size; avoid executing any user-provided code.

## Secrets & Environment
- Store secrets in `.env` (never commit). Keep `.env.example` updated.
- Required: `OPENAI_API_KEY`. Optional: Telegram/Discord/Twitter/DB keys; see `.windsurf/ENV_VARS.md`.

## Platform Webhooks/Clients
- Verify identities/signatures when available.
- Respect platform rate limits and data policies.

## Data Handling
- Use repository/service boundaries for DB and external calls.
- Avoid PII persistence unless necessary; apply retention where applicable.

## Reviews & CI
- PRs must pass `.windsurf/CODE_REVIEW_CHECKLIST.md` security items.
- CI runs `bun run check-all`. Any security test failures block merge.

## Incident Response
- On suspected compromise: revoke tokens, rotate keys, disable affected services via env flags, and ship a hotfix.
