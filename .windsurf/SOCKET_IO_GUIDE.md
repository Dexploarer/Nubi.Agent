# Socket.IO Guide

Reference: `src/services/socket-io-events-service.ts`.

## Events
- Define event names centrally; document payload shapes.
- Use rooms per session/user; avoid broadcasting sensitive data.

## Reliability
- Reconnect/backoff strategy; server should handle idempotency.

## Security
- Authenticate where possible; sanitize payloads; rate-limit event bursts.
