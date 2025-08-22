# Healthcheck Policy

## Endpoint
- `/health` returns basic liveness and service presence flags only.

## No Secrets
- Do not include tokens, env values, or internal errors.

## Dependencies
- Optionally include timestamps, version, and service readiness booleans.
