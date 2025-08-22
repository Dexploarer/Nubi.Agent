# Service Design Guide

## Purpose
- Encapsulate I/O, scheduling, analytics, moderation, realtime. Keep actions thin.

## Existing Services (see `src/services/`)
- community-management-service
- compose-state-service
- cross-platform-identity-service
- database-memory-service
- elizaos-message-processor
- emotional-state-service
- enhanced-realtime-service
- enhanced-response-generator
- messaging-analytics-service
- personality-evolution-service
- security-filter
- sessions-service
- socket-io-events-service

## Design Rules
- Provide stable service names; expose minimal API surface.
- Timeouts/retries with backoff for external calls; circuit breakers.
- Non-blocking: queue long tasks; avoid blocking message flow.
- Health: expose a simple `isHealthy()` or passive checks for `/health`.

## Observability
- Use `logger`; redact secrets; emit structured events to analytics service.
