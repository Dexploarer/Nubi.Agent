# Performance Budgets

Set explicit targets to control latency, cost, and resource use.

## Providers
- Typical latency: < 50ms; heavy providers < 150ms with caching.
- Memory reads: bound to count<=50 (prefer 10–20). Use `unique: true` where applicable.
- Output: keep `text` short; put raw arrays in `data` trimmed to top-N.

## Actions
- Validate() time: < 5ms (string/entity checks only).
- First token target: < 1s for routine small-model responses; stream for long-form.
- LLM usage: 1 model call per message path unless required; prefer small model when possible.

## Evaluators
- Security evaluator: < 10ms typical; no LLM call by default.
- Others: avoid cascaded LLM chains; sample to <= 33% frequency unless critical.

## Services
- Never block message flow; queue/retry with backoff.
- External calls: timeouts (<= 5s); circuit breaker after N failures.

## Sessions API (see `src/routes/sessions-routes.ts`)
- History pagination: limit<=100 enforced; default limit=50.
- Analytics window: days<=30 enforced; default=7.

## LLM
- TEXT_SMALL: default for classification/routing.
- TEXT_LARGE: only when response quality requires it.
- EMBEDDING: batch requests, exponential backoff on 429/5xx.

## Memory/DB
- Index on sessionId/userId fields used in lookups.
- Avoid N+1: aggregate queries for analytics.

## Telemetry
- Async metrics via `messaging_analytics` service; < 5% CPU overhead target.
