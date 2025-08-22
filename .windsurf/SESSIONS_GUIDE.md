# Sessions API Guide

Implemented in `src/routes/sessions-routes.ts`.

## Endpoints
- POST `/api/sessions/create` — body: `{ userId?, timeoutMinutes?, autoRenew?, metadata? }` (5<=timeout<=1440)
- POST `/api/sessions/:sessionId/message` — body: `{ senderId, senderType: 'user'|'agent', content, metadata? }`
- GET `/api/sessions/:sessionId/history?limit&offset` — limit<=100 (default 50)
- PUT `/api/sessions/:sessionId/renew` — body: `{ timeoutMinutes? }` (5..1440)
- POST `/api/sessions/:sessionId/heartbeat`
- DELETE `/api/sessions/:sessionId`
- GET `/api/sessions?userId&status&limit&offset` — status in ['active','expired','ended']
- GET `/api/sessions/analytics?days` — days<=30 (default 7)

## Response Generation
- For user messages, the route composes state and uses `runtime.useModel(ModelType.TEXT_LARGE, ...)`.
- Analytics are tracked via `messaging_analytics` service if available.

## Status & Expiry
- Expires based on `timeoutMinutes`; heartbeat/renew extend lifecycle.
- Error codes: `SESSION_EXPIRED`, `SESSION_NOT_FOUND` used for clear client handling.

## Best Practices
- Use short `content.text`; attachments handled by upstream message processor/services.
- Client should handle 503 when `sessions` service is not available.
- Respect pagination and days limits to avoid heavy queries.
