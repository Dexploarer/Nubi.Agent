# Analytics Guide

Reference: `src/services/messaging-analytics-service.ts`.

## What to Track
- Generation time, model params, context usage, token counts if available.
- Sessions analytics endpoints supply daily stats; avoid per-message PII.

## Emission
- Non-blocking; batch or debounce.

## Privacy
- Aggregate metrics; scrub user-identifying data unless opted in.
