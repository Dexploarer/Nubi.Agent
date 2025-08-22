# Error Handling

## Principles
- Fail fast on invalid env or inputs; return clear errors in routes.
- Catch at boundaries (routes/services); include error codes for clients.

## Logging
- `logger.error` with context but no secrets.

## Retries
- Exponential backoff; circuit breaker after N failures for external services.
